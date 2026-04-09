# 전투 시스템 기획서 (Combat System Design)

> **프로젝트**: HktGameplay — 3D RTS Adventure Dynamic MMORPG
> **브랜치**: `claude/combat-system-design-jeAoM`
> **작성일**: 2026-03-19
> **제약사항**: HktCore는 순수 C++ (No UObject), 서버 권위적

---

## 1. 현재 상태 분석

### 1.1 이미 구현된 것

| 영역 | 구현 내용 | 위치 |
|------|----------|------|
| **기본 공격** | BasicAttack Story (AnimTag → 대기 → AttackPower 데미지) | `HktStoryBasicAttack.cpp` |
| **스킬** | Fireball (시전 → 투사체 스폰 → 충돌 → 직격+범위 데미지+화상) | `HktStoryFireball.cpp` |
| **힐** | Heal Story | `HktStoryHeal.cpp` |
| **데미지 처리** | `ApplyDamage(Target, Amount)` — Health 차감 빌더 조합 연산 | `HktStoryBuilder` |
| **속성** | Health, MaxHealth, AttackPower, Defense, Mana, MaxMana, Team | `HktCoreProperties.h` |
| **이동** | 힘→가속도 물리 기반 이동, MoveToward, MoveForward | `HktMovementSystem` |
| **충돌** | 공간 분할 Grid 기반 충돌 감지 | `HktPhysicsSystem` |
| **Stance** | Unarmed/Spear/Gun/Sword1H 태그 | `HktCoreDefs.h` |

### 1.2 아직 없는 것 (= 이 기획서의 범위)

- 사망 처리 / 부활
- 어그로 / 위협 시스템 (NPC AI)
- 쿨다운 / 자원 소모
- 버프/디버프 스택 & 지속시간
- 스탯 계산 공식 (데미지 감소율 등)
- Stance별 공격 분기
- 콤보 / 공격 체인
- 원거리 공격 (Gun Stance)
- 스킬 슬롯 시스템

---

## 2. 설계 원칙

1. **VM 순수성 유지** — 전투 로직은 모두 Story 바이트코드로 표현. HktCore에 전투 전용 코드 추가 최소화.
2. **Property + Tag 조합** — 상태는 Property(int32)로, 분류/플래그는 GameplayTag로 표현.
3. **서버 권위적** — 클라이언트는 Precondition 힌트만 제공, 실제 검증은 서버 Story 내부.
4. **빌더 조합 우선** — 새 OpCode는 기존 조합으로 불가능할 때만 추가.
5. **결정론** — 모든 전투 계산은 int32 정수 연산, RandomSeed 기반.

---

## 3. 데미지 공식

### 3.1 기본 데미지 계산

```
FinalDamage = max(1, AttackPower - Defense / 2)
```

- **AttackPower**: 공격자의 `PropertyId::AttackPower`
- **Defense**: 방어자의 `PropertyId::Defense`
- 최소 데미지 보장: 1

### 3.2 스킬 데미지 계산

```
FinalDamage = max(1, SkillBaseDamage + AttackPower * SkillScaling / 100 - Defense / 2)
```

- **SkillBaseDamage**: Story 내 상수 (예: Fireball = 80)
- **SkillScaling**: 공격력 반영 비율 (예: 50 = 50%)

### 3.3 Builder 구현 방향

현재 `ApplyDamage`는 단순 차감. Defense 반영 버전을 Builder 조합 연산으로 추가:

```cpp
// StoryBuilder에 추가할 조합 연산
FHktStoryBuilder& ApplyDamageWithDefense(RegisterIndex Target, RegisterIndex RawDamage);
// 내부: LoadStoreEntity(Temp, Target, Defense) → Div → Sub → SaveStoreEntity(Target, Health, ...) → CmpLe(죽음판정)
```

---

## 4. 사망 & 부활

### 4.1 사망 조건

```
Health <= 0 → 사망 처리
```

### 4.2 새 Property 추가

| Property | Tier | 설명 |
|----------|------|------|
| `IsDead` | Cold | 0=생존, 1=사망 |
| `RespawnTimer` | Cold | 부활까지 남은 프레임 수 |

### 4.3 새 Tag

| Tag | 설명 |
|-----|------|
| `State.Dead` | 사망 상태 (애니메이션/렌더러 분기용) |
| `State.Invulnerable` | 부활 직후 무적 |

### 4.4 사망 Story Flow

```
Story("Story.System.Death")
    .AddTag(Self, State_Dead)
    .SaveConst(PropertyId::IsDead, 1)
    .StopMovement(Self)

    // NPC: 즉시 파괴 + 아이템 드랍 이벤트
    .LoadStoreEntity(R0, Self, PropertyId::IsNPC)
    .JumpIfNot(R0, "PlayerDeath")
    .DestroyEntity(Self)
    .Halt()

    // Player: 5초 후 부활
    .Label("PlayerDeath")
    .WaitSeconds(5.0f)

    // 부활 처리
    .LoadStoreEntity(R0, Self, PropertyId::MaxHealth)
    .SaveStoreEntity(Self, PropertyId::Health, R0)    // HP 풀 회복
    .SaveConst(PropertyId::IsDead, 0)
    .RemoveTag(Self, State_Dead)
    .AddTag(Self, State_Invulnerable)
    .WaitSeconds(3.0f)
    .RemoveTag(Self, State_Invulnerable)
    .Halt()
```

### 4.5 ApplyDamage 확장 — 사망 판정 내장

`ApplyDamage` 조합 연산 내부에 Health <= 0 체크를 추가하여, 사망 시 자동으로 `Story.System.Death` 이벤트를 생성.

---

## 5. 쿨다운 시스템

### 5.1 설계

스킬별 쿨다운은 **Cold Property**로 관리. 남은 프레임 수를 저장.

### 5.2 새 Property

| Property | Tier | 설명 |
|----------|------|------|
| `Cooldown0` ~ `Cooldown3` | Cold | 스킬 슬롯 0~3의 남은 쿨다운 (프레임 단위) |

### 5.3 쿨다운 감소

매 프레임 실행되는 시스템 Story로 처리:

```
Story("Story.System.CooldownTick")
    // 각 슬롯의 쿨다운 > 0 이면 -1
    .LoadStore(R0, PropertyId::Cooldown0)
    .CmpGt(Flag, R0, R1)  // R1 = 0 (초기값)
    .JumpIfNot(Flag, "Skip0")
    .AddImm(R0, R0, -1)
    .SaveStore(PropertyId::Cooldown0, R0)
    .Label("Skip0")
    // ... Cooldown1~3 반복
```

### 5.4 스킬 사용 시 쿨다운 설정

각 스킬 Story 시작부에 Precondition + 쿨다운 설정:

```
Story("Story.Event.Skill.Fireball")
    .SetPrecondition([](const FHktWorldState& WS, const FHktEvent& E) {
        return WS.GetProperty(E.SourceEntity, PropertyId::Cooldown1) == 0
            && WS.GetProperty(E.SourceEntity, PropertyId::Mana) >= 30;
    })
    // 쿨다운 설정 (5초 = 150프레임 @30fps)
    .SaveConst(PropertyId::Cooldown1, 150)
    // 마나 소모
    .LoadStore(R0, PropertyId::Mana)
    .AddImm(R0, R0, -30)
    .SaveStore(PropertyId::Mana, R0)
    // ... 나머지 스킬 로직
```

---

## 6. 버프/디버프 시스템

### 6.1 설계 방침

- **태그 기반 식별**: `Effect.Burn`, `Effect.Slow`, `Effect.Buff.AttackUp` 등
- **지속시간**: 별도 Story VM이 타이머 역할 → 시간 만료 시 태그 제거
- **스택**: 동일 효과 중복 적용 시 기존 VM 취소 후 재적용 (CancelOnDuplicate)

### 6.2 버프 Story 패턴

```
Story("Story.Effect.Burn")
    .CancelOnDuplicate()
    .AddTag(Self, Effect_Burn)

    // 3초간 매 0.5초마다 10 데미지
    .LoadConst(R0, 6)                    // 반복 횟수
    .Label("BurnLoop")
    .ApplyDamageConst(Self, 10)
    .PlayVFXAttached(Self, VFX_BurnTick)
    .WaitSeconds(0.5f)
    .AddImm(R0, R0, -1)
    .CmpGt(Flag, R0, R1)
    .JumpIf(Flag, "BurnLoop")

    .RemoveTag(Self, Effect_Burn)
    .Halt()
```

### 6.3 스탯 변경 버프 패턴

```
Story("Story.Effect.Buff.AttackUp")
    .CancelOnDuplicate()
    .AddTag(Self, Effect_Buff_AttackUp)

    // 공격력 +20
    .LoadStore(R0, PropertyId::AttackPower)
    .AddImm(R0, R0, 20)
    .SaveStore(PropertyId::AttackPower, R0)

    .WaitSeconds(10.0f)   // 10초 지속

    // 공격력 복원
    .LoadStore(R0, PropertyId::AttackPower)
    .AddImm(R0, R0, -20)
    .SaveStore(PropertyId::AttackPower, R0)
    .RemoveTag(Self, Effect_Buff_AttackUp)
    .Halt()
```

---

## 7. NPC 어그로 / AI

### 7.1 설계

NPC AI는 **상시 루프 Story**로 구현. NPC 스폰 시 AI Story가 자동 실행.

### 7.2 새 Property

| Property | Tier | 설명 |
|----------|------|------|
| `AggroTarget` | Cold | 현재 어그로 대상 EntityId |
| `AggroRange` | Cold | 인지 범위 (cm) |
| `AttackRange` | Cold | 공격 가능 범위 (cm) |
| `AIState` | Cold | 0=Idle, 1=Chase, 2=Attack, 3=Return |

### 7.3 NPC AI Story

```
Story("Story.Flow.AI.Hostile")
    .Label("Scan")
    // State.Dead이면 즉시 종료
    .HasTag(Flag, Self, State_Dead)
    .JumpIf(Flag, "Dead")

    // 범위 내 플레이어 탐색
    .LoadStoreEntity(R0, Self, PropertyId::AggroRange)
    .FindInRadius(Self, R0)
    .NextFound()
    .JumpIfNot(Flag, "Idle")            // 아무도 없으면 대기

    // 타겟 설정
    .Move(Target, Iter)
    .SaveStoreEntity(Self, PropertyId::AggroTarget, Iter)

    // 거리 체크 → 공격 가능?
    .GetDistance(R1, Self, Target)
    .LoadStoreEntity(R2, Self, PropertyId::AttackRange)
    .CmpLe(Flag, R1, R2)
    .JumpIf(Flag, "Attack")

    // 추적
    .GetPosition(R3, Target)
    .MoveToward(Self, R3, 300)
    .Yield(15)                          // 0.5초 후 재스캔
    .Jump("Scan")

    .Label("Attack")
    .StopMovement(Self)
    // 기본공격 이벤트 발생 (Self→Target)
    // ... (ApplyDamage + WaitAnimEnd)
    .Yield(30)                          // 공격 후 1초 대기
    .Jump("Scan")

    .Label("Idle")
    .StopMovement(Self)
    .Yield(30)                          // 1초 대기 후 재스캔
    .Jump("Scan")

    .Label("Dead")
    .Halt()
```

---

## 8. Stance 전투 분기

### 8.1 Stance별 공격 Story

각 Stance마다 별도 BasicAttack Story를 등록하는 대신, **단일 BasicAttack Story 내에서 Stance 태그로 분기**:

```
Story("Story.Event.Attack.Basic")
    // Stance 확인
    .HasTag(Flag, Self, HktStance::Spear)
    .JumpIf(Flag, "SpearAttack")
    .HasTag(Flag, Self, HktStance::Gun)
    .JumpIf(Flag, "GunAttack")
    .HasTag(Flag, Self, HktStance::Sword1H)
    .JumpIf(Flag, "SwordAttack")

    // Default: Unarmed
    .Label("UnarmedAttack")
    .AddTag(Self, Anim_Montage_Punch)
    .WaitAnimEnd(Self)
    .ApplyDamageConst(Target, 5)        // 맨손 = 낮은 데미지
    .RemoveTag(Self, Anim_Montage_Punch)
    .Halt()

    .Label("SpearAttack")
    // 긴 사거리, 보통 데미지
    .AddTag(Self, Anim_Montage_SpearThrust)
    .WaitAnimEnd(Self)
    .LoadStore(R0, PropertyId::AttackPower)
    .ApplyDamage(Target, R0)
    .RemoveTag(Self, Anim_Montage_SpearThrust)
    .Halt()

    .Label("GunAttack")
    // 원거리 투사체
    .SpawnEntity(Entity_Projectile_Bullet)
    .GetPosition(R0, Self)
    .SetPosition(Spawned, R0)
    .MoveForward(Spawned, 800)          // 빠른 투사체
    .PlaySound(Sound_Gunshot)
    .WaitCollision(Spawned)
    .DestroyEntity(Spawned)
    .LoadStore(R0, PropertyId::AttackPower)
    .ApplyDamage(Hit, R0)
    .Halt()

    .Label("SwordAttack")
    // 기존 BasicAttack과 동일
    .AddTag(Self, Anim_Montage_Attack)
    .WaitAnimEnd(Self)
    .LoadStore(R0, PropertyId::AttackPower)
    .ApplyDamage(Target, R0)
    .PlayVFXAttached(Target, VFX_HitSpark)
    .PlaySound(Sound_Hit)
    .RemoveTag(Self, Anim_Montage_Attack)
    .Halt()
```

---

## 9. 스킬 슬롯 시스템

### 9.1 설계

- 4개 스킬 슬롯 (클라이언트 CommandInputAction 슬롯 0~3과 대응)
- 각 슬롯에 Story EventTag를 바인딩
- 서버에서 슬롯→EventTag 매핑을 관리

### 9.2 새 Property

| Property | Tier | 설명 |
|----------|------|------|
| `SkillSlot0` ~ `SkillSlot3` | Cold | 각 슬롯에 바인딩된 스킬 식별자 (Tag의 int 인코딩) |

### 9.3 클라이언트→서버 흐름

```
[Client] CommandInputAction(SlotIndex=1)
    → IntentBuilder: FHktEvent { EventTag = "Event.Command.Skill", Param0 = SlotIndex }
    → [Server] OnReceived_FireIntentEvent
        → SlotIndex로 실제 스킬 EventTag 조회
        → SimulationEvent에 해당 Story 이벤트 추가
```

---

## 10. 구현 우선순위

### Phase 1 — 핵심 전투 루프 (필수)

| # | 작업 | 변경 파일 |
|---|------|----------|
| 1 | Cold Property 추가 (IsDead, Cooldown0~3, AggroTarget 등) | `HktCoreProperties.h` |
| 2 | 사망 판정 Story + Tag (State.Dead) | `HktStoryDeath.cpp` (신규) |
| 3 | `ApplyDamageWithDefense` Builder 조합 연산 | `HktStoryBuilder.h/cpp` |
| 4 | Stance별 BasicAttack 분기 | `HktStoryBasicAttack.cpp` (수정) |
| 5 | Fireball에 Precondition + Cooldown + Mana 소모 추가 | `HktStoryFireball.cpp` (수정) |

### Phase 2 — 버프/디버프

| # | 작업 | 변경 파일 |
|---|------|----------|
| 6 | Burn DoT Story | `HktStoryEffectBurn.cpp` (신규) |
| 7 | AttackUp Buff Story | `HktStoryEffectAttackUp.cpp` (신규) |
| 8 | CooldownTick 시스템 Story | `HktStoryCooldownTick.cpp` (신규) |

### Phase 3 — NPC AI

| # | 작업 | 변경 파일 |
|---|------|----------|
| 9 | AI Property 추가 (AggroRange, AttackRange, AIState) | `HktCoreProperties.h` |
| 10 | Hostile NPC AI Story | `HktStoryAIHostile.cpp` (신규) |
| 11 | NPC 스포너에서 AI Story 자동 실행 연결 | `HktStoryNPCLifecycle.cpp` (수정) |

### Phase 4 — 스킬 슬롯

| # | 작업 | 변경 파일 |
|---|------|----------|
| 12 | SkillSlot Property + 서버 매핑 | `HktCoreProperties.h`, `HktServerRule.cpp` |
| 13 | CommandInputAction → 스킬 이벤트 변환 | `HktClientRule.cpp` |

---

## 11. 새 OpCode 필요성 검토

| 후보 | 필요 여부 | 근거 |
|------|----------|------|
| `DamageWithDefense` | **불필요** | LoadStoreEntity + Sub + Div + CmpLe 조합으로 구현 가능 |
| `IsDead` 체크 | **불필요** | HasTag(State.Dead) 또는 LoadStore(IsDead) + CmpEq로 구현 |
| `FireEvent` (Story에서 다른 Story 트리거) | **검토 필요** | 사망 시 Death Story 트리거에 필요. 현재는 VM이 직접 이벤트를 생성할 수 없음 |
| `ClampMin` | **불필요** | CmpLt + JumpIf + LoadConst 조합 |

### FireEvent OpCode 제안

사망 판정 후 Death Story를 트리거하려면, VM이 실행 중 새 이벤트를 `PendingExternalEvents`에 추가할 수 있어야 함.

```
X(FireEvent)    // VM에서 새 FHktEvent를 생성하여 다음 프레임에 처리
```

**대안**: `ApplyDamage` 조합 연산 내에서 Health <= 0일 때 바로 Death Story 코드를 인라인하는 방식. OpCode 추가 없이 가능하지만 모든 데미지 Story에 중복 코드 발생.

**권장**: `FireEvent` OpCode 추가. Story 간 통신의 근본 메커니즘으로서 전투 외에도 활용도 높음.

---

## 12. Presentation 연동

### 12.1 전투 관련 렌더링 데이터 흐름

```
[HktCore]                    [HktPresentation]
  PropertyDelta              →  FHktEntityPresentation
    Health changed           →    Health/HealthRatio 업데이트
    IsDead changed           →    사망 애니메이션 트리거
  TagDelta                   →  FHktEntityPresentation.Tags
    State.Dead 추가          →    AnimInstance → Death montage
    Anim.Montage.Attack 추가 →    AnimInstance → Attack montage
    Effect.Burn 추가         →    VFX 렌더러 → 화상 이펙트 루프
```

### 12.2 추가 필요 PresentationState 필드

```cpp
// FHktEntityPresentation에 추가
THktVisualField<bool> bIsDead;
THktVisualField<int32> Cooldown0;  // UI 쿨다운 표시용 (선택)
```

---

## 요약

이 기획서는 기존 HktGameplay의 **Story VM + Property + Tag** 아키텍처를 그대로 활용하여 전투 시스템을 확장합니다. 핵심 원칙:

1. **새 OpCode 최소화** — `FireEvent` 1개만 추가 검토
2. **Story 바이트코드로 모든 전투 로직 표현** — 사망, 쿨다운, 버프, AI 모두 Story
3. **Property 추가로 상태 확장** — Cold tier에 전투 관련 속성 추가
4. **GameplayTag로 시각/분류 분기** — 사망, 버프, Stance 등

4단계 Phase로 점진적 구현하며, Phase 1만으로도 완전한 전투 루프(공격→데미지→사망→부활)가 동작합니다.
