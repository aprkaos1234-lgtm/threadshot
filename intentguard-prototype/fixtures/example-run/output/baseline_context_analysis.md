# Baseline Context / History Coverage (명세 §17)

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
