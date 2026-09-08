# Example Run (합성 데이터 · mock 모델)

> ⚠️ **여기 있는 모든 숫자는 조작된 것입니다.**

`fixtures/make_fixture.js` 가 만든 합성 transcript 를
`fixtures/mock-llm.js` 의 가짜 모델로 처리한 결과입니다.
API 호출은 한 번도 일어나지 않았습니다.

**목적**: 실제 돈을 쓰기 전에 각 단계가 무엇을 만들어내는지 형태를 확인하는 것.
**금지**: 이 결과로 IntentGuard 의 성능을 판단하는 것. 합성 데이터에는
작성자가 넣어둔 패턴만 들어 있으므로 순환논증이 됩니다 (명세 §36).

## 파일

| 경로 | 만든 단계 |
|---|---|
| `output/message_filter_samples.md` | STEP 3 — 사람이 검토할 파일 |
| `output/message_filter_report.md` | STEP 3 — 필터 카운트 |
| `output/parse_diagnostics.md` | STEP 3 — 스키마 변형 |
| `output/intentguard_contract.md` | STEP 7 — Product Contract (명세 §14) |
| `output/baseline_context_analysis.md` | STEP 8 — context 분석 (명세 §17) |
| `data/classified_messages.json` | Stage 2 |
| `data/candidates.json` | Stage 3 |
| `data/groups.json` | Stage 4 |
| `data/reconciled.json` | Stage 5-7 |
| `data/baseline_{1,2,3}.json` | STEP 8 |
| `data/merged_items.json` | STEP 9 — hidden source 포함 |
| `data/blind_items.json` | STEP 9 — **평가자에게 보이는 전부** |
| `data/evaluation_progress.json` | STEP 10-11 |
| `RESULT.md` | STEP 13 |

재생성: `node fixtures/make_demo.js`
