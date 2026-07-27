# Phase 4 — 사건 탐지 시스템

> 근거: §42-4(상태 변화 기록을 관련 사건으로 묶는다), §28(자동 탐지), §29(중요도), §30(사건과 퀘스트의 관계).

## 목표

행동·규칙이 남긴 `RawWorldChange` 흐름에서 **개발자가 작성하지 않은 사건**을 자동으로 묶어낸다(§28, §44-13). "침묵림 교역로 습격"(§28 예시) 급의 다주체 사건이 수동 세계에서 실제로 검출되어야 한다(§44-7).

## 산출 모듈 (§37 `core/events/`)

- `ChangeCollector.ts` — RawWorldChange 수집·색인 (Phase 1 부터 쌓인 로그의 소비자)
- `EventDetector.ts` — EventPattern 매칭, 사건 생성·병합·수명 관리
- `EventSummarizer.ts` — 사건 요약 데이터 갱신(§26 루프의 `updateEventSummaries`), 구조화 요약까지만 — 문장화는 Phase 8

## 상세 설계

### 4.1 RawWorldChange 수집 (§28)

- StateStore·EffectExecutor·행동 완료 처리가 이미 남기는 change 에 **tags 전파 규약**을 확정한다: 규칙의 tags + 행동의 tags + 관련 개체의 tags 합집합. 패턴 매칭의 재료가 tags 이므로(§28 `requiredTags`) 여기가 품질의 절반이다.
- 색인: 시간순 링 버퍼(최근 N tick) + `Map<tag, changeIdx[]>` + `Map<locationId, changeIdx[]>`. 오래된 change 는 사건에 소속되지 못하면 폐기 — §24 와 같은 무한 증가 방지.

### 4.2 EventPattern 매칭 (§28)

`EventPattern` 전 필드(requiredTags, optionalTags, minimumParticipants, timeWindow, locationRadius, significanceFormula) 사용.

매칭 알고리즘 (매 tick 이 아니라 interval 이벤트로, 기본 반 일 주기):
1. 패턴별로 requiredTags 를 모두 포함하는 change 군집을 timeWindow 슬라이딩 윈도 + locationRadius 반경으로 클러스터링(단순 그리디: 시간순으로 시드 change 를 잡고 윈도·반경 내 태그 일치 change 를 흡수).
2. 참여자 수(§28 participants = change 의 sourceId∪targetIds 의 상위 주체·조직·종족) ≥ minimumParticipants 확인.
3. 기존 ongoing 사건과 겹치면(참여자·위치·패턴 동일) 새 사건 생성 대신 **병합** — 사건은 진행 중 계속 자란다(§28 status: "ongoing").
4. 신규면 `WorldEvent { id, patternId, type, title(구조화 키), participants, affectedStates, changes: changeId[], status, startedAt }` 생성. §28 예시 JSON 의 필드를 그대로 따른다.

수명: timeWindow 의 2배 동안 새 change 흡수가 없으면 `status: "concluded"`. 종결 시 사건 결과 요약(영향 상태의 순변화량)을 확정 — §44-9(사건 결과가 세계 상태 변화로 남음)의 증거 데이터.

### 4.3 사건 중요도 (§29)

`calculateEventSignificance` 의 6개 항·계수 그대로(참여자×8, 영향 시스템×12, 변화량×0.5, 관계 영향×0.7, 플레이어 관련도, 미래 잠재력). 구현 주석:
- "영향 시스템 수" = affectedStates 의 StateSchema ownerType·카테고리 종류 수.
- "플레이어 관련도" = Phase 7 전까지 0.
- "미래 잠재력" = 사건 참여자들의 활성 목적 중 이 사건의 affectedStates 를 targetConditions 로 갖는 목적 수 (Phase 3 GoalSystem 질의).
- 중요도는 사건 병합 시마다 재계산. 임계 미만 사건은 저장하되 기본 뷰에서 숨김(§29 "모든 변화를 보여줄 필요 없다").

### 4.4 개입 기회 (§30)

`InterventionOpportunity` 전 필드. 생성 규칙:
- `knownFacts` 는 **관찰자별**이다 — 사건 자체가 아니라 "주체 X 가 아는 사건" 을 질의하는 API: `getEventViewFor(agentId, eventId)` 가 해당 주체의 BeliefRecord·기억과 사건 changes 를 교집합해 knownParticipants/knownFacts 를 계산한다. §30 "플레이어가 아는 것/모르는 것" 분리가 여기서 나온다. Phase 7 이 이 API 를 그대로 쓴다.
- `possibleInteractions` = 사건 참여자·위치를 대상으로 실행 가능한 ActionDefinition 태그 목록(§30 예시: 토벌 참가/조사/추적/정보 판매…). 고정 정답 없음(§30 "시스템은 미리 정답을 정하지 않는다") — 행동 체계에서 역산할 뿐 별도 저작물이 아니다.
- `timeSensitivity` = 사건 패턴 timeWindow 대비 잔여 활동량.

### 4.5 수동 세계 사건 패턴

§40 한도(패턴 10개) 내에서 수동 세계에 4~6개 작성: 생태 충돌(§28 예시형), 식량 위기, 토벌 소집, 조사 활동, 소문 확산, 거래 분쟁. **각 패턴은 둘 이상의 주체/시스템을 연결해야 한다**(§34 검증 규칙) — 작성 시점부터 준수.

## 구현 스텝

1. change tags 전파 규약 확정 + ChangeCollector 색인.
2. 클러스터링 매처 + 사건 생성·병합·종결 수명.
3. significance 계산 + 재계산 훅.
4. `getEventViewFor` 관찰자 시점 API.
5. InterventionOpportunity 산출.
6. 수동 세계 패턴 4~6개 + 30일 실행 검증.

## 완료 조건 (DoD)

- [ ] 30일 실행에서 §28 예시 구조의 사건(참여자에 종족·조직·개인이 섞인 ecological_conflict 형)이 자동 검출된다.
- [ ] 최소 세 주체의 목적이 충돌하는 사건이 존재한다(§44-7 — 사건 참여자들의 활성 목적 targetConditions 가 상호 배타임을 자동 판정).
- [ ] 같은 사건에 대해 관찰자별 knownFacts 가 다르다(마을사람 vs 연구자).
- [ ] 사건 종결 후 affectedStates 순변화가 0 이 아니다(§44-9) + 참여자에게 새 목적이 활성화된 사례가 있다(§44-10).
- [ ] 저중요도 변화(§29 예시: 평시 거래 등)가 사건으로 승격되지 않는다.
- [ ] 동일 시드 재실행 시 동일 사건 목록.

## 이후 Phase 인터페이스

- `EventPattern` JSON 스키마 → Phase 5 사건 패턴 생성기 출력 계약.
- 사건·개입기회·관찰자 시점 API → Phase 7 플레이어 UI, Phase 8 사건 화면(§36.4).
- 사건 통계(종류·참여 조합) → Phase 6 다양성 검증(§35).
