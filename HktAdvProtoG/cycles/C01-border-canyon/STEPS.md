# C01 Module Step 목록

고정 순서 `V → O → S → D → P → Q → W → R → E → G → C → X → N → A`.
모드는 CREATE / EXTEND / REFINE / HARDEN / REUSE — SKIP 없음.
각 Step 은 헌법 §13 템플릿 필드를 갖춘다. 하위 모듈 번호(V0, D4 …)는
[docs/Design-ModulePlan.md](../../docs/Design-ModulePlan.md) 를 따른다.

> **선행 게이트**: Foundation(Phase 0 — V0~V4 기반, O~A 최소 인터페이스, 스키마,
> 리플레이 저장소, 권위 서버 껍질)이 완료되어야 C01-V 에 진입한다.
> Foundation 은 Cycle Step 이 아니며 아래 목록에 포함하지 않는다.

---

## V — 검증 기반

```yaml
id: C01-V-S01
module: V0~V4
mode: EXTEND            # Foundation 산출물에 C01 자산을 등록·연결
purpose: "C01 계약·Situation·Scenario·리플레이·완료 증거를 검증 기반에 등록한다"
player_visible_contribution:
  - "(간접) 같은 세계가 재현되고, 버그 원인이 인과 경로로 추적된다"
mmorpg_loop_contribution: [persistent_world]
consumes:
  - {artifact: "Foundation V0~V4 (계약 레지스트리·결정적 Tick·Scenario Runner·Lab·증거 생성기)", from: Foundation}
  - {artifact: "CYCLE.yaml / SCENARIOS.md", from: 계획}
produces:
  - {artifact: "C01 Cycle·Scenario 등록", consumedBy: [모든 Step]}
  - {artifact: "cycle:lint / cycle:trace 실행 환경", consumedBy: [C01-A-S01, 통합 판정]}
implementation:
  filesToCreate: ["packages/verification/ 내 C01 등록 코드", "cycles/C01-border-canyon/scenarios/ 골격"]
  functions: [{name: registerCycle, deterministic: true}, {name: runScenarioSet, deterministic: true}]
verification:
  scenarios: ["SC-C01-V-01 같은 시드·입력 → 같은 상태 해시", "SC-C01-V-02 다른 입력 → 최초 차이 Tick 보고"]
  labPanels: ["Cycle 등록 현황", "Scenario 실행 결과"]
done: "cycle:lint C01 이 골격 수준에서 통과, 결정성 스모크 통과"
risks: "Foundation 스키마가 C01 요구를 못 담으면 여기서 즉시 드러남 (조기 발견이 목적)"
```

## O — 세계관 공리와 존재론

```yaml
id: C01-O-S01
module: O0
mode: CREATE
purpose: "C01 핵심 공리 7종과 평가기를 등록한다 (§16 상세 설계 그대로)"
axioms: [사건 기반 상태 변경, 자원·비용 보존, 능력 흔적, 관찰 세계 고정, 조직 실체 행동, 신의 유지 조건, 권위 충돌 확정]
player_visible_contribution:
  - "능력·의례에 비용과 흔적이 생긴다"
  - "관찰한 장소가 임의로 바뀌지 않는다"
  - "고유 자원 소유권이 공유 세계에서 일관된다"
mmorpg_loop_contribution: [exploration, combat, economy, social, persistent_world, multiplayer]
consumes: [{artifact: "AxiomSpec 인터페이스", from: Foundation}]
produces:
  - {artifact: "AxiomRegistry(7종)+validate 4함수", consumedBy: [C01-W-S01, C01-R-S01, C01-E-S02, C01-N-S01, C01-A-S01]}
verification:
  failureTests: ["기관 미소비 무한 치료제 생산 → 보존 위반", "사건 없는 신 안정도 수정 → 사건 기반 위반",
                 "관찰된 동굴 소급 이동 → 관찰 고정 위반", "병사 없는 광산 점유 변경 → 조직 실체 위반",
                 "이중 소유자 → 권위 확정 위반"]
  labPanels: ["공리 목록·phase·통과/실패·위반 상태 경로"]
done: "공리 7종 등록 + 실패 Scenario 5종 통과 + registryHash 증거"
```

```yaml
id: C01-O-S02
module: O1~O2
mode: CREATE
purpose: "협곡 존재론(장소·자원·주체·계약·사건 타입)과 상태·규칙 스키마를 정의한다"
player_visible_contribution: ["(간접) 세계 요소가 전 모듈에서 같은 의미를 가진다"]
mmorpg_loop_contribution: [persistent_world]
consumes: [{artifact: AxiomRegistry, from: C01-O-S01}]
produces: [{artifact: "WorldOntology + StateSchema v1", consumedBy: [C01-S-S01, C01-W-S01, C01-R-S01, C01-N-S02]}]
verification: {unitTests: ["스키마 검증·버전 필드"], scenarios: ["SC-C01-O-01 스키마 위반 요소 거부"]}
done: "CYCLE.yaml 의 places/resources/subjects 전부가 존재론 타입으로 표현됨"
```

## S — 주체 원형

```yaml
id: C01-S-S01
module: S0~S3
mode: CREATE
purpose: "8종 주체 원형(주민·치료사·상인·국가 관리인·밀수업자·마물·신·자원 군락)과 플레이어 역할 8종, 개별 주체 생성기를 만든다"
player_visible_contribution: ["서로 다르게 감지하고 행동하는 주체가 존재한다"]
mmorpg_loop_contribution: [exploration, combat, economy, social]
consumes: [{artifact: WorldOntology, from: C01-O-S02}]
produces: [{artifact: "SubjectArchetypes + IndividualSubjects", consumedBy: [C01-D-S01, C01-C-S01, C01-W-S01]}]
verification:
  unitTests: ["같은 시드 → 같은 개별 주체 (결정성)"]
  scenarios: ["SC-C01-S-01 원형별 지각·행동 후보 차이 확인"]
done: "8원형+역할 8종 생성, Lab 에서 원형별 속성·의존 목록 확인"
```

## D — 의존 그래프

```yaml
id: C01-D-S01
module: D0~D4
mode: CREATE
purpose: "의존 대상 7계열(식량·안전·광물·기관·이동로·의례·정당성)의 그래프 생성과 충족도 평가를 만든다"
player_visible_contribution: ["세력과 생물이 왜 행동하는지 이유가 생긴다 — 마물이 임의로 마을을 공격하지 않는다"]
mmorpg_loop_contribution: [exploration, hunting, economy, faction, persistent_world]
consumes: [{artifact: IndividualSubjects, from: C01-S-S01}, {artifact: WorldStateSnapshot, from: C01-O-S02}]
produces: [{artifact: "DependencyPressureSet + RegionalPressureSnapshot", consumedBy: [C01-P-S01, C01-E-S01, C01-X-S02]}]
verification:
  scenarios: ["SC-C01-D4-01 식량 감소 → 마을 압력 상승·목적 변화", "SC-C01-D4-BASE-01 단일 인간 식량 압력 계산"]
  propertyTests: ["압력은 결핍 단조 증가", "동일 상태 → 동일 압력 (결정성)"]
done: "5세력+마물+신의 압력이 Lab 에서 상태 변화에 따라 갱신됨"
```

```yaml
id: C01-D-S02
module: D5
mode: CREATE
purpose: "같은 자원·공간·대상에 걸린 의존 충돌을 탐지한다 (Situation 의 원료)"
player_visible_contribution: ["(간접) 세력 갈등이 임의 스크립트가 아니라 충돌 구조에서 나온다"]
mmorpg_loop_contribution: [faction, multiplayer]
consumes: [{artifact: DependencyPressureSet, from: C01-D-S01}]
produces: [{artifact: DependencyConflictSet, consumedBy: [C01-E-S01, C01-Q-S01]}]
verification: {scenarios: ["SC-C01-D5-01 광산 확장 시 국가·밀수·마물 3자 충돌 탐지"]}
done: "5개 Situation 의 충돌 구조가 모두 D5 출력으로 표현됨"
```

## P — 가능성 그래프

```yaml
id: C01-P-S01
module: P0~P5
mode: CREATE
purpose: "행동 원자와 전략 9계열(탐험·사냥·채집·제작·거래·운송·밀수·의례·협상), 목적 선택·유지·행동 계획을 만든다"
player_visible_contribution: ["같은 문제를 여러 방식으로 해결할 수 있다 — 마물 위협에 사냥/복구/의례/협상/대피가 모두 유효"]
mmorpg_loop_contribution: [exploration, combat, crafting, economy, social, progression]
consumes: [{artifact: "DependencyPressureSet·ConflictSet", from: "C01-D-S01·S02"}]
produces: [{artifact: "PossibilityGraph + GoalSelection + ActionPlan", consumedBy: [C01-Q-S01, C01-R-S02, C01-G-S01]}]
verification:
  scenarios: ["SC-C01-P4-01 마물 경로 선택이 비용·위험에서 계산", "SC-C01-P-02 동일 압력에 주체 원형별 다른 전략"]
  propertyTests: ["선택은 후보 중 최소 비용·위험 근거를 가짐 (설명 가능)"]
done: "Lab 에서 압력 → 목적 → 전략 → 행동 계획 사슬을 주체별로 추적 가능"
```

## Q — 세계 요구

```yaml
id: C01-Q-S01
module: Q0~Q3
mode: CREATE
purpose: "각 전략의 공간·자원·규칙·정보·상대·역사 요구를 추출·평가하고 근거를 추적한다"
player_visible_contribution: ["콘텐츠가 임의 배치되지 않는다 — 광산·습지·통로·제단이 존재하는 이유가 생긴다"]
mmorpg_loop_contribution: [exploration, persistent_world]
consumes: [{artifact: PossibilityGraph, from: C01-P-S01}, {artifact: DependencyConflictSet, from: C01-D-S02}]
produces: [{artifact: "WorldRequirementGraph (근거 포함)", consumedBy: [C01-W-S01]}]
verification: {scenarios: ["SC-C01-Q-01 모든 요구 노드가 전략·의존성 근거를 가짐 (미근거 요구 = lint 오류)"]}
done: "TRACE.graph.json 의 요구 노드가 전부 Q 출력과 일치"
```

## W — 세계 컴파일

```yaml
id: C01-W-S01
module: W0~W4
mode: CREATE
purpose: "5세력+마물+신의 요구를 병합해 협곡의 규칙·상태·공간을 실체화한다"
player_visible_contribution: ["탐험할 실제 지역이 생긴다 — 마을·초소·광산·제단·습지·협곡·동굴·교역로"]
mmorpg_loop_contribution: [exploration, economy, persistent_world]
consumes: [{artifact: WorldRequirementGraph, from: C01-Q-S01}, {artifact: AxiomRegistry, from: C01-O-S01}]
produces: [{artifact: "CompiledRegion(규칙·상태·공간 그래프)", consumedBy: [C01-W-S02, C01-R-S01, C01-X-S01]}]
verification:
  scenarios: ["SC-C01-W1-01 다중 세력 요구가 하나의 협곡 구조로 병합", "SC-C01-W-02 공리 위반 제안 거부"]
done: "Lab 미리보기에서 장소 8종+경로 4종이 요구 근거와 함께 표시"
```

```yaml
id: C01-W-S02
module: W5~W6
mode: CREATE
purpose: "압축 역사(국경석 이동 이전의 상태)를 생성하고 잠재·암시·정식·관찰 상태를 구분해 정식 세계로 등록한다"
player_visible_contribution: ["현재 갈등의 근거가 생긴다 — 왜 국경석이 옮겨졌고 무엇이 달라졌는지 흔적으로 남는다"]
mmorpg_loop_contribution: [exploration, persistent_world]
consumes: [{artifact: CompiledRegion, from: C01-W-S01}]
produces: [{artifact: "CanonicalWorld v1 (초기 압력 구조 포함)", consumedBy: [C01-R-S01, C01-N-S02]}]
verification: {scenarios: ["SC-C01-W-03 관찰 상태 고정 — 관찰 후 소급 변경 거부"]}
done: "ST-C01-01 의 초기 조건(국경석 이동 직후)이 압축 역사로 설명됨"
```

## R — 세계 런타임

```yaml
id: C01-R-S01
module: R0~R2
mode: CREATE
purpose: "세계 상태 저장소·사건 로그·현상 생성을 만든다 — 모든 상태 변경은 사건 경유"
player_visible_contribution: ["세계에서 일이 '일어난다' — 제단 빛 약화·발자국·잔해가 현상으로 남는다"]
mmorpg_loop_contribution: [exploration, persistent_world]
consumes: [{artifact: CanonicalWorld, from: C01-W-S02}, {artifact: AxiomRegistry, from: C01-O-S01}]
produces: [{artifact: "EventLog + PhenomenonStream", consumedBy: [C01-R-S02, C01-E-S01, C01-X-S01, C01-N-S02]}]
verification:
  failureTests: ["사건 없는 직접 상태 수정 시도 → 거부"]
  propertyTests: ["이벤트 재생 = 상태 재현 (결정성)"]
done: "임의 상태 조회가 사건 이력으로 완전 설명됨"
```

```yaml
id: C01-R-S02
module: R3~R6
mode: CREATE
purpose: "지각·믿음·기억·관계·행동 의도를 만든다 — 주체는 실제 세계가 아니라 자신이 아는 정보로 행동한다"
player_visible_contribution: ["NPC 가 전지적이지 않다 — 국가 보고서와 실제 흔적이 다르면 서로 다른 믿음이 생긴다"]
mmorpg_loop_contribution: [exploration, social, combat]
consumes: [{artifact: PhenomenonStream, from: C01-R-S01}, {artifact: ActionPlan, from: C01-P-S01}]
produces: [{artifact: "BeliefState + ActionIntents", consumedBy: [C01-E-S01, C01-E-S02, C01-G-S01]}]
verification:
  scenarios: ["SC-C01-R4-01 보고서·흔적 불일치 → 상이한 믿음", "SC-C01-R5-BASE-01 거절 기억 → 다음 전략 반영"]
done: "Lab 에서 주체별 믿음 대 실제 상태 diff 확인 가능"
```

## E — 사건과 상호작용

```yaml
id: C01-E-S01
module: E0~E2
mode: CREATE
purpose: "압력·충돌에서 Situation 을 군집 계산하고, 사회적 상호작용(거래·협상·기만)과 약속·계약을 만든다"
player_visible_contribution: ["개입할 '상황'이 세계에 존재한다 — 호위 모집·재료 의뢰·은폐 시도가 계약과 소문으로 나타난다"]
mmorpg_loop_contribution: [social, economy, multiplayer]
consumes: [{artifact: DependencyConflictSet, from: C01-D-S02}, {artifact: "BeliefState·ActionIntents", from: C01-R-S02}]
produces: [{artifact: "ActiveSituations + Contracts", consumedBy: [C01-E-S02, C01-X-S02, C01-G-S01]}]
verification:
  scenarios: ["SC-C01-E0-01 ST-C01-01~05 가 조건 충족 시 발생·미충족 시 미발생", "SC-C01-E2-01 계약 위반 → 평판·관계 변화"]
done: "5개 Situation 전부가 상태 조건에서 계산되어 발생 (하드코딩 트리거 없음)"
```

```yaml
id: C01-E-S02
module: E3~E4
mode: CREATE
purpose: "행동 충돌 해결(소유권·전투·동시 행동)과 사건 연쇄를 만든다"
player_visible_contribution: ["플레이어·주체의 행동 충돌이 콘텐츠가 된다 — 같은 기관을 둘이 잡으면 한 명만 얻는다"]
mmorpg_loop_contribution: [combat, multiplayer, economy]
consumes: [{artifact: ActionIntents, from: C01-R-S02}, {artifact: AxiomRegistry(권위 확정), from: C01-O-S01}]
produces: [{artifact: "ResolvedEvents + EventChains", consumedBy: [C01-R-S01(기록), C01-G-S01, C01-N-S01]}]
verification:
  scenarios: ["SC-C01-E3-01 동시 획득 → 소유권 1회 확정", "SC-C01-E3-BASE-01 음식 하나 동시 획득 충돌", "SC-C01-E4-01 국경석 이동 → 연쇄 사건 전파"]
done: "충돌 해결이 결정적이고 권위 경로로만 확정됨"
```

## G — 성장과 의존 변형

```yaml
id: C01-G-S01
module: G0~G3
mode: CREATE
purpose: "숙련(흔적 판별·제작)·제작식·가능성 그래프 성장·의존 효율·대체를 얇게 만든다 (G4 탈피·G5 능력 생성은 비범위, 능력 조건 '발견'만 G1 지식으로 취급)"
player_visible_contribution: ["반복 플레이가 새로운 가능성을 연다 — 추적 반복 → 판별 정확도·비용 개선, 신뢰 획득 → 새 거래 접근"]
mmorpg_loop_contribution: [progression, exploration, crafting, social]
consumes: [{artifact: ResolvedEvents, from: C01-E-S02}, {artifact: PossibilityGraph, from: C01-P-S01}]
produces: [{artifact: "GrowthState + UnlockedPossibilities", consumedBy: [C01-P-S01(재입력), C01-X-S02, C01-N-S02]}]
verification:
  scenarios: ["SC-C01-G1-01 반복 추적 → 판별 가능성·비용 변화", "SC-C01-G-02 성장이 비용 없이 발생하지 않음 (보존 공리)"]
done: "성장 전후로 가능한 행동 집합이 실제로 달라짐 (Progression Gate 입력)"
```

## C — 복합 주체

```yaml
id: C01-C-S01
module: C0~C4
mode: CREATE
purpose: "거대 마물·국가 조직·밀수 조직·국경 신·자원 군락·생태 개체군을 복합 주체로 실행한다 (제한 해상도)"
player_visible_contribution: ["개인 NPC 를 넘어선 변화 — 마물 경로 변경, 국가 순찰·은폐, 신 영역 약화가 플레이어 없이 진행된다"]
mmorpg_loop_contribution: [exploration, combat, faction, economy, persistent_world]
consumes: [{artifact: SubjectArchetypes, from: C01-S-S01}, {artifact: "D~E 파이프라인 전체"}]
produces: [{artifact: "ComplexSubjectBehaviors", consumedBy: [C01-R-S02(의도), C01-X-S01(현상), C01-N-S01]}]
verification:
  scenarios: ["SC-C01-C-01 무개입 N-tick 진행 → Situation 발생·악화·해소 (World Autonomy)", "SC-C01-C-02 조직 행동이 구성원·자산 경유 (실체 공리)"]
done: "무개입 시뮬레이션에서 ST-C01-01 에스컬레이션이 고정 타임라인 없이 상태 계산으로 진행"
```

## X — 3D 공간과 웹 클라이언트

```yaml
id: C01-X-S01
module: X0~X2
mode: CREATE
purpose: "의미 공간 그래프 → 3D 공간 컴파일 → 웹 렌더링. W 출력만 사용 (좌표 하드코딩 금지)"
player_visible_contribution: ["실제로 걸어다닐 수 있는 협곡 — 장소 8종·경로 4종·현상(제단 빛·발자국·잔해)이 3D 로 보인다"]
mmorpg_loop_contribution: [exploration]
consumes: [{artifact: CompiledRegion, from: C01-W-S01}, {artifact: PhenomenonStream, from: C01-R-S01}]
produces: [{artifact: "Playable3DRegion", consumedBy: [C01-X-S02]}]
verification:
  scenarios: ["SC-C01-X-01 W 출력 변경 → 3D 반영 (하드코딩 없음 증명)"]
  labPanels: ["공간 그래프 대 3D 대응 확인"]
done: "브라우저에서 협곡 전역 탐험 가능, 현상이 세계 상태와 일치"
```

```yaml
id: C01-X-S02
module: X3~X4
mode: CREATE
purpose: "플레이어 조작(이동·상호작용·전투·채집·제작·거래)과 콘텐츠 UI(흔적 조사·소문·시장 시세·계약·평판)를 만든다"
player_visible_contribution: ["8역할의 실제 플레이 — 조사·사냥·제작·거래·계약·의례를 조작으로 수행하고 결과를 세계 현상으로 이해한다"]
mmorpg_loop_contribution: [exploration, combat, crafting, economy, social, progression]
consumes: [{artifact: Playable3DRegion, from: C01-X-S01}, {artifact: "ActiveSituations·Contracts·GrowthState", from: "C01-E-S01·C01-G-S01"}]
produces: [{artifact: "PlayerCommands(클라 → 서버 제출용)", consumedBy: [C01-N-S01]}]
verification:
  scenarios: ["SC-C01-X-02 내부 그래프 비노출 — UI 는 세계 현상·소문·가격만 표시 (Player Comprehension)"]
done: "퀘스트 목록 없이 흔적·소문·가격·NPC 행동만으로 5개 Situation 발견 가능"
```

## N — 멀티플레이 서버와 영속화

```yaml
id: C01-N-S01
module: N0 (+N1·N2 최소)
mode: CREATE
purpose: "단일 프로세스 권위 서버 — 명령 제출·검증·충돌 확정·상태 브로드캐스트. 관심 영역·해상도는 최소 구현"
player_visible_contribution: ["여러 플레이어가 같은 세계를 본다 — 동시 획득·계약·전투가 한 번만 확정된다"]
mmorpg_loop_contribution: [multiplayer, combat, economy]
consumes: [{artifact: PlayerCommands, from: C01-X-S02}, {artifact: "E3 충돌 해결·권위 공리"}]
produces: [{artifact: "AuthoritativeState", consumedBy: [C01-X-S01(표시), C01-N-S02]}]
verification:
  scenarios: ["SC-C01-N0-01 클라이언트 직접 확정 시도 → 거부", "SC-C01-E3-01 재사용 (서버 경유 버전)"]
done: "2+ 클라이언트 동시 접속, 충돌 확정이 서버에서만 발생"
```

```yaml
id: C01-N-S02
module: N3
mode: CREATE
purpose: "사건 로그+스냅샷 저장·재접속 복구"
player_visible_contribution: ["끈 뒤 다시 접속해도 세계가 이어진다 — 국경석·신 안정도·마물 경로·평판·계약 유지"]
mmorpg_loop_contribution: [persistent_world, progression]
consumes: [{artifact: AuthoritativeState, from: C01-N-S01}, {artifact: EventLog, from: C01-R-S01}]
produces: [{artifact: "PersistentWorldStore + 복구 경로", consumedBy: [다음 세션, C02 기준선]}]
verification:
  scenarios: ["SC-C01-N3-01 국경석 이동 후 저장·재접속 → 상태 유지", "SC-C01-N3-02 사건 로그 재생 복구 = 스냅샷 (해시 일치)"]
done: "저장·재접속·복구 3경로 모두 상태 해시 일치"
```

## A — AI 제작 자동화

```yaml
id: C01-A-S01
module: A0, A1~A2 (최소)
mode: CREATE
purpose: "구조화 콘텐츠 편집기와, 자원 군락 변형 후보 1종의 AI 생성 → 정적 검증 경로를 만든다. 검증 통과 후보만 정식 등록 가능 (A3·A4 는 Cycle 7)"
player_visible_contribution: ["(간접·다음 Cycle 대비) 새 콘텐츠가 같은 인과 구조·검증을 거쳐 추가된다"]
mmorpg_loop_contribution: [persistent_world]
consumes: [{artifact: "WorldOntology·AxiomRegistry", from: "C01-O-S01·S02"}, {artifact: "validateDefinition", from: C01-O-S01}]
produces: [{artifact: "ContentCandidate 파이프라인 (생성→정적 검증→등록 대기)", consumedBy: [C02+]}]
verification:
  failureTests: ["공리 위반 후보 → 거부", "검증 우회 등록 경로 없음 (lint)"]
done: "후보 1종이 정적 검증을 통과하고, 위반 후보가 거부되는 증거"
```

---

# 구현 순서 — 7개 구간

모듈 순서를 지키되, 각 구간 종료 시 플레이 가능한(또는 Lab 관찰 가능한) 통합 상태를 확인한다 (Phase 11 수직 통합).

## 구간 0 — Foundation (선행, Cycle 외)

- **포함**: Phase 0 전체 (V0~V4, 스키마, 리플레이 저장소, 서버 껍질, Lab·게임 공통 상태 연결)
- **결과**: Cycle 등록·Scenario 실행·결정성 해시·증거 생성이 가능한 빈 파이프라인
- **확인 장면**: Lab 에서 빈 Cycle 등록·더미 Scenario 실행
- **자동 검증**: 같은 시드·입력 → 같은 상태 해시
- **다음 구간 진입 조건**: Phase 0 완료 조건 7항 전부 충족

## 구간 1 — 주체와 압력 (C01-V-S01, O-S01, O-S02, S-S01, D-S01, D-S02)

- **결과**: 공리·존재론 위에서 8주체의 의존 압력·충돌이 계산됨
- **확인 장면**: Lab 텍스트 시뮬 — 식량을 줄이면 마을 압력이 오르고, 광산을 확장하면 3자 충돌이 탐지된다
- **자동 검증**: SC-C01-V-01/02, O 실패 5종, SC-C01-D4-01, D4-BASE-01, D5-01
- **진입 조건(→2)**: D5 출력이 5개 Situation 의 충돌 구조를 모두 표현

## 구간 2 — 전략과 세계 생성 (C01-P-S01, Q-S01, W-S01, W-S02)

- **결과**: 압력 → 전략 → 요구 → 협곡 실체화 (정식 세계 v1 + 압축 역사)
- **확인 장면**: Lab 지역 미리보기 — 장소·경로가 요구 근거와 함께 표시, 마물 경로 선택이 비용에서 계산
- **자동 검증**: SC-C01-P4-01, P-02, Q-01, W1-01, W-02, W-03
- **진입 조건(→3)**: cycle:trace C01 에서 미근거 세계 요소 0건

## 구간 3 — 살아있는 세계 (C01-R-S01, R-S02, E-S01, E-S02)

- **결과**: 사건·현상·지각·믿음·계약·충돌 해결이 도는 헤드리스 세계
- **확인 장면**: 헤드리스 Situation 실행 — ST-C01-01 이 조건에서 발생하고 개입 없이 악화된다
- **자동 검증**: R 결정성·사건 경유, SC-C01-R4-01, R5-BASE-01, E0-01, E2-01, E3-01, E3-BASE-01, E4-01
- **진입 조건(→4)**: 5개 Situation 전부 상태 계산으로 발생 (하드코딩 트리거 0)

## 구간 4 — 성장과 자율 세계 (C01-G-S01, C-S01)

- **결과**: 반복 실행에서 성장·생태·조직·신의 장기 변화
- **확인 장면**: 무개입 장기 시뮬 — 마물 습격→부상 증가→재료 부족→가격 상승 연쇄가 자율 진행
- **자동 검증**: SC-C01-G1-01, G-02, C-01, C-02
- **진입 조건(→5)**: World Autonomy Gate 의 4항 모두 헤드리스에서 통과

## 구간 5 — 3D 플레이 (C01-X-S01, X-S02)

- **결과**: 브라우저에서 8역할 플레이 가능한 협곡
- **확인 장면**: 흔적·소문·가격만으로 Situation 을 발견하고 역할별로 다르게 개입
- **자동 검증**: SC-C01-X-01, X-02 + 기존 Scenario 회귀
- **진입 조건(→6)**: Player Comprehension 4문을 개발자 콘솔 없이 답할 수 있음 (내부 확인)

## 구간 6 — 멀티플레이와 영속 (C01-N-S01, N-S02)

- **결과**: 권위 서버 경유 2+ 동시 접속, 저장·재접속
- **확인 장면**: 두 클라이언트가 같은 기관을 두고 경쟁, 재접속 후 세계 유지
- **자동 검증**: SC-C01-N0-01, E3-01(서버판), N3-01, N3-02
- **진입 조건(→7)**: Multiplayer·Persistence Gate 통과

## 구간 7 — AI 경로와 통합 판정 (C01-A-S01 + Acceptance)

- **결과**: 콘텐츠 후보 검증 경로 + Cycle 통합
- **확인 장면**: 위반 후보 거부·정상 후보 통과, 전체 Gate 체크리스트 실행
- **자동 검증**: A 실패 2종, cycle:lint/trace/scenario/replay 전체
- **완료**: [ACCEPTANCE.md](ACCEPTANCE.md) 10 Gate + 플레이 테스트 → `advprotog-cycle-integrator` 의 VERIFIED 판정으로 인계
