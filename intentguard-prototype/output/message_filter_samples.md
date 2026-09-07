# Message Filter Samples — 사람이 직접 검토할 파일

> **이 파일을 검토하기 전에는 다음 단계(Requirement Pipeline / Baseline / Benchmark)를 실행하지 않는다.**
> 명세 §4. 쓰레기 입력 위에서 정교한 평가를 하지 않는다.

| | |
|---|---|
| 프로젝트 | `/home/user/threadshot` |
| 세션 파일 수 | 1 |
| 적용한 범위 | --limit 200 (전체 24개가 한도 이하) |
| 생성 시각 | 2026-09-07T15:03:26.851Z |

검토 방법: 각 샘플의 분류가 **틀렸다면** 그 항목에 메모를 남기고,
`src/filter.js` 의 규칙을 고친 뒤 이 명령을 다시 실행한다 (STEP 4).
`npm test` 가 회귀를 잡아준다.

---

## ⚠️ 이 데이터셋은 가설 검증에 충분하지 않다

- 세션 파일이 1개뿐이다. 여러 세션에 걸친 개발 이력이 아니다 (명세 §2).
- 이력 기간이 0.01일이다. "긴 시간축의 변경/취소/재활성화"가 존재할 수 없는 길이다.
- 사람 메시지가 1개뿐이다. 필터 품질을 통계적으로 평가할 수 없다.
- intent-bearing 메시지가 1개뿐이다. Requirement 복구 성능을 비교할 대상이 없다.

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

## HUMAN_INTENT — 0개 (샘플 0개)

요구사항을 담고 있다고 판단한 메시지. **여기 노이즈가 섞이면 이후 전부 오염된다.**

_해당 없음._

---

## HUMAN_CORRECTION — 1개 (샘플 1개)

이전 지시를 뒤집거나 되돌리는 메시지. IntentGuard 가설의 핵심 입력.

### HUMAN_CORRECTION #1

- id: `6ed19a2e-4f7c-4746-abe6-e5d2acd7ef46`
- time: `2026-09-07T14:53:23.544Z`
- confidence: 0.8
- rule: correction marker

```text
# IntentGuard Validation Prototype — FINAL

## 0. 목적

이 프로젝트는 IntentGuard 제품을 만드는 것이 아니다.

단 하나의 가설만 검증한다.

"Claude Code의 장기간 개발 기록에서 현재 유효한 Product Contract를 복구하는
IntentGuard 전용 파이프라인이,
동일한 기록을 최신 장문맥 LLM에게 직접 정리시키는 강한 Baseline보다
실제로 더 정확하고 유용한가?"

이 가설이 성립하지 않으면 IntentGuard 개발을 중단한다.

이 실험의 목표는 IntentGuard를 증명하는 것이 아니라,
IntentGuard가 필요 없는 이유를 최대한 싸고 빠르게 찾아내는 것이다.


==================================================
1. 이번 프로토타입에서 절대 만들지 않을 것
==================================================

다음은 구현하지 않는다.

- UI
- 웹앱
- Codex 지원
- Git 분석
- 현재 코드 분석
- Risk Advisor
- Prompt Guard
- SQLite
- 브라우저 테스트
- Playwright
- 자동 코드 수정
- SaaS
- 회원가입
- 결제
- 팀 기능
- 클라우드 동기화
- Hook 연동
- 보안 검사
- 배포 기능

오직:

Claude history
→ 실제 사용자 메시지 필터링
→ IntentGuard Product Contract
→ Baseline 3회
→ 의미 병합
→ Blind Evaluation
→ 결과 분석

까지만 만든다.


==================================================
2. 검증 대상 프로젝트 선택
==================================================

아무 프로젝트나 사용하지 않는다.

가능하면 내가 Claude Code로 가장 오래 개발한 실제 프로젝트를 사용한다.

우선 조건:

- 여러 세션에 걸쳐 개발됨
- 사용자 메시지가 충분히 많음
- 요구사항이 여러 번 추가됨
- 기존 요구사항 변경 사례 존재
- 기능 취소 사례 존재
- 임시 테스트 변경 사례 존재
- 나중에 원래 요구사항으로 되돌린 사례 존재
- 같은 기능을 여러 번 수정한 사례 존재
- 장기간 개발해서 초기 요구사항을 잊었을 가능성이 있음
… [truncated, 17358 chars total]
```

판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______

---

## HUMAN_CONFIRMATION — 0개 (샘플 0개)

독립 Requirement 로 만들면 안 되는 승인 발화. `context_message_ids` 로 직전 맥락과 연결됨.

_해당 없음._

---

## HUMAN_CONTEXT — 0개 (샘플 0개)

질문/설명/아이디어. ACTIVE Requirement 가 되어서는 안 된다.

_해당 없음._

---

## LOW_INFORMATION — 0개 (샘플 0개)

"계속", "ㅇㅋ" 류. 독립 Requirement 금지.

_해당 없음._

---

## UNKNOWN — 0개 (샘플 0개)

**가장 중요한 검토 대상.** 규칙이 판단하지 못한 것들.

_해당 없음._

---

## 제외된 Noise 샘플 — 23개 중 30개

여기에 **진짜 사람이 쓴 요구사항이 섞여 있으면 그것이 가장 심각한 오류다.**
(누락은 Precision 지표에 잡히지 않는다.)

### NOISE #1 — TOOL_OR_SYSTEM_CONTENT

- id: `605783c6-d774-44ee-9dd9-1ec91a551ba0` · time: `2026-09-07T14:53:29.741Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #2 — TOOL_OR_SYSTEM_CONTENT

- id: `ec4987ed-2074-4ffc-8783-eb8f02aea454` · time: `2026-09-07T14:53:31.104Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #3 — TOOL_OR_SYSTEM_CONTENT

- id: `15a59468-37d0-4368-8da7-517371dea0dd` · time: `2026-09-07T14:53:36.929Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #4 — TOOL_OR_SYSTEM_CONTENT

- id: `646568fd-36a3-4c79-a663-9b133f5c3b7e` · time: `2026-09-07T14:53:37.028Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #5 — TOOL_OR_SYSTEM_CONTENT

- id: `f0f8788e-9b0a-45d7-8bf3-16c54325ba8b` · time: `2026-09-07T14:53:46.680Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #6 — TOOL_OR_SYSTEM_CONTENT

- id: `10638b4e-c6d0-42a8-946b-62471aa479eb` · time: `2026-09-07T14:53:48.429Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #7 — TOOL_OR_SYSTEM_CONTENT

- id: `f67296d8-40df-431e-8728-6bce3201e118` · time: `2026-09-07T14:54:00.692Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #8 — TOOL_OR_SYSTEM_CONTENT

- id: `70048368-24fe-474e-9a70-9d5fda0f23db` · time: `2026-09-07T14:54:10.790Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #9 — TOOL_OR_SYSTEM_CONTENT

- id: `aaf0c9a1-4dd3-4683-84d8-9fef4e98d278` · time: `2026-09-07T14:55:00.097Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #10 — TOOL_OR_SYSTEM_CONTENT

- id: `6908c52d-5e16-4928-8fdd-8ca0f84651b0` · time: `2026-09-07T14:55:50.665Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #11 — TOOL_OR_SYSTEM_CONTENT

- id: `d0122a10-b463-4f17-9e9e-2884fab011ad` · time: `2026-09-07T14:56:09.831Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #12 — TOOL_OR_SYSTEM_CONTENT

- id: `83dab890-8310-4e88-b95a-cb72ff3060e9` · time: `2026-09-07T14:56:43.681Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #13 — TOOL_OR_SYSTEM_CONTENT

- id: `67ac2681-17ea-42fc-8384-534b4bec4953` · time: `2026-09-07T14:57:56.375Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #14 — TOOL_OR_SYSTEM_CONTENT

- id: `61822564-ede4-4bdf-b9c0-3160f275ca59` · time: `2026-09-07T14:58:11.729Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #15 — TOOL_OR_SYSTEM_CONTENT

- id: `f354f230-2b33-46df-b287-a51b608250ae` · time: `2026-09-07T14:58:21.022Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #16 — TOOL_OR_SYSTEM_CONTENT

- id: `4e1091a4-ac9e-4f1a-8aa0-7457a78d16ec` · time: `2026-09-07T14:59:53.573Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #17 — TOOL_OR_SYSTEM_CONTENT

- id: `2d950f40-5812-40f3-b6d3-c4f7c90c1456` · time: `2026-09-07T14:59:59.645Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #18 — TOOL_OR_SYSTEM_CONTENT

- id: `9ca09aea-7e89-4f73-8da1-bd728ebf4276` · time: `2026-09-07T15:00:09.089Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #19 — TOOL_OR_SYSTEM_CONTENT

- id: `d2919094-262e-4ef6-b614-2ab068b2e852` · time: `2026-09-07T15:01:01.341Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #20 — TOOL_OR_SYSTEM_CONTENT

- id: `92e782f9-2795-4780-91d9-bad0e09a6ba3` · time: `2026-09-07T15:01:07.734Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #21 — TOOL_OR_SYSTEM_CONTENT

- id: `7049795c-9441-47b9-8ee8-9facb197ea10` · time: `2026-09-07T15:02:02.132Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #22 — TOOL_OR_SYSTEM_CONTENT

- id: `f12877a9-ec94-48a2-9a1b-1fffe10b55db` · time: `2026-09-07T15:02:48.773Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

### NOISE #23 — TOOL_OR_SYSTEM_CONTENT

- id: `42c6bf75-6d05-417d-9e95-001024327a51` · time: `2026-09-07T15:02:56.226Z` · route: `tool_result` · raw 0 chars
- rule: tool_result record

```text
(정제 후 텍스트 없음 — tool_result / 자동주입 context)
```

판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**

---

## AMBIGUOUS / 경계 사례

confidence <= 0.6 인 human 분류 항목. 규칙이 확신하지 못한 것들이다.

_해당 없음._