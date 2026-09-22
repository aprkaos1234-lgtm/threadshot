// 쿠팡 파트너스 Open API 리포트(클릭/주문) 클라이언트.
//
// 설계 원칙 3가지:
//  1. 에러를 절대 삼키지 않는다. 401/403/429/서명실패는 CoupangReportError로 던진다.
//  2. 데이터가 없을 때 0이 아니라 null을 반환한다. "0 클릭"과 "데이터 없음"은 다른 상태다.
//  3. 날짜 범위는 항상 KST 기준으로 계산한다. 서버가 UTC로 돌아도 결과가 흔들리지 않는다.

import crypto from "node:crypto";

const HOST = "https://api-gateway.coupang.com";
const BASE = "/v2/providers/affiliate_open_api/apis/openapi";

// 응답에서 클릭 수가 담겨 나올 수 있는 필드명 후보. 앞에서부터 처음 발견된 것을 사용한다.
export const CLICK_FIELDS = ["clickCount", "clicks", "click", "clickCnt"];

export class CoupangReportError extends Error {
  constructor(message, {status = null, body = null, cause = null} = {}){
    super(message);
    this.name = "CoupangReportError";
    this.status = status;
    this.body = body;
    if(cause) this.cause = cause;
  }
}

// 쿠팡 서명 규격: signed-date는 GMT 기준 yyMMddTHHmmssZ.
// 로컬 타임존이 KST여도 반드시 UTC 값으로 만들어야 한다.
export function gmtSignedDate(date = new Date()){
  const p = n => String(n).padStart(2, "0");
  return `${p(date.getUTCFullYear() % 100)}${p(date.getUTCMonth()+1)}${p(date.getUTCDate())}`
       + `T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`;
}

// 서명 대상 문자열 = signed-date + METHOD + path + query(물음표 제외).
// query는 실제로 전송하는 문자열과 순서까지 완전히 같아야 한다.
export function buildAuthorization({method, path, query, accessKey, secretKey, date = new Date()}){
  if(!accessKey || !secretKey){
    throw new CoupangReportError(
      "쿠팡 파트너스 API 키가 없습니다. COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 환경변수를 확인하세요."
    );
  }
  const signedDate = gmtSignedDate(date);
  const message = signedDate + method + path + query;
  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("hex");
  return {
    header: `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`,
    signedDate,
    message
  };
}

// KST 기준 날짜 범위. 기본값은 "어제까지 최근 7일".
// 쿠팡 리포트는 당일 데이터가 비어 있는 경우가 많아 오늘을 끝으로 잡으면 안 된다.
export function kstDayRange({days = 7, endOffsetDays = -1} = {}, now = new Date()){
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const ymd = offset => {
    const d = new Date(now.getTime() + KST_OFFSET_MS + offset * 86400000);
    const p = n => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}`;
  };
  return {
    startDate: ymd(endOffsetDays - days + 1),
    endDate: ymd(endOffsetDays)
  };
}

// 리포트 1페이지를 호출한다. 실패는 전부 던진다 — 조용히 빈 배열을 돌려주지 않는다.
export async function fetchReportPage({
  kind = "clicks",
  startDate,
  endDate,
  page = 1,
  subId = null,
  accessKey = process.env.COUPANG_ACCESS_KEY,
  secretKey = process.env.COUPANG_SECRET_KEY,
  fetchImpl = fetch
} = {}){
  if(kind !== "clicks" && kind !== "orders"){
    throw new CoupangReportError(`알 수 없는 리포트 종류: ${kind}`);
  }
  const path = `${BASE}/v1/reports/${kind}`;
  const params = [`startDate=${startDate}`, `endDate=${endDate}`, `page=${page}`];
  // subId는 값이 있을 때만 붙인다. 빈 문자열을 붙이면 "subId가 빈 링크"만 조회돼 0건이 된다.
  if(subId) params.push(`subId=${encodeURIComponent(subId)}`);
  const query = params.join("&");

  const {header, signedDate, message} = buildAuthorization({
    method: "GET", path, query, accessKey, secretKey
  });
  const url = `${HOST}${path}?${query}`;

  let res, raw;
  try{
    res = await fetchImpl(url, {
      method: "GET",
      headers: {Authorization: header, "Content-Type": "application/json;charset=UTF-8"},
      cache: "no-store"
    });
    raw = await res.text();
  }catch(e){
    throw new CoupangReportError(`쿠팡 리포트 API 네트워크 오류: ${e.message}`, {cause: e});
  }

  if(!res.ok){
    throw new CoupangReportError(
      `쿠팡 리포트 API 오류 HTTP ${res.status}`,
      {status: res.status, body: raw}
    );
  }

  let json;
  try{
    json = JSON.parse(raw);
  }catch(e){
    throw new CoupangReportError("쿠팡 리포트 응답이 JSON이 아닙니다.", {status: res.status, body: raw, cause: e});
  }

  // rCode가 0이 아니면 HTTP 200이라도 실패다. 이걸 무시하면 조용히 0건이 된다.
  if(json && json.rCode !== undefined && String(json.rCode) !== "0"){
    throw new CoupangReportError(
      `쿠팡 리포트 API가 오류 코드를 반환했습니다: rCode=${json.rCode} rMessage=${json.rMessage ?? ""}`,
      {status: res.status, body: raw}
    );
  }

  return {status: res.status, raw, json, url, signedDate, signMessage: message};
}

// 응답 행에서 클릭 수를 합산한다.
// 행이 아예 없으면 null(데이터 없음)을 반환한다 — 0으로 뭉개지 않는다.
export function sumClicks(rows, {subId = null} = {}){
  if(!Array.isArray(rows) || rows.length === 0){
    return {total: null, field: null, rowCount: 0, reason: "응답에 행이 없습니다(데이터 없음)."};
  }
  const target = subId ? rows.filter(r => String(r.subId ?? "") === String(subId)) : rows;
  if(target.length === 0){
    return {total: null, field: null, rowCount: 0, reason: `subId="${subId}"와 일치하는 행이 없습니다(데이터 없음).`};
  }
  const field = CLICK_FIELDS.find(f => target.some(r => r[f] !== undefined && r[f] !== null));
  if(!field){
    return {
      total: null, field: null, rowCount: target.length,
      reason: `행은 있지만 클릭 필드를 찾지 못했습니다. 실제 키: ${Object.keys(target[0]).join(", ")}`
    };
  }
  const total = target.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
  return {total, field, rowCount: target.length, reason: null};
}

// 화면 표시용. null은 0이 아니라 "데이터 없음"으로 보여준다.
export function formatClickCount(total){
  return total === null || total === undefined ? "데이터 없음" : String(total);
}
