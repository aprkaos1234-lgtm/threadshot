
import { XMLParser } from "fast-xml-parser";
import * as cheerio from "cheerio";

const FALLBACK = [
  ["냉장고 계란 자동 롤링 트레이","주방",94,"움직임이 보여 짧은 영상에 강함"],
  ["싱크대 물막이 실리콘 가드","주방",93,"물 튀는 문제의 전후 차이가 큼"],
  ["틈새 청소 브러시 세트","청소",92,"창틀·싱크대 틈새처럼 반복되는 불편 해결형"],
  ["회전식 양념통 정리대","수납",91,"정리 전후가 직관적"],
  ["무선 미니 진공청소기","청소",90,"차량·책상·소파 등 활용 장면이 많음"],
  ["다단 공간절약 옷걸이","수납",89,"좁은 옷장 전후 비교가 확실함"],
  ["접이식 실리콘 음식물 쓰레기통","주방",88,"작은 주방 불편을 바로 해결"],
  ["휴대용 보풀 제거기","생활",87,"사용 전후 비교가 즉시 보임"],
  ["차량용 틈새 수납함","차량",85,"좌석 틈새 낙하 문제 해결형"],
  ["배수구 머리카락 거름망","욕실",84,"저가·반복 불편 해결형"],
  ["전자레인지 실리콘 찜기","주방",83,"짧은 조리·간편함을 보여주기 쉬움"],
  ["수세미 디스펜서 일체형","주방",82,"설거지 동선 단축이 직관적"]
];

const SHOP_HINTS = [
  "청소기","선풍기","제습기","가습기","텀블러","보조배터리","이어폰",
  "키보드","마우스","우산","캠핑","수납","정리","주방","청소","육아",
  "차량","자동차","세척","보관","냉감","쿨링","모기","빨래","건조",
  "트레이","브러시","실리콘","거치대","정리함","수납함","찜기","디스펜서"
];

function coupangSearchUrl(q){
  return "https://www.coupang.com/np/search?q=" + encodeURIComponent(q);
}

async function fetchGoogleTrends(){
  try{
    const r = await fetch("https://trends.google.com/trending/rss?geo=KR", {
      cache: "no-store",
      headers: {"user-agent":"Mozilla/5.0"}
    });
    if(!r.ok) return [];
    const xml = await r.text();
    const parser = new XMLParser({ignoreAttributes:false});
    const obj = parser.parse(xml);
    let items = obj?.rss?.channel?.item || [];
    if(!Array.isArray(items)) items = [items];
    return items.map(x=>x.title).filter(Boolean).slice(0,40);
  }catch{
    return [];
  }
}

async function verifyCoupang(query){
  const url = coupangSearchUrl(query);
  try{
    const r = await fetch(url, {
      cache:"no-store",
      redirect:"follow",
      headers:{
        "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        "accept-language":"ko-KR,ko;q=0.9,en;q=0.8"
      }
    });
    const html = await r.text();
    const $ = cheerio.load(html);
    const hasProduct = $('a[href*="/vp/products/"]').length > 0 ||
                       html.includes("search-product") ||
                       html.includes("productId");
    return {status: hasProduct ? "verified" : "review", url};
  }catch{
    return {status:"review", url};
  }
}

function categoryFromName(name){
  if(/주방|싱크|냉장고|계란|찜기|수세미|양념/.test(name)) return "주방";
  if(/청소|브러시|진공|먼지/.test(name)) return "청소";
  if(/차량|자동차/.test(name)) return "차량";
  if(/수납|정리|옷걸이/.test(name)) return "수납";
  if(/욕실|배수구/.test(name)) return "욕실";
  return "생활";
}

function productLikeTrends(trends){
  return trends.filter(t => SHOP_HINTS.some(h => String(t).toLowerCase().includes(h.toLowerCase())));
}

export async function discoverItems(){
  const trends = await fetchGoogleTrends();
  const dynamic = productLikeTrends(trends).slice(0,6).map((name,idx)=>[
    name, categoryFromName(name), Math.max(86, 98-idx), "Google Trends 한국 급상승 키워드에서 포착"
  ]);
  const merged = [...dynamic, ...FALLBACK];
  const dedup = [];
  const seen = new Set();
  for(const x of merged){
    const k = x[0].replace(/\s+/g,"").toLowerCase();
    if(seen.has(k)) continue;
    seen.add(k); dedup.push(x);
  }

  const checked = [];
  for(const [name,category,score,why] of dedup){
    const coupang = await verifyCoupang(name);
    checked.push({name,category,score,why,coupang});
  }

  // 쿠팡 자동확인 성공 상품 우선.
  // 차단 환경에서도 앱이 비어버리지 않도록 review 후보는 아래에 유지.
  checked.sort((a,b)=>{
    const av=a.coupang.status==="verified"?1:0, bv=b.coupang.status==="verified"?1:0;
    if(av!==bv) return bv-av;
    return b.score-a.score;
  });
  return {trends:trends.slice(0,12), items:checked.slice(0,20)};
}
