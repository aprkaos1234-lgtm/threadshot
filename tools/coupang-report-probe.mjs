#!/usr/bin/env node
// 쿠팡 파트너스 리포트 API 진단 스크립트.
//
// 실행:  COUPANG_ACCESS_KEY=... COUPANG_SECRET_KEY=... node tools/coupang-report-probe.mjs
// 옵션:  --subid=MYSUB      subId 필터를 함께 시험한다
//        --days=7           조회 일수 (기본 7, 어제까지)
//
// 이 스크립트는 클릭이 0으로 나오는 원인을 세 가지로 갈라준다.
//   에러/인증 문제  → HTTP 401/403 또는 rCode != 0
//   필터/날짜 문제  → HTTP 200인데 data 배열이 비어 있음
//   파싱/집계 문제  → data 배열에 행이 있는데 클릭 필드를 못 찾거나 합계가 0

import {
  fetchReportPage, kstDayRange, gmtSignedDate, sumClicks, formatClickCount,
  CoupangReportError, CLICK_FIELDS
} from "../lib/coupang-report.js";

const args = new Map(process.argv.slice(2)
  .filter(a => a.startsWith("--"))
  .map(a => { const [k, v = "true"] = a.slice(2).split("="); return [k, v]; }));

const subId = args.get("subid") || process.env.COUPANG_SUB_ID || null;
const days  = Number(args.get("days") || 7);

const accessKey = process.env.COUPANG_ACCESS_KEY;
const secretKey = process.env.COUPANG_SECRET_KEY;

function line(){ console.log("-".repeat(72)); }

line();
console.log("[1] 환경 점검");
line();
console.log("COUPANG_ACCESS_KEY :", accessKey ? `설정됨 (길이 ${accessKey.length}, 앞 4자 ${accessKey.slice(0,4)}…)` : "*** 없음 ***");
console.log("COUPANG_SECRET_KEY :", secretKey ? `설정됨 (길이 ${secretKey.length})` : "*** 없음 ***");
console.log("subId 필터         :", subId ? `"${subId}"` : "없음 (전체 조회)");
if(!accessKey || !secretKey){
  console.log("\n키가 없으면 여기서 더 진행할 수 없습니다. 로컬과 배포 환경 양쪽에 모두 설정했는지 확인하세요.");
  process.exit(2);
}

line();
console.log("[2] 시각/날짜 점검");
line();
const now = new Date();
const {startDate, endDate} = kstDayRange({days}, now);
console.log("로컬 타임존        :", Intl.DateTimeFormat().resolvedOptions().timeZone, `(offset ${-now.getTimezoneOffset()/60}h)`);
console.log("현재 UTC           :", now.toISOString());
console.log("현재 KST           :", new Date(now.getTime()+9*3600*1000).toISOString().replace("Z"," (KST)"));
console.log("signed-date (GMT)  :", gmtSignedDate(now), "← yyMMddTHHmmssZ, GMT여야 함");
console.log("조회 범위 (KST)    :", startDate, "~", endDate, `(${days}일, 어제까지)`);
if(startDate === endDate) console.log("  ⚠ 시작일과 종료일이 같습니다. 하루치만 조회됩니다.");

// 서버 시각과 5분 이상 벌어지면 쿠팡이 서명을 거부한다.
try{
  const r = await fetch("https://api-gateway.coupang.com/", {method:"HEAD"});
  const serverDate = r.headers.get("date");
  if(serverDate){
    const skew = Math.abs(new Date(serverDate).getTime() - now.getTime())/1000;
    console.log("서버 시각          :", serverDate, `| 시차 ${skew.toFixed(0)}초`,
      skew > 300 ? "← ⚠ 5분 초과. 서명이 거부됩니다." : "← 정상 범위");
  }
}catch{ console.log("서버 시각          : 확인 불가(무시 가능)"); }

async function probe(kind, useSubId){
  line();
  console.log(`[3] ${kind} 리포트 호출 ${useSubId ? `(subId="${useSubId}" 필터 적용)` : "(필터 없음)"}`);
  line();
  try{
    const {status, raw, json, url, signedDate, signMessage} =
      await fetchReportPage({kind, startDate, endDate, subId: useSubId || null, accessKey, secretKey});
    console.log("URL          :", url);
    console.log("signed-date  :", signedDate);
    console.log("서명 대상    :", signMessage);
    console.log("HTTP STATUS  :", status);
    console.log("원본 응답 JSON:");
    console.log(raw);

    const rows = json?.data ?? null;
    console.log("\n-- 집계 --");
    if(!Array.isArray(rows)){
      console.log("data가 배열이 아닙니다. 실제 최상위 키:", json ? Object.keys(json).join(", ") : "(없음)");
      return {kind, useSubId, verdict: "응답 구조 불일치", rows: null};
    }
    console.log("data 행 수   :", rows.length);
    if(rows.length){
      console.log("첫 행 키     :", Object.keys(rows[0]).join(", "));
      console.log("첫 행        :", JSON.stringify(rows[0]));
      const subIds = [...new Set(rows.map(r => r.subId ?? "(없음)"))];
      console.log("응답 내 subId:", subIds.join(", "));
    }
    const agg = sumClicks(rows);
    console.log("사용한 필드  :", agg.field ?? "(없음)", "| 후보:", CLICK_FIELDS.join(", "));
    console.log("클릭 합계    :", formatClickCount(agg.total), agg.reason ? `| ${agg.reason}` : "");

    let verdict;
    if(rows.length === 0)            verdict = "응답이 비어 있음 → 필터/날짜 문제";
    else if(agg.field === null)      verdict = "행은 있는데 클릭 필드 불일치 → 파싱 버그";
    else if(agg.total === 0)         verdict = "실제로 클릭 0건 (데이터는 정상 수신)";
    else                             verdict = `정상: 클릭 ${agg.total}건`;
    console.log("판정         :", verdict);
    return {kind, useSubId, verdict, rows};
  }catch(e){
    if(e instanceof CoupangReportError){
      console.log("HTTP STATUS  :", e.status ?? "(네트워크 단계에서 실패)");
      console.log("에러         :", e.message);
      if(e.body) console.log("원본 응답    :", e.body);
      const hint = e.status === 401 ? "인증/서명 실패 → 키 값 또는 signed-date 확인"
                 : e.status === 403 ? "권한 없음 → 파트너스 계정에 Open API 권한이 있는지 확인"
                 : e.status === 429 ? "호출 제한 초과 → 잠시 후 재시도"
                 : "인증 문제 가능성";
      console.log("판정         :", `에러 → ${hint}`);
      return {kind, useSubId, verdict: `에러 HTTP ${e.status ?? "-"} → ${hint}`, rows: null};
    }
    throw e;
  }
}

const results = [];
results.push(await probe("clicks", null));
results.push(await probe("orders", null));
if(subId){
  results.push(await probe("clicks", subId));
  const noFilter = results[0], filtered = results[3];
  if(Array.isArray(noFilter.rows) && noFilter.rows.length > 0 && Array.isArray(filtered.rows) && filtered.rows.length === 0){
    line();
    console.log("⚠ subId 없이 조회하면 데이터가 있는데 subId 필터를 걸면 0건입니다.");
    console.log("  파트너스 사이트에서 직접 만든 링크에는 subId가 없습니다. 필터를 제거하세요.");
  }
}

line();
console.log("[4] 최종 요약");
line();
for(const r of results) console.log(`${r.kind}${r.useSubId ? ` (subId=${r.useSubId})` : ""}: ${r.verdict}`);
