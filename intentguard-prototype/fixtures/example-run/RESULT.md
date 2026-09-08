<!-- 이 파일은 합성 데이터 + mock 모델로 생성된 예시입니다. 실제 결과가 아닙니다. -->

> ⚠️ **이것은 예시 출력입니다.**
> 합성 transcript 를 mock 모델로 처리한 결과이며, IntentGuard 에 대한 어떤 증거도 아닙니다.
> 산출물의 형태를 미리 보기 위한 것입니다.

# RESULT — IntentGuard Validation

- 대상 프로젝트: `/home/user/demo-app (합성)`
- 이력 범위: 2026-03-02T09:00:00.000Z ~ 2026-05-20T11:26:00.000Z
- 생성: 2026-09-08T00:51:39.710Z
- 평가된 항목: 18 / 18

> 명세 §29 는 GO / NO-GO 를 자동 판정하지 말라고 요구합니다. 이 문서는 판정하지 않습니다.
> §30: 숫자 하나로 판단하지 않습니다. Precision 이 높아도 AMBIGUOUS 가 과다하면 좋은 결과가 아니고,
> 더 정확해도 차이가 미미하고 비용·복잡성만 크다면 좋은 결과가 아닙니다.

# 1. MANUAL MISSING REQUIREMENTS

명세 §22 가 이 실험의 가장 중요한 산출물로 지정한 항목입니다.

| 사용자가 기억해낸 요구사항 | IntentGuard | Baseline 1 | Baseline 2 | Baseline 3 |
|---|:--:|:--:|:--:|:--:|
| 분석 결과를 CSV 로 내보내는 기능 | — | — | — | — |

- IntentGuard **만** 발견: 0개
- 모두 누락: 1개


# 2. 실제 잊힌 Requirement 사례

사용자가 잊고 있었다가 시스템 출력을 보고 떠올린 요구사항은 기록되지 않았습니다.

# 3. Temporal Recovery

취소 / 임시 변경 / 대체 / 재활성화 사건에서 각 시스템의 상태 판정 정확도입니다.

| 사건 유형 | 해당 항목 | IntentGuard | Baseline 1 | Baseline 2 | Baseline 3 |
|---|---:|:--:|:--:|:--:|:--:|
| REJECTION | 1 | 100% (1/1) | 0% (0/1) | 0% (0/1) | n/a |
| TEMPORARY_CHANGE | 1 | 100% (1/1) | 100% (1/1) | n/a | 0% (0/1) |
| SUPERSEDED | 1 | 100% (1/1) | 0% (0/1) | 0% (0/1) | n/a |
| REACTIVATION | 1 | 100% (1/1) | 100% (1/1) | n/a | 0% (0/1) |

> **이 표의 한계**: Baseline 은 사건 체인을 출력하지 않습니다. 따라서 "이 항목이 REJECTION 사건이었다"는
> 분류는 IntentGuard 의 history 에서 가져왔습니다. IntentGuard 가 애초에 묶지 못한 요구사항은
> 이 표에 아예 등장하지 않으므로, 이 표는 IntentGuard 에 유리한 방향으로 편향돼 있습니다.
> 절대값보다 시스템 간 상대 비교로만 읽으십시오.

# 4. Blind Evaluation

| 지표 | IntentGuard | Baseline 1 | Baseline 2 | Baseline 3 |
|---|---:|---:|---:|---:|
| 출력 항목 수 | 16 | 8 | 8 | 8 |
| 평가된 항목 수 | 16 | 8 | 8 | 8 |
| ACTIVE 로 제안한 수 | 12 | 8 | 7 | 7 |
| **ACTIVE Precision** | 25% | 25% | 28.6% | 14.3% |
| False Requirement Rate | 18.8% | 25% | 25% | 25% |
| Wrong Status Rate | 18.8% | 0% | 12.5% | 12.5% |
| Temporal State Accuracy | 31.3% | 25% | 25% | 12.5% |

판정 분포:

| 판정 | 수 |
|---|---:|
| CORRECT_ACTIVE | 4 |
| CORRECT_NON_ACTIVE | 4 |
| NOT_A_REAL_REQUIREMENT | 4 |
| WRONG_STATUS | 3 |
| AMBIGUOUS_IN_REALITY | 3 |

# 5. AMBIGUOUS 분석

명세 §13: 애매한 것을 전부 AMBIGUOUS 로 보내는 시스템은 쓸모가 없습니다.
ACTIVE Precision 은 반드시 이 표와 함께 읽어야 합니다.

| 지표 | IntentGuard | Baseline 1 | Baseline 2 | Baseline 3 |
|---|---:|---:|---:|---:|
| AMBIGUOUS 수 | 0 | 0 | 0 | 1 |
| **Ambiguous Rate** | 0% | 0% | 0% | 12.5% |
| Justified (사람도 애매) | 0 | 0 | 0 | 0 |
| Avoidable (사람은 판단 가능) | 0 | 0 | 0 | 1 |
| Avoidable 비율 | n/a | n/a | n/a | 100% |

# 6. Baseline Stability

동일 입력·동일 프롬프트·동일 모델로 3회 실행한 결과의 흔들림입니다 (명세 §25).

| 항목 | 값 |
|---|---:|
| baseline_1 의 ACTIVE 수 | 8 |
| baseline_2 의 ACTIVE 수 | 7 |
| baseline_3 의 ACTIVE 수 | 7 |
| 세 실행 모두 공통 ACTIVE | 0 |
| 한두 실행에만 존재한 ACTIVE | 12 |
| 상태 불일치 항목 | 2 |

- baseline_1: AMBIGUOUS 0 / 8
- baseline_2: AMBIGUOUS 0 / 8
- baseline_3: AMBIGUOUS 1 / 8

> Baseline 이 동일 입력에서도 크게 흔들립니다. 이 경우 IntentGuard 와의 1회성 비교는
> 실력 차이가 아니라 실행 분산을 본 것일 수 있습니다.

# 7. Context Length / History Coverage

| 항목 | 값 |
|---|---|
| 전략 | `single_pass` |
| Baseline model | `claude-opus-5` |
| Model context limit | 1,000,000 tokens |
| 전체 예상 tokens | 661 |
| 한 컨텍스트에 들어가는가 | 예 |
| 청크 수 | 1 |
| 포함된 history 비율 | 100.0% |
| 잘린 message 수 | 0 |
| 잘린 날짜 범위 | 없음 |
| 이력 범위 | 2026-03-02T09:00:00.000Z ~ 2026-05-20T11:26:00.000Z |

전체 이력이 한 번에 들어갔다. IntentGuard 와 완전히 동일한 입력이다.

## 이 표를 읽는 법

IntentGuard 가 이겼다면, **더 많은 context 를 처리해서 이긴 것인지**
**시간축을 구조화해서 이긴 것인지** 구분해야 합니다 (명세 §17).

이 실행에서는 Baseline 이 전체 이력을 한 번에 받았습니다. 따라서 context 량은 동일 조건이고,
차이가 났다면 그것은 **구조화의 효과**로 해석할 수 있습니다.

# 8. 비용

| Stage | 호출 | Input tokens | Output tokens | 비용 (USD) |
|---|---:|---:|---:|---:|
| reconciliation | 15 | 15,000 | 4,500 | $0.1875 |
| candidate_extraction | 2 | 2,000 | 600 | $0.0250 |
| semantic_judge | 2 | 2,000 | 600 | $0.0250 |
| classification | 1 | 1,000 | 300 | $0.0125 |
| grouping | 1 | 1,000 | 300 | $0.0125 |
| baseline_1 | 1 | 1,000 | 300 | $0.0125 |
| baseline_2 | 1 | 1,000 | 300 | $0.0125 |
| baseline_3 | 1 | 1,000 | 300 | $0.0125 |
| **합계** | 24 | | | **$0.3000** |

- IntentGuard 파이프라인 + 평가 인프라: $0.2625
- Baseline 3회 합계: $0.0375
- 비용 배수: **7.0x**

> 명세 §30: 더 정확해도 차이가 미미하고 비용·복잡성만 크다면 좋은 결과가 아닙니다.

# 9. Message Filtering 품질

| 항목 | 수 |
|---|---:|
| Raw user-role messages | 42 |
| Actual human messages | 24 |
| Intent-bearing | 16 |
| Low information | 8 |
| Noise/system/tool | 18 |
| Unknown | 0 |

Stage 1 은 결정론적 규칙이며 LLM 을 쓰지 않았습니다(비용 $0).
필터가 잘못 버린 사람 메시지는 이후 어떤 지표에도 나타나지 않습니다 —
`output/message_filter_samples.md` 의 사람 검토가 이 실험 전체의 신뢰도 상한입니다.

# 10. 대표 실패 사례

## IntentGuard 만 틀린 사례 (3)

- **아직은 됐어**
  - 제안 상태: ACTIVE / 판정: WRONG_STATUS
  - 출처: intentguard
- **네**
  - 제안 상태: ACTIVE / 판정: NOT_A_REAL_REQUIREMENT
  - 출처: intentguard
- **팀 기능도 나중에 만들까?**
  - 제안 상태: ACTIVE / 판정: WRONG_STATUS
  - 출처: intentguard

## Baseline 만 틀린 사례 (1)

- **아까 만든 공유 링크 기능은 빼자. 스팸 신고가 들어올 것 같아**
  - 제안 상태: ACTIVE / 판정: NOT_A_REAL_REQUIREMENT
  - 출처: baseline_1, baseline_2

## 둘 다 틀린 사례 (3)

- **ㅇㅇ**
  - 제안 상태: ACTIVE / 판정: NOT_A_REAL_REQUIREMENT
  - 출처: baseline_2, baseline_3, intentguard
- **구글 트렌드에서 한국 인기 검색어를 가져와서 쇼핑 상품형 키워드만 골라주는 웹앱을 만들어줘**
  - 제안 상태: ACTIVE / 판정: WRONG_STATUS
  - 출처: baseline_2, baseline_3, intentguard
- **이거 왜 안 되지?**
  - 제안 상태: ACTIVE / 판정: NOT_A_REAL_REQUIREMENT
  - 출처: baseline_1, baseline_3, intentguard

# 11. Parsing / Maintenance Risk

Claude Code JSONL 은 외부 제품이 통제하는 비공개 포맷입니다.
여기 기록된 것은 IntentGuard 를 제품으로 유지할 때의 실제 부담에 대한 데이터입니다 (명세 §31).

| 항목 | 값 |
|---|---|
| 관측된 Claude Code 버전 | {"1.0.88":22,"2.0.31":20,"2.1.263":20} |
| record type 종류 | 3 |
| **parser 가 모르는 type** | 0 [] |
| 자동 주입 attachment 종류 | 3 |
| JSON 파싱 실패 | 0 |
| 중복 uuid (세션 resume) | 1 |

구조적으로 취약한 지점:

1. `type: "user"` 가 인간 메시지와 tool result 를 함께 담고, `promptId` 는 tool result 에도
   상속됩니다. 판별은 `toolUseResult` / `sourceToolAssistantUUID` 같은 내부 필드에 의존합니다.
2. `origin.kind === "human"` 은 최신 버전에만 존재합니다. 필수 조건으로 걸면 과거 이력이 사라지고,
   보조 신호로만 쓰면 신버전의 이점을 못 씁니다. 어느 쪽도 안전하지 않습니다.
3. 자동 주입되는 `attachment` 종류가 버전마다 늘어납니다.
4. 인간 메시지 본문 안에도 `<system-reminder>`, slash 확장, wake 봉투가 섞여 들어옵니다.

Claude Code 가 새 record type 을 추가하고 그 안에 인간 메시지가 들어가면 **조용히 누락됩니다**.
테스트가 실패하는 게 아니라 요구사항이 사라집니다.

## 실행 중 기록된 메모

- 이 실행은 합성 transcript + mock 모델이다. 결과 해석에 사용할 수 없다.

---

**GO / NO-GO 는 자동 판정하지 않습니다 (명세 §29).**

판단 기준은 §30 입니다:
긴 시간축에서 변경 / 취소 / 임시 설정 / 복구 / 대체를 Baseline 보다 실질적으로 더 잘 복구하는가,
그리고 사용자가 실제로 잊은 중요한 Requirement 를 다시 찾아주는가.