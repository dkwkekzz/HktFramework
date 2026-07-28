# Phase 3 — 주체 판단 시스템

> 근거: §42-3(생존 압력·목적 활성도·행동 후보·행동 선택·기억과 관계), §8(생존 압력), §10(믿음), §19~§20(목적 그래프·활성도), §21~§22(행동·후보·선택), §23(인식), §24(기억), §25(관계), §26~§27(재판단·실행 사이클).

## 목표

Phase 1 의 간이 판단을 기획서 전체 모델로 교체한다. 핵심 증명: **주체가 실제 상태가 아니라 자신의 믿음으로 판단한다**(§20, §44-6). 잘못된 믿음 → 잘못된 결정이 실제로 관찰되어야 한다.

## 산출 모듈 (§37 `core/agents/`)

- `PerceptionSystem.ts` — canObserve 판정 + 신호→믿음 파이프라인 (§23)
- `BeliefSystem.ts` — BeliefRecord 저장·갱신·질의 (§10)
- `MemorySystem.ts` — 기억 생성·중요도·감쇠·요약 통합 (§24)
- `RelationshipSystem.ts` — RelationshipState + 변화 규칙 (§25)
- `GoalSystem.ts` — SurvivalPressure(§8) + GoalGraph 평가 + 활성도 계산 (§19~20)
- `ActionPlanner.ts` — 행동 후보 생성·점수·softmax 선택 (§22)

## 상세 설계

### 3.1 믿음 모델 — 판단의 유일한 세계관 (§10, §20)

- `BeliefStore`: `Map<subjectId, Map<stateKey, BeliefRecord>>`. §10 필드 전부(believedValue, confidence, sourceIds, lastUpdatedAt).
- **핵심 규약**: `GoalSystem`/`ActionPlanner` 는 `WorldState` 를 직접 읽을 수 없다. 판단 입력은 `BeliefView` 인터페이스 — 믿음이 있으면 믿음값, 없으면 "모름"(undefined) 을 반환한다. 자기 자신의 상태(§9.1 health 등)만 직접 읽기 허용(자기 감각).
- 모름(undefined)의 처리: feasibility·risk 평가에서 모르는 값은 종족 기본 추정치(SpeciesDefinition 유래)로 대체하고 confidence 를 낮게 취급 — §22 `candidate.confidence` 의 근거.

### 3.2 인식 파이프라인 (§23)

1. `canObserve` — 기획서 함수 그대로: 채널 점수 + 신호 강도 + 주의 보정 − 거리 감쇠 − 차폐 > 50. 채널 점수는 `SpeciesDefinition.senses`(§15) 의 channel/range/accuracy 에서 산출.
2. 관찰 성공 → 즉시 사실화 금지(§23): `신호 → 기억 대조 → 원인 후보 → 성격·편견 적용 → 믿음 생성/수정` 4단계를 다음으로 구현:
   - **기억 대조**: 신호 tags 로 MemorySystem 질의, 유사 기억의 원인 해석을 후보에 추가.
   - **원인 후보**: 신호 payload 의 명시 원인 + 기억 유래 해석 후보들.
   - **성격·편견**: traits(§18 판단 변수 — uncertaintyAversion, vengefulness 등)와 기존 관계(공포·원한 §25)가 후보 가중치를 왜곡. 예: 공포 대상의 신호는 위협 해석 가중.
   - **믿음 갱신**: 선택된 해석으로 BeliefRecord upsert. confidence 는 `min(1, 채널 accuracy × 신호 강도 정규화 + 기존 confidence 감쇠 병합)`. sourceIds 에 신호 id 추가.
3. 소문·보고 채널(§23 관찰 채널 목록의 대화/문서/소문/조직 보고): 전달자의 믿음을 신호 payload 로 실어 나르는 2차 신호. confidence 는 전달자 confidence × 수신자의 전달자 신뢰(§25 trust) 로 감쇠 — 정보 비대칭의 원천.

### 3.3 기억 (§24)

- `MemoryDefinition` 전 필드. 생성 시점: 관찰 성공, 상호작용(행동의 대상이 됨), 성공/실패, 약속/배신 이벤트.
- 중요도: §24 `calculateMemoryImportance` 계수 그대로(0.4/0.3/0.2/0.4).
- 감쇠: interval 규칙(일 1회)으로 `relevance -= decayRate`. 중요도 < 임계 시 **요약 통합**: 같은 (participants, tags) 군집의 저중요도 기억 3개 이상 → 하나의 요약 믿음으로 변환(§24 상인 예시)하고 원본 삭제. 요약문 자체는 Phase 8 전까지 태그 조합으로 기계 생성(사람이 읽는 문장은 Presentation 몫).
- 데이터 상한: 주체당 기억 수 상한(기본 64)으로 무한 증가 방지(§24 첫 문장).

### 3.4 관계 (§25)

- `RelationshipState` 전 필드(trust/fear/respect/affection/resentment/dependency/debt/familiarity/knownSecrets/promises). 저장은 `relationships: Record<"from:to", RelationshipState>`(§9.1).
- 변화는 **관계 변화 규칙 = DSL 규칙**(§25 예시 4종을 `relationship_changed`/`action_executed` 트리거 규칙으로 작성). 코드 하드코딩이 아니라 콘텐츠로 두어 Phase 5 가 생성 가능하게 한다.
- `PromiseState`: 약속 내용(조건)과 만기 tick. interval 규칙이 위반을 검사해 §25 "약속 위반" 연쇄(신뢰 급감·소문 확산)를 발화.

### 3.5 목적 활성도 (§8, §19, §20)

- `SurvivalPressureDefinition`(§8) → 각 압력은 대응 GoalNode 를 가리키고, `urgencyGrowth` 로 매일 urgency 가 누적, 압력 해소 시 리셋.
- `calculateGoalActivation`(§20) 의 11개 항을 각각 독립 함수로 구현하고 **모든 평가는 BeliefView 입력**(§20 "믿음 상태를 사용"). 각 항의 산출 근거(어떤 믿음·관계·기억을 참조했는지)를 디버그 구조로 남긴다 — Phase 8 주체 관찰 화면(§36.3)과 Phase 6 진단의 입력.
- GoalEdge(§19) 반영: `requires` 미충족 부모는 자식으로 활성 위임, `conflicts` 는 §20 의 `conflict` 감산항, `creates/reveals` 는 완료 효과에서 새 노드 활성화(§44-10 후속 목적).
- `abandonmentConditions` 충족 시 목적 비활성 + 실패 기억 생성.

### 3.6 행동 후보와 선택 (§22)

- `generateActionCandidates` 기획서 코드 그대로: allowedActionTags → actorRequirements 필터 → 대상 열거(BeliefView 로 아는 대상만!) → 점수화.
- 점수식·softmax 선택(§22 `scoreActionCandidate`, `selectAction`)의 계수 그대로. randomness 의 난수는 `RandomContext{…, entityId: agent.id}`.
- `handleNoAvailableAction`(§27): 목적을 일시 차단(쿨다운)하고 차선 목적으로 — 교착 방지(§35 deadlockedAgents 대비).

### 3.7 조직도 주체다 (§17)

"조직은 이름표가 아니라 목적과 상태를 가진 주체"(§17). 별도 조직 AI 를 만들지 않는다 — `EntityState.type: "faction"` 개체에 **같은 판단 파이프라인을 적용**한다:

- 목적: `FactionDefinition.requiredStates`(유지 목적) + hiddenPurposes 를 목적 그래프 노드로. 활성도 계산 동일.
- 믿음: 조직의 믿음은 §23 "조직 보고" 채널로 수집된 구성원 믿음의 집약 — 조직도 실제 상태를 직접 알지 못한다.
- 행동: 정책 변경, 자원 이동, 그리고 **구성원 위임**(§21 행동 목록의 "다른 주체에게 행동을 위임한다") — 토벌 소집(§28 예시 5)이 이 형태다. 위임받은 개인은 자기 목적 그래프에 조직 유래 목적 노드가 주입되고, 자신의 가치관·관계와의 충돌(§18-6)은 평소 활성도 계산이 처리한다.
- 재판단 주기: 개인보다 느린 interval(기본 1일) + 조직 상태 급변 시.
- `collapseConditions` 는 interval 규칙으로 상시 검사, 충족 시 붕괴 처리(구성원 소속 해제, 통제 자원 방출) — §35 factionCollapse 판정의 근거 데이터.
- `internalGroups` 는 조직 산하의 소주체로 같은 구조를 재귀 적용(§17 절차 4·5 의 수혜/피해 집단).

Phase 1 의 조직 2개는 정적 데이터였다 — 이 절부터 판단 주체가 된다.

### 3.8 재판단 통합 (§26)

`shouldReplan` 조건 중 `important_observation` 플래그는 인식 파이프라인이 (믿음 변화량 × 활성 목적 관련도) 가 임계 초과일 때 세운다. 관계 급변·목적 무효화 플래그도 각 시스템이 세우고, `updateUrgentAgents` 훅이 소비한다.

## 콘텐츠 확장

간이 판단 제거에 맞춰 수동 세계에 추가: 개인 5명의 traits(§18 판단 변수 9종), 생존 압력 세트(§8 기본 10종 중 종별 적용), 관계 초기값, 관계 변화 규칙 ~8개, 조직 2개의 목적 그래프·집약 믿음·위임 행동(3.7). 종족의 번식·적응·성장(§15 reproduction/adaptationRules/growthRules — 반향수 새끼 성장·능력 잔재 적응)도 별도 시스템이 아니라 DSL 규칙(`create_entity` 등)로 작성한다. 규칙 총수는 §40 한도(40~60) 내.

## 구현 스텝

1. BeliefStore + BeliefView (+ "판단 코드의 WorldState 직접 참조 금지" 린트 테스트).
2. PerceptionSystem 4단계 파이프라인 (+ §10 반향수 예시 재현 테스트: 같은 신호 → 마을사람/연구자 상이한 믿음).
3. MemorySystem (생성·감쇠·요약 통합·상한).
4. RelationshipSystem + 관계 변화 DSL 규칙.
5. GoalSystem (압력 → urgency, 활성도 11항, 엣지 처리).
6. ActionPlanner (후보·점수·softmax) + Phase 1 간이 판단 삭제.
7. 조직 주체화 (집약 믿음, 위임 행동, collapseConditions 감시).
8. 30일 실행 회귀 + 신규 시나리오 테스트.

## 완료 조건 (DoD)

- [ ] §10 시나리오 재현: 반향수의 실제 aggression=낮음, 마을사람 믿음=높음 → 마을은 토벌 준비, 연구자는 조사 행동 (같은 세계에서 상반된 행동).
- [ ] 잘못된 믿음이 잘못된 행동을 만든 사례가 30일 로그에서 자동 검출된다(믿음값 ≠ 실제값인 상태를 근거로 한 행동 존재).
- [ ] 소문 경로로 전파된 믿음의 confidence 가 직접 관찰보다 낮다.
- [ ] 저중요도 기억이 요약 믿음으로 통합되고 총 기억 수가 상한을 지킨다.
- [ ] 목적 충돌(§19 "가족 생존 ↕ 신념") 상황에서 conflict 감산이 선택을 바꾸는 단위 테스트.
- [ ] 조직이 판단 주체로 행동한 기록이 있다(위임 발생 — 예: 마을의 토벌 소집이 개인 목적 그래프에 주입되고, 개인 가치관과의 충돌이 활성도에 반영됨).
- [ ] 30일 실행에서 deadlocked 주체 0 (§35).

## 이후 Phase 인터페이스

- 활성도·후보 점수의 디버그 산출 근거 → Phase 8 §36.3 화면.
- 믿음/기억/관계 저장소 → Phase 4 사건 참여자 판정, Phase 7 플레이어 지식 필터.
