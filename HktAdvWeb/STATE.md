# STATE — 현재 상태

> **이 문서만 보고 다음 세션을 시작할 수 있어야 한다.** 규칙·불변 원칙은 [CLAUDE.md](CLAUDE.md),
> 설계 본체는 [Design-ObjectiveHierarchy.md](Design-ObjectiveHierarchy.md),
> 실행 계획은 [Design-StepPlan.md](Design-StepPlan.md). 완료 이력은 git.

## 현재 — 한눈에

- **Phase A(세계 기질) 완료 — 세계 상태가 술어로 읽힌다(legible). M1 달성.**
  `bash run.sh` = 설치 → `npm test`(36 케이스 전건 통과) → 데모 서버. 순수 JS(ESM, Node 20+),
  런타임 의존은 `js-yaml` 1개. 자동 회귀와 데모(눈 검증)가 같은 코드 경로를 쓴다.
- 설계·seed 데이터(기존):
  - [Design-ObjectiveHierarchy.md](Design-ObjectiveHierarchy.md) v0.3 · [Design-Visualization.md](Design-Visualization.md) v0.1 ·
    [Design-StepPlan.md](Design-StepPlan.md) v0.1 (6 Phase 19 step).
  - [data/objective-graph.yaml](data/objective-graph.yaml) — seed 목적 그래프(술어 DSL v0 명세 포함,
    Slice-1 정의). **A4 가 모든 done_when/demand 술어를 파싱·평가(스텁 포함)함을 회귀로 고정** —
    구조 정합 인수(id 유일성·참조 무결·DAG)는 아직 미검증(step B1).
  - [data/property-lexicon.yaml](data/property-lexicon.yaml) — 속성 사전(속성명의 정본).

### Phase A 로 참이 된 명제 (`src/substrate/`)

- **A1** `package.json`·`demo/server.js`(node:http)·`run.sh`·`demo/shot.js`(브라우저 없으면 스킵+경고).
  서버 기동→`GET /`→200 및 `/api/demo` 스냅샷이 테스트로 상시 회귀.
- **A2** `lexicon.js`·`substance.js` — 속성명은 사전이 정본, 미등재 속성 조회는 **예외**.
  `World.scan` 은 아키타입이 달라도 속성만 맞으면 찾는다(다중 해법의 씨앗, 불변 원칙 ②).
- **A3** `ledger.js` — 사유(cause) 필수 이체 + 보존 불변식 `audit()`(mint == Σ잔고 + burn).
  무작위 이체 200회 후에도 성립. `mint/burn` 은 세계 경계 사유 전용.
- **A4** `predicate.js` `evalPred(pred, ctx) → {value, trace}` — `all/any/not/has/state/epistemic/event`
  + 비교 6종 + `const.<이름>` 해석. `epistemic`/`event` 는 belief/events 미주입 시 **스텁**
  (인터페이스만 고정 — C1/A5 에서 실체화). trace 가 "숫자 없는 진행"의 먹이.
- **A5** `events.js`(append-only) · `laws.js` — **상태 변경의 유일한 경로는 `apply`**(법칙 존재→
  에너지 지불→상태전이→사건 기록, 원자적). 법칙 밖 전이 거부. 절편 동사 `채취`·`관찰` 등재
  (나머지 15 동사는 표 비움). `채취` 순도=정밀도 함수, `event` 술어가 사건 로그를 실판정.
- 타 트랙 참조 없음 — 이 폴더 안에서 완결.

## NEXT — 다음 할 일

**step B1 — 그래프 스키마 + seed 로더/정합 검사기** ([Design-StepPlan.md](Design-StepPlan.md) §4 B1):

- `src/graph/schema.js`(GoalNode/Stage 필드 규칙) + `src/graph/loader.js` — seed 그래프 로드 후
  기계 검사: id 유일성 · `serves`/`stages`/`alternatives` 참조 무결 · `serves` DAG(사이클 검출)이
  뿌리 `G-0` 에 닿음 · 모든 done_when/demand 술어가 A4 로 파싱(이미 성립) · demand·supplies 속성명이
  사전에 존재 · 17 동사 목록 · 말단만 verb 보유 · 죽은 무대(supplies 미대응) 경고.
- 고의 오염 픽스처(`test/fixtures/bad-*.yaml`)로 각 검사 항목의 거부를 증명.
- done_when: `npm test` 안에서 seed 그래프 정합 검사가 상시 회귀로 돈다.
- 재사용 자산: A4 `evalPred`(술어 파싱)·A2 `lexicon`(속성명 정본). 이후 B2(demand 판정) →
  B3(done_when 파문) → B4(최소 수직 절편 = M2).
