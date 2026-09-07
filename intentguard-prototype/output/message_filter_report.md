# Message Filter Report

- 프로젝트: `/home/user/threadshot`
- 세션 파일: 1개
- 범위: --limit 200 (전체 24개가 한도 이하)
- 생성: 2026-09-07T15:03:26.814Z
- LLM 호출: **0회 (비용 $0)** — Stage 1 은 전부 결정론적 규칙

## 카운트 (명세 §7)

| 항목 | 수 |
|---|---:|
| Raw user-role messages | 24 |
| Actual human messages | 1 |
| Potential intent-bearing | 1 |
| Low-information / context-only | 0 |
| Noise (system/tool/paste/error) | 23 |
| Unknown | 0 |

## 버킷별 분포

| message_type | 수 | 비율 |
|---|---:|---:|
| TOOL_OR_SYSTEM_CONTENT | 23 | 95.8% |
| HUMAN_CORRECTION | 1 | 4.2% |

## Token 추정 (STEP 5/6 입력)

| 대상 | 문자 | 추정 토큰 |
|---|---:|---:|
| Raw user-role 전체 | 17,358 | 5,786 (거친 상한) |
| 필터 통과 human timeline | 17,358 | 6,083 |
| intent-bearing 만 | 17,358 | 6,083 |

필터가 Baseline 에 넣을 입력을 얼마나 줄였는지가 곧 Baseline 의 context 여유다.
**주의(명세 §17): 이 축소는 IntentGuard 만의 이점이 아니다. Baseline 도 동일한 filtered timeline 을 받는다.**

## 시간 범위

- 최초: `2026-09-07T14:53:23.544Z`
- 최종: `2026-09-07T15:02:56.226Z`
- 기간: 0.01일

> ⚠️ **기간이 너무 짧다.** IntentGuard 가설은 "긴 시간축에서의 변경/취소/임시변경/재활성화 복구"에
> 관한 것이다. 이 정도 기간의 데이터로는 가설을 검증할 수 없다 (명세 §2).

## Parser 진단

```json
{
  "files": 1,
  "linesRead": 131,
  "parseFailures": 0,
  "parseFailureSamples": [],
  "duplicateUuids": 0,
  "recordTypes": {
    "queue-operation": 2,
    "user": 24,
    "attachment": 37,
    "atis-latch": 10,
    "last-prompt": 9,
    "assistant": 49
  },
  "unknownRecordTypes": {},
  "attachmentTypes": {
    "environment": 2,
    "model": 1,
    "deferred_tools_delta": 1,
    "agent_listing_delta": 1,
    "mcp_instructions_delta": 1,
    "skill_listing": 1,
    "auto_mode": 1,
    "total_tokens_reminder": 21,
    "session_context": 1,
    "date": 1,
    "remote_session_change": 1,
    "prompt_snapshot": 2,
    "task_reminder": 3
  },
  "userContentShapes": {
    "string": 1,
    "tool_result": 23
  },
  "unknownContentBlocks": {},
  "missingTimestamp": 0,
  "sidechainEntries": 0,
  "humanSignalCoverage": {
    "origin": 1,
    "promptSource": 1,
    "permissionMode": 1
  },
  "versions": {
    "2.1.263": 110
  },
  "entrypoints": {
    "remote_mobile": 110
  }
}
```