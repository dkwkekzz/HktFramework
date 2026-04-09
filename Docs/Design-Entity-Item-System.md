# Entity 생명주기 및 아이템 소유/활성화 정책 기획서

## 문서 개요

HktGameplay 모듈의 Entity 생명주기(Lifecycle)와 아이템 소유/활성화 정책을 정의하는 게임 기획서이다.
현재 코드베이스의 구현 상태를 기준으로 전체 설계를 정리하고, 미구현 영역과 개선 제안을 포함한다.

---

## 0. Tag 네이밍 컨벤션

모든 GameplayTag는 아래 규칙을 따른다.

### 0.1 Story Tags — `Story.{호출형태}.{카테고리}.{이름}`

Story(VM 프로그램)를 식별하는 태그. 접두사로 호출 출처를 구분한다.

| 접두사 | 호출 출처 | 설명 | 예시 |
|--------|-----------|------|------|
| `Story.Event.*` | Client Intent | 클라이언트가 최초로 fire | `Story.Event.Item.Pickup`, `Story.Event.Attack.Basic` |
| `Story.Flow.*` | Map Event | 서버가 자체적으로 fire | `Story.Flow.Spawner.GoblinCamp`, `Story.Flow.NPC.Lifecycle` |
| `Story.State.*` | 지속 상태 | 서버가 fire, 지속 유지 | `Story.State.Player.InWorld` |

### 0.2 Entity Tags — `Entity.*`

엔티티 관련 모든 태그의 루트.

| 패턴 | 용도 | 예시 |
|------|------|------|
| `Entity.{Type}.{Name}` | 엔티티 유형 (SpawnEntity의 ClassTag) | `Entity.Character.Player`, `Entity.Item.WoodenSword`, `Entity.NPC.Goblin` |
| `Entity.Attr.{Category}.{Name}` | 엔티티 속성 (AddTag로 부여하는 분류) | `Entity.Attr.Weapon.Sword`, `Entity.Attr.Item.Material`, `Entity.Attr.NPC.Hostile` |
| `Entity.{PropertyName}.{Value}` | Property 값으로 사용되는 태그 | `Entity.Stance.Spear`, `Entity.Stance.Sword1H` |

### 0.3 Presentation Tags

| 패턴 | 용도 | 예시 |
|------|------|------|
| `Anim.{Layer}.{Category}.{Name}` | 애니메이션 상태 태그 | `Anim.FullBody.Locomotion.Idle`, `Anim.UpperBody.Combat.Attack` |
| `VFX.Niagara.{Name}` | VFX 식별자 (Niagara) | `VFX.Niagara.SpawnEffect`, `VFX.Niagara.HitSpark` |
| `Sound.{Name}` | 사운드 식별자 | `Sound.Spawn`, `Sound.Hit` |
| `Widget.{Name}` | UI 위젯 식별자 | `Widget.IngameHud` |

### 0.4 System Tags

| 패턴 | 용도 | 예시 |
|------|------|------|
| `Effect.{Name}` | 게임 이펙트 (버프/디버프) | `Effect.Burn` |

---

## 1. Event와 Story의 구조

### 1.1 근본 개념

**Story**는 **Event**로부터 실행되는 구조이다.
모든 Story는 GameplayTag로 지칭되며, 클라이언트 또는 서버가 최초로 시작(fire)하는 Tag가 **Event**가 된다.

구현적으로 Event와 Story는 동일하다 — 둘 다 Tag로 식별되는 VM 프로그램이다.
차이는 **개념적**이다: Event는 최초의 트리거(진입점)이고, Story는 그로부터 파생되는 후속 로직이다.

### 1.2 Event의 두 가지 출처

| 출처 | 이름 | 설명 | 예시 |
|------|------|------|------|
| **서버** | Map Event | 서버가 자체적으로 요청하는 자연적 작용 | `Story.Flow.Spawner.Item.TreeDrop`, `Story.Flow.NPC.Lifecycle`, `Story.State.Player.InWorld` |
| **클라이언트** | Client Intent | 사용자가 요청하는 상호작용 | `Story.Event.Item.Pickup`, `Story.Event.Item.Activate`, `Story.Event.Item.Drop` |

### 1.3 Event와 Story의 분리

핵심 구분: **Event는 최초의 트리거**이다. Story 내부에서 파생되는 로직은 Event가 아니다.

```
예시: 아이템 지급(Grant)

  Event(최초 트리거)          Story(파생 로직)
  ─────────────────          ──────────────────
  퀘스트 완료 UI 클릭    ──►  퀘스트 보상 처리 Story
                               └─► Grant (아이템 생성+InBag)
  NPC 대화 선택          ──►  NPC 상점 Story
                               └─► Grant (아이템 생성+InBag)
```

Grant 자체는 Event가 아니다. 최초의 트리거(퀘스트 UI, NPC 대화 등)가 Event이고,
Grant는 그 Event의 Story 내부에서 수행되는 아이템 생성+소유 로직이다.

반면 Pickup은 그 자체가 Event이다 — 클라이언트가 "이 아이템을 줍겠다"고 직접 요청한다.

### 1.4 Event 검증 (미구현 — Gap)

**최초의 Story(Event)는 검증이 필요하다.** 클라이언트가 fire하는 Client Intent는 서버에서 사전 조건을 검증해야 한다. 현재 이 검증 레이어가 빠져 있다.

검증이 필요한 이유:
- Client Intent는 클라이언트가 임의로 fire할 수 있다
- 검증 없이 Story가 실행되면 부정 행위가 가능하다
- Map Event는 서버 자체가 fire하므로 검증이 불필요하거나 최소화할 수 있다

검증의 위치:
- Story 내부의 조건 분기 (현재 방식: Pickup에서 거리/용량 검증)
- Event fire 시점의 사전 검증 레이어 (미구현: Story 실행 전에 걸러내는 게이트)

---

## 2. Entity 생명주기

### 2.1 핵심 개념

모든 게임 오브젝트(캐릭터, 아이템, NPC, 이펙트)는 **Entity**이다.
Entity는 순수 데이터이며, `FHktEntityId`(int32)로 식별된다.
Entity의 종류는 `FGameplayTagContainer`의 태그로 구분한다 (예: `Entity.Character.Player`, `Entity.Item.Sword`).

### 2.2 식별 체계

| 식별자 | 타입 | 범위 | 용도 |
|--------|------|------|------|
| `FHktEntityId` | int32 | 그룹 내 유일 | 런타임 엔티티 참조 (NextEntityId++ 순차 할당) |
| `PlayerUid` | int64 | 전역 유일 | 계정 식별, DB 키, 엔티티 소유권 |
| `OwnerEntity` | int32 (Hot Property) | 그룹 내 | 엔티티-엔티티 소유 관계 (아이템→캐릭터) |
| `EntitySpawnTag` | int32 (Hot Property) | GameplayTag 넷인덱스 | Presentation 시각 유형 |

### 2.3 소유 관계의 이중 구조

**계정 소유 (Account Ownership)** — `OwnerUid` (int64)
- Entity가 어떤 플레이어 계정에 속하는지 나타낸다.
- DB 저장/로드, 로그아웃 시 엔티티 추출의 기준.
- `Op_SpawnEntity`에서 `Runtime.PlayerUid != 0`일 때 자동 설정된다.

**엔티티 소유 (Entity Ownership)** — `OwnerEntity` (int32, Hot Property)
- 아이템이 어떤 캐릭터 엔티티에 소속되는지 나타낸다.
- Pickup/Activate/Drop 등 Story 검증의 기준.
- `Op_SpawnEntity`에서 `Reg::Self`로 자동 설정된다.

### 2.4 접속에서 월드 존재까지의 전체 흐름

```
Phase 1: 네트워크 접속 및 인증
  1. 클라이언트 접속 → UE5 GameMode.PostLogin() 호출
  2. PlayerController에 UHktWorldPlayerComponent 부착
  3. BeginPlay()에서 PlayerState.UniqueNetId 해시 → PlayerUid(int64) 산출
  4. IHktServerRule.OnEvent_GameModePostLogin(IHktWorldPlayer) 호출
       │
       ▼
Phase 2: DB 로드 (비동기)
  1. ServerRule이 CachedDB->LoadPlayerRecordAsync(PlayerUid) 호출
  2. FHktPlayerRecord 반환:
     - PlayerUid, LastLoginTime, LastPosition
     - ActiveEvents: 재개할 Story Flow 이벤트 목록 (예: State.Player.InWorld)
     - EntityStates: 소유 엔티티의 전체 스냅샷 (TArray<FHktEntityState>)
  3. 로드 완료 시 PendingLoginResults 큐에 적재
       │
       ▼
Phase 3: Relevancy 배치 및 엔티티 주입 (GameModeTick에서)
  1. PendingLoginResults 디큐
  2. LastPosition 기반으로 RelevancyGroup 인덱스 결정
  3. GroupEventSend.Entered에 신규 플레이어 등록
  4. FHktPlayerRecord.EntityStates → GroupBatch.NewEntityStates로 주입
  5. FHktPlayerRecord.ActiveEvents → GroupBatch.NewEvents로 주입
       │
       ▼
Phase 4: 시뮬레이터 실행 및 월드 존재
  1. Simulator.AdvanceFrame(GroupBatch) 호출
  2. NewEntityStates → WorldState.ImportEntityState()로 복원
  3. NewEvents 중 "State.Player.InWorld" → Story VM 기동
     - 신규: 캐릭터 엔티티 SpawnEntity + 초기 아이템 지급
     - 복귀: DB에서 복원된 엔티티가 이미 존재, Story가 상태 유지
  4. Graph.RegisterPlayer(Player, GroupIndex) 실행
  5. 클라이언트에 SimulationEvent + WorldState 전송
```

### 2.5 로그아웃 및 영구 저장 흐름

```
  1. GameMode.Logout() → ServerRule.OnEvent_GameModeLogout()
  2. PendingLogoutRequests 큐에 PlayerUid 적재
  3. GameModeTick에서 디큐:
     a. Simulator.ExportPlayerState(PlayerUid) 호출
        → OwnerUid가 일치하는 모든 엔티티를 FHktEntityState로 추출
        → 해당 플레이어의 ActiveEvents(VM 실행 중인 Story)도 추출
     b. DB.SavePlayerRecordAsync(PlayerUid, PlayerState)
     c. GroupBatch.RemovedOwnerIds에 추가
        → 시뮬레이터가 해당 OwnerUid 엔티티 모두 제거
  4. Graph.UnregisterPlayer(PlayerUid)
```

### 2.6 클라이언트의 자기 Entity 식별

클라이언트는 자신의 `PlayerUid`를 알고 있다 (`UHktWorldPlayerComponent.GetPlayerUid()`).
서버로부터 수신한 `FHktWorldState`에서 `ForEachEntityByOwner(PlayerUid, ...)`를 사용하거나,
엔티티의 `OwnerUid`를 비교하여 자신의 캐릭터와 소유 아이템을 식별한다.

---

## 3. 아이템 소유 정책

### 3.1 설계 원칙

**"아이템은 엔티티이다."**

아이템은 별도의 인벤토리 테이블이 아니라, 캐릭터와 동일한 Entity 시스템 내에 존재한다.
소유 관계는 Property와 OwnerUid로 표현된다.

### 3.2 OwnerUid 자동 전파

`Op_SpawnEntity` (`HktVMInterpreterActions.cpp`)에서:
- `OwnerEntity`는 `Reg::Self`(호출자 엔티티)로 자동 설정
- `OwnerUid`는 `Runtime.PlayerUid`가 0이 아닐 때 자동 설정

따라서 플레이어 Story에서 SpawnEntity로 생성된 아이템은 자동으로 해당 플레이어 계정에 귀속된다.

### 3.3 소유 상태 전이 규칙

```
[무주물 (Ground)]          [소유됨 (InBag/Active)]
  OwnerEntity = 0            OwnerEntity = 캐릭터ID
  OwnerUid = 0               OwnerUid = 플레이어Uid
  ItemState = 0              ItemState = 1 또는 2

      ──── Pickup ────►
      ◄──── Drop ──────
```

| 전이 | Story | 사전 조건 | 변경 속성 |
|------|-------|-----------|-----------|
| **Pickup** | `Story.Event.Item.Pickup` | ItemState==0, 거리<=300cm, 가방<BagCapacity | OwnerEntity=Self, ItemState=1 |
| **Grant** | (Story 내부 패턴) | 가방<BagCapacity | SpawnEntity→OwnerEntity=Self, ItemState=1 |
| **Activate** | `Story.Event.Item.Activate` | ItemState==1, OwnerEntity==Self | ItemState=2, EquipIndex=Param0, 캐릭터 Stance=아이템 Stance |
| **Deactivate** | `Story.Event.Item.Deactivate` | ItemState==2, OwnerEntity==Self | ItemState=1, EquipIndex=-1 |
| **Drop** | `Story.Event.Item.Drop` | OwnerEntity==Self | ItemState=0, OwnerEntity=0, EquipIndex=-1, 위치=Self위치 |

### 3.4 아이템 획득 경로 (Acquisition Paths)

아이템 획득은 **Event(최초 트리거)와 Story(파생 로직)의 구분**(섹션 1.3 참조)에 따라 분류된다.

| 경로 | 분류 | 최초 트리거 (Event) | 파생 로직 (Story) |
|------|------|---------------------|-------------------|
| **바닥 줍기** | Client Intent | `Story.Event.Item.Pickup` | — (Event 자체가 획득 로직) |
| **퀘스트 보상** | Client Intent | 퀘스트 완료 UI 등 | Story 내부에서 Grant (SpawnEntity→InBag) |
| **NPC 상점** | Client Intent | NPC 대화/구매 선택 | Story 내부에서 Grant (SpawnEntity→InBag) |
| **조합** | Client Intent | `Story.Event.Item.Craft` (향후) | 재료소비 후 Grant |
| **NPC 전리품** | Map Event | `Story.Flow.NPC.Lifecycle` | SpawnEntity→Ground → 플레이어가 Pickup |
| **자연 스폰** | Map Event | `Story.Flow.Spawner.Item.TreeDrop` | SpawnEntity→Ground → 플레이어가 Pickup |
| **초기 지급** | Map Event | `Story.State.Player.InWorld` | Story 내부에서 직접 SpawnEntity→InBag |

**Grant는 Event가 아니다.** Grant(아이템 생성+InBag 주입)는 다양한 Event의 Story 내부에서 수행되는 공통 패턴이다. VM에 서브루틴 호출이 없으므로, Grant 로직(용량검증+SpawnEntity+속성설정)은 각 Story에 인라인으로 포함된다. 가방 슬롯 관리는 Player의 BagComponent가 담당한다.

**Pickup과 Grant의 차이:**
- Pickup: 이미 존재하는 Ground 아이템(Target)의 소유권을 가져온다. 거리 검증 필요. 그 자체가 Event.
- Grant: 새 아이템을 SpawnEntity로 생성하여 바로 InBag에 넣는다. 거리 검증 불필요. Event의 Story 내부 로직.

### 3.5 아이템 상호작용 요청 경로 (Client → Server)

아이템 이벤트는 `FHktItemRequest` 구조체를 통해 클라이언트에서 서버로 전달된다.

```
클라이언트 입력                           서버 처리
─────────────────────────                 ──────────────────────
[바닥 아이템 클릭]
  OnTargetAction()
    ItemState==0 감지
      → RequestItemPickup()
        → Server_ReceiveItemRequest()  → OnReceived_ItemRequest()
                                           Action=Pickup → Story.Event.Item.Pickup

[가방 위젯에서 아이템 선택 — 장착]
  RequestBagRestore(BagSlot, EquipIndex)
    → Server_ReceiveBagRequest()       → OnReceived_BagRequest()
                                           Action=RestoreToSlot → 엔티티 생성 + Story.Event.Item.Activate

[장비 위젯에서 아이템 선택 — 가방으로 보관]
  RequestBagStore(EquipIndex)
    → Server_ReceiveBagRequest()       → OnReceived_BagRequest()
                                           Action=StoreFromSlot → 스냅샷 + Story.Event.Item.Deactivate

[드롭 요청]
  RequestItemDrop(Item)
    → Server_ReceiveItemRequest()      → OnReceived_ItemRequest()
                                           Action=Drop → Story.Event.Item.Drop
```

**서버 검증**: `OnReceived_ItemRequest`에서 SourceEntity 소유권 검증 + TargetEntity 존재 검증. Story VM의 Precondition이 ItemState 등 세부 조건을 이중 검증.

### 3.6 소유 제한 사항

| 제한 | 현재 값 | 근거 |
|------|---------|------|
| 가방 용량 (기본) | 8개 | 엔티티별 `BagCapacity` Cold Property. 플레이어 캐릭터 기본값 8 |
| 가방 용량 (엔티티별 가변) | 엔티티마다 다름 | 이동형 창고 엔티티 등으로 확장 가능 |
| 줍기 최대 거리 | 300cm (3m) | `HktStoryItemPickup.cpp` — `.LoadConst(R1, 300)` |
| 소유권 이전 | Drop 후 Pickup만 가능 | 직접 트레이드 Story 미구현 |
| EquipIndex 범위 | 정수, -1=미등록 | 최대 슬롯 수 미정의 |

---

## 4. 아이템 활성화 정책

### 4.1 아이템 상태 머신

아이템은 획득 시 즉시 Active 상태가 되어 스킬을 사용할 수 있다.
별도의 활성화 단계는 없으며, 가방(Bag)으로의 보관/복원으로 관리한다.

```
                    ┌──────────┐
        Spawn       │          │
    ───────────────►│  Ground  │
    (자연 스포너)    │ State=0  │
                    └────┬─────┘
                         │
                    Pickup│(Story.Event.Item.Pickup)
                         │ 조건: 거리<=3m, 빈 EquipIndex 존재
                         │ + 자동 EquipIndex 할당 + 스탯/Stance 적용
                         ▼
                    ┌──────────────┐   BagStore (StoreFromSlot)
                    │ Active       │──────────────►┌─────────┐
                    │ State=2      │               │   Bag   │
                    │ EquipIndex=N │◄──────────────┤(스냅샷) │
                    └──────────────┘   BagRestore  └─────────┘
                                      (RestoreToSlot)

    * Pickup 시 빈 EquipIndex(0~8)이 없으면 픽업 실패
    * Drop은 Active 상태에서 Ground로 복귀 가능
    * Drop 시: EquipSlot[N] 클리어, OwnerEntity=0, EquipIndex=-1, 위치=소유자위치
    * Bag은 엔티티가 아닌 경량 스냅샷(FHktBagItem)으로 보관
    * Activate/Deactivate Story는 Bag 연동 전용 (내부 사용)
```

### 4.2 슬롯 구조

**EquipIndex (액션 슬롯)**
- 범위: 0~8 (EquipSlot0~EquipSlot8)
- 할당 방식: Pickup 시 자동으로 빈 슬롯 할당, BagRestore 시 지정
- 용도: 장착된 아이템의 활성 슬롯 (예: 0=주무기, 1=보조장비)

### 4.3 Stance (전투 자세)와 아이템의 관계

Stance는 Hot Property로 캐릭터의 전투 모드를 정의한다:
- `Entity.Stance.Unarmed` — 비무장
- `Entity.Stance.Spear` — 창
- `Entity.Stance.Gun` — 총
- `Entity.Stance.Sword1H` — 한손검

아이템 엔티티는 자신의 `Stance` Property에 해당 무기의 Stance 값을 저장한다.
Activate Story에서 아이템의 Stance를 읽어 캐릭터의 Stance를 자동 변경한다.

### 4.4 아이템 Property 목록

| Property | Tier | 용도 |
|----------|------|------|
| `OwnerEntity` | Hot | 소유 캐릭터 EntityId |
| `AttackPower` | Hot | 공격력 (아이템이 기여하는 전투 스탯) |
| `Defense` | Hot | 방어력 |
| `ItemState` | Cold | 상태 (0=Ground, 1=InBag, 2=Active) |
| `ItemId` | Cold | 아이템 종류 식별자 (100=목검, 101=나무) |
| `EquipIndex` | Cold | 액션 슬롯 번호 (-1=미등록) |
| `BagCapacity` | Cold | 엔티티별 가방 용량 (기본 8, 창고 엔티티 등은 다른 값) |

---

## 5. 현재 구현 상태 매핑

### 5.1 구현 완료 항목

| 기능 | 구현 파일 | 상태 |
|------|-----------|------|
| Entity 할당/해제 | `HktWorldState.h` — `AllocateEntity()`, `RemoveEntity()` | 완료 |
| 3-Tier Property Storage | `HktWorldState.h` — Hot/Warm/Overflow | 완료 |
| OwnerUid 관리 | `HktWorldState.h` — `GetOwnerUid()`, `SetOwnerUid()`, `ForEachEntityByOwner()` | 완료 |
| 태그 기반 분류 | `FGameplayTagContainer` per entity | 완료 |
| 플레이어 접속 흐름 | `HktServerRule.cpp` — `OnEvent_GameModePostLogin()` | 완료 |
| DB 비동기 로드/저장 | `IHktWorldDatabase` 인터페이스 | 완료 |
| 엔티티 직렬화/복원 | `FHktEntityState`, `ExtractEntityState()`, `ImportEntityState()` | 완료 |
| ExportPlayerState | `IHktDeterminismSimulator` — OwnerUid 기준 추출 | 완료 |
| OwnerUid 자동 전파 | `HktVMInterpreterActions.cpp` — `Op_SpawnEntity` | 완료 |
| 아이템 Pickup Flow | `HktStoryItemPickup.cpp` — 거리/용량 검증 포함 | 완료 |
| 아이템 Activate Flow | `HktStoryItemActivate.cpp` — InBag→Active + EquipIndex + Stance | 완료 |
| 아이템 Drop Flow | `HktStoryItemDrop.cpp` — 소유 해제 + 위치 이동 | 완료 |
| 자연 아이템 스포너 | `HktStoryItemSpawnerTreeDrop.cpp` — 30초 주기 나무 스폰 | 완료 |
| 플레이어 월드 진입 | `HktStoryPlayerInWorld.cpp` — 캐릭터 + 목검 생성 | 완료 |
| 캐릭터 스폰 연출 | `HktStoryCharacterSpawn.cpp` — 이펙트/애니메이션/장비 | 완료 |
| 로그아웃 처리 | `HktServerRule.cpp` — Export + Save | 완료 |
| Relevancy 그룹 기반 병렬 시뮬레이션 | `HktServerRule.cpp` — `ParallelFor(NumGroups, ...)` | 완료 |
| WorldView 읽기 뷰 | `HktWorldView.h` — Diff 기반 클라이언트 상태 전달 | 완료 |

### 5.2 아이템 종류 정의

| ItemId | 태그 | 이름 | 초기 스탯 |
|--------|------|------|-----------|
| 100 | `Entity.Item.WoodenSword` | 목검 | AttackPower=5, Stance=Sword1H |
| 101 | `Entity.Item.Wood` | 나무 | (재료) |
| 102 | `Entity.Item.WoodSpear` | 나무창 | AttackPower=7, Stance=Spear |
| - | `Entity.Item.Sword` | 검 | (CharacterSpawn용) |
| - | `Entity.Item.Shield` | 방패 | (CharacterSpawn용) |

---

## 6. Gap 분석 (미구현/불완전 항목)

### Gap 0: Event 검증 레이어 부재 — 우선순위: 높음
- **현상**: Client Intent로 fire되는 Event(최초의 Story)에 대한 사전 검증이 없다. 현재는 Story 내부의 조건 분기(예: Pickup의 거리/용량 체크)로만 검증하고 있다.
- **영향**: 클라이언트가 임의의 Event Tag를 fire하여 부정 행위가 가능하다. Story 내부 검증은 Story가 이미 실행된 후에 발생하므로, 실행 자체를 막지는 못한다.
- **제안**: Event fire 시점에 사전 검증 레이어 추가. Map Event(서버 자체 fire)는 검증 최소화 또는 생략 가능. Client Intent는 Story 실행 전 게이트에서 조건을 확인.

### Gap 1: Deactivate 흐름 부재 — 우선순위: 높음
- **현상**: Active(State=2) → InBag(State=1) 전이를 담당하는 Story가 없다.
- **영향**: 활성 해제를 하려면 Drop 후 Pickup해야 한다 (비직관적).
- **제안**: `Story.Event.Item.Deactivate` Story 추가. Active→InBag 전환, EquipIndex=-1로 초기화, Stance 복원.

### Gap 2: EquipIndex 충돌 미검증 — 우선순위: 중간
- **현상**: `Story.Event.Item.Activate`에서 동일 EquipIndex에 이미 다른 아이템이 할당되어 있는지 확인하지 않는다.
- **영향**: 두 개의 아이템이 같은 EquipIndex을 점유할 수 있다.
- **제안**: 기존 EquipIndex 점유 아이템의 자동 해제 로직 추가.

### Gap 4: 장비 스탯 캐릭터 반영 미구현 — 우선순위: 중간 ✅ 구현 완료
- **현상**: 아이템의 AttackPower/Defense가 캐릭터의 전투 스탯에 합산되는 로직 없음.
- **영향**: 아이템 활성화가 실질적인 전투력 변화를 일으키지 않음.
- **구현**: Activate Story에서 아이템 스탯을 캐릭터에 합산, Deactivate/Drop/Evict 시 차감. `HktStoryItemActivate.cpp`, `HktStoryItemDeactivate.cpp`, `HktStoryItemDrop.cpp` 수정.

### Gap 5: 무기 메쉬 소켓 부착 시스템 부재 — 우선순위: 높음 ✅ 구현 완료
- **현상**: Presentation 레이어에 무기 소켓 부착 시스템이 없다. 아이템은 독립 Actor로 렌더링되며 캐릭터에 붙지 않는다.
- **영향**: EquipIndex이 변경되어도 시각적으로 무기가 캐릭터에 표시되지 않음.
- **구현**: `UHktItemVisualDataAsset`에 `AttachSocketName` 프로퍼티 추가. 소켓 이름은 아이템 DataAsset이 정의하며 EquipIndex 값과 무관. `AHktItemActor`가 스폰 시 소켓 이름을 캐싱하고, `FHktActorRenderer::TryAttachToOwner()`가 아이템 Actor에서 소켓 이름을 읽어 부착. OwnerEntity/EquipIndex 변경 감지 → 자동 재부착, PendingAttachments로 스폰 순서 독립 처리. `HktItemVisualDataAsset.h`, `HktItemActor.h/.cpp`, `HktActorRenderer.h/.cpp` 수정.

### Gap 6: Drop 시 OwnerUid 미해제 — 우선순위: 높음 ✅ 구현 완료
- **현상**: `Story.Event.Item.Drop`에서 `OwnerEntity=0`으로 초기화하지만 `OwnerUid`는 해제하지 않는다.
- **영향**: 드롭된 아이템이 DB 상으로 여전히 원래 플레이어 소유. 로그아웃 시 드롭된 아이템도 함께 저장/추출될 수 있다. 다른 플레이어가 Pickup하면 OwnerUid 불일치 발생.
- **구현**: VM에 `SetOwnerUid`/`ClearOwnerUid` Op 추가. Drop Story에서 `ClearOwnerUid`, Pickup Story에서 `SetOwnerUid` 호출. `HktStoryTypes.h`, `HktVMInterpreter.h/.cpp`, `HktVMInterpreterActions.cpp`, `HktStoryBuilder.h/.cpp`, `HktStoryItemDrop.cpp`, `HktStoryItemPickup.cpp` 수정.

### Gap 7: 아이템 거래/이전 시스템 부재 — 우선순위: 낮음 ✅ 구현 완료
- **현상**: 플레이어 간 직접 아이템 이전 수단 없음.
- **영향**: Drop→Pickup으로만 거래 가능 (분실 위험, 보안 취약).
- **구현**: `Story.Event.Item.Trade` Story 추가. Precondition에서 양측 소유권/상태 검증, 원자적으로 OwnerEntity 교환. Active 아이템 거래 불가. `HktStoryItemTrade.cpp` 신규.

### Gap 8: 신규 vs 복귀 플레이어 분기 — 우선순위: 미정 ✅ 구현 완료
- **현상**: 복귀 플레이어 재접속 시 DB에서 EntityStates가 Import된 후 `Story.State.Player.InWorld` Story가 다시 기동되면, 초기 아이템(목검)이 중복 지급될 수 있다.
- **구현**: `CountByOwner`로 소유 아이템 존재 여부 확인, 있으면 초기 지급 건너뜀. `HktStoryPlayerInWorld.cpp` 수정.

---

## 7. 프로토타입 전투 흐름

### 7.1 기본 흐름

```
1. 서버가 플레이어 Entity 생성 (Story.State.Player.InWorld)
2. 클라이언트가 자기 Entity를 포커싱하여 게임 진행
3. 우클릭으로 이동
4. PrototypeMap에 WoodSpear가 하나 스폰되어 있음
5. 플레이어가 WoodSpear를 클릭 → 자동 Pickup (OnTargetAction에서 Ground 아이템 감지 → RequestItemPickup)
6. Pickup 시 즉시 Active:
   - 빈 EquipIndex 자동 할당
   - ItemState: 0(Ground) → 2(Active)
   - 아이템의 Stance Property를 읽어 캐릭터 Stance 자동 변경
   - 캐릭터 무기 소켓에 해당 아이템 Mesh 부착 (Gap 5 ✅)
7. 장비 위젯에서 아이템 클릭 → 가방으로 보관 (RequestBagStore → Server_ReceiveBagRequest)
8. 가방 위젯에서 아이템 클릭 → 다시 장착 (RequestBagRestore → Server_ReceiveBagRequest)
```

### 7.2 미구현 항목 (프로토타입용)

| 항목 | 상태 | 설명 |
|------|------|------|
| WoodSpear 맵 스폰 Story | 미구현 | PrototypeMap 로드 시 고정 위치에 WoodSpear 1개 스폰하는 Map Event |
| Pickup 클릭 | ✅ 구현 완료 | OnTargetAction에서 Ground 아이템(ItemState==0) 감지 → RequestItemPickup → Server_ReceiveItemRequest. 즉시 Active 상태 |
| Bag Store/Restore | ✅ 구현 완료 | `RequestBagStore`/`RequestBagRestore` → `Server_ReceiveBagRequest` RPC → `OnReceived_BagRequest` |
| 무기 메쉬 소켓 부착 | ✅ 구현 완료 | `UHktItemVisualDataAsset.AttachSocketName`으로 소켓 지정, `FHktActorRenderer`에서 OwnerEntity/EquipIndex 변경 감지 → 자동 부착/분리 |
| Inventory/Equipment 위젯 | ✅ 구현 완료 | 장비 패널: `RequestBagStore` 호출, 가방 패널: `RequestBagRestore` 호출 |

---

## 8. 향후 확장 제안

### 8.1 아이템 내구도/소비 시스템
- Cold Property로 `Durability` 추가.
- 사용/전투 시 감소, 0이면 파괴(RemoveEntity).

### 8.2 아이템 조합/성장 시스템
- CLAUDE.md에 명시된 "item attribute and combination, random growth" 컨셉.
- **조합**: 두 아이템 엔티티를 소비하고 새 아이템 엔티티를 SpawnEntity.
- **성장**: 아이템 Property에 Level/Experience 추가, Story에서 조건 충족 시 스탯 증가.
