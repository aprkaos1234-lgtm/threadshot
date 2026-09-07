# Message Filter Samples — 사람이 직접 검토할 파일

> **이 파일을 검토하기 전에는 다음 단계(Requirement Pipeline / Baseline / Benchmark)를 실행하지 않는다.**
> 명세 §4. 쓰레기 입력 위에서 정교한 평가를 하지 않는다.

| | |
|---|---|
| 프로젝트 | `/home/user/demo-app` |
| 세션 파일 수 | 3 |
| 적용한 범위 | 전체 이력 |
| 생성 시각 | 2026-09-07T15:03:40.811Z |

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

- id: `370a9cbf-b396-49e3-bbdb-dcfe11dcfbf9`
- time: `2026-03-02T09:00:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
구글 트렌드에서 한국 인기 검색어를 가져와서 쇼핑 상품형 키워드만 골라주는 웹앱을 만들어줘
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #2

- id: `b99ecd82-2552-463f-990e-aa4c9e381484`
- time: `2026-03-02T09:45:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
무료 사용자는 월 3회만 분석할 수 있게 제한해
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #3

- id: `1674085a-9eb1-44c5-aacc-90d0acc49e69`
- time: `2026-03-02T10:05:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
결과 카드에 쿠팡 검색 링크를 같이 넣어줘
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #4

- id: `fe760999-7b5d-49c2-9a43-098b0f30c2f1`
- time: `2026-03-02T11:08:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
로그인은 일단 이메일만 지원하자
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #5

- id: `c569acbb-af5b-44c9-a5d8-d9b9f39f513f`
- time: `2026-03-02T11:38:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
그리고 분석 결과를 공유할 수 있는 링크 생성 기능도 추가해줘
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #6

- id: `1e337b0a-4caf-430b-8923-72ff32f52b0b`
- time: `2026-03-02T12:00:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
타임아웃 늘리고 재시도 3번 하게 해줘
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #7

- id: `8bfd0d1d-29f8-49e7-8a69-4b91fa14e89d`
- time: `2026-04-11T10:00:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
테스트하는 동안에는 월 3회 제한 풀어줘. 계속 걸려서 확인이 안 돼
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #8

- id: `998504bf-8979-408c-b9f5-5d298564fd17`
- time: `2026-04-11T11:43:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
상단에 마지막 업데이트 시간 표시해줘
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #9

- id: `b68696ac-c94e-4da8-960b-927a824b0ce5`
- time: `2026-05-20T09:37:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
한국시간 오전 6시를 하루 갱신 기준으로 써줘
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #10

- id: `bc9cdf4d-478f-40e3-9256-e688dfb21ab9`
- time: `2026-05-20T09:57:00.000Z`
- confidence: 0.8
- rule: requirement/imperative marker

```text
앱 켜둔 상태면 10분마다 날짜 경계 확인해서 자동 갱신하게
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_INTENT #11

- id: `ab6b6f5d-1440-4543-a3e8-079f744363ce`
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

- id: `e7ded08a-e286-47e6-9642-c054b6dea693`
- time: `2026-04-11T10:45:00.000Z`
- confidence: 0.8
- rule: correction marker

```text
아까 만든 공유 링크 기능은 빼자. 스팸 신고가 들어올 것 같아
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_CORRECTION #2

- id: `3733ba3c-5f9e-4443-84c7-a7e73ae69e21`
- time: `2026-05-20T08:30:00.000Z`
- confidence: 0.8
- rule: correction marker

```text
출시 준비하자. 무료 사용자 제한 다시 월 3회로 되돌려줘
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_CORRECTION #3

- id: `3924371c-1d42-4808-96b6-c5dcc7a31267`
- time: `2026-05-20T08:45:00.000Z`
- confidence: 0.8
- rule: correction marker

```text
아니 3회 말고 5회로 하자. 초반엔 좀 넉넉하게 주는 게 나을 것 같아
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_CORRECTION #4

- id: `7d903f33-8e08-4af3-bde0-b88d39d83795`
- time: `2026-05-20T10:35:00.000Z`
- confidence: 0.45
- rule: short message, no vocabulary hit; soft rejection — but "됐어" can also mean "it works now"; needs context

```text
아직은 됐어
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_CORRECTION #5

- id: `4908ea2b-07a5-4e2e-ac81-7c3223995284`
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

- id: `d977a873-6b8c-4ca9-aaef-d669e4489ff1`
- time: `2026-03-02T10:08:00.000Z`
- confidence: 0.8
- rule: short affirmative — must be read against prior context
- context: `b99ecd82-2552-463f-990e-aa4c9e381484`, `1674085a-9eb1-44c5-aacc-90d0acc49e69`

```text
ㅇㅇ
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_CONFIRMATION #2

- id: `af9d1cb6-ab35-40cc-9ac1-3e57cdabfac2`
- time: `2026-04-11T10:47:00.000Z`
- confidence: 0.8
- rule: short affirmative — must be read against prior context
- context: `8bfd0d1d-29f8-49e7-8a69-4b91fa14e89d`, `e7ded08a-e286-47e6-9642-c054b6dea693`

```text
ㅇㅋ
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### HUMAN_CONFIRMATION #3

- id: `213e8226-a9f9-4b57-b5e1-c6268be88ff4`
- time: `2026-05-20T08:47:00.000Z`
- confidence: 0.8
- rule: short affirmative — must be read against prior context
- context: `3733ba3c-5f9e-4443-84c7-a7e73ae69e21`, `3924371c-1d42-4808-96b6-c5dcc7a31267`

```text
네
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

---

## HUMAN_CONTEXT — 2개 (샘플 2개)

질문/설명/아이디어. ACTIVE Requirement 가 되어서는 안 된다.

### HUMAN_CONTEXT #1

- id: `682ff4b2-6548-46df-996d-205ea8989db9`
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

- id: `d8790d2d-b952-491e-b3de-c675b45f2352`
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

- id: `9a20cc14-ce60-4570-ad38-90ef018920b0`
- time: `2026-03-02T11:40:00.000Z`
- confidence: 0.85
- rule: continuation / filler
- context: `fe760999-7b5d-49c2-9a43-098b0f30c2f1`, `c569acbb-af5b-44c9-a5d8-d9b9f39f513f`

```text
계속
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### LOW_INFORMATION #2

- id: `97a6de14-4f99-42a3-98fe-aa1e4f6f7d67`
- time: `2026-04-11T11:13:00.000Z`
- confidence: 0.85
- rule: continuation / filler
- context: `af9d1cb6-ab35-40cc-9ac1-3e57cdabfac2`, `682ff4b2-6548-46df-996d-205ea8989db9`

```text
음
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

### LOW_INFORMATION #3

- id: `e030195e-61d6-46ce-9641-73847914470a`
- time: `2026-05-20T10:46:00.000Z`
- confidence: 0.7
- rule: too short to carry intent
- context: `7d903f33-8e08-4af3-bde0-b88d39d83795`, `ab6b6f5d-1440-4543-a3e8-079f744363ce`

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

- id: `45c95ca3-01f9-4866-a388-3534b3564b74` · time: `2026-03-02T09:00:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #2 — ERROR_LOG

- id: `8f63c10d-7023-4ee5-8f77-e44a4dbe1124` · time: `2026-03-02T11:55:00.000Z` · route: `human` · raw 334 chars
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

- id: `4b2dacbf-0be9-4020-ad58-0b3a6f9fe7ad` · time: `2026-03-02T09:45:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #4 — TOOL_OR_SYSTEM_CONTENT

- id: `0c07058b-b86a-43a5-92e5-17af23a72311` · time: `2026-03-02T10:05:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #5 — TOOL_OR_SYSTEM_CONTENT

- id: `166ba2eb-f907-488f-9992-9ca5c4b23312` · time: `2026-03-02T11:08:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #6 — TOOL_OR_SYSTEM_CONTENT

- id: `83464ab6-c9e9-487c-ae8f-620b32a173f1` · time: `2026-03-02T11:38:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #7 — TOOL_OR_SYSTEM_CONTENT

- id: `18beea84-c567-438b-af68-fc64465718a5` · time: `2026-03-02T12:00:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #8 — TOOL_OR_SYSTEM_CONTENT

- id: `b36e705a-070b-4e24-bd94-c5f0459f1513` · time: `2026-04-11T10:00:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #9 — TOOL_OR_SYSTEM_CONTENT

- id: `a4e28707-56c3-4644-9f87-1fe7846dced3` · time: `2026-04-11T10:05:00.000Z` · route: `human` · raw 106 chars
- rule: system/slash/wake envelope: ^\/[A-Za-z0-9_:-]+\s*$

```text
/clear
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #10 — TOOL_OR_SYSTEM_CONTENT

- id: `a4aa271c-e9a0-43cb-99b7-91871feb681a` · time: `2026-04-11T10:45:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #11 — TOOL_OR_SYSTEM_CONTENT

- id: `8d607915-4ba4-4441-87d2-008f786c8b9d` · time: `2026-04-11T10:47:00.000Z` · route: `sidechain` · raw 73 chars
- rule: isSidechain=true (sub-agent)

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #12 — TOOL_OR_SYSTEM_CONTENT

- id: `1fe0b9cc-c5e8-4549-9695-658e7b3a9901` · time: `2026-04-11T11:12:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #13 — TOOL_OR_SYSTEM_CONTENT

- id: `556b927f-fb40-4c24-bb57-a0ef3bf7bea8` · time: `2026-04-11T11:43:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #14 — TOOL_OR_SYSTEM_CONTENT

- id: `7922e76f-2699-44e0-bc83-5d3700a7b3bf` · time: `2026-05-20T08:30:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #15 — TOOL_OR_SYSTEM_CONTENT

- id: `b9c5c567-5555-4ce6-8aa6-1623329b632d` · time: `2026-05-20T08:45:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #16 — TOOL_OR_SYSTEM_CONTENT

- id: `fadd2aeb-d3ff-4651-895f-324c0d7c024b` · time: `2026-05-20T09:37:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #17 — TOOL_OR_SYSTEM_CONTENT

- id: `9510a007-0aab-46a4-a8e4-61bfa535ca0c` · time: `2026-05-20T09:57:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #18 — TOOL_OR_SYSTEM_CONTENT

- id: `4f8f7efb-50da-422e-8951-615bf22ea73e` · time: `2026-05-20T11:26:00.000Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

---

## AMBIGUOUS / 경계 사례

confidence <= 0.6 인 human 분류 항목. 규칙이 확신하지 못한 것들이다.

### AMBIGUOUS #1 — HUMAN_CORRECTION (conf 0.45)

- id: `7d903f33-8e08-4af3-bde0-b88d39d83795` · rule: short message, no vocabulary hit; soft rejection — but "됐어" can also mean "it works now"; needs context

```text
아직은 됐어
```
