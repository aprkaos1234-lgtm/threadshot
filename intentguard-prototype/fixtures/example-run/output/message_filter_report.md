# Message Filter Report

- 프로젝트: `/home/user/demo-app`
- 세션 파일: 3개
- 범위: 전체 이력
- 생성: 2026-09-07T15:03:40.792Z
- LLM 호출: **0회 (비용 $0)** — Stage 1 은 전부 결정론적 규칙

## 카운트 (명세 §7)

| 항목 | 수 |
|---|---:|
| Raw user-role messages | 42 |
| Actual human messages | 24 |
| Potential intent-bearing | 16 |
| Low-information / context-only | 8 |
| Noise (system/tool/paste/error) | 18 |
| Unknown | 0 |

## 버킷별 분포

| message_type | 수 | 비율 |
|---|---:|---:|
| TOOL_OR_SYSTEM_CONTENT | 17 | 40.5% |
| HUMAN_INTENT | 11 | 26.2% |
| HUMAN_CORRECTION | 5 | 11.9% |
| HUMAN_CONFIRMATION | 3 | 7.1% |
| LOW_INFORMATION | 3 | 7.1% |
| HUMAN_CONTEXT | 2 | 4.8% |
| ERROR_LOG | 1 | 2.4% |

## Token 추정 (STEP 5/6 입력)

| 대상 | 문자 | 추정 토큰 |
|---|---:|---:|
| Raw user-role 전체 | 1,289 | 430 (거친 상한) |
| 필터 통과 human timeline | 685 | 341 |
| intent-bearing 만 | 454 | 270 |

필터가 Baseline 에 넣을 입력을 얼마나 줄였는지가 곧 Baseline 의 context 여유다.
**주의(명세 §17): 이 축소는 IntentGuard 만의 이점이 아니다. Baseline 도 동일한 filtered timeline 을 받는다.**

## 시간 범위

- 최초: `2026-03-02T09:00:00.000Z`
- 최종: `2026-05-20T11:26:00.000Z`
- 기간: 79.10일

## Parser 진단

```json
{
  "files": 3,
  "linesRead": 62,
  "parseFailures": 0,
  "parseFailureSamples": [],
  "duplicateUuids": 1,
  "recordTypes": {
    "attachment": 4,
    "user": 43,
    "assistant": 15
  },
  "unknownRecordTypes": {},
  "attachmentTypes": {
    "skill_listing": 2,
    "date": 1,
    "environment": 1
  },
  "userContentShapes": {
    "string": 28,
    "tool_result": 15
  },
  "unknownContentBlocks": {},
  "missingTimestamp": 0,
  "sidechainEntries": 1,
  "humanSignalCoverage": {
    "origin": 18,
    "promptSource": 18,
    "permissionMode": 18
  },
  "versions": {
    "2.0.31": 20,
    "2.1.263": 20,
    "1.0.88": 22
  },
  "entrypoints": {
    "cli": 42,
    "remote_mobile": 20
  }
}
```