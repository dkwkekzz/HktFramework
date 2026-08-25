# content/blank — 최소 컨텐츠 팩 (분리의 증명)

기반/컨텐츠 분리(P5 — [루트 design/Design-System-Content-Separation.md](../../design/Design-System-Content-Separation.md))의
수용 기준이다: **engine/ 을 한 줄도 고치지 않고** 두 번째 팩이 뜨고 움직인다.

## 무엇이 있는가

```text
world/index.ts   존재 종류 1(blank-walker) · interaction 1(move) · 시스템 1(이동 진행)
view/index.ts    최소 결정 Layer — placeholder 그림 · 지형 클릭/이동키 · 빈 명령 표면
master/root.md   비어 있는 Root — 새 Root 를 쓰는 자리 (Human 소유)
world/tests/     스모크 검증 — 참여 → 관찰 → 이동 요청 → 자리가 바뀐다
```

모션도, 스프라이트 표도, 명령도 없다 — 엔진의 placeholder 와 봉투가 전부 받아 준다.

## 활성화하는 법

코드 조립 포인터 셋과 공정 선언 하나를 이 팩으로 바꾼다. engine/ 은 건드리지 않는다.

```text
content/active.ts          createWorld · TICK_INTERVAL → './blank/world/index'
content/active-view.ts     resolvePresentation 외 4종 → './blank/view/index'
content/active-catalog.ts  (카탈로그 표가 없으므로 비활성 — 이 팩은 kind 정적 데이터 3원소를 쓰지 않는다)
hkt.pack.json              { "active": "blank" }
```

`npm run dev` 로 뜨고, WASD/클릭으로 움직인다. 검증은 팩 스모크 테스트가 상시 수행한다 —
포인터를 바꾸지 않아도 `npm test` 가 이 팩을 엔진 위에서 직접 돌린다.
