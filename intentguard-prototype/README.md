# IntentGuard Validation Prototype

이것은 제품이 아니다. **하나의 가설을 반증하기 위한 실험 장치**다.

> Claude Code 의 장기 개발 기록에서 현재 유효한 Product Contract 를 복구할 때,
> IntentGuard 전용 파이프라인이 같은 기록을 장문맥 LLM 에 그대로 넣는
> 강한 Baseline 보다 **실질적으로** 더 나은가?

목표는 IntentGuard 를 살리는 것이 아니라 **필요 없다는 사실을 최대한 싸고 빨리 찾는 것**이다.

현재 진행 상태: **STEP 1-13 전 단계 구현 완료.**
실행은 명세대로 두 곳에서 강제로 멈춥니다 — 필터 샘플 검토 전(STEP 3), 비용 확인 전(STEP 6).

---

## PC에서 바로 시작하기

**Node 18+** 필요. 의존성은 `@anthropic-ai/sdk` 하나뿐입니다.

```bash
git clone <repo> && cd threadshot
git checkout claude/intentguard-validation-prototype-uqjuga
cd intentguard-prototype
npm install

npm run projects        # 이 PC에 있는 Claude Code 이력 목록
npm test                # 파서/필터/시간축 fold 회귀 테스트
npm run test:e2e        # 전 단계 배선 테스트 (mock 모델, API 호출 0회)
```

STEP 1-3(파싱·필터)까지는 API 키 없이 돌아가고 **비용이 0** 입니다.
STEP 7 이후만 `ANTHROPIC_API_KEY` 가 필요합니다.

`npm run projects` 가 출력한 경로를 그대로 복사해서:

```bash
npm run analyze -- "<복사한 경로>" --limit 200
```

검증된 것: 40세션 / 235MB / 사람 메시지 3,000개 이력에서 **1.7초, 메모리 124MB**.
규모는 문제되지 않습니다.

### 미리 알아둘 것 3가지

1. **웹·모바일 세션 기록은 PC에 없습니다.** Claude Code on the web / 모바일 세션은
   클라우드 컨테이너에 살고 세션이 끝나면 사라집니다. `~/.claude/projects/` 에 남는 것은
   **로컬 CLI 로 작업한 이력뿐**입니다. 분석 대상 프로젝트를 주로 웹에서 작업했다면
   그 이력은 복구할 수 없습니다.
2. **Windows 는 실기 검증을 못 했습니다.** 경로 인코딩(`C:\Users\me\proj` → `C--Users-me-proj`)과
   대소문자·후행 슬래시는 대응해 뒀지만 실제 Windows 에서 돌려본 적은 없습니다.
   `npm run projects` 가 프로젝트를 못 찾으면 그게 첫 번째 의심 지점입니다.
   (매칭은 디렉터리 이름보다 transcript 안의 `cwd` 필드를 우선 신뢰하도록 되어 있습니다.)
3. **UNKNOWN 비율이 여기보다 높게 나옵니다.** 필터 어휘는 합성 fixture 기준으로 맞춘 것이라
   본인의 실제 말버릇은 안 잡힐 수 있습니다. 그게 STEP 4 에서 고칠 대상이고,
   `output/message_filter_samples.md` 의 UNKNOWN 섹션을 가장 먼저 보라고 한 이유입니다.

## 실행 순서

명세 §33 의 STEP 순서 그대로입니다. **강제 중단 지점이 두 곳** 있습니다.

```bash
# STEP 2-3 — 파싱 + 사람 메시지 필터링 (비용 $0)
npm run analyze  -- "<project>" --limit 200
#   → output/message_filter_samples.md
#   ⛔ 여기서 멈춤. 사람이 샘플을 직접 검토한다.
#      필터를 고칠 곳은 src/filter.js, 회귀는 npm test 로 잡는다. (STEP 4)

# STEP 5-6 — 전체 실행 비용 추산 (비용 $0)
npm run estimate -- "<project>"
#   → output/full_run_cost_estimate.md
#   ⛔ 여기서 멈춤. 비용을 보고 진행 여부를 사람이 결정한다.

# ---- 아래부터 실제 API 비용이 발생한다 ----

npm run pipeline -- "<project>"     # STEP 7  IntentGuard Stage 2-7
npm run baseline -- "<project>"     # STEP 8  Baseline x3 (동일 입력·프롬프트·모델)
npm run merge    -- "<project>"     # STEP 9  4-way 의미 병합 → blind 목록
npm run evaluate                    # STEP 10-11 Blind Evaluation (대화형)
npm run result   -- "<project>"     # STEP 12-13 source 복원 → RESULT.md
```

돈이 드는 명령은 실행 직전 예상 비용을 보여주고 y/N 확인을 받습니다 (`--yes` 로 생략).

옵션: `--limit N` `--from ISO` `--to ISO` `--model ID` `--runs N` `--claude-home P` `--out DIR`

기본 모델은 `claude-opus-5` 이며 **IntentGuard 와 Baseline 이 같은 모델·같은 effort** 를 씁니다.
한쪽만 유리하게 만들지 않기 위해서입니다 (명세 §36).

## 설계에서 중요한 한 가지

Stage 5 에서 **모델은 사건에 라벨만 붙입니다** —
`CREATED` / `MODIFIED` / `TEMPORARILY_DISABLED` / `REACTIVATED` / `REJECTED` / `UNCLEAR`.

최종 상태는 **코드가 결정론적으로 접습니다**(Stage 6).

```
CREATED → TEMPORARILY_DISABLED → REACTIVATED  ⇒  ACTIVE
CREATED → TEMPORARILY_DISABLED                ⇒  TEMPORARY (끝나지 않은 임시 변경)
CREATED → REJECTED                            ⇒  REJECTED
```

"지금 상태가 뭐냐"고 모델에게 한 번에 묻는 것은 Baseline 이 이미 하는 일입니다.
IntentGuard 가 다르려면 시간축 판단이 **감사 가능**해야 하고, 틀렸을 때
모델이 사건을 잘못 읽은 것인지 규칙이 잘못 접은 것인지 구분할 수 있어야 합니다.

검색에도 같은 구조를 씁니다: 정정 발언은 주어를 반복하지 않아서
("아니 3회 말고 5회로 하자" ↔ "무료 사용자는 월 3회만 제한해" 어휘 유사도 **0.011**)
어휘 검색만으로는 절대 묶이지 않습니다. 그래서 CHANGE/REJECTION 후보는
**시간상 직전 후보들을 무조건 후보군에 넣습니다.**

## 산출물

| 파일 | 단계 | 내용 |
|---|---|---|
| `output/message_filter_samples.md` | 3 | **사람이 직접 검토할 파일** (명세 §4) |
| `output/message_filter_report.md` | 3 | 카운트 리포트 (명세 §7) |
| `output/parse_diagnostics.md` | 3 | 스키마 변형 — 유지보수 리스크 증거 (명세 §31) |
| `output/full_run_cost_estimate.md` | 6 | 전체 실행 비용 추산 (명세 §28) |
| `output/intentguard_contract.md` | 7 | Product Contract (명세 §14) |
| `output/baseline_context_analysis.md` | 8 | context 한계 분석 (명세 §17) |
| `data/user_messages.json` | 3 | 정규화 타임라인 (명세 §8) |
| `data/classified_messages.json` | 2 | 메시지 분류 (명세 §9) |
| `data/candidates.json` | 3 | 요구사항 후보 (명세 §10) |
| `data/groups.json` | 4 | 그룹 + 판정한 쌍 수 |
| `data/reconciled.json` | 5-7 | 사건 체인 + 최종 상태 |
| `data/baseline_{1,2,3}.json` | 8 | Baseline 3회 (명세 §16) |
| `data/merged_items.json` | 9 | 병합 결과 + **hidden source** |
| `data/blind_items.json` | 9 | **평가자에게 보이는 전부** — 요구사항 텍스트와 제안 상태뿐 |
| `data/evaluation_progress.json` | 10-11 | 판정 + MANUAL_MISSING (재개 가능) |
| `data/cost_ledger.json` | 전체 | 호출별 stage/토큰/비용 (명세 §27) |
| `RESULT.md` | 13 | 최종 보고서 (명세 §29) |

산출물의 실제 모양은 `fixtures/example-run/` 에서 미리 볼 수 있습니다
(합성 데이터 + mock 모델로 만든 예시이며, **결과 해석에 쓸 수 없습니다**).

## ⚠️ 이 컨테이너에서는 본 실험을 할 수 없다

이 세션은 원격 ephemeral 컨테이너에서 실행 중이다. `~/.claude/projects/` 에는
**이번 세션의 transcript 1개**밖에 없다 (사람 메시지 1개 = 이 실험 지시문 자체).

명세 §2 가 요구하는 조건 — 여러 세션, 요구사항 추가·변경·취소·임시변경·재활성화가
존재하는 장기 프로젝트 — 은 이 컨테이너 안에 존재하지 않는다.

**따라서 STEP 4 이후는 사용자의 로컬 머신에서 실행해야 한다.**
CLI 는 경로만 바꾸면 그대로 동작한다:

```bash
npm run projects                       # 로컬의 진짜 이력 목록
npm run analyze -- "<가장 오래 개발한 프로젝트 경로>" --limit 200
```

## 파일 구조

```
src/discover.js   ~/.claude/projects 탐색, cwd ↔ 디렉터리명 매핑
src/parse.js      JSONL → 정규화 레코드. 인간 메시지 vs tool result 판별
src/filter.js     Stage 1 분류 (명세 §6). LLM 미사용, 비용 $0
src/load.js       프로젝트 로드 + 범위 필터 (모든 명령의 공통 앞단)
src/tokens.js     한국어를 고려한 오프라인 토큰 추정
src/analyze.js    STEP 2-3 CLI. STEP 3 에서 강제 정지
src/llm.js        Anthropic SDK 래퍼. structured output, 재시도, 비용 기록
src/cost.js       호출별 비용 원장 (명세 §27)
src/similar.js    어휘 검색 (한국어용 char-bigram). 전수 비교 회피 (명세 §18)
src/pipeline.js   Stage 2-7. 모델은 사건 라벨링, 코드가 상태를 접는다
src/baseline.js   Baseline x3 + context 전략 (명세 §15-17)
src/merge.js      4-way 의미 병합, hidden source (명세 §19)
src/evaluate.js   Blind Evaluation CLI. 재개 가능, 세션 분할 (명세 §20-22)
src/result.js     지표 계산 + RESULT.md (명세 §13, §24, §25, §29)
src/estimate.js   전체 실행 비용 추산 (명세 §28)
src/cli.js        STEP 5-13 명령 라우팅
test.js           파서/필터/시간축 fold 회귀 테스트
test-e2e.js       mock 모델로 전 단계 배선 검증 (API 호출 0회)
fixtures/         합성 transcript 생성기 + mock 모델 + 예시 실행 결과
```

## fixtures/ 에 대한 경고

`fixtures/make_fixture.js` 가 만드는 데이터는 **전부 조작된 것**이다.
parser/filter 회귀 테스트 용도로만 존재한다.

합성 이력에는 작성자가 넣어둔 시간축 패턴만 들어 있으므로,
**그 위에서 IntentGuard vs Baseline 을 측정하면 순환논증이 된다.**
GO / NO-GO 판단에 절대 사용하지 않는다.

## 대상 프로젝트 보호 (명세 §35)

이 도구는 분석 대상 프로젝트를 **읽기만** 한다.
코드 수정 / 삭제 / 설정 변경 / git commit 을 하지 않는다.
모든 산출물은 `intentguard-prototype/` 안에만 쓴다.
