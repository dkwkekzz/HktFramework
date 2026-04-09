HktCore 시뮬레이션 모듈 아키텍처 설계서

작성일: 2026년 2월 11일
최종 수정: 2026년 3월 14일 (GGPO 동기화 및 예외처리 문서화)
대상: HktCore 모듈 구현 담당자
플랫폼: Unreal Engine 5.6 (C++ Module)

1. 개요 (Overview)

본 문서는 HktCore 모듈의 핵심 시뮬레이션 엔진에 대한 설계 명세를 기술합니다. 이 시스템은 결정론적(Deterministic) 결과를 보장하며, 롤백(Rollback) 기반의 네트워크 동기화를 지원하기 위해 **데이터(State)**와 **로직(System)**을 엄격하게 분리하는 구조를 따릅니다.

1.1 핵심 목표

순수 C++ 시뮬레이션: 언리얼 엔진의 UObject 라이프사이클에 의존하지 않는 독립적인 메모리 관리.

결정론적 실행: 동일한 초기 상태(WorldState)와 입력(Input)이 주어지면, 언제나 동일한 결과(Next State)를 보장.

VM 기반 로직: 게임플레이 로직은 바이트코드 기반의 VM에서 실행되며, 로직 실행 중 월드 상태를 직접 오염시키지 않음.

SOA 데이터 레이아웃: 엔티티 데이터를 PropertyId별 컬럼으로 관리하여 캐시 효율을 극대화.

2. 아키텍처 원칙 (Core Principles)

2.1 상태와 로직의 분리 (Separation of State and Logic)

State (FHktWorldState): 시뮬레이션의 모든 데이터를 SOA 컬럼 기반으로 저장. 로직을 포함하지 않으며, Deep Copy 및 직렬화가 가능.

System: 데이터를 입력받아 가공하는 로직 처리기. 내부에 상태를 저장하지 않음(Stateless).

2.2 트랜잭션 기반 상태 변경 (Buffered Writes)

VM이나 로직은 FHktWorldState를 직접 수정하지 않습니다.

변경 사항은 FHktVMStore의 PendingWritesByProperty에 PropertyId별로 배치 기록되며, 프레임의 특정 시점(ApplyStoreSystem)에 컬럼 단위로 일괄 적용(Commit)됩니다.

2.3 SOA (Structure of Arrays) 레이아웃

기존 AOS(TMap<EntityId, EntityState>) 방식 대비:
- 같은 Property를 가진 데이터가 메모리에 연속 배치 → 캐시 라인 히트율 극대화
- 시스템이 필요한 컬럼만 접근 (예: Physics는 PosX/PosY/PosZ 컬럼만)
- 컬럼 포인터를 루프 밖에서 캐싱하여 TMap 룩업을 1회로 제한

3. 데이터 구조 명세 (Data Structures)

3.1 Event Structures

FHktEvent (범용 게임플레이 이벤트)

    EventId (int32): 이벤트 고유 ID.
    EventTag (FGameplayTag): 이벤트 종류.
    SourceEntity (int32): 유발자 ID.
    TargetEntity (int32): 대상 ID.
    Location (FVector): 발생 위치.
    Param0, Param1 (int32): 범용 정수 파라미터.

FHktPhysicsEvent (물리 충돌 이벤트)

    EntityA, EntityB (int32): 충돌한 두 엔티티.
    ContactPoint (FVector): 충돌 지점.

FHktSimulationEvent (프레임 단위 시뮬레이션 입력)

    FrameNumber (int64)
    RandomSeed (int32)
    DeltaSeconds (float)
    RemovedOwnerIds (TArray<int64>)
    Events (TArray<FHktEvent>)

3.2 SOA Data Column

FHktDataColumn — PropertyId별 int32 데이터 배열

    PropertyId (int32): 컬럼이 대응하는 Property ID.
    IntData (TArray<int32>): SlotIndex로 인덱싱되는 값 배열.
    GetInt(SlotIndex) / SetInt(SlotIndex, Value) 로 접근.

3.3 World State (SOA)

FHktWorldState — 시뮬레이션 전체 스냅샷

    FrameNumber (int64), RandomSeed (int32), NextEntityId (int32)

    Entity Index Mapping:
        EntityToIndex (TArray<int32>): EntityId -> SlotIndex (-1 = invalid)
        IndexToEntity (TArray<FHktEntityId>): SlotIndex -> EntityId
        FreeIndices (TArray<int32>): 재사용 가능 슬롯 스택

    SOA Data:
        Columns (TMap<int32, FHktDataColumn>): PropertyId별 데이터 컬럼
        TagColumn (TArray<TArray<int32>>): SlotIndex별 TagIndices

    Active Events:
        ActiveEvents (TArray<FHktEvent>): 진행 중인 이벤트 (중간 합류 클라이언트 동기화용)

    Core Operations:
        AllocateEntity() -> FHktEntityId
        RemoveEntity(Id)
        IsValidEntity(Id) -> bool
        GetIndex(Id) -> int32 (EntityId → SlotIndex, invalid이면 -1)
        GetEntityCount() -> int32

    Property Access:
        GetProperty(Entity, PropertyId) -> int32
        SetProperty(Entity, PropertyId, Value)
        GetColumn(PropertyId) -> const FHktDataColumn*
        GetOrCreateColumn(PropertyId) -> FHktDataColumn&

    Iteration:
        ForEachEntity([](FHktEntityId Id, int32 SlotIndex) { ... })

    DTO 변환 (HktRuntime 네트워크 직렬화용):
        ExtractEntityState(Id) -> FHktEntityState

    Snapshot/Rollback:
        CopyFrom(Other), operator<< 직렬화

3.4 Entity State (DTO)

FHktEntityState — HktRuntime 모듈의 네트워크/DB 직렬화 전용 DTO

    EntityId (int32)
    Position (FVector): PosX/PosY/PosZ에서 조립
    TagIndices (TArray<int32>): 커스텀 태그 시스템 인덱스
    Properties (TArray<int32>): PropertyId 인덱스 기반 속성 배열

    주의: HktCore 내부에서는 SOA WorldState를 직접 사용.
    FHktEntityState는 ExtractEntityState()를 통해 SOA -> DTO 변환 시에만 생성.

3.5 World View (Zero Copy)

FHktWorldView — WorldState의 경량 읽기 뷰 (Zero Copy + Sparse Overlay)

    WorldState (const FHktWorldState*): 원본 데이터 참조 (복사 없음)
    IntOverlays (TMap<PropId, TMap<EntityId, int32>>): Property-first 희소 오버레이

    GetColumn(PropertyId): WorldState 컬럼 직접 접근 (Zero Copy — 벌크 순회용)
    GetOverlay(PropertyId): 해당 Property의 Overlay 맵 (없으면 nullptr)
    GetInt(Entity, PropertyId): Overlay → WorldState 순서로 layered read (단발성 조회용)
    GetAllEntities(): WorldState->IndexToEntity 참조 반환

    PublishViewSystem이 ActiveVMs의 Store를 순회하여 Overlay를 자동 구축

3.6 Property IDs (HktCoreProperties.h)

PropertyId 네임스페이스에 uint16 상수로 정의:

    위치/이동: PosX(0), PosY(1), PosZ(2), RotYaw(3), MoveTargetX/Y/Z(4-6), MoveSpeed(7), IsMoving(8)
    전투/상태: Health(10), MaxHealth(11), AttackPower(12), Defense(13), Team(14), Mana(15), MaxMana(16)
    소유: OwnerEntity(20), EntitySpawnTag(21)
    이벤트 파라미터: TargetPosX/Y/Z(30-32), Param0-3(33-36)
    애니메이션: AnimState(40), VisualState(41)
    소유권: OwnedPlayerUid(52)

4. VM 런타임 규격 (VM Runtime Specification)

4.1 VM 상태 (State Machine)

EVMStatus:
    Ready -> Running -> Completed / Failed
    Running -> Yielded (WaitFrames > 0)
    Running -> WaitingEvent (외부 이벤트 대기)
    Yielded -> Ready (WaitFrames == 0)
    WaitingEvent -> Ready (이벤트 매칭 또는 타이머 만료)

4.2 런타임 컨텍스트 (FHktVMRuntime)

    Program Counter (PC): int32
    Registers: int32[16] (R0~R9 범용, R10~R15 특수: Self, Target, Spawned, Hit, Iter, Flag)
    Status: EVMStatus
    Timers: CreationFrame, WaitFrames
    Search Result: FSpatialQueryResult (공간 검색 결과 캐싱)
    Store: FHktVMStore* (로컬 버퍼 참조)

4.3 VM Store (SOA 배치 쓰기)

FHktVMStore:
    SourceEntity, TargetEntity: 현재 VM 컨텍스트
    PendingWritesByProperty (TMap<uint16, TArray<FPendingWrite>>):
        PropertyId별로 쓰기를 묶어 배치 처리
        FPendingWrite { Entity, Value }
    LocalCache (TMap<uint64, int32>): read-after-write 일관성
    WorldState (const FHktWorldState*): SOA 읽기 참조

    Read 순서: LocalCache -> WorldState.GetProperty()
    Write: LocalCache + PendingWritesByProperty에 기록

4.4 핸들 규격 (FHktVMHandle)

    Index : 24 bits (최대 16M 슬롯)
    Generation : 8 bits (ABA 문제 방지)
    유효성 검사: Index != 0xFFFFFF

5. 실행 파이프라인 (Execution Pipeline)

FHktSimulationWorld::ProcessBatch 함수 내에서 매 프레임 실행되는 순차적 단계입니다.

Phase 1: 준비 (Preparation)

    1-1. Arrange System: 삭제된 소유자에 속하는 엔티티 정리.
        - OwnedPlayerUid 컬럼을 루프 밖에서 캐싱하여 순회.

    1-2. Build System: FHktEvent를 순회하며 VM 생성 및 레지스터 초기화.
        - VM 생성 성공 시 WorldState.ActiveEvents에 이벤트 등록.

Phase 2: 실행 (Execution)

    Process System:
        활성 VM 루프:
            WaitingEvent: 타이머 감소 또는 외부 이벤트 매칭.
            Yielded: WaitFrames 감소. 0이 되면 Ready 전환.
            Running/Ready: 인터프리터(Execute) 실행.
        실행 결과에 따라 CompletedVMs 목록으로 이동.

Phase 3: 물리 및 적용 (Physics & Commit)

    3-1. Physics System:
        - 공간 분할(Spatial Hashing): CellSize = 1000.0f
        - RebuildGrid: PosX/PosY 컬럼 포인터를 캐싱하여 순회 (Z는 2D 그리드에 불필요)
        - 충돌 감지: PosX/PosY/PosZ 컬럼 포인터를 캐싱, EntityToIndex로 직접 인덱싱
        - PhysicsEvent -> PendingExternalEvents 변환 (양방향 등록)

    3-2. Apply Store System:
        - VM별 PendingWritesByProperty를 순회
        - PropertyId별로 GetOrCreateColumn 후 해당 컬럼에 순차 기록
        - 캐시 효율: 같은 PropertyId의 모든 writes가 하나의 컬럼 메모리에 연속 접근

Phase 4: 정리 (Cleanup)

    Cleanup System: 완료된 VM 핸들 해제.
        - WorldState.ActiveEvents에서 해당 이벤트 제거 (SourceEntity + EventTag 매칭).

Phase 5: 뷰 생성 (View)

    CreateWorldView(OutView):
        - PublishViewSystem을 통해 FHktWorldView를 초기화.
        - WorldState 포인터를 연결 (Zero Copy — 데이터 복사 없음).
        - ActiveVMs의 Store를 순회하며 Int/Float Overlay를 구축.
        - 렌더러는 GetInt/GetFloat으로 Overlay → WorldState 순서로 조회.

6. 캐시 효율 패턴 (Cache Efficiency Patterns)

6.1 컬럼 포인터 호이스팅

모든 시스템에서 ForEachEntity 루프 전에 GetColumn()으로 컬럼 포인터를 캐싱합니다.
루프 내부에서는 Col->GetInt(SlotIndex) 배열 인덱싱만 수행하여 TMap 룩업을 제거합니다.

    // Good: TMap 룩업 1회
    const FHktDataColumn* ColX = WorldState.GetColumn(PropertyId::PosX);
    WorldState.ForEachEntity([&](FHktEntityId Id, int32 SlotIndex) {
        float X = ColX ? static_cast<float>(ColX->GetInt(SlotIndex)) : 0.f;
    });

    // Bad: 엔티티당 TMap 룩업
    WorldState.ForEachEntity([&](FHktEntityId Id, int32 SlotIndex) {
        float X = static_cast<float>(WorldState.GetProperty(Id, PropertyId::PosX));
    });

6.2 GetProperty vs GetColumn 사용 기준

    GetProperty(Entity, PropId): VM Store 내부, 단발성 읽기, 외부 API 등 편의성이 필요한 곳
    GetColumn(PropId) + Col->GetInt(Slot): 시스템 루프 내부, 성능이 중요한 벌크 순회

7. 구현 시 주의사항 (Implementation Notes)

메모리 풀링 (Pooling): FHktVMRuntimePool은 MaxVMs(256) 크기의 배열과 FreeSlots 스택을 사용하여 O(1) 할당/해제.

결정론적 부동소수점: 물리 연산 시 FVector 연산 순서를 임의로 변경하지 않음.

Store 패턴: VM은 절대로 WorldState를 직접 수정하면 안 됨. 반드시 Store.Write() / Store.WriteEntity()를 통해 버퍼링.

ActiveEvents 관리: VMBuildSystem에서 Add, VMCleanupSystem에서 Remove. WorldState에 포함되어 직렬화/롤백 시 자동 동기화.

FHktEntityState는 DTO: HktCore 내부에서는 SOA WorldState를 직접 사용. FHktEntityState는 HktRuntime의 네트워크 직렬화 시 ExtractEntityState()로 생성.

8. 폴더 구조 (Directory Structure)

HktCore/
├── Public/
│   ├── HktCoreDefs.h          // FHktEntityId
│   ├── HktCoreEvents.h        // FHktEvent, FHktEntityState, FHktSimulationEvent, FHktSimulationDiff, FHktPlayerState
│   ├── HktCoreProperties.h    // PropertyId 네임스페이스 (uint16 상수)
│   ├── HktCoreSimulator.h     // IHktAuthoritySimulator 인터페이스
│   ├── HktStoryTypes.h        // RegisterIndex, Reg, EOpCode, FInstruction (Story 빌더 공개)
│   ├── HktStoryBuilder.h
│   ├── HktWorldState.h
│   └── HktWorldView.h
├── Private/
│   ├── HktWorldState.cpp      // FHktWorldState 구현부
│   ├── HktSimulationSystems.h // 각 단계별 시스템 클래스 선언
│   ├── HktSimulationSystems.cpp
│   ├── HktWorldDeterminismSimulator.h/cpp
│   └── VM/
│       ├── HktVMTypes.h       // EVMStatus, FHktVMHandle, FHktVMRuntime, FHktVMRuntimePool
│       ├── HktVMStore.h       // FHktVMStore (SOA 배치 쓰기)
│       ├── HktVMStore.cpp
│       ├── HktVMInterpreter.h
│       ├── HktVMInterpreter.cpp
│       ├── HktVMInterpreterActions.cpp
│       └── HktVMProgram.h     // FHktVMProgram, FHktVMProgramRegistry

9. GGPO 동기화 모델 (GGPO Synchronization Model)

9.1 개요

서버와 클라이언트 모두 동일한 IHktDeterminismSimulator를 사용하여 30Hz 고정 타임스텝으로 시뮬레이션한다.
결정론적 실행이 보장되므로, 동일한 초기 상태 + 동일한 입력 = 동일한 결과가 성립한다.

    서버: 권위(Authority) 시뮬레이터. 매 프레임 AdvanceFrame()으로 확정된 Diff를 생성하여 클라이언트로 전송.
    클라: 프록시(Proxy) 시뮬레이터 (UHktProxySimulatorComponent). 로컬 예측 + 서버 배치 수신 시 롤백/재실행.

핵심 인터페이스 (HktCoreSimulator.h):

    AdvanceFrame(InEvent) → FHktSimulationDiff   // 1프레임 전진, 변경점 반환
    UndoDiff(Diff)                                // Diff 역적용으로 프레임 되돌리기
    RestoreWorldState(InState)                    // 전체 상태 덮어쓰기 (초기 합류용)

9.2 Diff 구조 (FHktSimulationDiff)

프레임별 변경점을 양방향(적용/되돌리기)으로 기록하는 구조체:

    FrameNumber (int64): 이 Diff가 발생한 프레임
    PrevNextEntityId: 프레임 실행 전 NextEntityId (UndoDiff 시 복원)

    SpawnedEntities (TArray<FHktEntityState>):
        이번 프레임에 생성된 엔티티 전체 상태
        UndoDiff 시 → RemoveEntity()로 제거

    RemovedEntities / RemovedEntityStates:
        제거된 엔티티 ID 목록 + 제거 전 전체 상태 스냅샷
        UndoDiff 시 → ImportEntityStateWithId()로 복원

    PropertyDeltas (TArray<FHktPropertyDelta>):
        {EntityId, PropertyId, NewValue, OldValue}
        UndoDiff 시 → OldValue로 복원

    TagDeltas / OwnerDeltas:
        태그·소유권 변경도 Old/New 쌍으로 기록

9.3 UndoDiff 동작 (HktWorldState.cpp)

Diff를 역순으로 적용하여 프레임을 되돌린다:

    1. SpawnedEntities에 기록된 엔티티를 RemoveEntity()
    2. PrevNextEntityId로 NextEntityId 복원
    3. RemovedEntityStates로 삭제되었던 엔티티를 ImportEntityStateWithId()
    4. PropertyDeltas의 OldValue로 프로퍼티 복원
    5. OwnerDeltas의 OldOwnerUid로 소유권 복원
    6. TagDeltas의 OldTags로 태그 복원
    7. FrameNumber = Diff.FrameNumber - 1

9.4 클라이언트 동기화 흐름 (UHktProxySimulatorComponent)

고정 타임스텝 (30Hz) 틱 루프:

    TickComponent(DeltaTime):
        FrameAccumulator += DeltaTime
        while (FrameAccumulator >= 1/30):
            if 서버 Batch 큐에 데이터 있음:
                ProcessPendingServerBatches()    // 롤백 + 서버 권위 재실행
            else:
                AdvanceLocalFrame()              // 로컬 예측

로컬 예측 (AdvanceLocalFrame):

    1. LocalFrame++
    2. BuildLocalBatch(LocalFrame) → 빈 이벤트 + 결정론적 시드
    3. Simulator->AdvanceFrame(LocalBatch) → Diff 생성
    4. DiffHistory에 Diff 추가 (나중에 롤백할 수 있도록)
    5. PendingDiff에 누적 (렌더링 갱신용)

서버 Batch 처리 (ProcessPendingServerBatches):

    1. PendingServerBatches를 FrameNumber 기준 오름차순 정렬
    2. 롤백으로 이전 예측 무효화 → PendingDiff 초기화
    3. 각 서버 Batch에 대해:
       a. [롤백] DiffHistory를 뒤에서부터 UndoDiff() — ServerFrame 직전까지
       b. [빨리감기] 현재 프레임 ~ ServerFrame 사이 빈 Batch 실행 (Diff 누적)
       c. [권위 실행] 서버 Batch로 AdvanceFrame() 실행 (Diff 누적)
       d. DiffHistory 초기화, LocalFrame = ServerFrame
          → 이후 틱에서 ServerFrame+1부터 재예측

9.5 예외 상황 처리

Case 1: 클라이언트가 서버보다 빠른 경우 (Rollback)

    상황: 클라가 프레임 N+1, N+2, N+3까지 예측 실행.
          서버 Batch(프레임 N+1)가 도착.

    처리:
        1. DiffHistory에서 N+3, N+2, N+1 순으로 UndoDiff() → 프레임 N 상태로 복원
        2. 서버 Batch(N+1)로 AdvanceFrame() 실행 → 서버 권위 상태 확정
        3. DiffHistory 초기화
        4. 이후 틱에서 N+2부터 다시 로컬 예측 시작

    시퀀스:

        클라 타임라인:  [N] → [N+1 예측] → [N+2 예측] → [N+3 예측]
                                                            ↓ 서버 Batch N+1 수신
        롤백:          [N+3] ← UndoDiff ← [N+2] ← UndoDiff ← [N+1] ← UndoDiff → [N]
        재실행:        [N] → [N+1 서버 권위] → [N+2 로컬 예측 재시작] → ...

Case 2: 클라이언트가 서버보다 느린 경우 (Fast-Forward)

    상황: 클라가 프레임 K에 있는데, 서버 Batch(프레임 M, M > K+1)가 도착.

    처리:
        1. DiffHistory에서 K까지 UndoDiff() (예측분 있으면)
        2. 프레임 K+1 ~ M-1까지 빈 Batch로 빨리감기 실행
        3. 서버 Batch(M)로 AdvanceFrame() 실행
        4. LocalFrame = M으로 보정

    시퀀스:

        클라 타임라인:  [K]
                         ↓ 서버 Batch M 수신 (M > K+1)
        빨리감기:      [K] → [K+1 빈] → [K+2 빈] → ... → [M-1 빈] → [M 서버 권위]

Case 3: 서버 Batch 순서 역전 (Network Reordering)

    상황: 네트워크 지연으로 Batch M+1이 M보다 먼저 도착.

    처리:
        ProcessPendingServerBatches()에서 FrameNumber 기준 오름차순 정렬 후 처리.
        → M 먼저 처리, 이후 M+1 처리. 결과적으로 올바른 순서 보장.

Case 4: DiffHistory 오버플로 (장시간 서버 미응답)

    상황: 서버 Batch 없이 로컬 예측만 300프레임(10초@30Hz) 이상 누적.

    처리:
        MaxHistoryFrames(300) 초과 시 연결 끊김으로 판정.
        → DiffHistory.Empty() 후 bInitialized = false로 시뮬레이션 중단.
        → OnTimeout 델리게이트 브로드캐스트 → 클라이언트 연결 해제(logout).
        → 10초간 서버 응답 없음 = 네트워크 단절. 클라 재접속이 필요.

Case 5: 중간 합류 (Mid-Join)

    상황: 새 플레이어가 진행 중인 세션에 합류.

    처리:
        1. 서버가 Client_ReceiveInitialState(FHktWorldState) RPC 전송
        2. 클라이언트에서 RestoreState(InState) 호출:
           - Simulator->RestoreWorldState(InState)으로 전체 상태 덮어쓰기
           - LocalFrame = InState.FrameNumber
           - DiffHistory, PendingServerBatches 초기화
        3. 이후부터 정상 예측/롤백 루프 진입

9.6 서버-클라 전체 동기화 시퀀스

    ┌──────────────────────────────────────────────────────────────────────┐
    │                          SERVER (30Hz)                              │
    │                                                                     │
    │  GameMode::Tick                                                     │
    │    └─ While FrameAccumulator >= 1/30:                               │
    │         ├─ Rule->OnEvent_GameModeTick()                             │
    │         │   └─ 그룹별 Simulator->AdvanceFrame(ServerBatch)          │
    │         │       └─ FHktSimulationDiff 생성                          │
    │         └─ 각 그룹 플레이어에게 RPC 전송:                            │
    │             ├─ 신규 진입: Client_ReceiveInitialState(WorldState)     │
    │             └─ 기존 참여: Client_ReceiveFrameBatch(ServerBatch)      │
    └────────────────────────────────┬─────────────────────────────────────┘
                                     │ Network (Reliable RPC)
    ┌────────────────────────────────▼─────────────────────────────────────┐
    │                         CLIENT (30Hz)                                │
    │                                                                      │
    │  UHktProxySimulatorComponent::TickComponent                          │
    │    └─ While FrameAccumulator >= 1/30:                                │
    │         ├─ [서버 Batch 있음] ProcessPendingServerBatches()            │
    │         │   ├─ DiffHistory 역적용 (UndoDiff) → 롤백                  │
    │         │   ├─ 빈 Batch 빨리감기 (클라 느린 경우)                      │
    │         │   ├─ 서버 Batch AdvanceFrame() → 권위 Diff                  │
    │         │   └─ DiffHistory 초기화, LocalFrame 보정                    │
    │         └─ [서버 Batch 없음] AdvanceLocalFrame()                      │
    │             ├─ BuildLocalBatch() → 빈 로컬 Batch                     │
    │             ├─ AdvanceFrame() → 예측 Diff                            │
    │             └─ DiffHistory에 추가                                    │
    └──────────────────────────────────────────────────────────────────────┘

    유저 입력 흐름 (별도):
    Enhanced Input → IHktClientRule → IHktIntentBuilder::Submit()
        → Server_ReceiveIntent(Event) [C2S Reliable RPC]
        → GameMode::PushIntent() → 서버 Batch의 NewEvents에 포함

9.7 설계 보증 (Guarantees)

    결정론성: 동일 WorldState + 동일 SimulationEvent = 동일 결과. 롤백 후 재실행 가능.
    서버 권위: 클라이언트 예측은 항상 서버 Batch로 덮어써짐. 클라가 결과를 조작할 수 없음.
    시드 일치: 클라이언트는 InitialState 수신 시 GroupIndex를 전달받아 서버와 동일한 RandomSeed = Hash(Frame, GroupIndex)를 생성.
    타임아웃: MaxHistoryFrames(300) = 10초@30Hz. 초과 시 연결 끊김 판정, OnTimeout 브로드캐스트 → 클라 연결 해제.
    상태 완전성: UndoDiff는 Property, Tag, Owner, Entity 생성/삭제 모두 되돌림. 누락 없음.
    순서 보장: 서버 Batch는 FrameNumber 정렬 후 처리. 네트워크 순서 역전에 안전.
