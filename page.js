
"use client";
import {useEffect,useMemo,useState} from "react";

const disclosure = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

function copyText(name, cat, style){
  const opener = [
    `${name} 이거 나만 이제 알았나ㅋㅋ`,
    `요즘 ${name} 자꾸 보여서 봤는데 은근 괜찮네`,
    `이런 게 있었네. ${name}은 좀 탐난다`,
    `처음엔 굳이? 싶었는데 ${name} 쓰는 거 보니까 이해됨`
  ];
  const body = {
    "주방":"매일 쓰는 공간이라 작은 불편 하나만 줄어도 체감이 큰데, 이건 사용법도 단순해서 한 번 두면 계속 쓸 듯.",
    "청소":"청소는 꺼내기 귀찮으면 결국 안 쓰게 되는데, 이런 건 필요한 부분만 바로 끝낼 수 있어서 손이 자주 갈 것 같음.",
    "수납":"집이 갑자기 넓어질 순 없으니까 결국 있는 공간을 덜 답답하게 쓰는 게 현실적. 정리 전후가 확실해서 좋음.",
    "차량":"차에서는 별거 아닌 불편이 계속 반복되니까 이런 작은 아이템이 체감이 큼. 한 번 두면 신경 쓸 일이 줄어드는 타입.",
    "욕실":"욕실은 자주 손봐야 해서 복잡한 것보다 바로 쓰는 게 편함. 이런 건 작은 귀찮음을 계속 줄여주는 느낌.",
    "생활":"별거 아닌데 매번 반복되는 귀찮음을 줄여주는 물건이 결국 제일 잘 쓰이는 것 같음."
  }[cat] || "별거 아닌데 반복되는 귀찮음을 줄여주는 물건이 결국 제일 잘 쓰이는 것 같음.";

  if(style==="B") return `맨날 이 부분 때문에 은근 귀찮았는데 ${name}은 방식이 단순해서 괜찮아 보임.\n\n복잡하게 뭘 바꾸는 게 아니라 불편한 부분만 딱 줄여주는 타입이라 실제로 손이 자주 갈 것 같음.`;
  if(style==="C") return `${name}, 처음 봤을 땐 '이게 뭐가 편하지?' 했는데 쓰는 장면 보니까 바로 이해됨ㅋㅋ\n\n기능이 한눈에 보여서 더 신기하고, 필요했던 사람은 보자마자 탐날 듯.`;
  return `${opener[Math.floor(Math.random()*opener.length)]}\n\n${body}\n별거 아닌데 이런 게 은근 삶의 질 올려주는 듯.`;
}

const replies = [
  "제품 궁금한 분들 있어서 남겨둘게요 👇\n[여기에 파트너스 링크 넣기]",
  "제가 본 제품은 이거예요\n👉 [여기에 파트너스 링크 넣기]",
  "찾아보실 분들은 여기 참고하세요 👇\n[여기에 파트너스 링크 넣기]"
];

function kstDateKey(){
  const now = new Date();
  const k = new Date(now.toLocaleString("en-US",{timeZone:"Asia/Seoul"}));
  // 오전 6시를 날짜 경계로 사용
  if(k.getHours()<6) k.setDate(k.getDate()-1);
  return `${k.getFullYear()}-${String(k.getMonth()+1).padStart(2,"0")}-${String(k.getDate()).padStart(2,"0")}`;
}

export default function Page(){
  const [items,setItems]=useState([]);
  const [selected,setSelected]=useState(null);
  const [style,setStyle]=useState("A");
  const [loading,setLoading]=useState(false);
  const [updatedAt,setUpdatedAt]=useState("");
  const [filter,setFilter]=useState("전체");

  async function refresh(force=true){
    setLoading(true);
    try{
      const r=await fetch(`/api/discover?t=${Date.now()}`,{cache:"no-store"});
      const d=await r.json();
      setItems(d.items||[]);
      setUpdatedAt(d.updatedAt||new Date().toISOString());
      localStorage.setItem("threadshotLastRefreshKey", kstDateKey());
      localStorage.setItem("threadshotCache", JSON.stringify({items:d.items||[],updatedAt:d.updatedAt}));
      if(d.items?.length) setSelected(d.items[0]);
    }finally{setLoading(false);}
  }

  useEffect(()=>{
    const todayKey=kstDateKey();
    const last=localStorage.getItem("threadshotLastRefreshKey");
    const cached=localStorage.getItem("threadshotCache");
    if(cached){
      try{
        const c=JSON.parse(cached);
        setItems(c.items||[]); setUpdatedAt(c.updatedAt||"");
        if(c.items?.length) setSelected(c.items[0]);
      }catch{}
    }
    if(last!==todayKey || !cached) refresh();
  },[]);

  // 앱을 오래 켜둔 경우 10분마다 날짜 경계를 확인.
  useEffect(()=>{
    const id=setInterval(()=>{
      const last=localStorage.getItem("threadshotLastRefreshKey");
      if(last!==kstDateKey()) refresh();
    },10*60*1000);
    return ()=>clearInterval(id);
  },[]);

  const cats=["전체",...Array.from(new Set(items.map(x=>x.category)))];
  const shown=filter==="전체"?items:items.filter(x=>x.category===filter);
  const main=selected?copyText(selected.name,selected.category,style):"";

  async function cp(t){
    await navigator.clipboard.writeText(t);
    alert("복사했습니다.");
  }

  return <main>
    <header className="topbar">
      <div>
        <div className="brand">🔥 <b>ThreadShot V4</b></div>
        <div className="sub">핫쇼핑템 → 쿠팡 확인 → Threads 글/답글</div>
      </div>
      <button className="primary" onClick={()=>refresh()} disabled={loading}>{loading?"새로 찾는 중...":"🔄 새 핫템 찾기"}</button>
    </header>

    <section className="status">
      <span>자동갱신: <b>매일 오전 6시 이후 첫 접속</b></span>
      <span>마지막 업데이트: <b>{updatedAt?new Date(updatedAt).toLocaleString("ko-KR"):"-"}</b></span>
    </section>

    <div className="filters">
      {cats.map(c=><button key={c} className={filter===c?"chip active":"chip"} onClick={()=>setFilter(c)}>{c}</button>)}
    </div>

    <div className="grid">
      <section className="panel">
        <h2>오늘의 핫상품</h2>
        {shown.map((x,i)=><button key={x.name} className={selected?.name===x.name?"card selected":"card"} onClick={()=>setSelected(x)}>
          <div className="cardtop"><strong>{x.name}</strong><span className="score">{x.score}점</span></div>
          <div className="badges">
            <span>{x.category}</span>
            <span className={x.coupang.status==="verified"?"ok":"warn"}>
              {x.coupang.status==="verified"?"쿠팡 자동확인":"쿠팡 최종확인"}
            </span>
          </div>
          <p>{x.why}</p>
        </button>)}
      </section>

      <section className="panel detail">
        {!selected?<div className="empty">상품을 선택하세요.</div>:<>
          <div className="detailHead">
            <div><h1>{selected.name}</h1><p>{selected.why}</p></div>
            <span className="score big">{selected.score}점</span>
          </div>

          <a className="coupangBtn" href={selected.coupang.url} target="_blank" rel="noreferrer">
            쿠팡에서 실제 판매상품 확인
          </a>
          {selected.coupang.status!=="verified" && <div className="warning">
            쿠팡이 자동 검색을 차단한 경우입니다. 위 버튼으로 실제 상품이 있는지 한 번 확인한 뒤 사용하세요.
          </div>}

          <h3>Threads 본문</h3>
          <div className="tabs">
            {["A","B","C"].map((s,i)=><button key={s} className={style===s?"active":""} onClick={()=>setStyle(s)}>
              {["일상형","문제해결형","호기심형"][i]}
            </button>)}
          </div>
          <div className="textBox">{main}</div>
          <button className="copyBtn" onClick={()=>cp(main)}>📋 본문 복사</button>

          <h3>링크 넣을 답글</h3>
          {replies.map((r,i)=><div className="reply" key={i}>
            <div className="textBox">{r}</div>
            <button className="copyBtn" onClick={()=>cp(r)}>📋 답글 복사</button>
          </div>)}

          <h3>파트너스 안내문</h3>
          <div className="textBox">{disclosure}</div>
          <button className="copyBtn" onClick={()=>cp(disclosure)}>📋 안내문 복사</button>
        </>}
      </section>
    </div>
  </main>;
}
