# 20. Phase N — 서버·동기화·영속화

> 상위: [Design-Modules.md](../Design-Modules.md) · 원문 대응: 설계 원문 「18. Phase N — 서버·동기화·영속화」
>
> **아래 「원문」 절은 설계 원문을 그대로 옮긴 것이다.** 원문에 없는 보조 정보는 맨 끝 「파생 메모」에만 둔다.

---

## 원문

# 18. Phase N — 서버·동기화·영속화

## N0. 권위 서버

| 항목 | 내용 |
| -- | -- |
| 목적 | 모든 중요한 상태 변화와 능력 실행을 서버가 확정한다 |
| 포함 | Command Validation, Server Tick, Protocol, Event Broadcast |
| 대표 검증 | 두 클라이언트가 같은 아이템을 동시에 획득해도 한 명만 소유 |
| 선행 | K, I3 |

## N1. 예측·관심 영역·지역 분리

| 항목 | 내용 |
| -- | -- |
| 목적 | 이동 반응성을 유지하면서 필요한 사건만 클라이언트에 전달한다 |
| 포함 | Prediction, Reconciliation, Spatial Interest, Relation Interest, Region |
| 대표 검증 | 먼 지역에서 플레이어와의 계약이 위반되면 공간 밖 사건도 정보 규칙에 따라 전달 |
| 선행 | N0, S0, I2 |

## N2. 시뮬레이션 해상도

| 항목 | 내용 |
| -- | -- |
| 목적 | 모든 주체를 동일 정밀도로 계산하지 않고도 일관된 세계를 유지한다 |
| 포함 | L0~L4 LOD, Aggregate Population, Promotion, Demotion, Remote Scheduler |
| 대표 검증 | 원격 마을을 집단 상태로 계산한 뒤 접근하면 주요 사건과 인물이 일관되게 복원됨 |
| 선행 | C, K3, N0 |

## N3. 저장·복구·버전 이관

| 항목 | 내용 |
| -- | -- |
| 목적 | 세계 사건과 상태를 장기간 보존하고 장애 후 복구한다 |
| 포함 | Event Store, Snapshot, Migration, Reconnect, Crash Recovery |
| 대표 검증 | 서버 강제 종료 후 마지막 확정 사건까지 복구되고 중복 지급이 없음 |
| 선행 | K3, N0 |

---

## 파생 메모 (원문에 없음 — 작업 편의용)

### 패키지 경로

| ID | 패키지 |
|---|---|
| N0 | `packages/runtime/N0-authority-server` |
| N1 | `packages/runtime/N1-sync-interest` |
| N2 | `packages/runtime/N2-simulation-lod` |
| N3 | `packages/runtime/N3-persistence` |

원문 「25. 프로젝트 디렉터리 구조」의 `/apps/server` 가 이 페이즈를 실행하는 앱이다.

### 관련 원문 절

- N0 은 [01-Global-Invariants.md](01-Global-Invariants.md) GI-09(플레이어 특권 금지)·GI-11(고유 자원의 중복 소유 금지), N2 는 GI-10(플레이어 부재 시 세계 정지 금지)의 대상이다.
- 원문 「2.5」의 무효화 연쇄 종점이 N0(Authoritative Server)이다.

### 관련 수직 통합

| 슬라이스 | 포함 모듈 (원문 기준) |
|---|---|
| [VS10](30-Vertical-Slices.md#vs10-멀티플레이와-영속-세계) | N0~N3 |

### 함께 읽을 세계 설계 원본

- 서버 권위 항목과 서버 구조(WorldCoordinator / RegionShard / SubjectRuntime / RuleEngine / SituationEngine / WorldCompiler) — [Design-MMO.md](../Design-MMO.md) 28장 · 31장
- `simulationStep` 루프와 결정적 시드 조합 — 같은 문서 29장
- 시뮬레이션 해상도 L0~L4 표와 초기 주기(60Hz / 20Hz / 10Hz / 1~2Hz / 0.1Hz), 승격·강등 시 보존 대상 — 같은 문서 30장
- 관심 영역 5종(공간·관계·약속·정보·조직) — 같은 문서 31장
- 이벤트 소싱 저장 테이블 — 같은 문서 32장
