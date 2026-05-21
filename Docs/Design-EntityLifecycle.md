# Entity Lifecycle — VM 위 엔티티 수명 표현

본 문서는 [I-0034](intents/I-0034.md) 의 상세 구현·근거.

상위 의도 / 관련 문서:
- [I-0006 — 결정론적 시뮬레이션 시스템](intents/I-0006.md)
- [Runtime-Pipeline.md](Runtime-Pipeline.md)
- [HktGameplay/Content/Stories/SCHEMA.md](../HktGameplay/Content/Stories/SCHEMA.md)

---

## 1. Lifecycle Story 의 한 줄

```
대기 → (체력 0 → State.Dead 부여) → death anim 부착 → 잠시 후 DestroyEntity → VMCleanupSystem 이 풀에서 회수
```

각 부분의 책임:

| 부분 | 누가 한다 |
|---|---|
| 대기 | `WaitTag(Self, StateDead)` — VM 은 `WaitingEvent` 로 자고 매 프레임 polling 비용 0 |
| 체력 0 → `State.Dead` | 외부(전투 시스템 / 다른 Story) — 본 lifecycle 은 *결과* 만 본다 |
| death anim 부착 | `AddTag(Self, "Anim.FullBody.Action.Death")` 또는 `PlayAnim` |
| 잠시 후 파괴 | `WaitSeconds N` + `DestroyEntity Self` |
| 풀 회수 | `Halt` 후 `FHktVMCleanupSystem` 이 다음 프레임에 슬롯 반환 |

`HktGameplay/Content/Stories/Natural/Birch/Birch_Lifecycle.json` 가 이 패턴의 단일 출처.

---

## 2. 왜 폴링은 안 되는가

### 2.1 변경 전 Birch_Lifecycle 패턴

```jsonc
{ "op": "Label", "name": "check" },
{ "op": "HasTag", "dst": {"var":"isDead"}, "entity": "Self", "tag": "StateDead" },
{ "op": "JumpIf", "cond": {"var":"isDead"}, "label": "die" },
{ "op": "WaitSeconds", "seconds": 1.0 },
{ "op": "Jump", "label": "check" },
```

`WaitSeconds` 는 `EVMStatus::Yielded` 로 진입한다. VM 슬롯은 **점유 유지**. cleanup 은 `Completed / Failed` 만 회수한다.

### 2.2 슬롯 단조 증가

청크 로드마다 lifecycle VM 1 개가 새 트리당 생성된다. 죽기 전까지 회수되지 않는다.

```
프레임 N    : Birch_Lifecycle × K       (K = 살아있는 Birch 수)
프레임 N+1  : Birch_Lifecycle × (K + ΔSpawn)
…
```

풀 상한에 도달하는 순간 `VM Build: Pool exhausted` — 이후 모든 신규 이벤트가 silent drop. 게임 상태는 *결정론적으로* 망가진다 (drop 자체는 결정론 입력에 종속).

---

## 3. 해결 — WaitTag opcode

### 3.1 새 opcode

`WaitTag(WatchEntity, Tag)` + `EWaitEventType::TagAdded`.

진입 시 VM 은 `EVMStatus::WaitingEvent`. 슬롯은 살아있으나 매 프레임 polling 비용 ~0.

### 3.2 매칭 채널

`FHktVMProcessSystem` 이 매 프레임 `Pool.ForEachActive` 안에서 `WaitingEvent + Type == TagAdded` 인 VM 에 대해:

```cpp
const FGameplayTagContainer& Tags = WorldState.GetTagsBySlot(Slot);
if (Tags.HasTag(Runtime.EventWait.WatchedTag))  // 계층 매칭 (HasTag = MatchesTag 와 동치)
    Runtime.Status = EVMStatus::Ready;
```

다른 Wait 류 (Collision / MoveEnd / Grounded) 와 달리 **ScratchEvents 큐를 거치지 않는다**. 이유:

- 태그 부여는 `VMProxy::AddTag` 한 곳이지만 호출 지점이 매우 많다 (Op_AddTag, SpawnEntity ClassTag, VMCleanupSystem, 외부 입력 …). 채널 1 곳으로 모으려면 모든 호출 지점에 emit 코드를 흩뿌려야 함.
- WorldState 의 태그 컨테이너 자체가 진실의 단일 출처. 그것을 polling 하면 *누락 가능성 0*.
- `WaitingEvent` VM 수는 lifecycle 등 소수. polling 비용은 N\_wait × |TagContainer| 정도로 작다.

`WatchedEntity` 가 사라지면 `EVMStatus::Failed` 로 전이 — cleanup 이 회수.

### 3.3 변경 후 Lifecycle

```jsonc
{ "op": "WaitTag", "entity": "Self", "tag": "StateDead" },
// 깨어남 → 사망 처리
{ "op": "Label", "name": "die" },
// Branch drop, anim, DestroyEntity, Halt
```

폴링 5 줄 → 1 줄.

---

## 4. VM 풀의 동적 grow

`FHktVMRuntimePool` 은 부팅 시 `InitialVMPoolCapacity = 64` 로 시작해 슬롯이 다 차면 한 슬롯씩 push 한다. `MaxVMPoolCapacity = 1024` 가 hard cap — 초과 시 `Allocate()` 가 Invalid 반환.

`MaxVMPoolCapacity` 는 `FHktVMHandle.Index` 의 24-bit 범위 내(직렬화 / hash 안정). CVar 로 노출하지 않고 헤더 상수로 고정 — 결정론 입력의 일부이기 때문.

`Reserve(MaxVMPoolCapacity)` 로 SOA 배열 6개의 동시 capacity 를 사전 확보 — grow 중 realloc 빈도 최소화.

---

## 5. 직렬화 영향

`FHktVMSnapshot` 에 `FGameplayTag WaitWatchedTag` 추가:

```cpp
Ar << S.WaitType << S.WaitWatchedEntity << S.WaitRemainingFrames;
Ar << S.WaitWatchedTag;  // NEW
```

`CaptureVMSnapshots` / `RehydrateVMPool` 도 함께 갱신. **기존 saved state (replay / late-join 캡처) 는 무효화** — 새로 캡처해야 한다.

---

## 6. Lifecycle Story 작성 가이드

### 6.1 잠자는 lifecycle — `WaitTag` 한 줄

```jsonc
{
  "schema": 2,
  "storyTag": "Story.Flow.Natural.<Entity>.Lifecycle",
  "tags": { "StateDead": "State.Dead" },
  "steps": [
    { "op": "WaitTag", "entity": "Self", "tag": "StateDead" },

    /* 사망 처리: drop / lineage / anim / dispatch */

    { "op": "WaitSeconds", "seconds": 3.0 },
    { "op": "DestroyEntity", "entity": "Self" },
    { "op": "Halt" }
  ]
}
```

계층 매칭이므로 `tag: "State"` 로 두면 `State.Dead`, `State.Stunned`, `State.Frozen` 어느 상태가 부여되어도 wake. 보수적으로는 leaf 태그를 명시.

### 6.2 깨어있는 lifecycle (NPC / Player Brain)

NPC / Player Lifecycle 처럼 *매 프레임 의사결정* 이 본업이면 `Yield 1` 폴링이 본질. 이 패턴은 본 의도의 *잠자는 lifecycle* 과 분리되며 — 본 문서의 범위 밖이다. Brain 류의 슬롯 사용량은 동시 active entity 수에 비례하므로 `MaxVMPoolCapacity` 의 적정선을 재검토할 때 함께 고려.

---

## 7. 변경된 파일 (참고)

| 파일 | 변경 |
|---|---|
| `HktCore/Private/HktSimulationLimits.h` | `MaxVMs` 단일 상수 → `InitialVMPoolCapacity` / `MaxVMPoolCapacity` |
| `HktCore/Private/VM/HktVMRuntime.h/.cpp` | 정적 SetNum → 동적 grow + `GetCapacity` / `GetUsage` |
| `HktCore/Private/VM/HktVMTypes.h` | `EWaitEventType::TagAdded` |
| `HktCore/Private/VM/HktVMInterpreter.h/.cpp` | `Op_WaitTag` + precondition skip |
| `HktCore/Private/HktSimulationSystems.cpp` | `VMProcessSystem` 의 TagAdded polling |
| `HktCore/Public/HktCoreEvents.h` | `FHktVMSnapshot::WaitWatchedTag` + 직렬화 |
| `HktCore/Public/HktStoryTypes.h` | OpCode list `WaitTag` |
| `HktCore/Private/HktStoryBuilder.cpp` / `HktCore/Public/HktStoryBuilder.h` | `WaitTag` 빌더 (RegisterIndex / FHktVar) |
| `HktCore/Private/HktStoryJsonParser.cpp` | `"WaitTag"` 등록 |
| `HktCore/Private/HktStoryValidator.cpp` | WaitTag 케이스 |
| `HktCore/Public/HktVMEventRecorder.h` | `GetHktPendingTypeName` TagAdded |
| `HktCore/Private/HktWorldDeterminismSimulator.cpp` | Capture/Rehydrate WatchedTag, 풀 capacity 참조 |
| `HktGameplay/Content/Stories/Natural/Birch/Birch_Lifecycle.json` (+ spec) | WaitTag 1 줄 |
| `HktGameplay/Content/Stories/Natural/Oak/Oak_Lifecycle.json` (+ spec) | WaitTag 1 줄 |
