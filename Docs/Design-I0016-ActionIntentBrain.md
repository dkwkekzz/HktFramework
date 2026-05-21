# I-0016 상호작용: User Action State 기반 Brain/Lifecycle 분리 — 구현

[I-0016 의도 문서](intents/I-0016.md) 의 *왜* 에 대응하는 *어떻게* 를 기술한다. 본 문서는 구현된 데이터/플로우/계약을 한 곳에 모아 디버깅·확장 시 참조용이다.

## 역할 분리 — Brain vs Lifecycle

같은 ActionIntent 채널을 공유하는 두 책임을 별도 Story 로 갈라낸다.

| 책임 | Brain | Lifecycle |
|---|---|---|
| 한 줄 정의 | *상황을 읽고 어떤 Intent 를 부여할지 결정* | *Intent 혹은 외부 이벤트에 어떻게 반응할지 라우팅* |
| 트리거 | 매 N frame yield (NPC AI) / 입력 이벤트 (Player) | 매 1 frame yield (영속 루프) |
| 읽기 | 시야·피격·체력·아군 위치 등 *상황 정보* | ActionIntent / Position / 사거리 / 쿨다운 |
| 쓰기 | `ActionIntent*` (= 어떤 의도) | `MoveTarget*` / `DispatchEventTo(UseSkill)` / `Anim*` (= 어떻게 실행) |
| Player | `Story_TargetAction` (PlayerController → 인간이 곧 Brain) | `Story_PlayerLifecycle` |
| NPC    | `Story_<Type>Brain` (예: `Story_SlimeBrain`)              | `Story_NPCLifecycle` |
| 자동 클리어 | 폴링 채널 (`LastAttacker`) 소비 | `ActionIntentType=0` (대상 사망 / 위치 도달) |

분할 이득: 같은 캐릭터를 *Player 직접 조작* 도, *AI 조작* 도 동일한 Lifecycle 본문으로 굴릴 수 있다 — Brain 만 갈아끼우면 된다.

## 데이터 흐름

```
┌─ Brain (결정) ────────────────────────────────────────────────┐
│ Player: PlayerController → Story_TargetAction (입력 1회)        │
│   결정만 (Hittable / Move / 좌표) → ActionIntent* 기록 → Halt    │
│                                                                  │
│ NPC: Spawn 시 DispatchEventFrom(<Brain>, Self) (영속 1 인스턴스) │
│   매 N frame yield → LastAttacker / 시야 / 체력 폴링            │
│                  → ActionIntent* 기록 + 채널 소비                │
└──────────────────────────────────┬───────────────────────────────┘
                                   ▼
┌─ 상태 (Subject 의 영속 프로퍼티) ─────────────────────────────┐
│   ActionIntentType   (0=none / 1=Move / 2=Attack)                │
│   ActionIntentTarget (Attack 대상 EntityId)                      │
│   ActionIntentX / Y / Z (Move 좌표 또는 Attack 시 기억된 좌표)  │
│   ActionIntentSlot   (스킬 슬롯, 0=기본)                          │
│   LastAttacker       (Brain 입력 채널 — 공격 Story 가 기록)      │
└──────────────────────────────────┬───────────────────────────────┘
                                   ▼
┌─ Lifecycle (반응) ───────────────────────────────────────────┐
│ Story_PlayerLifecycle / Story_NPCLifecycle 매 1 frame yield     │
│   ├─ State.Dead → die 분기                                       │
│   ├─ IntentType == 0 → loop (idle)                               │
│   ├─ IntentType == 2 (Attack) → 사거리/쿨다운 판단:              │
│   │     out of range → MoveToward(Target)                         │
│   │     in range + cooldown OK → DispatchEventTo(UseSkill, Target)│
│   ├─ IntentType == 1 (Move)   → MoveToward(ActionIntentX/Y/Z),   │
│   │                              d²≤16 → clear (도착)             │
│   └─ Jump loop                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**왜 분리** — 이전 설계는 "Lifecycle 안에서 매 프레임 ActionIntent 를 *해석* 한다"고 표현했지만, 실제 의도는 `결정 + 실행` 의 묶음이 아니었다. *결정* 은 사람이 클릭하든 AI 가 시야를 스캔하든 다양한 방식으로 일어나야 하고, *실행* 은 캐릭터의 능력에 묶여 동일해야 한다. 둘을 한 Story 에 박으면 AI 구현이 Lifecycle 본문 안으로 침투해 *Player 와 분기 코드* 가 생긴다. 같은 데이터를 두 Story 가 공유하도록 갈라놓으면 Brain 만 바꾸어 Player ↔ AI 를 교체할 수 있다 — 이것이 본 PR 의 핵심 재설계.

## 데이터 — `ActionIntent*` + `LastAttacker`

`HktGameplay/Source/HktCore/Public/HktCoreProperties.h` 정의 — 모두 Cold tier (매 프레임 갱신되지 않음).

| 프로퍼티 | 의미 | 갱신 주체 | 클리어 시점 |
|---|---|---|---|
| `ActionIntentType` | 0=none, 1=Move, 2=Attack | Brain | Lifecycle 의 도착·사망 분기 |
| `ActionIntentTarget` | Attack 대상 EntityId (0=없음) | Brain | Lifecycle 이 Type=0 으로 환원 시 |
| `ActionIntentX/Y/Z` | Move 목표 위치 (cm) | Brain | (그대로 유지 — Type 만 0 으로) |
| `ActionIntentSlot` | 스킬 슬롯 인덱스 (0=기본/innate fallback) | Brain | (그대로 유지) |
| `LastAttacker` | 마지막으로 데미지를 가한 공격자 EntityId (Brain 폴링 채널) | 공격 Story (`Story_CombatUseSkill`, `Story_BasicAttack`) — `ApplyDamage` 직전에 `Target.LastAttacker = Self` | Brain 이 폴링 후 0 으로 소비 |

원자성: Lifecycle 은 매 프레임 `LoadStoreEntity` 로 한 번에 읽고 분기한다. 동일 프레임 안에 Brain 이 새 값을 써도 다음 yield 사이클에서 자동 반영 — 별도 동기화 메커니즘 없음.

## Player Brain — `Story_TargetAction.json`

PlayerController 의 우클릭이 곧 Brain. 한 번 클릭의 책임:
1. `Self == Target` → noop, Halt
2. `Target == -1` (빈 곳 클릭) → Move 인텐트로 기록
3. `Target` 이 `Hittable` trait 보유 → Attack 인텐트로 기록
4. 그 외 → Move 인텐트로 폴백 (TargetLocation 사용)

**Item 분기는 제거됨.** 기존 `Story.Event.Item.Pickup` 호환을 위해 ItemPickup 스토리 자체는 남아있지만 TargetAction 에서 더 이상 디스패치되지 않는다 — *TODO: Pickup 재정립 후 다시 입구 연결.*

`cancelOnDuplicate: true` — 새 클릭이 들어오면 직전 TargetAction VM 이 자동 취소된다. 이는 의도 *세팅 시점* 의 race 만 차단할 뿐, Lifecycle 이 보는 영속 프로퍼티에는 영향이 없다 (마지막 쓰기가 곧 상태).

## NPC Brain — Slime (`Natural/Slime/Slime_Brain.json`)

NPC AI 의 첫 구현. 정책은 *피격 반응 + 추적*:

1. `Yield 6` (≈ 0.2 sec @ 30Hz) 로 매 사이클 폴링.
2. `State.Dead` → Halt.
3. `LastAttacker == 0` → 자극 없음, loop.
4. `LastAttacker > 0` 이고 attacker.Health > 0 → `ActionIntentType=2`, `ActionIntentTarget=attacker`, `ActionIntentSlot=0` 기록.
5. 어느 경로든 `LastAttacker = 0` 으로 소비 (반복 트리거 방지).

**Brain 은 사거리/쿨다운을 신경쓰지 않는다** — 그건 Lifecycle 의 일. Brain 은 *누구를 표적으로 할지* 만 정한다. 같은 슬라임을 다시 때리면 Brain 이 다음 사이클에 새 attacker 로 ActionIntent 를 덮어쓴다 (latest hit wins).

**Damage 채널 입력** — `Story_CombatUseSkill.json` / `Story_BasicAttack.json` 의 `ApplyDamage` 호출 직전에:

```jsonc
{ "op": "SaveStoreEntity", "entity": "Target", "property": "LastAttacker", "src": "Self" }
```

이 한 줄로 Brain 의 폴링 채널이 켜진다. ApplyDamage 자체를 건드리지 않으므로 SCHEMA / Builder 변경 없음.

**현재 한계 / 확장 여지**:
- 시야 스캔 없음 — 슬라임은 *맞아야* 반응한다. 비-피격 시 patrol / aggro range 는 후속 PR.
- `FindInRadius` op 를 이용해 시야 스캔하는 형태가 자연스러운 다음 단계.

## Lifecycle — 결정 매트릭스 (변경 없음)

### Player (`Story_PlayerLifecycle.json`)

`Story_PlayerInit.json` 끝에서 `DispatchEventFrom(PlayerLifecycle, Self)` 로 1 회 발사 — 캐릭터 수명 내내 1 인스턴스가 영속 실행된다.

Lifecycle 본문은 NPC 와 동일. 차이는 죽음 처리뿐:
- Player: 사망 애니 태그 부착 후 Halt — *destroy 하지 않는다* (respawn 별도 PR)

### NPC (`Story_NPCLifecycle.json`)

기존 `WaitSeconds 1.0` 폴링 루프를 `Yield 1` Lifecycle 루프로 리팩토. 죽음 분기의 랜덤 loot drop + DestroyEntity 처리는 그대로 유지.

### 결정 매트릭스

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
Physics 순서), Lifecycle 이 매 프레임 `MoveToward` 를 호출하면 MovementSystem 이
도착 시 세팅한 `IsMoving=0` 을 *다음 프레임 시작 시 Lifecycle 이 다시 1 로 덮어쓴다*.
결과적으로 Lifecycle 이 `ReadProperty IsMoving` 으로는 영영 0 을 못 본다.

따라서 도착 판정은 *제곱 2D 거리* (`(ix-px)² + (iy-py)² <= 16`) 로 한다. 임계 16 은
MovementSystem 의 `ArrivalThresholdSq` (`HktSimulationSystems.h`) 와 동일 — Lifecycle 이
MovementSystem 보다 *덜* 관대한 임계를 쓰면 안 되고, 더 관대하면 (이전 40000) Lifecycle 이
MovementSystem 의 overshoot-snap 보다 먼저 인텐트를 클리어해 *목표 직전에서 정지* 하는
버그가 발생한다. MovementSystem 이 `MoveStep >= HDist` 일 때 타겟에 정확히 SetPosition
해주므로, Lifecycle 은 한 사이클 뒤에 d²≈0 으로 안전하게 클리어한다. Z 차이는 무시 (지형
적분 후 약간의 수직 오차는 도착으로 간주). 거리 제곱이 i32 overflow 하지 않는 범위 (각 축
±46340 cm = ±463 m 이내) 에서 안전.

## 자동 종료 조건

- **대상 사망** — Lifecycle 의 Attack 분기에서 `Target.Health <= 0` 검사 → 자체 클리어
- **위치 도달** — Lifecycle 의 Move 분기에서 squared 2D 거리 ≤ 16 검사 → 자체 클리어
- **새 의도** — Brain 이 동일 프로퍼티를 덮어쓰기 → Lifecycle 다음 사이클에서 새 인텐트 따라감
- **캐릭터 사망** — Lifecycle 의 die 라벨로 진입 → loot drop (NPC) 또는 사망 애니 (Player). Brain 도 `State.Dead` 감지 후 Halt (Slime Brain 참조).

명시적 Cancel/Stop 입력 이벤트는 *없음*. 빈 곳 클릭이 곧 "이동 인텐트" 라서 사실상 cancel 처럼 동작 — 별 옵션 입력은 *TODO* (수정키 / Esc).

## DispatchEventTo 의 의미

Lifecycle 은 `DispatchEventTo(UseSkill, Target)` 로 매 사이클 새 UseSkill VM 을 발사한다. UseSkill 측의 `cancelOnDuplicate` 설정에 따라 같은 Self 의 이전 UseSkill 이 자동 취소되거나 누적된다. Lifecycle 자체는 디스패치 결과를 *기다리지 않는다* — 매 프레임 yield 한 뒤 cooldown (`NextActionFrame`) 로만 페이스 조절.

이는 동일 프레임 안에 같은 인텐트가 두 번 발사되는 것을 막아주는 안전판이 *쿨다운 프로퍼티* 라는 의미다. UseSkill 시작 시 NextActionFrame 을 즉시 잠그는 기존 패턴 (`Story_CombatUseSkill.json` 의 `WriteConst NextActionFrame 0x7FFFFFFF`) 이 Lifecycle 의 단일 책임 가정과 정확히 맞물린다.

## Brain 수명 / 다중성

- **Player**: 별도 Brain Story 없음 — `Story_TargetAction` 이 매 클릭당 1 회 dispatch (cancelOnDuplicate). 항상 최근 클릭이 ActionIntent 의 진실원.
- **NPC**: spawn 시 `DispatchEventFrom(<Brain>, Self)` 로 1 인스턴스. `cancelOnDuplicate: false` — 재초기화 / respawn 시 중복 가능성 있음. 현재는 Slime spawner-as-loop 가 1 회만 dispatch 하므로 문제 없음. 후속 PR 에서 명시적 가드 필요.
- **Brain 자체 종료**: `State.Dead` 도달 시 Brain 은 Halt. Lifecycle 의 die 분기가 별도로 사망 처리. Brain 과 Lifecycle 이 같은 사망 시그널을 *독립적으로* 본다 — 결합 없음.

## 격차 / TODO

- **Pickup 재정립** — TargetAction 의 Item 분기 제거됨. 새 입구 (intent type 3 = Pickup?) 또는 별도 입력 채널로 부활 필요.
- **Slime Brain 확장** — 비-피격 상황 patrol / 시야 스캔 (`FindInRadius` 활용 후보).
- **다른 NPC 종족 Brain** — Goblin / Skeleton 등 종족별 행동 패턴. 현재는 Slime 1 종.
- **무기별 AttackRange** — 사거리 상수 200 을 슬롯 아이템의 AttackRange 프로퍼티로 일반화.
- **단발 인텐트 토글** — 수정키 / 별도 입력으로 Attack 인텐트를 1회로 강제 (Lifecycle 이 디스패치 후 자체 클리어).
- **Brain VM 의 수명 단일성** — `cancelOnDuplicate: false` 라 같은 Self 에 Brain 이 두 번 디스패치되면 인스턴스 둘. 현재는 spawn 경로가 1회뿐이라 문제 없음 — respawn / 재초기화 도입 시 가드 필요.
- **Target 슬롯 재활용 검증** — Lifecycle 의 Attack 분기는 `Target.Health <= 0` 으로 무효를 잡지만, 엔티티 destroy 후 슬롯이 다른 entity 로 재활용된 경우엔 새 entity 의 Health 를 읽어 phantom chase 발생 가능. 현재 destroy 가 즉시 일어나지 않고 cooldown 사이 사라지는 경로가 드물어 실문제 미발견. 명시적 검증 op 추가 후보. `LastAttacker` 도 동일 위험.

## 관련 파일

- 데이터: `HktGameplay/Source/HktCore/Public/HktCoreProperties.h` (ActionIntent* 6개 + LastAttacker)
- 태그: `HktGameplay/Source/HktStory/Public/HktStoryTags.h`, `…/Private/HktStoryTags.cpp` (`Story_Player_Lifecycle`, `Story_Brain_Slime`)
- Brain: `HktGameplay/Content/Stories/Story_TargetAction.json` (Player), `Natural/Slime/Slime_Brain.json` (Slime NPC)
- Lifecycle: `HktGameplay/Content/Stories/Story_PlayerLifecycle.json`, `Story_NPCLifecycle.json`
- 디스패처: `Story_PlayerInit.json` (PlayerLifecycle), `Natural/Slime/Slime_Spawn.json` (NPCLifecycle + SlimeBrain)
- Damage 채널: `Story_CombatUseSkill.json`, `Story_BasicAttack.json` (`LastAttacker` 기록)
- spec: 위 Story 들의 `*.spec.json` (모든 분기 시나리오)
