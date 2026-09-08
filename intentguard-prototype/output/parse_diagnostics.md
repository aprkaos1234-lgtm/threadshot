# Parse Diagnostics — 유지보수 리스크 근거 (명세 §29 #11, §31)

Claude Code 는 외부 제품이 통제하는 비공개 포맷이다. 여기 기록되는 값들은
IntentGuard 를 제품으로 유지할 때 **매 릴리스마다 깨질 수 있는 지점**의 목록이다.

- Claude Code 버전: {"2.1.263":405}
- entrypoint: {"remote_mobile":405}
- 파일 1개 / 라인 493개
- JSON 파싱 실패: 0
- 중복 uuid (세션 resume/fork 로 인한): 0
- timestamp 없는 레코드: 0
- sidechain(sub-agent) 레코드: 0

## 관측된 record type

| type | 수 | parser 처리 |
|---|---:|---|
| `assistant` | 191 | 명시적 라우팅 |
| `attachment` | 122 | 명시적 라우팅 |
| `user` | 91 | 명시적 라우팅 |
| `last-prompt` | 31 | 명시적 라우팅 |
| `atis-latch` | 30 | 명시적 라우팅 |
| `mode` | 19 | ⚠️ **미지 타입 — 규칙 없음** |
| `queue-operation` | 8 | 명시적 라우팅 |
| `system` | 1 | 명시적 라우팅 |

> ⚠️ 미지 타입이 존재한다. Claude Code 가 새 레코드 종류를 추가했다는 뜻이며,
> 그 안에 인간 메시지가 들어갔다면 조용히 누락된다. 이것이 이 제품의 구조적 취약점이다.

## `type: "user"` 안의 content 모양

| block 구성 | 수 |
|---|---:|
| `tool_result` | 86 |
| `string` | 4 |
| `text` | 1 |

## 인간 판별 신호의 존재율

| 필드 | 존재한 레코드 수 |
|---|---:|
| `origin` | 4 |
| `promptSource` | 4 |
| `permissionMode` | 4 |

`origin.kind === "human"` 은 최신 버전에만 존재한다. 구버전 transcript 에는 없으므로
**부재를 근거로 배제하면 과거 이력이 통째로 사라진다.** parser 는 이를 보조 신호로만 쓴다.

## 자동 주입 attachment 종류

| attachment.type | 수 |
|---|---:|
| `total_tokens_reminder` | 87 |
| `task_reminder` | 12 |
| `environment` | 6 |
| `skill_listing` | 3 |
| `deferred_tools_delta` | 2 |
| `date` | 2 |
| `prompt_snapshot` | 2 |
| `model` | 1 |
| `agent_listing_delta` | 1 |
| `mcp_instructions_delta` | 1 |
| `auto_mode` | 1 |
| `session_context` | 1 |
| `remote_session_change` | 1 |
| `deferred_tools_record` | 1 |
| `command_permissions` | 1 |

이들은 전부 `type: "attachment"` 로 분리되어 있어 배제가 쉬웠다. 다만 종류가 15가지이고 버전마다 늘어난다.