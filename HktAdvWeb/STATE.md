# STATE — 현재 상태

> **이 문서만 보고 다음 세션을 시작할 수 있어야 한다.** 규칙·불변 원칙은 [CLAUDE.md](CLAUDE.md),
> 설계 본체는 [Design-ObjectiveHierarchy.md](Design-ObjectiveHierarchy.md),
> 실행 계획은 [Design-StepPlan.md](Design-StepPlan.md). 완료 이력은 git.

## 현재 — 한눈에

- **Phase A(세계 기질)·B(목적 그래프 코어)·C(발견 상태)·D(시각화 최소) 완료 — M1~M4 달성.**
  `bash run.sh` = 설치 → `npm test`(87 케이스 전건 통과) → 데모 서버. 순수 JS(ESM, Node 20+),
  런타임 의존은 `js-yaml` 1개. 자동 회귀와 데모(눈 검증)가 같은 코드 경로를 쓴다.
  봇 1기가 `동기(G-0) → 세부 목적(G-0.1.1.2) → 말단(G-0.1.1.2.1) → 절차(S-0045 채취)` 사슬을
  자동 완주하고, 그래프는 **액터의 믿음**이며(발견 상태·가설 반증·역결합), 이제 **방사형·별자리
  뷰로 눈에 보인다**(렌더러는 Scene 서술자만 소비 — 불변 원칙 ⑥ 기계 강제).
- 설계·seed 데이터(기존):
  - [Design-ObjectiveHierarchy.md](Design-ObjectiveHierarchy.md) v0.3 · [Design-Visualization.md](Design-Visualization.md) v0.1 ·
    [Design-StepPlan.md](Design-StepPlan.md) v0.1 (6 Phase 19 step).
  - [data/objective-graph.yaml](data/objective-graph.yaml) — seed 목적 그래프. **B1 이 구조 정합
    (id 유일성·참조 무결·serves DAG·뿌리 도달·술어 파싱·속성 사전·17 동사·죽은 무대)을 기계 인수** —
    이제 "검증된 데이터". 39 노드·4 무대·경고 0.
  - [data/property-lexicon.yaml](data/property-lexicon.yaml) — 속성 사전(속성명의 정본).
  - [data/world-slice1.yaml](data/world-slice1.yaml) — Slice-1 세계 픽스처(B4): 조직 조각 개체
    (소멸타이머)·봇 1기·시간 진행.

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

### Phase B 로 참이 된 명제 (`src/graph/`, `src/actors/`)

- **B1** `schema.js`(17 동사·발견 4값·필수 필드) · `loader.js` — seed 그래프를 "검증된 데이터"로
  인수. 검사: id 유일성·`serves`/`stages`/`alternatives` 참조 무결·`serves` DAG(사이클)·뿌리 `G-0`
  도달·술어 파싱(A4)·demand/supplies 속성 사전 등재·17 동사·`predicate_dsl` 버전·죽은 무대(경고).
  **주의**: seed 의 `serves` 는 분해 에지와 공급 에지(DAG 교차)를 겸하므로 "말단만 verb" 구조 결합은
  강제하지 않고 verb 어휘만 검사. bad 픽스처 15종으로 각 거부를 증명.
- **B2** `demand.js` `matchDemand` — 보유형은 인벤토리·세계 속성 스캔, 상태형은 상태 창 판정.
  **다중 해법 기계 증명**: 서로 다른 archetype 2종(조직 조각·권속 심장)이 같은 잔향 demand 를 충족
  (불변 원칙 ②). 시간 창 밖이면 미충족 + `nextInfo`.
- **B3** `complete.js` `checkDone`(= done_when 의 현재값, 영구 플래그 아님 → 세계 변화 시 재개방) ·
  `ripple.js` — 완료가 `serves` 계보를 타고 상향 파문(조상마다 조건 trace). DAG 다중 부모면 갈래별
  파문(권속의 심장 → `G-0.2.3.2`·`G-0.1.1.2` 동시). **경로 무관 판정** 회귀 고정(불변 원칙 ①).
- **B4** `data/world-slice1.yaml` · `actors/bot.js` `runSlice` — 봇 v0(계획 없음, 반응만)가 사슬을
  자동 완주(M2). 시간 압박: 소멸타이머 > 이동 → 성공 / 짧으면 무대 소멸 → 실패. 완주 후 `audit()`
  + 사건 로그 감사 성립.

### Phase C 로 참이 된 명제 (`src/epistemic/`)

- **C1** `belief.js` `BeliefView` — 액터별 발견 상태(미발견/추정/확인/반증). 미발견 노드는 봇 시점
  그래프에서 "?" 로만, 미발견 무대는 좌표 대신 탐색 영역 단계로만. 두 액터의 믿음이 독립.
  **A4 `epistemic` 스텁 해제** — `ctx.belief` 주입 시 `BeliefView.query(spec)`(target/tag)로
  실판정(`G-0.1.1.2` 의 done_when 이 이제 실판정). belief 미주입 시 여전히 스텁(하위 호환).
- **C2** `hypothesis.js` — 가설(추정 지식 노드) 판정: 실험 반응 vs 예측 → 확인(재현 ≥ `재현_최소`)
  / 반증. 반증 시 그 가설에만 매달린 하위 가지가 믿음에서 붕괴(모든 부모가 붕괴 집합일 때만 —
  다른 살아있는 부모가 있으면 생존, DAG 의 이점). 경합 가설 H1 확인 / H2 반증·붕괴 → `G-0.1.1.2`
  충족·파문. 법칙 표에 `실험`·`검증` 동사 추가. (M3)
- **C3** `retrobind.js` — 획득 시 발견된 어떤 demand 와도 안 닿는 재료 = 용도 불명. 새 가지 발견 시
  보유 재료를 그 demand 에 대조해 매칭되면 `retro-bind`(가지 발견 전이 + 재료·노드 연결).

### Phase D 로 참이 된 명제 (`src/scene/`, `demo/graph-*.js`)

- **D1** `scene/viewmodel.js` `buildScene` — `세계+BeliefView+이벤트 → Scene 서술자`. `goalGraph.nodes`
  는 BeliefView 파생(미발견은 "?", 전역 제목 비노출). 속성→채널 번역표 `data/channel-map.yaml`
  (GLOW·JITTER). 조건 슬롯 = trace 서술 텍스트(퍼센트 금지). ViewModel 은 순수(스냅샷 회귀).
- **D2** `demo/graph-radial.js` — 방사형 뷰(깊이 환). 발견 상태 4값 문법(확인=선명/추정=흐림·떨림/
  미발견=성운"?"/반증=붕괴 X). 조건 슬롯 텍스트.
- **D3** `demo/graph-constellation.js` — 별자리 + 파문 연출. `effects`(ripple 경로·collapse·retro-bind)
  소비 — 파문 경로는 ViewModel 이 계산(렌더러 재유도 금지). 권속의 심장 2갈래 동시 파문.
- **불변 원칙 ⑥ 기계 강제**: 렌더러(`demo/graph-*.js`)가 `src/` 를 import 하지 않음을 스캔 테스트로
  고정. shot ①②는 브라우저 없으면 스킵+경고(등록만).
- 타 트랙 참조 없음 — 이 폴더 안에서 완결.

## NEXT — 다음 할 일

**step E1 — 재해석 스캐너** ([Design-StepPlan.md](Design-StepPlan.md) §7 E1):

- `src/planner/reinterpret.js` — `scan(demand, world) → StageCandidate[]`: demand 가 주어지면 **이미
  존재하는** 세계 요소(개체·장·환경 상태)를 속성 매칭으로 Stage 후보로 감싼다(§4.5 스키마).
  supplies·obstacles 는 요소의 실제 속성·주변 상태에서 파생 — **발명하지 않는다**(불변 원칙 ④).
- **스폰 금지 테스트**: 세계에 없는 속성 → 후보 0건, 요소 추가 후에만 등장. 스캔 전후 세계 상태
  해시 불변(스캐너는 읽기 전용). 후보의 발견은 C1 경로(정보 재료)로만 — 스캔이 곧바로
  BeliefView 에 꽂히지 않는다.
- done_when: 불변 원칙 ④ 가 회귀 테스트로 고정된다 (M5 의 절반).
- 재사용 자산: B2 `matchDemand`(속성 스캔)·C1 `BeliefView`. 이후 E2(생성 제약 검사기) →
  E3(규칙 기반 플래너 v0). 그다음 F(다중 행위자).
  주의: 본격 월드 렌더(three.js)·LLM 분해는 이 계획 밖.
