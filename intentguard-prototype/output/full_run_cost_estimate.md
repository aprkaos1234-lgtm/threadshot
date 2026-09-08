# Full Run Cost Estimate (명세 §28)

생성: 2026-09-08T00:45:41.017Z

| | Smoke | Full |
|---|---:|---:|
| 사람 메시지 | 4 | 4 |
| intent-bearing | 2 | 2 |
| 사람 메시지 tokens | 6,117 | 6,117 |

## Observed Smoke Cost

**실측값 없음** — smoke 파이프라인을 아직 실행하지 않았습니다.
아래는 전부 토큰 추정에 근거한 예측치입니다.

## Estimated Full Run

| 항목 | 예상 비용 |
|---|---:|
| Estimated Full IntentGuard Cost | $0.23 |
| Estimated Baseline x3 | $0.26 |
| Estimated Semantic Judge | $0.02 |
| **Estimated Total** | **$0.51** |

Stage 별 내역:

| Stage | 예상 input tokens | 예상 비용 |
|---|---:|---:|
| classification | 7,341 | $0.10 |
| candidate_extraction | 7,323 | $0.10 |
| grouping | 450 | $0.01 |
| reconciliation | 1,800 | $0.02 |
| baseline_1 | 6,423 | $0.09 |
| baseline_2 | 6,423 | $0.09 |
| baseline_3 | 6,423 | $0.09 |
| semantic_judge | 1,200 | $0.02 |

## 이 추정이 기대는 가정 (기본 가정값 (smoke 실측 없음))

| 가정 | 값 |
|---|---:|
| intent 메시지당 후보 수 | 1.3 |
| 후보당 그룹 비율 | 0.55 |
| 항목당 judge 쌍 수 | 2.5 |
| output/input 토큰 비 | 0.35 |

- 추정 후보 수: 3
- 추정 그룹 수: 2
- 추정 병합 전 항목 수: 8

가정이 틀리면 비용도 틀립니다. 특히 **그룹 수**가 예상보다 많으면
reconciliation 단계는 그룹당 1회 호출이므로 선형으로 늘어납니다.

모델: `claude-opus-5` — 다른 모델을 쓰려면 `--model` 로 지정하고 다시 추정하세요.
