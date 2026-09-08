# Parse Diagnostics — 유지보수 리스크 근거 (명세 §29 #11, §31)

Claude Code 는 외부 제품이 통제하는 비공개 포맷이다. 여기 기록되는 값들은
IntentGuard 를 제품으로 유지할 때 **매 릴리스마다 깨질 수 있는 지점**의 목록이다.

- Claude Code 버전: {"1.0.88":22,"2.0.31":20,"2.1.263":20}
- entrypoint: {"cli":42,"remote_mobile":20}
- 파일 3개 / 라인 62개
- JSON 파싱 실패: 0
- 중복 uuid (세션 resume/fork 로 인한): 1
- timestamp 없는 레코드: 0
- sidechain(sub-agent) 레코드: 1

## 관측된 record type

| type | 수 | parser 처리 |
|---|---:|---|
| `user` | 43 | 명시적 라우팅 |
| `assistant` | 15 | 명시적 라우팅 |
| `attachment` | 4 | 명시적 라우팅 |

## `type: "user"` 안의 content 모양

| block 구성 | 수 |
|---|---:|
| `string` | 28 |
| `tool_result` | 15 |

## 인간 판별 신호의 존재율

| 필드 | 존재한 레코드 수 |
|---|---:|
| `origin` | 18 |
| `promptSource` | 18 |
| `permissionMode` | 18 |

`origin.kind === "human"` 은 최신 버전에만 존재한다. 구버전 transcript 에는 없으므로
**부재를 근거로 배제하면 과거 이력이 통째로 사라진다.** parser 는 이를 보조 신호로만 쓴다.

## 자동 주입 attachment 종류

| attachment.type | 수 |
|---|---:|
| `skill_listing` | 2 |
| `environment` | 1 |
| `date` | 1 |

이들은 전부 `type: "attachment"` 로 분리되어 있어 배제가 쉬웠다. 다만 종류가 3가지이고 버전마다 늘어난다.