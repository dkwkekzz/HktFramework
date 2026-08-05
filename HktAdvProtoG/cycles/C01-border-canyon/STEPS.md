# C01 Module Step 목록 (사냥 중심 재설계)

고정 순서 `V → O → S → D → P → Q → W → R → E → G → C → X → N → A`.
모드는 CREATE / EXTEND / REFINE / HARDEN / REUSE — SKIP 없음.
하위 모듈 번호는 [docs/Design-ModulePlan.md](../../docs/Design-ModulePlan.md) 를 따른다.

> **선행 게이트**: Foundation(Phase 0) 완료가 C01-V 진입 조건. Foundation 은 Cycle Step 이 아니다.

---

## V — 검증 기반

```yaml
id: C01-V-S01
module: V0~V4
mode: EXTEND
purpose: "C01 계약·Situation·Scenario·리플레이·완료 증거를 Foundation 검증 기반에 등록한다"
player_visible_contribution: ["(간접) 같은 세계가 재현되고 버그 원인이 인과로 추적된다"]
mmorpg_loop_contribution: [persistent_world]
consumes:
  - {artifact: "Foundation V0~V4", from: Foundation}
  - {artifact: "CYCLE.yaml / SCENARIOS.md", from: 계획}
produces:
  - {artifact: "C01 Cycle·Scenario 등록 + lint/trace 실행 환경", consumedBy: [모든 Step]}
verification:
  scenarios: ["SC-C01-V-01 같은 시드 → 같은 상태 해시", "SC-C01-V-02 차이 → 최초 차이 Tick 보고"]
done: "cycle:lint C01 골격 통과, 결정성 스모크 통과"
risks: "Foundation 스키마가 C01 요구를 못 담으면 여기서 조기 발견"
```

## O — 세계관 공리와 존재론

```yaml
id: C01-O-S01
module: O0
mode: CREATE
purpose: "C01 핵심 공리 5종과 평가기 등록 (신 유지·능력 흔적 공리는 대상 부재로 후속 Cycle 이월)"
axioms: [사건 기반 상태 변경, 자원·비용 보존, 관찰 세계 고정, 조직 실체 행동, 권위 충돌 확정]
player_visible_contribution:
  - "마물·부산물·치료제에 일관된 비용과 재고가 있다 (무한 생산·무근거 스폰 없음)"
  - "관찰한 서식지·흔적이 임의로 바뀌지 않는다"
  - "사냥한 개체의 소유권이 공유 세계에서 일관된다"
mmorpg_loop_contribution: [combat, economy, multiplayer, persistent_world]
consumes: [{artifact: "AxiomSpec 인터페이스", from: Foundation}]
produces:
  - {artifact: "AxiomRegistry(5종)+validate 함수", consumedBy: [C01-W-S01, C01-R-S01, C01-E-S02, C01-N-S01, C01-A-S01]}
verification:
  failureTests: ["재료 미소비 치료제 무한 생산 → 보존 위반", "사건 없는 개체수 직접 수정 → 사건 기반 위반",
                 "관찰된 둥지 소급 이동 → 관찰 고정 위반", "구성원 없는 조합 계약 발급 → 조직 실체 위반",
                 "동시 포획 이중 소유 → 권위 확정 위반"]
done: "공리 5종 등록 + 실패 Scenario 5종 통과 + registryHash 증거"
```

```yaml
id: C01-O-S02
module: O1~O2
mode: CREATE
purpose: "사냥터 존재론(장소·마물·부산물·계약·사건 타입)과 상태·규칙 스키마 정의"
player_visible_contribution: ["(간접) 세계 요소가 전 모듈에서 같은 의미를 가진다"]
mmorpg_loop_contribution: [persistent_world]
consumes: [{artifact: AxiomRegistry, from: C01-O-S01}]
produces: [{artifact: "WorldOntology + StateSchema v1", consumedBy: [C01-S-S01, C01-W-S01, C01-R-S01, C01-N-S02]}]
verification: {scenarios: ["SC-C01-O-01 스키마 위반 요소 거부"]}
done: "CYCLE.yaml 의 places/resources/subjects 전부가 존재론 타입으로 표현됨"
```

## S — 주체 원형

```yaml
id: C01-S-S01
module: S0~S3
mode: CREATE
purpose: "주체 원형 6종(주민·조합·상인·초식 무리·포식 마물·자원 군락)과 플레이어 역할 4종, 개별 주체 생성기"
player_visible_contribution: ["서로 다르게 감지·행동하는 주체가 존재한다 — 무리는 도망치고 포식자는 추격한다"]
mmorpg_loop_contribution: [exploration, combat, economy, social]
consumes: [{artifact: WorldOntology, from: C01-O-S02}]
produces: [{artifact: "SubjectArchetypes + IndividualSubjects", consumedBy: [C01-D-S01, C01-C-S01, C01-W-S01]}]
verification:
  unitTests: ["같은 시드 → 같은 개별 주체 (결정성)"]
  scenarios: ["SC-C01-S-01 원형별 지각·행동 후보 차이"]
done: "6원형+역할 4종 생성, Lab 에서 원형별 속성·의존 목록 확인"
```

## D — 의존 그래프

```yaml
id: C01-D-S01
module: D0~D5
mode: CREATE
purpose: "의존 대상 6계열(먹이·안전·부산물·치료·서식지/이동로·계약/평판) 그래프·충족도 평가·충돌 탐지"
player_visible_contribution: ["마물이 임의로 움직이지 않는다 — 먹이가 줄면 이동하고, 포식자가 굶으면 목장으로 온다"]
mmorpg_loop_contribution: [exploration, combat, economy, persistent_world]
consumes: [{artifact: IndividualSubjects, from: C01-S-S01}, {artifact: WorldStateSnapshot, from: C01-O-S02}]
produces:
  - {artifact: "DependencyPressureSet + ConflictSet", consumedBy: [C01-P-S01, C01-E-S01, C01-X-S02]}
verification:
  scenarios: ["SC-C01-D4-01 무리 감소 → 포식 마물 먹이 압력 상승·목적 변화", "SC-C01-D4-BASE-01 단일 개체 먹이 압력 계산",
              "SC-C01-D5-01 무리 과잉 시 군락·마을·조합 3자 충돌 탐지"]
  propertyTests: ["압력은 결핍 단조 증가", "동일 상태 → 동일 압력"]
done: "6주체의 압력이 Lab 에서 상태 변화에 따라 갱신, 5개 Situation 의 충돌 구조가 D5 출력으로 표현됨"
```

## P — 가능성 그래프

```yaml
id: C01-P-S01
module: P0~P5
mode: CREATE
purpose: "행동 원자와 전략 6계열(추적·사냥·채집·해체제작·거래·계약), 목적 선택·유지·행동 계획"
player_visible_contribution: ["같은 문제를 여러 방식으로 해결한다 — 마을 위협에 토벌/유인/먹이 회복/방어가 모두 유효"]
mmorpg_loop_contribution: [exploration, combat, crafting, economy, progression]
consumes: [{artifact: "DependencyPressureSet·ConflictSet", from: C01-D-S01}]
produces: [{artifact: "PossibilityGraph + GoalSelection + ActionPlan", consumedBy: [C01-Q-S01, C01-R-S02, C01-G-S01]}]
verification:
  scenarios: ["SC-C01-P4-01 포식 마물 경로 선택이 먹이·위험 비용에서 계산", "SC-C01-P-02 동일 압력에 원형별 다른 전략"]
  propertyTests: ["선택은 비용·위험 근거를 가짐 (설명 가능)"]
done: "Lab 에서 압력 → 목적 → 전략 → 행동 계획 사슬을 주체별로 추적 가능"
```

## Q — 세계 요구

```yaml
id: C01-Q-S01
module: Q0~Q3
mode: CREATE
purpose: "각 전략의 공간·자원·규칙·정보·상대 요구를 추출·평가하고 근거를 추적한다"
player_visible_contribution: ["콘텐츠가 임의 배치되지 않는다 — 골짜기·둥지·습지·시장이 존재하는 이유가 생긴다"]
mmorpg_loop_contribution: [exploration, persistent_world]
consumes: [{artifact: PossibilityGraph, from: C01-P-S01}, {artifact: ConflictSet, from: C01-D-S01}]
produces: [{artifact: "WorldRequirementGraph (근거 포함)", consumedBy: [C01-W-S01]}]
verification: {scenarios: ["SC-C01-Q-01 모든 요구 노드가 전략·의존성 근거 보유 (미근거 = lint 오류)"]}
done: "TRACE.graph.json 의 요구 노드가 전부 Q 출력과 일치"
```

## W — 세계 컴파일

```yaml
id: C01-W-S01
module: W0~W6
mode: CREATE
purpose: "6주체 요구를 병합해 사냥터의 규칙·상태·공간을 실체화하고, 압축 역사와 함께 정식 세계로 등록한다"
player_visible_contribution: ["탐험할 실제 사냥터가 생긴다 — 마을·목장·골짜기·둥지·습지·전망 바위와 현재 생태의 근거(왜 무리가 저기 사는지)"]
mmorpg_loop_contribution: [exploration, economy, persistent_world]
consumes: [{artifact: WorldRequirementGraph, from: C01-Q-S01}, {artifact: AxiomRegistry, from: C01-O-S01}]
produces: [{artifact: "CanonicalWorld v1 (초기 생태 상태 포함)", consumedBy: [C01-R-S01, C01-X-S01, C01-N-S02]}]
verification:
  scenarios: ["SC-C01-W1-01 6주체 요구가 하나의 사냥터 구조로 병합", "SC-C01-W-02 공리 위반 제안 거부",
              "SC-C01-W-03 관찰 상태 고정 — 관찰 후 소급 변경 거부"]
done: "Lab 미리보기에서 장소 6종+경로 3종이 요구 근거와 함께 표시, 초기 개체군 상태가 압축 역사로 설명됨"
```

## R — 세계 런타임

```yaml
id: C01-R-S01
module: R0~R2
mode: CREATE
purpose: "세계 상태 저장소·사건 로그·현상 생성 — 모든 상태 변경은 사건 경유"
player_visible_contribution: ["세계에서 일이 '일어난다' — 발자국·훼손 흔적·가축 실종이 현상으로 남는다"]
mmorpg_loop_contribution: [exploration, persistent_world]
consumes: [{artifact: CanonicalWorld, from: C01-W-S01}, {artifact: AxiomRegistry, from: C01-O-S01}]
produces: [{artifact: "EventLog + PhenomenonStream", consumedBy: [C01-R-S02, C01-E-S01, C01-X-S01, C01-N-S02]}]
verification:
  failureTests: ["사건 없는 직접 상태 수정 → 거부"]
  propertyTests: ["이벤트 재생 = 상태 재현 (결정성)"]
done: "임의 상태 조회가 사건 이력으로 완전 설명됨"
```

```yaml
id: C01-R-S02
module: R3~R6
mode: CREATE
purpose: "지각·믿음·기억·관계·행동 의도 — 주체는 자신이 아는 정보로 행동한다"
player_visible_contribution: ["마물이 전지적이지 않다 — 플레이어를 본 개체는 경계하고, 소문은 실제와 다를 수 있다"]
mmorpg_loop_contribution: [exploration, combat, social]
consumes: [{artifact: PhenomenonStream, from: C01-R-S01}, {artifact: ActionPlan, from: C01-P-S01}]
produces: [{artifact: "BeliefState + ActionIntents", consumedBy: [C01-E-S01, C01-E-S02, C01-G-S01]}]
verification:
  scenarios: ["SC-C01-R4-01 과장된 목격 소문 대 실제 흔적 → 상이한 믿음", "SC-C01-R5-BASE-01 위협 기억 → 다음 행동 반영 (경계·회피)"]
done: "Lab 에서 주체별 믿음 대 실제 상태 diff 확인"
```

## E — 사건과 상호작용

```yaml
id: C01-E-S01
module: E0~E2
mode: CREATE
purpose: "압력·충돌에서 Situation 을 계산하고, 조합 계약·거래·평판 상호작용을 만든다"
player_visible_contribution: ["개입할 '상황'이 세계에 존재한다 — 토벌 공고·조절 계약·매입 급구가 상태에서 발생한다"]
mmorpg_loop_contribution: [social, economy, multiplayer]
consumes: [{artifact: ConflictSet, from: C01-D-S01}, {artifact: "BeliefState·ActionIntents", from: C01-R-S02}]
produces: [{artifact: "ActiveSituations + Contracts", consumedBy: [C01-E-S02, C01-X-S02, C01-G-S01]}]
verification:
  scenarios: ["SC-C01-E0-01 ST-01~05 조건 충족 시 발생·미충족 시 미발생", "SC-C01-E2-01 계약 위반 → 평판·등급 변화"]
done: "5개 Situation 전부 상태 계산으로 발생 (하드코딩 트리거 0)"
```

```yaml
id: C01-E-S02
module: E3~E4
mode: CREATE
purpose: "행동 충돌 해결(포획 소유권·전투·동시 계약)과 사건 연쇄"
player_visible_contribution: ["같은 개체를 둘이 잡으면 한 명만 얻는다 — 충돌이 콘텐츠가 된다"]
mmorpg_loop_contribution: [combat, multiplayer, economy]
consumes: [{artifact: ActionIntents, from: C01-R-S02}, {artifact: "AxiomRegistry(권위)", from: C01-O-S01}]
produces: [{artifact: "ResolvedEvents + EventChains", consumedBy: [C01-R-S01(기록), C01-G-S01, C01-N-S01]}]
verification:
  scenarios: ["SC-C01-E3-01 동시 희귀 개체 포획 → 소유권 1회 확정", "SC-C01-E3-BASE-01 두 주체 동시 획득 충돌",
              "SC-C01-E4-01 남획 → 무리 감소 → 포식 마물 이동 연쇄"]
done: "충돌 해결이 결정적이고 권위 경로로만 확정"
```

## G — 성장과 의존 변형

```yaml
id: C01-G-S01
module: G0~G3
mode: CREATE
purpose: "흔적 판별·전투·해체 숙련, 제작식, 조합 평판·계약 등급, 가능성 해금 (얇게 — G4·G5 이월)"
player_visible_contribution: ["반복 사냥이 새 가능성을 연다 — 추적 정확도 상승, 상위 계약 수주, 새 제작식"]
mmorpg_loop_contribution: [progression, exploration, crafting, social]
consumes: [{artifact: ResolvedEvents, from: C01-E-S02}, {artifact: PossibilityGraph, from: C01-P-S01}]
produces: [{artifact: "GrowthState + UnlockedPossibilities", consumedBy: [C01-P-S01(재입력), C01-X-S02, C01-N-S02]}]
verification:
  scenarios: ["SC-C01-G1-01 반복 추적 → 판별 정확도·비용 변화", "SC-C01-G-02 비용 없는 성장 불가 (보존 공리)"]
done: "성장 전후 가능 행동 집합이 실제로 달라짐"
```

## C — 복합 주체

```yaml
id: C01-C-S01
module: C0~C2 상당
mode: CREATE
purpose: "초식 무리 개체군·거대 포식 마물·자원 군락·사냥꾼 조합을 복합 주체로 실행 (신·국가는 이월 — C3·C4 최소 인터페이스만 유지)"
player_visible_contribution: ["개체군 수준의 변화 — 무리가 번식·이동하고, 포식자가 굶주리면 행동이 변하고, 조합이 계약을 발급한다. 전부 플레이어 없이 진행"]
mmorpg_loop_contribution: [exploration, combat, economy, persistent_world]
consumes: [{artifact: SubjectArchetypes, from: C01-S-S01}, {artifact: "D~E 파이프라인 전체"}]
produces: [{artifact: "ComplexSubjectBehaviors", consumedBy: [C01-R-S02(의도), C01-X-S01(현상), C01-N-S01]}]
verification:
  scenarios: ["SC-C01-C-01 무개입 N-tick → Situation 발생·악화·해소 (World Autonomy)",
              "SC-C01-C-02 조합 행동이 구성원·자산 경유 (실체 공리)"]
done: "무개입 시뮬에서 사냥 균형 붕괴(양방향)가 고정 타임라인 없이 상태 계산으로 진행"
```

## X — 3D 공간과 웹 클라이언트

```yaml
id: C01-X-S01
module: X0~X2
mode: CREATE
purpose: "의미 공간 그래프 → 3D 컴파일 → 웹 렌더링. W 출력만 사용 (좌표 하드코딩 금지)"
player_visible_contribution: ["걸어다닐 수 있는 사냥터 — 장소 6종·경로 3종·현상(발자국·훼손·실종 흔적)이 3D 로 보인다"]
mmorpg_loop_contribution: [exploration]
consumes: [{artifact: CanonicalWorld, from: C01-W-S01}, {artifact: PhenomenonStream, from: C01-R-S01}]
produces: [{artifact: "Playable3DRegion", consumedBy: [C01-X-S02]}]
verification:
  scenarios: ["SC-C01-X-01 W 출력 변경 → 3D 반영 (하드코딩 없음 증명)"]
done: "브라우저에서 사냥터 전역 탐험 가능, 현상이 세계 상태와 일치"
```

```yaml
id: C01-X-S02
module: X3~X4
mode: CREATE
purpose: "플레이어 조작(이동·조사·전투·채집·해체·제작·거래)과 콘텐츠 UI(흔적 조사·시세판·조합 게시판·계약·평판)"
player_visible_contribution: ["4역할의 실제 플레이 — 추적·사냥·해체·거래를 조작으로 수행하고 결과를 세계 현상으로 이해한다"]
mmorpg_loop_contribution: [exploration, combat, crafting, economy, social, progression]
consumes: [{artifact: Playable3DRegion, from: C01-X-S01}, {artifact: "ActiveSituations·Contracts·GrowthState", from: "C01-E-S01·C01-G-S01"}]
produces: [{artifact: "PlayerCommands(클라 → 서버 제출)", consumedBy: [C01-N-S01]}]
verification:
  scenarios: ["SC-C01-X-02 내부 그래프 비노출 — UI 는 흔적·소문·시세·공고만 표시 (Player Comprehension)"]
done: "퀘스트 마커 없이 흔적·공고·시세만으로 5개 Situation 발견 가능"
```

## N — 멀티플레이 서버와 영속화

```yaml
id: C01-N-S01
module: N0 (+N1·N2 최소)
mode: CREATE
purpose: "단일 프로세스 권위 서버 — 명령 제출·검증·충돌 확정·브로드캐스트"
player_visible_contribution: ["여러 사냥꾼이 같은 사냥터를 본다 — 동시 포획·계약이 한 번만 확정된다"]
mmorpg_loop_contribution: [multiplayer, combat, economy]
consumes: [{artifact: PlayerCommands, from: C01-X-S02}, {artifact: "E3 충돌 해결·권위 공리"}]
produces: [{artifact: "AuthoritativeState", consumedBy: [C01-X-S01(표시), C01-N-S02]}]
verification:
  scenarios: ["SC-C01-N0-01 클라이언트 직접 확정 시도 → 거부", "SC-C01-E3-01 재사용 (서버 경유)"]
done: "2+ 클라이언트 동시 접속, 충돌 확정이 서버에서만 발생"
```

```yaml
id: C01-N-S02
module: N3
mode: CREATE
purpose: "사건 로그+스냅샷 저장·재접속 복구"
player_visible_contribution: ["끈 뒤 다시 접속해도 사냥터가 이어진다 — 개체군·시세·평판·계약 유지"]
mmorpg_loop_contribution: [persistent_world, progression]
consumes: [{artifact: AuthoritativeState, from: C01-N-S01}, {artifact: EventLog, from: C01-R-S01}]
produces: [{artifact: "PersistentWorldStore", consumedBy: [다음 세션, C02 기준선]}]
verification:
  scenarios: ["SC-C01-N3-01 토벌 후 저장·재접속 → 개체군·시세·평판 유지", "SC-C01-N3-02 로그 재생 복구 = 스냅샷 (해시 일치)"]
done: "저장·재접속·복구 3경로 모두 상태 해시 일치"
```

## A — AI 제작 자동화

```yaml
id: C01-A-S01
module: A0, A1~A2 (최소)
mode: CREATE
purpose: "구조화 편집기와, 마물 변종 후보 1종의 AI 생성 → 정적 검증 경로 (A3·A4 이월). 검증 통과 후보만 정식 등록 가능"
player_visible_contribution: ["(간접·다음 Cycle 대비) 새 마물 종·변종이 같은 생태 인과·검증을 거쳐 추가된다"]
mmorpg_loop_contribution: [persistent_world]
consumes: [{artifact: "WorldOntology·AxiomRegistry·validateDefinition", from: "C01-O-S01·S02"}]
produces: [{artifact: "ContentCandidate 파이프라인", consumedBy: [C02+]}]
verification:
  failureTests: ["공리 위반 후보(먹이 의존 없는 마물) → 거부", "검증 우회 등록 경로 없음 (lint)"]
done: "후보 1종 정적 검증 통과 + 위반 후보 거부 증거"
```

---

# 구현 순서 — 7개 구간

각 구간 종료 시 플레이 가능(또는 Lab 관찰 가능)한 통합 상태를 확인한다 (Phase 11).

## 구간 0 — Foundation (선행, Cycle 외)
- **포함**: Phase 0 전체 · **결과**: Cycle 등록·Scenario 실행·결정성 해시·증거 생성이 가능한 빈 파이프라인
- **확인 장면**: Lab 에서 더미 Scenario 실행 · **자동 검증**: 같은 시드 → 같은 해시
- **진입 조건(→1)**: Phase 0 완료 조건 7항 전부

## 구간 1 — 주체와 압력 (V-S01, O-S01, O-S02, S-S01, D-S01)
- **결과**: 공리·존재론 위에서 6주체의 의존 압력·충돌 계산
- **확인 장면**: Lab 텍스트 시뮬 — 무리를 줄이면 포식 마물 압력이 오르고, 무리를 늘리면 군락 충돌이 탐지된다
- **자동 검증**: V-01/02, O 실패 5종, D4-01, D4-BASE-01, D5-01
- **진입 조건(→2)**: D 출력이 5개 Situation 의 충돌 구조를 모두 표현

## 구간 2 — 전략과 세계 생성 (P-S01, Q-S01, W-S01)
- **결과**: 압력 → 전략 → 요구 → 사냥터 실체화 (정식 세계 v1 + 압축 역사)
- **확인 장면**: Lab 미리보기 — 장소·경로가 요구 근거와 함께 표시, 포식 마물 경로가 비용에서 계산
- **자동 검증**: P4-01, P-02, Q-01, W1-01, W-02, W-03
- **진입 조건(→3)**: cycle:trace 미근거 세계 요소 0건

## 구간 3 — 살아있는 세계 (R-S01, R-S02, E-S01, E-S02)
- **결과**: 사건·현상·지각·믿음·계약·충돌 해결이 도는 헤드리스 세계
- **확인 장면**: 헤드리스 실행 — ST-01(포식 마물 접근)이 먹이 상태에서 발생하고 무개입 시 악화
- **자동 검증**: R 결정성, R4-01, R5-BASE-01, E0-01, E2-01, E3-01, E3-BASE-01, E4-01
- **진입 조건(→4)**: 5개 Situation 전부 상태 계산 발생 (하드코딩 트리거 0)

## 구간 4 — 성장과 자율 생태 (G-S01, C-S01)
- **결과**: 반복 실행에서 성장·개체군·군락·조합의 장기 변화
- **확인 장면**: 무개입 장기 시뮬 — 남획→무리 감소→포식자 이동→마을 위협, 방치→과잉 번식→군락 황폐화 양방향 확인
- **자동 검증**: G1-01, G-02, C-01, C-02
- **진입 조건(→5)**: World Autonomy Gate 4항 헤드리스 통과

## 구간 5 — 3D 플레이 (X-S01, X-S02)
- **결과**: 브라우저에서 4역할 플레이 가능한 사냥터
- **확인 장면**: 흔적·공고·시세만으로 Situation 을 발견하고 역할별로 다르게 개입
- **자동 검증**: X-01, X-02 + 기존 Scenario 회귀
- **진입 조건(→6)**: Player Comprehension 4문을 콘솔 없이 답할 수 있음

## 구간 6 — 멀티플레이와 영속 (N-S01, N-S02)
- **결과**: 권위 서버 경유 2+ 동접, 저장·재접속
- **확인 장면**: 두 사냥꾼이 같은 희귀 개체를 두고 경쟁, 재접속 후 세계 유지
- **자동 검증**: N0-01, E3-01(서버판), N3-01, N3-02
- **진입 조건(→7)**: Multiplayer·Persistence Gate 통과

## 구간 7 — AI 경로와 통합 판정 (A-S01 + Acceptance)
- **결과**: 콘텐츠 후보 검증 경로 + Cycle 통합
- **확인 장면**: 위반 후보 거부·정상 후보 통과, Gate 체크리스트 전체 실행
- **완료**: [ACCEPTANCE.md](ACCEPTANCE.md) 10 Gate + 플레이 테스트 → `advprotog-cycle-integrator` 로 VERIFIED 판정 인계
