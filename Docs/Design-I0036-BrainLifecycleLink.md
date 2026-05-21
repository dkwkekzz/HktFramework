# I-0036 Brain System 과 Lifecycle 의 연결 — 구현

[I-0036 의도 문서](intents/I-0036.md) 의 *왜* 에 대응하는 *어떻게*. [I-0016](intents/I-0016.md) 의 ActionIntent + Lifecycle 위에 *Writer* 추상을 얹어 Player ↔ NPC AI 가 동일 채널을 공유하게 한다.

## 분리의 의도

같은 ActionIntent 채널을 공유하는 두 책임을 별도 Story 로 갈라낸다.

| 책임 | Brain | Lifecycle (I-0016) |
|---|---|---|
| 한 줄 정의 | *상황을 읽고 어떤 Intent 를 부여할지 결정* | *Intent / 외부 이벤트에 어떻게 반응할지 라우팅* |
| 트리거 | 매 N frame yield (NPC AI) / 입력 이벤트 (Player) | 매 1 frame yield (영속 루프) |
| 읽기 | 시야·피격·체력·아군 위치 등 *상황 정보* | ActionIntent / Position / 사거리 / 쿨다운 |
| 쓰기 | `ActionIntent*` (= 어떤 의도) | `MoveTarget*` / `DispatchEventTo(UseSkill)` / `Anim*` (= 어떻게 실행) |
| Player | `Story_TargetAction` (PlayerController → 인간이 곧 Brain) | `Story_PlayerLifecycle` |
| NPC    | `Story_<Type>Brain` (예: `Story_SlimeBrain`)              | `Story_NPCLifecycle` |

분할 이득: 같은 캐릭터를 *Player 직접 조작* 도, *AI 조작* 도 동일한 Lifecycle 본문으로 굴릴 수 있다 — Brain 만 갈아끼우면 된다. Lifecycle 코드는 *누가* 인텐트를 썼는지 모르고 모를 필요도 없다.

## 데이터 흐름

```
┌─ Brain (결정) ────────────────────────────────────────────────┐
│ Player: PlayerController → Story_TargetAction (입력 1회)        │
│   결정만 (Hittable / Move / 좌표) → ActionIntent* 기록 → Halt    │
│                                                                  │
│ NPC: Spawn 시 DispatchEventFrom(<Brain>, Self) (영속 1 인스턴스) │
│   매 N frame yield → LastAttacker / 시야 / 체력 폴링            │
│                   → ActionIntent* 기록 + 채널 소비               │
└──────────────────────────────────┬───────────────────────────────┘
                                   ▼
┌─ 상태 (Subject 의 영속 프로퍼티 — I-0016) ────────────────────┐
│   ActionIntentType   (0=none / 1=Move / 2=Attack)                │
│   ActionIntentTarget (Attack 대상 EntityId)                      │
│   ActionIntentX / Y / Z (Move 좌표 또는 Attack 시 기억된 좌표)   │
│   ActionIntentSlot   (스킬 슬롯, 0=기본)                          │
│   LastAttacker       (Brain 폴링 채널 — 공격 Story 가 기록) ★신규│
└──────────────────────────────────┬───────────────────────────────┘
                                   ▼
┌─ Lifecycle (반응 — I-0016 무변경) ───────────────────────────┐
│ Story_PlayerLifecycle / Story_NPCLifecycle 매 1 frame yield     │
│   사거리 / 쿨다운 → MoveToward / DispatchEventTo(UseSkill)      │
│   매트릭스는 Design-I0016 참조                                   │
└──────────────────────────────────────────────────────────────────┘
```

**왜 분리** — I-0016 은 "Lifecycle 안에서 매 프레임 ActionIntent 를 *해석* 한다"고 표현했지만, 실제 의도는 `결정 + 실행` 의 묶음이 아니었다. *결정* 은 사람이 클릭하든 AI 가 시야를 스캔하든 다양한 방식으로 일어나야 하고, *실행* 은 캐릭터의 능력에 묶여 동일해야 한다. 둘을 한 Story 에 박으면 AI 구현이 Lifecycle 본문 안으로 침투해 *Player 와 분기 코드* 가 생긴다. 같은 데이터를 두 Story 가 공유하도록 갈라놓으면 Brain 만 바꾸어 Player ↔ AI 를 교체할 수 있다.

## 데이터 — `LastAttacker` (신규)

`HktGameplay/Source/HktCore/Public/HktCoreProperties.h` — Cold tier. ActionIntent 묶음 바로 뒤.

| 프로퍼티 | 의미 | 갱신 주체 | 클리어 시점 |
|---|---|---|---|
| `LastAttacker` | 마지막으로 데미지를 가한 공격자 EntityId. Brain 폴링 채널. | 공격 Story (`Story_CombatUseSkill`, `Story_BasicAttack`) — `ApplyDamage` 직전 `Target.LastAttacker = Self` | Brain 이 폴링 후 0 으로 소비 |

**기록 위치 — `ApplyDamage` *직전*** (한 op 앞):

```jsonc
{ "op": "SaveStoreEntity", "entity": "Target", "property": "LastAttacker", "src": "Self" },
{ "op": "ApplyDamage",     "target": "Target", "amount": {"var":"atk"} }
```

`ApplyDamage` 빌더 자체를 건드리지 않은 이유: 데미지 op 의 시맨틱은 *수치 적용* 으로 좁게 유지하고, 채널 기록은 호출 측에서 명시적으로 — VM Self 자동 캡처는 빌더 API surface 를 늘리고 미래의 "공격자 없는 자해 데미지" 같은 경우와 충돌한다.

## Player Brain — `Story_TargetAction.json` (I-0016 그대로)

본 의도가 새로 만든 게 아니라 *재명명*. 우클릭 한 번의 책임은 Design-I0016 참조 — 결정만 하고 ActionIntent 에 기록 후 Halt. Brain 이라는 추상의 첫 사례이자 기준 구현.

## NPC Brain — Slime (`Natural/Slime/Slime_Brain.json`)

NPC AI 의 첫 구현. 정책은 *피격 반응 + 추적*:

1. `Yield 6` (≈ 0.2 sec @ 30Hz) 로 매 사이클 폴링. — Lifecycle (`Yield 1`) 보다 느슨해도 충분.
2. `State.Dead` → Halt. Brain 도 Lifecycle 과 독립적으로 사망 시그널을 본다.
3. `LastAttacker == 0` → 자극 없음, loop.
4. `LastAttacker > 0` 이고 attacker.Health > 0 → `ActionIntentType=2`, `ActionIntentTarget=attacker`, `ActionIntentSlot=0` 기록.
5. 어느 경로든 `LastAttacker = 0` 으로 소비 (반복 트리거 방지).

**Brain 은 사거리/쿨다운을 신경쓰지 않는다** — 그건 Lifecycle 의 일. Brain 은 *누구를 표적으로 할지* 만 정한다. 같은 슬라임을 다시 때리면 Brain 이 다음 사이클에 새 attacker 로 ActionIntent 를 덮어쓴다 (latest hit wins).

### Spawn 와이어링

`Natural/Slime/Slime_Spawn.json` 의 spawn 분기 끝에서 `NpcLifecycle` 옆에 Brain 도 dispatch:

```jsonc
{ "op": "DispatchEventFrom", "eventTag": "NpcLifecycle", "source": {"var":"slime"} },
{ "op": "DispatchEventFrom", "eventTag": "SlimeBrain",   "source": {"var":"slime"} }
```

Lifecycle 과 Brain 이 *각각 1 인스턴스씩* 영속 실행. 둘 다 같은 Self 위에서 영속 yield 루프.

### 현재 한계 / 확장 여지

- 시야 스캔 없음 — 슬라임은 *맞아야* 반응한다. 비-피격 시 patrol / aggro range 는 후속 PR. `FindInRadius` op 를 이용해 시야 스캔하는 형태가 자연스러운 다음 단계.
- 종족 1 종 — Goblin / Skeleton 등 행동 패턴이 다른 Brain 추가 필요.

## Brain 수명 / 다중성

- **Player**: 별도 Brain Story 없음 — `Story_TargetAction` 이 매 클릭당 1 회 dispatch (`cancelOnDuplicate: true`). 항상 최근 클릭이 ActionIntent 의 진실원.
- **NPC**: spawn 시 `DispatchEventFrom(<Brain>, Self)` 로 1 인스턴스. `cancelOnDuplicate: false` — 재초기화 / respawn 시 중복 가능성 있음. 현재는 Slime spawner-as-loop 가 1 회만 dispatch 하므로 문제 없음. 후속 PR 에서 명시적 가드 필요.
- **Brain 자체 종료**: `State.Dead` 도달 시 Brain 은 Halt. Lifecycle 의 die 분기가 별도로 사망 처리. Brain 과 Lifecycle 이 같은 사망 시그널을 *독립적으로* 본다 — 결합 없음.

## 격차 / TODO

- **Slime Brain 확장** — 비-피격 상황 patrol / 시야 스캔
- **스킬 분기의 데미지 채널 미커버** — 현재 `LastAttacker` 기록은 `Story_CombatUseSkill` 의 *기본 melee* 분기 (line ~69) 와 `Story_BasicAttack` (단일 + AoE) 에만 들어가 있다. `Story_CombatUseSkill` 의 line 84 / 92 / … `DispatchEvent` 로 분기되는 스킬 본문 (`Story.Event.Skill.Fireball` / `…Heal` / `…Lightning` / `…Buff`) 은 PR 범위 밖이라 *마법으로 슬라임을 때리면 Brain 이 반응 안 함*. 각 스킬 Story 의 `ApplyDamage` 직전에 동일하게 `SaveStoreEntity Target LastAttacker = Self` 한 줄 추가 필요 (별건 PR).
- **다른 NPC 종족 Brain** — Goblin / Skeleton 등
- **Brain on/off 토글** — 같은 NPC 를 Player 가 직접 조작 (Brain 비활성화). 빙의·관전 모드 후보.
- **LastAttacker 슬롯 재활용 검증** — 공격자 destroy 후 슬롯 재발급으로 phantom 가능. Design-I0016 의 Target 슬롯 위험과 동일 메커니즘.
- **Brain 의 입력 채널 확장** — `LastAttacker` 외에 `LastInteractor` (NPC 가 상호작용 받았을 때), `Threat` (위협 수준) 등.

## 관련 파일

- 데이터: `HktGameplay/Source/HktCore/Public/HktCoreProperties.h` — `LastAttacker` Cold 프로퍼티
- 태그: `HktGameplay/Source/HktStory/Public/HktStoryTags.h`, `…/Private/HktStoryTags.cpp` — `Story_Brain_Slime`
- Brain: `Natural/Slime/Slime_Brain.json` (NPC 첫 구현). Player Brain 인 `Story_TargetAction.json` 은 I-0016 의 자산을 그대로 활용.
- 디스패처: `Natural/Slime/Slime_Spawn.json` (NPCLifecycle + SlimeBrain 양쪽)
- Damage 채널: `Story_CombatUseSkill.json`, `Story_BasicAttack.json` (`ApplyDamage` 직전 `LastAttacker` 기록)
- spec: `Natural/Slime/Slime_Brain.spec.json` (4 시나리오 — idle / attack 세팅 / 죽은 공격자 소비 / self 사망)
