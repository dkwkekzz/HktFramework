# 20. Phase N — 서버·동기화·영속화

> 상위: [Design-Modules.md](../Design-Modules.md) · 선행: [19-Phase-X-Spatial-Client.md](19-Phase-X-Spatial-Client.md) · 후속: [21-Phase-A-Authoring.md](21-Phase-A-Authoring.md)

MMORPG 로 만드는 페이즈다. GI-09(플레이어 특권 금지), GI-10(플레이어 부재 시 세계 정지 금지), GI-11(중복 소유 금지)의 최종 강제 지점이다.

---

## 모듈 목록

| ID | 목적 | 대표 검증 | 선행 |
|---|---|---|---|
| N0 | 모든 중요한 상태 변화와 능력 실행을 서버가 확정한다 | 두 클라이언트가 같은 아이템을 동시 획득해도 한 명만 소유 | K, I3 |
| N1 | 이동 반응성을 유지하며 필요한 사건만 전달한다 | 먼 지역의 계약 위반도 정보 규칙에 따라 전달됨 | N0, S0, I2 |
| N2 | 모든 주체를 동일 정밀도로 계산하지 않고도 일관된 세계를 유지한다 | 원격 마을을 집단 상태로 계산 후 접근하면 주요 사건·인물이 일관 복원 | C, K3, N0 |
| N3 | 세계 사건과 상태를 장기 보존하고 장애 후 복구한다 | 강제 종료 후 마지막 확정 사건까지 복구되고 중복 지급이 없음 | K3, N0 |

---

## N0 — authority-server

패키지: `packages/runtime/N0-authority-server`

| 항목 | 내용 |
|---|---|
| 목적 | 모든 중요한 상태 변화와 능력 실행을 서버가 확정한다 |
| 포함 | Command Validation, Server Tick, Protocol, Event Broadcast |
| 대표 검증 | 두 클라이언트가 같은 아이템을 동시에 획득해도 한 명만 소유 |
| 선행 | K, I3 |

서버가 권위를 가지는 항목:

```text
위치의 최종 확정 · 전투 결과 · 능력 조건과 비용 · 아이템 소유권
관계·약속·평판 · 세계 사건 · 지역 생성
```

서버 구조는 인터페이스로 분리하되 초기 프로토타입에서는 하나의 Node 프로세스로 실행한다.

```text
WorldCoordinator   세계 시간 · 전역 사건 · 국가·조직 · 지역 간 이동 · 세계 컴파일 요구
RegionShard        지역 물리 · 지역 NPC · 지역 사건 · 생태 상태 · 플레이어 동기화
SubjectRuntime     지각 · 믿음 · 가능성 활성화 · 의도 선택 · 기억과 성장
RuleEngine         행동 검증 · 비용 계산 · 상태 변화 · 현상 방출
SituationEngine    압력 군집화 · 갈등 탐지 · 사건 중요도 계산
WorldCompiler      미충족 요구 수집 · 지역·자원·규칙 실체화
```

시뮬레이션 루프(`simulationStep`)는 [Design-MMO.md](../Design-MMO.md) 29장을 그대로 구현한다.

---

## N1 — sync-interest

패키지: `packages/runtime/N1-sync-interest`

| 항목 | 내용 |
|---|---|
| 목적 | 이동 반응성을 유지하면서 필요한 사건만 클라이언트에 전달한다 |
| 포함 | Prediction, Reconciliation, Spatial Interest, Relation Interest, Region |
| 대표 검증 | 먼 지역에서 플레이어와의 계약이 위반되면 공간 밖 사건도 정보 규칙에 따라 전달 |
| 선행 | N0, S0, I2 |

관심 영역은 거리만으로 결정하지 않는다.

```text
공간 관심   플레이어 근처 실체
관계 관심   플레이어와 강한 관계를 가진 주체
약속 관심   플레이어가 맺은 Commitment 관련 사건
정보 관심   플레이어가 추적 중인 주장과 증거
조직 관심   플레이어가 소속된 조직의 전역 사건
```

멀리 떨어진 NPC 가 약속을 위반하면 거리와 무관하게 전달될 수 있다. 다만 플레이어가 **즉시 아는지**는 U1/U2 의 정보 전달 규칙이 결정한다.

---

## N2 — simulation-lod

패키지: `packages/runtime/N2-simulation-lod`

| 항목 | 내용 |
|---|---|
| 목적 | 모든 주체를 동일 정밀도로 계산하지 않고도 일관된 세계를 유지한다 |
| 포함 | L0~L4 LOD, Aggregate Population, Promotion, Demotion, Remote Scheduler |
| 대표 검증 | 원격 마을을 집단 상태로 계산한 뒤 접근하면 주요 사건과 인물이 일관되게 복원됨 |
| 선행 | C, K3, N0 |

| 단계 | 표현 |
|---|---|
| L0 잠재 | 주체 원형과 가능성 문법만 존재 |
| L1 집단 | 개체군·자원·조직을 통계 상태로 표현 |
| L2 원격 실명 주체 | 위치·목적·다음 예정 사건만 관리 |
| L3 지역 주체 | 지각·믿음·관계·행동을 저주기로 계산 |
| L4 활성 상호작용 | 전투·대화·물리·능력을 정밀 계산 |

초기 주기:

```text
클라이언트 렌더링: 60Hz 목표
이동 권위 판정: 20Hz
전투·능력 규칙: 10Hz
NPC 숙고: 1~2Hz
조직·경제: 사건 기반 또는 0.1Hz
원격 지역: 다음 중요 사건 시간만 예약
```

승격/강등 시 **이름이 있는 주요 주체, 부상, 약속, 관계, 소유물, 비밀은 반드시 보존한다.**

---

## N3 — persistence

패키지: `packages/runtime/N3-persistence`

| 항목 | 내용 |
|---|---|
| 목적 | 세계 사건과 상태를 장기간 보존하고 장애 후 복구한다 |
| 포함 | Event Store, Snapshot, Migration, Reconnect, Crash Recovery |
| 대표 검증 | 서버 강제 종료 후 마지막 확정 사건까지 복구되고 중복 지급이 없음 |
| 선행 | K3, N0 |

저장 구조 ([Design-MMO.md](../Design-MMO.md) 32장):

```text
event_log          world_id · sequence · tick · event_type · payload
                   · cause_event_ids · deterministic_seed
world_snapshots    world_id · sequence · compressed_state
subject_snapshots  subject_id · sequence · mind_state · belief_state
                   · memory_state · possibility_frontier
world_requirements requirement_id · source_node_id · realization_id · status
world_definitions  definition_id · schema_version · content_json
```

모든 세계 변화는 사건 로그를 통해서만 발생시킨다 (GI-01). 이 구조로 버그 재생, 배신 원인 추적, 생성 근거 확인, 규칙 패치 전후 비교, 플레이어 영향 분석이 가능해진다.

---

## 관련 수직 통합

| 슬라이스 | 관계 |
|---|---|
| [VS10](30-Vertical-Slices.md#vs10-멀티플레이와-영속-세계) | N0~N3 — 이 페이즈의 핵심 슬라이스 |
