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

- [x] 30일 실행에서 §28 예시 구조의 사건(참여자에 종족·조직·개인이 섞인 ecological_conflict 형)이 자동 검출된다.
- [x] 최소 세 주체의 목적이 충돌하는 사건이 존재한다(§44-7 — 사건 참여자들의 활성 목적 targetConditions 가 상호 배타임을 자동 판정).
- [x] 같은 사건에 대해 관찰자별 knownFacts 가 다르다(마을사람 vs 연구자).
- [x] 사건 종결 후 affectedStates 순변화가 0 이 아니다(§44-9) + 참여자에게 새 목적이 활성화된 사례가 있다(§44-10).
- [x] 저중요도 변화(§29 예시: 평시 거래 등)가 사건으로 승격되지 않는다.
- [x] 동일 시드 재실행 시 동일 사건 목록.

## 구현 결과 (2026-07-28)

### 실제로 만든 모듈 (`proto/src/core/events/`)

| 모듈 | 하는 일 |
|---|---|
| `ChangeCollector.ts` | 최근 N tick 의 change 링 버퍼 + 태그·위치 색인. changeLog 에서 파생되는 캐시이므로 스냅샷에 싣지 않는다(복원 후 다시 만든다). |
| `EventDetector.ts` | 패턴 매칭·클러스터링·병합·종결 수명 + §29 중요도(6항). |
| `EventSummarizer.ts` | 영향 상태 누적(첫 값·마지막 값·순변화), 새 목적, 목적 충돌 판정. |
| `EventViews.ts` | §30 관찰자 시점 — `getEventViewFor` / `possibleInteractions` / `buildInterventionOpportunity`. 설계에 없던 4번째 모듈이다(§30 이 "사건"이 아니라 "**아는 사건**"을 다루므로 탐지와 분리했다). |
| `phase4Checks.ts` | verify 와 테스트가 공유하는 측정 함수 (Phase 3 의 `phase3Checks` 와 같은 규약). |

### 태그 전파 규약 (§4.1 확정)

`change.tags` = ① 맥락 태그 ② 개체 태그의 합집합이다.

| 출처 | 넣는 곳 | 예 |
|---|---|---|
| 규칙 | `RuleEngine.execute` — `rule`, 규칙 id, **규칙의 `tags`**(RuleDefinition 에 새로 추가한 선택 필드) | `rule.attack_resolution` + `violence,threat,creature` |
| 행동 | `ActionSystem` — `action`, 행동 id, 목적 id, **행동의 `tags`** | `action.gossip` + `rumor,social` |
| 개체 | `StateStore.appendChangeLog` — 원인·대상·변한 개체의 tags | `living,human,hunter,villager` |
| 런타임 | 관찰(`observation`+신호 id+신호 tags), 위임(`delegation`), 약속(`promise`) 등 맥락 태그 | `observation,signal.attack_noise.10,important` |

규칙 44개에 의미 태그를 부여했다(`survival/food/ecology/creature/threat/violence/fear/information/rumor/mobilization/organization/relationship/betrayal/economy/trade/research/crisis/trace/report/hunger/resource`). `WorldValidation` 이 **세계에 존재하지 않는 태그를 묻는 패턴을 거부**하므로, 태그 오타로 조용히 안 터지는 패턴이 생길 수 없다.

### 수동 세계의 사건 패턴 6개 (§4.5)

| 패턴 | requiredTags | 최소 참여자 | timeWindow | 반경 | 30일 검출 |
|---|---|---|---|---|---|
| `pattern.ecological_conflict` | threat + creature | 3 | 반 일 | 15 (같은 지역) | 11건 |
| `pattern.food_crisis` | crisis | 2 | 2일 | 40 (지역 넘음) | 1건 |
| `pattern.subjugation_muster` | mobilization | 2 | 1일 | 15 | 1건 |
| `pattern.investigation` | research + information | 2 | 1일 | 15 | 5건 |
| `pattern.rumor_spread` | rumor | 3 | 반 일 | 40 | 15건 |
| `pattern.broken_promise` | betrayal | 3 | 1일 | 40 | 4건 |

설계가 제안한 목록의 "거래 분쟁"은 **쓰지 않았다**. 수동 세계의 거래에는 분쟁 축(가격 담합·계약 위반)이 아직 없어서 `trade`+`betrayal` 이 한 번도 같은 변화에 함께 오지 않는다 — 발화하지 않는 패턴은 죽은 콘텐츠다. 대신 실제로 도는 축인 **약속 파기**(§25 promises · §17 위임)를 6번째 패턴으로 넣었다. 거래 분쟁은 조직·희소 자원이 늘어나는 Phase 5 의 몫이다.

지역 좌표가 서로 22 만큼 떨어져 있으므로(마을 vs 침묵림), 반경 15 는 "같은 지역", 40 은 "지역을 넘는 사건"을 뜻한다.

### 매칭·수명에서 실제로 고른 규칙

- **requiredTags 는 change 하나가 전부 가져야 한다.** 그 change 가 씨앗이 되고, `optionalTags` 를 하나라도 가진 곁가지 변화가 같은 창·같은 자리에서 딸려 온다(습격 자체는 `threat+creature`, 뒤따르는 공포·소집·조사는 아니다).
- **최소 참여자 수는 필수 태그 변화로만 센다.** 곁가지가 사건 성립을 대신 결정하지 못하게.
- **같은 change 는 같은 패턴 안에서만 배타적이다.** 하나의 습격이 생태 충돌이면서 동시에 소집의 계기일 수 있다 — 패턴이 다르면 같은 재료를 공유한다.
- **종결 판정은 흡수 뒤에 한다.** 순서를 반대로 하면 방금 들어온 변화를 못 본 채 "조용해졌다"고 닫아 버린다(구현 중 실제로 발생, 아래 표).
- **탐지는 반 일 주기로만 돈다.** 훅이 매 반복 호출되어도 주기가 아니면 아무 일도 하지 않는다 — 호출 횟수가 결과를 바꾸지 않아야 재현성이 유지된다(§39).

### 목적 충돌 판정 (§44-7)

`targetConditions` 만으로는 서로 다른 주체의 목적이 배타인지 알 수 없다 — desiredChanges 는 "무엇을 어느 쪽으로"만 말하고 **누구의** 상태인지 말하지 않기 때문이다. 그 답은 행동 정의에 있다(§21 `expectedEffects.on = actor|target`). 그래서 `목적 → 허용 행동 태그 → 행동 → 효과 대상` 으로 역산해 요구를 `(개체, 상태, 방향)` 으로 정규화하고, 같은 (개체·상태)를 반대 방향으로 요구하는 쌍을 충돌로 본다.

실제로 검출된 충돌축:

```
agent.kael(goal.report_danger)    threat_belief ↑  ↔  faction.silent_village(goal.faction_safety) threat_belief ↓
agent.mar (goal.village_safety)   threat_belief ↑  ↔  faction.silent_village(goal.faction_safety) threat_belief ↓
agent.ren (goal.report_danger)    threat_belief ↑  ↔  faction.silent_village(goal.faction_safety) threat_belief ↓
```

마을은 "위협 믿음을 가라앉히는 것"이 안전이고, 마을 사람들은 "위협을 알리는 것"이 안전이다. 아무도 이 대립을 작성하지 않았다 — 목적과 행동 정의에서 저절로 나왔다.

### 관측 결과 (`npm run verify`, 시드 42 · 30일)

```
=== Phase 4 완료 조건 — 사건 탐지 점검 — 시드 42, 30일 ===

✓ §28 구조의 사건이 자동 검출 (종족·조직·개인이 섞인 생태 충돌)
    사건 37건 (ecological_conflict:11 food_crisis:1 subjugation_muster:1 investigation:5 rumor_spread:15 broken_promise:4) · event.5 "ecological_conflict" 2~8일 @region.silent_forest 중요도 979 · 참여자 종족[species.echo_beast,species.human] 조직[faction.research_society,faction.silent_village] 개인[agent.kael,agent.mar,agent.ren,agent.rion,creature.echo_beast_cub#0,creature.echo_beast_mother] · change 395건 · 영향 상태 46개
✓ 세 주체 이상의 목적이 충돌하는 사건 (targetConditions 상호 배타 자동 판정)
    6건 · 예: event.0(rumor_spread) 충돌 주체 5명 — agent.kael(goal.report_danger) increase ↔ faction.silent_village(goal.faction_safety) decrease : faction.silent_village.threat_belief / agent.mar(goal.village_safety) increase ↔ faction.silent_village(goal.faction_safety) decrease : faction.silent_village.threat_belief
✓ 같은 사건에 대해 관찰자별 knownFacts 가 다르다 (마을사람 vs 연구자)
    event.0(rumor_spread): 마을사람 kael 은 참여자 9명·사실 3건, 연구자 rion 은 참여자 6명·사실 3건 · kael 만 아는 것 [agent.rion.recent_presence=true] / rion 만 아는 것 [agent.kael.recent_presence=true] · 진행 중 사건 event.3(subjugation_muster)에 대한 kael 의 개입 후보 11종 [action.attack,action.delegate,action.faction_trade,action.flee…] 시급도 0.77
✓ 종결 사건의 순변화 ≠ 0 이고 참여자에게 새 목적이 활성화됨
    23건 · 예: event.0(rumor_spread, 3일 종결) 순변화 59개 — agent.rion|creature.echo_beast_mother.relationship:resentment 0→100 | agent.rion|creature.echo_beast_mother.relationship:trust 0→-100 | creature.echo_beast_mother.offspring_threat 95→0 · 새 목적 agent.ren:goal.report_danger agent.ren:goal.profit agent.rion:goal.avoid_threat
✓ 평시 변화는 사건이 되지 않는다 (§29 중요도 하한)
    전체 change 7953건 중 사건 소속 2408건(30%) · 평시 rest 71/1231 eat 0/8 move 10/303 trade 28/156 → 6% · 사건성 attack 158/249 gossip 132/132 → 76% · 중요도 127~2363 중 임계 200 미만 7건 숨김 / 30건 표시
✓ 동일 시드 재실행 시 동일 사건 목록 / 다른 시드는 다름
    시드 42 사건 37건 해시 192ddf5b · 재실행 37건 192ddf5b · 시드 43 36건 a27b7a81

  6/6 통과

합계 43/43 통과
```

### 30일 세계에서 검출된 사건 (시드 42 — 아무도 작성하지 않은 목록)

```
 0~ 2일 rumor_spread         concluded 중요도 1160 참여 11 충돌주체 5 새목적 10
 0~ 0일 ecological_conflict  concluded 중요도  440 참여  5 충돌주체 0 새목적  1
 0~ 3일 investigation        concluded 중요도  322 참여  9 충돌주체 3 새목적  5
 1~29일 subjugation_muster   ongoing   중요도 2363 참여 11 충돌주체 0 새목적  2
 2~ 8일 ecological_conflict  concluded 중요도  979 참여 10 충돌주체 2 새목적  6
 5~ 9일 promise_breach       concluded 중요도 1116 참여 11 충돌주체 2 새목적  1
 7~29일 food_crisis          ongoing   중요도 2159 참여 12 충돌주체 0 새목적  1
11~14일 promise_breach       concluded 중요도  637 참여  8 충돌주체 2 새목적  3
14~18일 ecological_conflict  concluded 중요도  663 참여  9 충돌주체 0 새목적  7
…                                                        (전체 37건)
26~29일 ecological_conflict  ongoing   중요도  325 참여  8 충돌주체 0 새목적  3
```

토벌 소집(1일)과 식량 위기(7일)는 30일 내내 닫히지 않는다 — 마을이 계속 소집하고 계속 굶기 때문이다. §28 의 `status: "ongoing"` 이 뜻하는 그대로, **사건은 진행 중 계속 자란다**.

### 구현 중 드러난 실패와 처방

| 관측된 실패 | 원인 | 처방 |
|---|---|---|
| 두 번째 변화가 기존 사건에 붙지 않고 새 사건이 됨 | 종결 판정을 흡수 **전에** 해서, 탐지 주기 동안 들어온 변화를 못 본 채 사건을 닫았다 | 흡수 → 종결 순서로 교체 |
| 탐지 주기보다 짧은 timeWindow 의 변화가 통째로 누락 | 씨앗 후보를 `now - timeWindow` 로만 잘랐다 | 후보 창을 `timeWindow + 탐지주기` 로 넓혀 "지난 탐지 이후"를 반드시 덮게 함 |
| 중요도의 미래 잠재력 항이 항상 0 | `entityId.stateKey` 문자열을 첫 점에서 쪼갰는데 개체 id 에도 점이 있다(`agent.kael.fear` → `kael.fear`) | 집계를 문자열이 아니라 누적 요약(entityId·stateKey 분리 보관)에서 계산 |
| 관찰자별 knownFacts 가 거의 같음 | 사건이 건드린 것을 "실제 상태 변화"로만 봤다 | 사건 중 바뀐 **믿음**(`belief:주제.상태`)도 사건이 건드린 주제로 포함 — §10 의 갈라진 앎이 여기서 드러난다 |
| 거래 분쟁 패턴이 30일 내내 0건 | 수동 세계에 분쟁 축이 없다 | 패턴을 지우고 실제로 도는 축(약속 파기)으로 교체 |

### 기준선 재고정

Phase 4 는 세계의 **동역학을 바꾸지 않는다**. change 에 id 와 태그를 더했을 뿐이므로 로그 해시만 달라지고 나머지는 그대로다 — 재고정 직전에 그것을 확인했다.

| | 시드 1 | 시드 42 | 시드 43 |
|---|---|---|---|
| Phase 3 기준선 | `72aeb25e` / 8494건 | `a732b0d5` / 7953건 | `589159af` / 7964건 |
| Phase 4 (태그·id 추가 후) | `8b39a154` / 8494건 | `dbc0ad11` / 7953건 | `1a05756f` / 7964건 |
| 변경 건수·개체 상태 해시·규칙 발동 횟수 | 동일 | 동일 | 동일 |

즉 "달라진 것은 로그에 붙은 관측용 메타데이터뿐"이 기계적으로 증명된다. Phase 2 의 이관 증명 기록은 여전히 `migration-baseline.json` 의 `previous` 에 남아 있다.

### Phase 5 로 넘기는 것

- `EventPattern` 스키마(§28 필드 + `type`)와 `WorldValidation` 의 패턴 검사 → 생성기 출력 계약.
- `getEventViewFor` / `buildInterventionOpportunity` → Phase 7 플레이어는 **다른 경로가 아니라 이 API 를 그대로** 쓴다(플레이어도 하나의 주체다, §31).
- `eventCountsByPattern` / `measurePromotion` → Phase 6 §35 다양성·중요도 분포 검증.
- `events_created` 프로토콜 응답이 실체가 됐다 — 매 `advance_time` 마다 새로 생기거나 종결된 사건만 실려 나간다(§38).

## 이후 Phase 인터페이스

- `EventPattern` JSON 스키마 → Phase 5 사건 패턴 생성기 출력 계약.
- 사건·개입기회·관찰자 시점 API → Phase 7 플레이어 UI, Phase 8 사건 화면(§36.4).
- 사건 통계(종류·참여 조합) → Phase 6 다양성 검증(§35).
