# Message Filter Report

- 프로젝트: `/home/user/threadshot`
- 세션 파일: 1개
- 범위: --limit 200 (전체 91개가 한도 이하)
- 생성: 2026-09-08T00:53:09.321Z
- LLM 호출: **0회 (비용 $0)** — Stage 1 은 전부 결정론적 규칙

## 카운트 (명세 §7)

| 항목 | 수 |
|---|---:|
| Raw user-role messages | 91 |
| Actual human messages | 4 |
| Potential intent-bearing | 2 |
| Low-information / context-only | 2 |
| Noise (system/tool/paste/error) | 87 |
| Unknown | 0 |

## 버킷별 분포

| message_type | 수 | 비율 |
|---|---:|---:|
| TOOL_OR_SYSTEM_CONTENT | 86 | 94.5% |
| HUMAN_CONTEXT | 2 | 2.2% |
| HUMAN_CORRECTION | 1 | 1.1% |
| HUMAN_INTENT | 1 | 1.1% |
| PASTED_CONTENT | 1 | 1.1% |

## Token 추정 (STEP 5/6 입력)

| 대상 | 문자 | 추정 토큰 |
|---|---:|---:|
| 사람 메시지 (정제 전, 주입 블록 포함) | 120,562 | ~40,188 |
| 필터 통과 human timeline | 17,413 | 6,117 |
| intent-bearing 만 | 17,388 | 6,102 |

필터가 Baseline 에 넣을 입력을 얼마나 줄였는지가 곧 Baseline 의 context 여유다.
**주의(명세 §17): 이 축소는 IntentGuard 만의 이점이 아니다. Baseline 도 동일한 filtered timeline 을 받는다.**

## 시간 범위

- 최초: `2026-09-07T14:53:23.544Z`
- 최종: `2026-09-08T00:53:01.991Z`
- 기간: 0.42일

> ⚠️ **기간이 너무 짧다.** IntentGuard 가설은 "긴 시간축에서의 변경/취소/임시변경/재활성화 복구"에
> 관한 것이다. 이 정도 기간의 데이터로는 가설을 검증할 수 없다 (명세 §2).

## Parser 진단

```json
{
  "files": 1,
  "linesRead": 493,
  "parseFailures": 0,
  "parseFailureSamples": [],
  "duplicateUuids": 0,
  "recordTypes": {
    "queue-operation": 8,
    "user": 91,
    "attachment": 122,
    "atis-latch": 30,
    "last-prompt": 31,
    "assistant": 191,
    "mode": 19,
    "system": 1
  },
  "unknownRecordTypes": {
    "mode": 19
  },
  "attachmentTypes": {
    "environment": 6,
    "model": 1,
    "deferred_tools_delta": 2,
    "agent_listing_delta": 1,
    "mcp_instructions_delta": 1,
    "skill_listing": 3,
    "auto_mode": 1,
    "total_tokens_reminder": 87,
    "session_context": 1,
    "date": 2,
    "remote_session_change": 1,
    "prompt_snapshot": 2,
    "task_reminder": 12,
    "deferred_tools_record": 1,
    "command_permissions": 1
  },
  "userContentShapes": {
    "string": 4,
    "tool_result": 86,
    "text": 1
  },
  "unknownContentBlocks": {},
  "missingTimestamp": 0,
  "sidechainEntries": 0,
  "humanSignalCoverage": {
    "origin": 4,
    "promptSource": 4,
    "permissionMode": 4
  },
  "versions": {
    "2.1.263": 405
  },
  "entrypoints": {
    "remote_mobile": 405
  }
}
```