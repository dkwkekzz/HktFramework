# STATE — 현재 상태

> **이 문서만 보고 다음 세션을 시작할 수 있어야 한다.** 규칙·불변 원칙은 [CLAUDE.md](CLAUDE.md),
> 설계 본체는 [Design-ObjectiveHierarchy.md](Design-ObjectiveHierarchy.md),
> 실행 계획은 [Design-StepPlan.md](Design-StepPlan.md). 완료 이력은 git.

## 현재 — 한눈에

- **StepPlan 6 Phase 19 step 전부 완료 — M1~M6 달성.** (A 기질 · B 코어 · C 발견 · D 시각화 ·
  E 플래너 · F 다중 행위자). `bash run.sh` = 설치 → `npm test`(112 케이스 전건 통과) → 데모 서버.
  순수 JS(ESM, Node 20+), 런타임 의존은 `js-yaml` 1개. 자동 회귀와 데모(눈 검증)가 같은 코드 경로.
- 살아있는 세계 관전이 원클릭으로 재현된다: 봇 N기가 각자 독립 믿음으로 목적 그래프를 굴리고,
  같은 무대의 유한 공급을 두고 경쟁하며, 한 봇의 완료 `aftermath` 가 세계를 바꿔 다른 봇의 새 목적을
  낳는다. 그래프는 **액터의 믿음**(발견·가설 반증·역결합), **방사형·별자리 뷰로 보이며**(렌더러는
  Scene 서술자만 소비), **세계는 목적에 재해석으로 응답한다**(스폰 금지 + 규칙 분해 + E2 관문).
- 여섯 불변 원칙이 모두 회귀 테스트로 고정됨: ① done_when 경로 무관 · ② 속성 기반 다중 해법 ·
  ③ 그래프=믿음 · ④ 재해석(스폰 금지) · ⑤ 자동+눈 이중 검증 · ⑥ 렌더러 의존 방향(src import 0).
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

### Phase E 로 참이 된 명제 (`src/planner/`)

- **E1** `reinterpret.js` `scan(demand, world) → StageCandidate[]` — 이미 존재하는 세계 요소를 속성
  매칭으로 Stage 후보(§4.5)로 감싼다. supplies ⊆ 요소의 실속성, obstacles 는 실속성에서 파생
  (발명 금지). **스폰 금지**: 없는 것은 후보가 되지 않고, 스캔은 세계를 바꾸지 않음(읽기 전용).
  후보는 미발견(발견은 C1 경로로만). 불변 원칙 ④ 회귀 고정.
- **E2** `constraints.js` `checkBranch` — (a) demand 가 재료 10종으로 환원 (b) done_when 이 DSL 로
  기계 판정 가능 (c) 응답 기회가 세계에 ≥ 1 실존(E1 스캔 재사용). B1 정적 검사의 동적 확장.
  `backlogAgainstWorld` — 절편 세계 대비 (c) 실패 = "아직 무대 없는" 백로그(G-0.1.1.3.2/3.3 등).
- **E3** `decompose.js` — 분해 템플릿 표(`data/decompose-templates.yaml`, 장애물 유형 → 하위 목적
  골격)로 상위 목적+세계 → 하위 목적 계산. 후보는 E2 관문 통과 후에만 편입, `epistemic:추정`.
  **두 세계 분해 차이**: 같은 목적을 육체형 신(→파괴 수단)/신앙형 신(→숭배 교란)에 다르게 분해.
  LLM 접합면(입력·출력·관문·반려)은 `decompose.js` 주석에 고정 — 규칙이든 LLM 이든 접합면 동일.
### Phase F 로 참이 된 명제 (`src/actors/multibot.js`)

- **F1** `multibot.js` `runMultiSim` + `data/world-multi.yaml` — 봇 N기가 각자 독립 `BeliefView` 를
  굴린다. 유한 공급 무대에서 **선착 소진 경쟁**(A 성공 / B 밀림). 완료 `aftermath` 가 세계 상태를
  바꾸고 사건으로 감사되며(원장·사건 정합), 드러난 요소로 **E3 플래너를 깨워** 봇 B 에 신규 목적
  (G-0.1.4) 발견 + 하위 목적 계산. 두 봇의 믿음 독립. N봇 후 `audit()`·사건 감사 성립.
- **F2** 관전 통합 — 서버가 `/api/demo` 로 관전 Scene 서술자를 방송(폴링), 데모가 봇 관전 뷰
  (완료 파문 + aftermath 신규 목적)를 렌더. shot ③ 등록. `bash run.sh` 원클릭 관전(M6).
- 타 트랙 참조 없음 — 이 폴더 안에서 완결.

## NEXT — 다음 할 일 (StepPlan 완주 — 다음 트랙 후보)

StepPlan 6 Phase 19 step 을 모두 닫았다. 다음 세션이 열 수 있는 후속 트랙(StepPlan §2 주의·§10
미결정에서 예고된 것들 — 각각 새 step 열이 필요):

1. **월드 렌더 트랙** — Design-Visualization §10 의 본격 하이브리드 렌더(three.js·속성 채널·AI
   에셋). D1 의 Scene 서술자가 이 트랙과 공유하는 계약이다(이미 확정). 목적 그래프 UI(Canvas 2D)
   너머 실제 무대/개체 3D 렌더.
2. **LLM 플래너 트랙** — E3 의 규칙 분해를 LLM 분해로 교체. 접합면은 `decompose.js` 주석에 고정됨
   (입력=목적+세계 요약 / 출력=가지 YAML / 관문=E2 / 반려 루프). 프롬프트 설계가 미결정.
3. **멀티플레이어 권위 트랙** — F 는 단일 프로세스 봇까지. 서버 권위·동기화 모델이 미결정.
4. **절편 확장** — Slice-1 을 넘어 0.1.1.3(피해 수단 제작)·0.2.3(약물) 가지까지 종단 실행,
   미발견 무대(S-0201/S-0202) 발견 경로(C3 역결합)와 E2 백로그 소진.

권장: 눈에 보이는 성과가 가장 큰 **1(월드 렌더)** 또는 자기 확장성이 열리는 **4(절편 확장)**.
재사용 자산: 전 Phase 의 `src/` 모듈 + `demo/` 렌더러 + 112 케이스 회귀.
