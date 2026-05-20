# I-0016 상호작용: User Action State 기반 Brain System — 구현

[I-0016 의도 문서](intents/I-0016.md) 의 *왜* 에 대응하는 *어떻게* 를 기술한다. 본 문서는 구현된 데이터/플로우/계약을 한 곳에 모아 디버깅·확장 시 참조용이다.

## 핵심 모델

행동의 결정을 **3 단 분리** 한다.

```
┌─ 입력 (Client) ───────────────────────────────────────────────────┐
│ PlayerController → ClientRule → FHktEvent(Story.Event.Target.Action) │
│                                  Source = Subject, Target/Loc       │
└──────────────────────────────────┬───────────────────────────────────┘
                                   ▼
┌─ 상태 (Subject 의 영속 프로퍼티) ─────────────────────────────────┐
│ Story_TargetAction.json  — 결정만 (Hittable? Move?) 후              │
│                            ActionIntent{Type,Target,X/Y/Z,Slot}     │
│                            를 SaveStoreEntity 로 *기록* 하고 Halt   │
└──────────────────────────────────┬───────────────────────────────────┘
                                   ▼
┌─ 결정 (Lifecycle 의 Brain 매 프레임 루프) ────────────────────────┐
│ Story_PlayerLifecycle.json / Story_NPCLifecycle.json                 │
│   Yield 1                                                            │
│   ├─ Health <= 0 → die                                               │
│   ├─ IntentType == 0 → loop (idle)                                   │
│   ├─ IntentType == 2 (Attack) → 사거리/쿨다운 판단:                  │
│   │     out of range → MoveToward(Target)                            │
│   │     in range + cooldown OK → DispatchEventTo(UseSkill, Target)   │
│   ├─ IntentType == 1 (Move)   → MoveToward(ActionIntentX/Y/Z),       │
│   │                              IsMoving == 0 → clear (도착)         │
│   └─ Jump loop                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**왜 3 단** — 이전 구현은 "클릭이 곧 디스패치" 였다. 그 결과 *지속성* 을 표현하려면 (a) 액션 본문 안에 루프를 박거나 (b) 클라가 매 프레임 재전송해야 했다. 둘 다 액션 정의에 *사용자 인텐트의 시간축* 을 섞는다 — 본 의도가 차단하려는 결합이다. 상태를 영속 프로퍼티로 분리하면, 클릭은 상태 *세팅* 이 되고 Brain 이 결정의 단일 책임자가 된다.

## 데이터 — `ActionIntent*` 프로퍼티

`HktGameplay/Source/HktCore/Public/HktCoreProperties.h` 정의 — 모두 Cold tier (매 프레임 갱신되지 않음).

| 프로퍼티 | 의미 | 갱신 주체 | 클리어 시점 |
|---|---|---|---|
| `ActionIntentType` | 0=none, 1=Move, 2=Attack | TargetAction (세팅) / Brain (도착·사망 시 클리어) | 상태 머신의 진입 / 종료 |
| `ActionIntentTarget` | Attack 대상 EntityId (0=없음) | TargetAction | Brain 이 Type=0 으로 환원 시 |
| `ActionIntentX/Y/Z` | Move 목표 위치 (cm) | TargetAction | (그대로 유지 — Type 만 0 으로) |
| `ActionIntentSlot` | 스킬 슬롯 인덱스 (0=기본/innate fallback) | TargetAction | (그대로 유지) |

원자성: Brain 은 매 프레임 `LoadStoreEntity` 로 한 번에 읽고 분기한다. 동일 프레임 안에 TargetAction 이 새 값을 써도 다음 yield 사이클에서 자동 반영 — 별도 동기화 메커니즘 없음.

## 입구 — `Story_TargetAction.json`

우클릭 한 번의 책임:
1. `Self == Target` → noop, Halt
2. `Target == -1` (빈 곳 클릭) → Move 인텐트로 기록
3. `Target` 이 `Hittable` trait 보유 → Attack 인텐트로 기록
4. 그 외 → Move 인텐트로 폴백 (TargetLocation 사용)

**Item 분기는 제거됨.** 기존 `Story.Event.Item.Pickup` 호환을 위해 ItemPickup 스토리 자체는 남아있지만 TargetAction 에서 더 이상 디스패치되지 않는다 — *TODO: Pickup 재정립 후 다시 입구 연결.*

`cancelOnDuplicate: true` — 새 클릭이 들어오면 직전 TargetAction VM 이 자동 취소된다. 이는 의도 *세팅 시점* 의 race 만 차단할 뿐, Brain 이 보는 영속 프로퍼티에는 영향이 없다 (마지막 쓰기가 곧 상태).

## 결정 — Lifecycle Brain

### Player (`Story_PlayerLifecycle.json`)

`Story_PlayerInit.json` 끝에서 `DispatchEventFrom(PlayerLifecycle, Self)` 로 1회 발사 — 캐릭터 수명 내내 1 인스턴스가 영속 실행된다.

브레인 본문은 NPC 와 동일. 차이는 죽음 처리뿐:
- Player: 사망 애니 태그 부착 후 Halt — *destroy 하지 않는다* (respawn 별도 PR)

### NPC (`Story_NPCLifecycle.json`)

기존 `WaitSeconds 1.0` 폴링 루프를 `Yield 1` brain 루프로 리팩토. 죽음 분기의 랜덤 loot drop + DestroyEntity 처리는 그대로 유지.

NPC AI 가 ActionIntent 를 *세팅하는 채널* 은 아직 없음 — 현재 NPC 의 IntentType 은 항상 0 (idle). *TODO: NPC AI story 가 시야/거리 기반으로 ActionIntent 를 쓰는 채널 추가.*

### Brain 의 결정 매트릭스

| IntentType | 추가 조건 | 행동 | 사후 상태 |
|---|---|---|---|
| 0 | — | yield, loop | 유지 |
| 2 (Attack) | Target==0 또는 Target.Health<=0 | StopMovement, intent 클리어 | Type=0 |
| 2 | dist > 200 | `MoveToward(Target)` | Type 유지 (다음 사이클에 재평가) |
| 2 | dist <= 200, cooldown 진행중 (now < NextActionFrame) | StopMovement, yield | Type 유지 |
| 2 | dist <= 200, cooldown OK | `DispatchEventTo(UseSkill, Target)` | Type 유지 (다음 사이클에 또 공격) |
| 1 (Move) | `(ix-px)² + (iy-py)² <= 16` (4² cm², MovementSystem 의 `ArrivalThresholdSq` 와 동일) | StopMovement, intent 클리어 | Type=0 |
| 1 | 미도달 | `MoveToward(ActionIntentX/Y/Z)` | Type 유지 |

**사거리 200 은 상수**. 추후 무기/스킬별 AttackRange 프로퍼티로 분기 — *TODO.*

### Move 도착 판정에 IsMoving 을 쓰지 않는 이유

`MoveToward` op 는 `HktStoryBuilder.cpp:854-861` 에서 다음을 emit 한다:

```cpp
SaveStoreEntity(Entity, MoveTargetX, ...);
SaveStoreEntity(Entity, MoveTargetY, ...);
SaveStoreEntity(Entity, MoveTargetZ, ...);
SaveConstEntity(Entity, MoveForce, Force);
SaveConstEntity(Entity, IsMoving, 1);   // ← 호출 시점에 즉시 1 로 덮어쓰기
```

VM 은 시뮬레이션 틱 안에서 MovementSystem 보다 *먼저* 실행되므로
(`HktWorldDeterminismSimulator::ProcessBatch` 의 VM 루프 → Gravity → Movement →
Physics 순서), Brain 이 매 프레임 `MoveToward` 를 호출하면 MovementSystem 이
도착 시 세팅한 `IsMoving=0` 을 *다음 프레임 시작 시 Brain 이 다시 1 로 덮어쓴다*.
결과적으로 Brain 이 `ReadProperty IsMoving` 으로는 영영 0 을 못 본다.

따라서 도착 판정은 *제곱 2D 거리* (`(ix-px)² + (iy-py)² <= 16`) 로 한다. 임계 16 은
MovementSystem 의 `ArrivalThresholdSq` (`HktSimulationSystems.h`) 와 동일 — Brain 이
MovementSystem 보다 *덜* 관대한 임계를 쓰면 안 되고, 더 관대하면 (이전 40000) Brain 이
MovementSystem 의 overshoot-snap 보다 먼저 인텐트를 클리어해 *목표 직전에서 정지* 하는
버그가 발생한다. MovementSystem 이 `MoveStep >= HDist` 일 때 타겟에 정확히 SetPosition
해주므로, Brain 은 한 사이클 뒤에 d²≈0 으로 안전하게 클리어한다. Z 차이는 무시 (지형
적분 후 약간의 수직 오차는 도착으로 간주). 거리 제곱이 i32 overflow 하지 않는 범위 (각 축
±46340 cm = ±463 m 이내) 에서 안전.

## 자동 종료 조건

- **대상 사망** — Brain 의 Attack 분기에서 `Target.Health <= 0` 검사 → 자체 클리어
- **위치 도달** — Brain 의 Move 분기에서 squared 2D 거리 ≤ 16 검사 → 자체 클리어
- **새 클릭** — TargetAction 이 동일 프로퍼티를 덮어쓰기 → Brain 다음 사이클에서 새 인텐트 따라감
- **캐릭터 사망** — Brain 의 die 라벨로 진입 → loot drop (NPC) 또는 사망 애니 (Player) 후 종료

명시적 Cancel/Stop 입력 이벤트는 *없음*. 빈 곳 클릭이 곧 "이동 인텐트" 라서 사실상 cancel 처럼 동작 — 별 옵션 입력은 *TODO* (수정키 / Esc).

## DispatchEventTo 의 의미

Brain 은 `DispatchEventTo(UseSkill, Target)` 로 매 사이클 새 UseSkill VM 을 발사한다. UseSkill 측의 `cancelOnDuplicate` 설정에 따라 같은 Self 의 이전 UseSkill 이 자동 취소되거나 누적된다. Brain 자체는 디스패치 결과를 *기다리지 않는다* — 매 프레임 yield 한 뒤 cooldown (`NextActionFrame`) 로만 페이스 조절.

이는 동일 프레임 안에 같은 인텐트가 두 번 발사되는 것을 막아주는 안전판이 *쿨다운 프로퍼티* 라는 의미다. UseSkill 시작 시 NextActionFrame 을 즉시 잠그는 기존 패턴 (`Story_CombatUseSkill.json` 의 `WriteConst NextActionFrame 0x7FFFFFFF`) 이 Brain 의 단일 책임 가정과 정확히 맞물린다.

## 격차 / TODO

- **Pickup 재정립** — TargetAction 의 Item 분기 제거됨. 새 입구 (intent type 3 = Pickup?) 또는 별도 입력 채널로 부활 필요.
- **NPC AI 의 Intent 세팅 채널** — 현재 NPC 는 idle 만 가능. Sight / Hostility 기반으로 NPC AI Story 가 자기 ActionIntent 를 쓰는 패턴 필요.
- **무기별 AttackRange** — 사거리 상수 200 을 슬롯 아이템의 AttackRange 프로퍼티로 일반화.
- **단발 인텐트 토글** — 수정키 / 별도 입력으로 Attack 인텐트를 1회로 강제 (Brain 이 디스패치 후 자체 클리어).
- **Brain VM 의 수명 단일성** — `cancelOnDuplicate: false` 라 같은 Self 에 Lifecycle 이 두 번 디스패치되면 brain 이 둘 생긴다. 현재는 spawn 경로가 1회뿐이라 문제 없음 — respawn / 재초기화 도입 시 가드 필요.
- **Target 슬롯 재활용 검증** — Brain 의 Attack 분기는 `Target.Health <= 0` 으로 무효를 잡지만, 엔티티 destroy 후 슬롯이 다른 entity 로 재활용된 경우엔 새 entity 의 Health 를 읽어 phantom chase 발생 가능. 현재 destroy 가 즉시 일어나지 않고 cooldown 사이 사라지는 경로가 드물어 실문제 미발견. 명시적 검증 op 추가 후보.

## 관련 파일

- 데이터: `HktGameplay/Source/HktCore/Public/HktCoreProperties.h` (ActionIntent* 6개)
- 태그: `HktGameplay/Source/HktStory/Public/HktStoryTags.h`, `…/Private/HktStoryTags.cpp` (`Story_Player_Lifecycle`)
- 스토리: `HktGameplay/Content/Stories/Story_TargetAction.json`, `Story_PlayerLifecycle.json`, `Story_NPCLifecycle.json`, `Story_PlayerInit.json`
- spec: 위 4개 스토리의 `*.spec.json`
