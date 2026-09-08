# Message Filter Samples — 사람이 직접 검토할 파일

> **이 파일을 검토하기 전에는 다음 단계(Requirement Pipeline / Baseline / Benchmark)를 실행하지 않는다.**
> 명세 §4. 쓰레기 입력 위에서 정교한 평가를 하지 않는다.

| | |
|---|---|
| 프로젝트 | `/home/user/demo-app` |
| 세션 파일 수 | 3 |
| 적용한 범위 | 전체 이력 |
| 생성 시각 | 2026-09-08T00:51:39.492Z |

검토 방법: 각 샘플의 분류가 **틀렸다면** 그 항목에 메모를 남기고,
`src/filter.js` 의 규칙을 고친 뒤 이 명령을 다시 실행한다 (STEP 4).
`npm test` 가 회귀를 잡아준다.

---

## ⚠️ 이 데이터셋은 가설 검증에 충분하지 않다

- 사람 메시지가 24개뿐이다. 필터 품질을 통계적으로 평가할 수 없다.
- intent-bearing 메시지가 16개뿐이다. Requirement 복구 성능을 비교할 대상이 없다.

명세 §2: *"짧고 단순한 프로젝트의 결과로 IntentGuard 사업성을 판정하지 않는다."*

아래 샘플은 **parser/filter 동작 확인용**으로만 읽는다.

---

## Stage 1 의 알려진 한계 (검토 시 감안할 것)

1. **긴 문서 = 라벨 하나.** 요구사항 20개가 든 기획서 한 통도 버킷 하나로 분류된다.
   Stage 3(Requirement Candidate Extraction)에서 문단 단위로 쪼개기 전까지는 정상이다.
   검토 시 "이 긴 메시지의 라벨이 틀렸다"고 판단하기보다 **노이즈가 섞였는지**만 본다.
2. **규칙 기반이라 어휘에 민감하다.** 한국어 요청 어미(…줘/…하게/…하자)와 정정 표현
   (아니/말고/빼자/됐어)에 의존한다. 본인의 말버릇이 목록에 없으면 UNKNOWN 으로 샌다.
   → **UNKNOWN 섹션을 가장 먼저 볼 것.**
3. **LLM 을 쓰지 않았다 (비용 $0).** 정교한 분류는 Stage 2 이후의 일이다.
   쓰레기 입력 위에 돈을 쓰지 않기 위해 순서를 이렇게 잡았다.

---

## HUMAN_INTENT — 11개 (샘플 11개)

요구사항을 담고 있다고 판단한 메시지. **여기 노이즈가 섞이면 이후 전부 오염된다.**

### HUMAN_INTENT #1

- id: `718ecbb3-44c8-434c-b08c-82bb5ebefe8f`
- time: `2026-03-02T09:00:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
구글 트렌드에서 한국 인기 검색어를 가져와서 쇼핑 상품형 키워드만 골라주는 웹앱을 만들어줘
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #2

- id: `fd72e3e9-6234-460c-94ca-d8b8ab03efbd`
- time: `2026-03-02T09:45:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
무료 사용자는 월 3회만 분석할 수 있게 제한해
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #3

- id: `38f97d3c-e3aa-4e9e-9e5c-b89c338d167e`
- time: `2026-03-02T10:05:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
결과 카드에 쿠팡 검색 링크를 같이 넣어줘
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #4

- id: `8e1c47b1-285d-4bbf-8d16-e7c035bac401`
- time: `2026-03-02T11:08:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
로그인은 일단 이메일만 지원하자
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #5

- id: `dfefe9dd-a63c-4e7b-ae3e-0820b1a1e22c`
- time: `2026-03-02T11:38:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
그리고 분석 결과를 공유할 수 있는 링크 생성 기능도 추가해줘
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #6

- id: `23517887-59f4-4e57-8eb2-94ffed40f78c`
- time: `2026-03-02T12:00:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
타임아웃 늘리고 재시도 3번 하게 해줘
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #7

- id: `38ab3101-95c0-4304-8f71-6fedc12becc6`
- time: `2026-04-11T10:00:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
테스트하는 동안에는 월 3회 제한 풀어줘. 계속 걸려서 확인이 안 돼
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #8

- id: `f6195954-9961-4237-89b7-03723a56cb62`
- time: `2026-04-11T11:43:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
상단에 마지막 업데이트 시간 표시해줘
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #9

- id: `ad9c94cc-4daf-43e7-9de6-2b0882adbd3a`
- time: `2026-05-20T09:37:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
한국시간 오전 6시를 하루 갱신 기준으로 써줘
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #10

- id: `28a108a9-3dad-4966-a5a3-51f03e8d407c`
- time: `2026-05-20T09:57:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
앱 켜둔 상태면 10분마다 날짜 경계 확인해서 자동 갱신하게
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #11

- id: `2b2d0920-4310-44e9-a7a1-1e37a13202df`
- time: `2026-05-20T10:45:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
쿠팡이 자동 요청 막으면 "쿠팡 최종확인"으로 표시해줘
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

---

## HUMAN_CORRECTION — 5개 (샘플 5개)

이전 지시를 뒤집거나 되돌리는 메시지. IntentGuard 가설의 핵심 입력.

### HUMAN_CORRECTION #1

- id: `362c408e-5b08-4bca-a0ec-66a7117df0ae`
- time: `2026-04-11T10:45:00.000Z`
- confidence: 0.8
- rule: correction marker

```text
아까 만든 공유 링크 기능은 빼자. 스팸 신고가 들어올 것 같아
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_CORRECTION #2

- id: `2cb27240-057b-4a2f-a945-3f30569e619a`
- time: `2026-05-20T08:30:00.000Z`
- confidence: 0.8
- rule: correction marker

```text
출시 준비하자. 무료 사용자 제한 다시 월 3회로 되돌려줘
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_CORRECTION #3

- id: `f16068ae-6bdb-4f41-bc9d-5d056c7c03cf`
- time: `2026-05-20T08:45:00.000Z`
- confidence: 0.8
- rule: correction marker

```text
아니 3회 말고 5회로 하자. 초반엔 좀 넉넉하게 주는 게 나을 것 같아
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_CORRECTION #4

- id: `adcce67c-1b16-481e-aafc-495ec044405b`
- time: `2026-05-20T10:35:00.000Z`
- confidence: 0.45
- rule: short message, no vocabulary hit; soft rejection — but "됐어" can also mean "it works now"; needs context

```text
아직은 됐어
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_CORRECTION #5

- id: `5329b14e-fe8d-43a3-b150-5419699d94df`
- time: `2026-05-20T11:26:00.000Z`
- confidence: 0.8
- rule: correction marker

```text
이메일 로그인 말고 카카오 로그인으로 바꾸자
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

---

## HUMAN_CONFIRMATION — 3개 (샘플 3개)

독립 Requirement 로 만들면 안 되는 승인 발화. `context_message_ids` 로 직전 맥락과 연결됨.

### HUMAN_CONFIRMATION #1

- id: `24b1a4be-01b5-47f3-aed1-1cded3990ea8`
- time: `2026-03-02T10:08:00.000Z`
- confidence: 0.8
- rule: short affirmative — must be read against prior context
- context: `fd72e3e9-6234-460c-94ca-d8b8ab03efbd`, `38f97d3c-e3aa-4e9e-9e5c-b89c338d167e`

```text
ㅇㅇ
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_CONFIRMATION #2

- id: `e77a571e-c27a-4322-92c7-7d4df2d60099`
- time: `2026-04-11T10:47:00.000Z`
- confidence: 0.8
- rule: short affirmative — must be read against prior context
- context: `38ab3101-95c0-4304-8f71-6fedc12becc6`, `362c408e-5b08-4bca-a0ec-66a7117df0ae`

```text
ㅇㅋ
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_CONFIRMATION #3

- id: `d5eb4e9e-fbda-40f1-b45b-36558a754a5b`
- time: `2026-05-20T08:47:00.000Z`
- confidence: 0.8
- rule: short affirmative — must be read against prior context
- context: `2cb27240-057b-4a2f-a945-3f30569e619a`, `f16068ae-6bdb-4f41-bc9d-5d056c7c03cf`

```text
네
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

---

## HUMAN_CONTEXT — 2개 (샘플 2개)

질문/설명/아이디어. ACTIVE Requirement 가 되어서는 안 된다.

### HUMAN_CONTEXT #1

- id: `68519b42-6118-41c7-8458-bdfc6e16f806`
- time: `2026-04-11T11:12:00.000Z`
- confidence: 0.7
- rule: question shape — not an active requirement on its own

```text
이거 왜 안 되지?
export async function GET() {
  const res = await fetch(TRENDS_URL, { next: { revalidate: 0 } });
  const xml = await res.text();
  const items = parseRss(xml);
  return Response.json({ items });
}
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_CONTEXT #2

- id: `be579133-7623-4560-adbe-479a9509f6a6`
- time: `2026-05-20T10:32:00.000Z`
- confidence: 0.7
- rule: short message, no vocabulary hit; question shape — not an active requirement on its own

```text
팀 기능도 나중에 만들까?
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

---

## LOW_INFORMATION — 3개 (샘플 3개)

"계속", "ㅇㅋ" 류. 독립 Requirement 금지.

### LOW_INFORMATION #1

- id: `f13749da-2763-4f5a-acb6-e5f7b71ee328`
- time: `2026-03-02T11:40:00.000Z`
- confidence: 0.85
- rule: continuation / filler
- context: `8e1c47b1-285d-4bbf-8d16-e7c035bac401`, `dfefe9dd-a63c-4e7b-ae3e-0820b1a1e22c`

```text
계속
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### LOW_INFORMATION #2

- id: `84630a17-73ae-457b-b6e7-504537956129`
- time: `2026-04-11T11:13:00.000Z`
- confidence: 0.85
- rule: continuation / filler
- context: `e77a571e-c27a-4322-92c7-7d4df2d60099`, `68519b42-6118-41c7-8458-bdfc6e16f806`

```text
음
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### LOW_INFORMATION #3

- id: `f9fefb17-6a45-483c-a9c2-311fe03f95ac`
- time: `2026-05-20T10:46:00.000Z`
- confidence: 0.7
- rule: too short to carry intent
- context: `adcce67c-1b16-481e-aafc-495ec044405b`, `2b2d0920-4310-44e9-a7a1-1e37a13202df`

```text
.
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

---

## UNKNOWN — 0개 (샘플 0개)

**가장 중요한 검토 대상.** 규칙이 판단하지 못한 것들.

_해당 없음._

---

## 제외된 Noise 샘플 — 18개 중 30개

여기에 **진짜 사람이 쓴 요구사항이 섞여 있으면 그것이 가장 심각한 오류다.**
(누락은 Precision 지표에 잡히지 않는다.)

### NOISE #1 — TOOL_OR_SYSTEM_CONTENT

- id: `2ba2e509-38b0-4706-b123-eb8fc4790779` · time: `2026-03-02T09:00:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #2 — ERROR_LOG

- id: `6cfdc412-985c-4509-8da5-9b0eb1f77036` · time: `2026-03-02T11:55:00.000Z` · route: `human` · raw 334 chars
- rule: stack trace / error output shape

```text
Traceback (most recent call last):
  File "server/trends.py", line 42, in fetch
    resp = requests.get(url, timeout=5)
  File "/usr/lib/python3/requests/api.py", line 73, in get
    return request("get", url, **kwargs)
requests.exceptions.ConnectionError: HTTPSConnectionPool(host='trends.google.com', port=443): Max retries exceeded
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #3 — TOOL_OR_SYSTEM_CONTENT

- id: `79dd4ff9-4ccd-455f-be1c-ba5676afa56d` · time: `2026-03-02T09:45:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #4 — TOOL_OR_SYSTEM_CONTENT

- id: `6c4781cb-0e41-4fed-9778-42bf0b0bb2bd` · time: `2026-03-02T10:05:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #5 — TOOL_OR_SYSTEM_CONTENT

- id: `660a0033-f3fb-4a58-8ed8-8edd977a812f` · time: `2026-03-02T11:08:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #6 — TOOL_OR_SYSTEM_CONTENT

- id: `c48b8ab4-8e98-4662-bd08-efd77f9366da` · time: `2026-03-02T11:38:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #7 — TOOL_OR_SYSTEM_CONTENT

- id: `a0a78d9a-b1c7-4dd0-89e3-397f11dd706a` · time: `2026-03-02T12:00:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #8 — TOOL_OR_SYSTEM_CONTENT

- id: `30bf63df-b866-4754-b1ec-15ba9fecb29c` · time: `2026-04-11T10:00:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #9 — TOOL_OR_SYSTEM_CONTENT

- id: `af6b8fe7-43f3-4e54-ab11-b37b8697505c` · time: `2026-04-11T10:05:00.000Z` · route: `human` · raw 106 chars
- rule: system/slash/wake envelope: ^\/[A-Za-z0-9_:-]+\s*$

```text
/clear
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #10 — TOOL_OR_SYSTEM_CONTENT

- id: `65248b3e-a7fc-4ebb-bacf-240d87267c05` · time: `2026-04-11T10:45:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #11 — TOOL_OR_SYSTEM_CONTENT

- id: `d5115341-0895-4051-8ec9-6f973d711d7d` · time: `2026-04-11T10:47:00.000Z` · route: `sidechain` · raw 73 chars
- rule: isSidechain=true (sub-agent)

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #12 — TOOL_OR_SYSTEM_CONTENT

- id: `f41da0bc-d041-489c-9700-ea3b649eb492` · time: `2026-04-11T11:12:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #13 — TOOL_OR_SYSTEM_CONTENT

- id: `8fac104a-8a7f-4c06-b5eb-1cd59355a93e` · time: `2026-04-11T11:43:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #14 — TOOL_OR_SYSTEM_CONTENT

- id: `ecd329a9-6ef0-4c5a-b71b-4275cc1bc2a1` · time: `2026-05-20T08:30:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #15 — TOOL_OR_SYSTEM_CONTENT

- id: `01317be3-4f12-4640-97d5-1f23e1212838` · time: `2026-05-20T08:45:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #16 — TOOL_OR_SYSTEM_CONTENT

- id: `c5358f47-1abd-4387-9dc6-07e7213a3531` · time: `2026-05-20T09:37:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #17 — TOOL_OR_SYSTEM_CONTENT

- id: `b065d440-3500-4e53-9d18-c12957d45234` · time: `2026-05-20T09:57:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #18 — TOOL_OR_SYSTEM_CONTENT

- id: `4b862902-2d41-4ddf-a6f0-6c94b055901e` · time: `2026-05-20T11:26:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

---

## AMBIGUOUS / 경계 사례

confidence <= 0.6 인 human 분류 항목. 규칙이 확신하지 못한 것들이다.

### AMBIGUOUS #1 — HUMAN_CORRECTION (conf 0.45)

- id: `adcce67c-1b16-481e-aafc-495ec044405b` · rule: short message, no vocabulary hit; soft rejection — but "됐어" can also mean "it works now"; needs context

```text
아직은 됐어
```
