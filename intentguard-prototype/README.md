# IntentGuard Validation Prototype

이것은 제품이 아니다. **하나의 가설을 반증하기 위한 실험 장치**다.

> Claude Code 의 장기 개발 기록에서 현재 유효한 Product Contract 를 복구할 때,
> IntentGuard 전용 파이프라인이 같은 기록을 장문맥 LLM 에 그대로 넣는
> 강한 Baseline 보다 **실질적으로** 더 나은가?

목표는 IntentGuard 를 살리는 것이 아니라 **필요 없다는 사실을 최대한 싸고 빨리 찾는 것**이다.

현재 진행 상태: **STEP 3 완료 후 정지.** (명세 §33)

---

## 사용법

```bash
cd intentguard-prototype

# 1) 이 머신에 어떤 Claude Code 이력이 있는지 확인
npm run projects

# 2) Smoke test — 최근 200개 raw user-role 레코드만
npm run analyze -- "/path/to/your/project" --limit 200

# 3) 기간 지정
npm run analyze -- "/path/to/your/project" --from 2026-01-01 --to 2026-06-30

# 4) 전체 이력
npm run analyze -- "/path/to/your/project"

# 필터 규칙을 고친 뒤에는 반드시
npm test
```

옵션: `--limit N` `--from ISO` `--to ISO` `--claude-home PATH` `--out DIR`

`analyze` 는 Stage 1(파싱 + 사람 메시지 필터링)까지만 실행하고 멈춘다.
Requirement Pipeline / Baseline / Benchmark 는 **사람이 샘플을 검토하기 전에는 실행되지 않는다.**

## 산출물

| 파일 | 내용 |
|---|---|
| `output/message_filter_samples.md` | **사람이 직접 검토할 파일.** 버킷별 샘플 + 제외된 노이즈 + 경계 사례 |
| `output/message_filter_report.md` | 카운트 리포트, 토큰 추정, 시간 범위 (명세 §7) |
| `output/parse_diagnostics.md` | 관측된 스키마 변형 — 유지보수 리스크 증거 (명세 §31) |
| `data/user_messages.json` | 정규화 타임라인 (명세 §8) |
| `data/user_messages.debug.json` | 위 + 분류 근거 + parser 진단 |

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
src/tokens.js     한국어를 고려한 오프라인 토큰 추정
src/analyze.js    CLI. STEP 3 에서 강제 정지
test.js           회귀 테스트 (STEP 4 에서 필터를 고칠 때의 안전망)
fixtures/         합성 transcript 생성기 + 참고 실행 결과
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
