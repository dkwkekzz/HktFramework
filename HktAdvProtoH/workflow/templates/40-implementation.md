# 40-implementation — <PKG-ID>

## 코드 맵

> Rule/State/Observable/View 각각이 코드 어디에 존재하는지. 추적 ID 를 코드 주석에도 남긴다.

| 설계 요소 | 코드 위치 |
|---|---|
| RULE-… | |
| Actor.Knowledge | |
| OBS-… | |
| DesignerView | |

## §24 완료 자체 점검

- [ ] Goal/Possibility Trace — 코드에서 설계 ID 로 역추적 가능
- [ ] Intent — 의미 변경 없음
- [ ] World State — 요구 상태 전부 존재
- [ ] World Rule — Precondition/Transition 이 20-world.md 와 일치
- [ ] Runtime Transition — 실제 상태 전이 발생
- [ ] Observable State — 계약된 상태 전부 노출
- [ ] Observable Transition — Before/Input/Rule/After 관측 가능
- [ ] View — Observable 만 읽음 (World 내부 직접 접근 없음)

## World Design Gap Proposal

> 설계에 없는 의미가 필요해진 경우. **임의로 확정하지 말고** 여기 기록 후 사용자에게 보고한다.

```text
WORLD DESIGN GAP
Intent: INTENT-…
Missing Semantic: …
Reason: …
Proposed State/Rule: …
```

(없으면 "없음")

## 비고

임의 결정 사항(자료구조, 파일 분리 등 Mechanism 선택)과 그 이유.
