# `[VUX-SK]` Skill 실행 관찰 UI/UX 설계
## `[VIEW]` `[OBSERVATION]` `[DIRECT-CYCLE]` `[CYCLE-READY]`

| 항목 | 내용 |
|---|---|
| 문서 ID | `VUX-SK-D1` |
| 문서 버전 | D1 |
| 상태 | **CYCLE READY — 별도 Master 선택 없이 즉시 Cycle 착수** |
| 접두사 | 산출물·Fixture·검증 ID는 `VUX-SK-*`를 사용한다 |
| 설계 근거 | [`Skill-System.md`](Skill/Skill-System.md), [`Skill-Execution-Form.md`](Skill/Skill-Execution-Form.md), [`Skill-Effect.md`](Skill/Skill-Effect.md), World Spatial Presence (문서 없음 — 6층에서 다시 세운다) |
| 소유 영역 | Skill 관찰 계약의 View 표현, 조준 입력, 실행 피드백, 관찰 오버레이, 접근성, Cycle handoff |
| 비소유 영역 | Activation·Anchor·Resolution·Effect·Presence의 World 의미와 판정 |

> **실행 지시**
>
> 이 문서는 Skill 규칙을 추가하는 기획이 아니라, 이미 설계된 Skill 실행을 플레이어가
> **선택하고, 조준하고, 실행하고, 결과를 설명할 수 있게 만드는 관찰 표면 설계**다.
> 별도의 후보 등록·Human Select를 기다리지 않고 §13의 `VUX-SK-01`부터
> 8 Stage Cycle을 시작한다. World → Observation → GameView → View 경계와 기존 Cycle의
> 8 Stage는 그대로 지킨다.

## 태그 규약

| 태그 | 의미 |
|---|---|
| `[VIEW]` | 배치·문구·입력·피드백을 View가 소유한다 |
| `[OBSERVATION]` | World가 관찰자에게 공개한 Skill 의미만 표현한다 |
| `[DIRECT-CYCLE]` | Master 후보화 없이 다음 Cycle로 직접 착수한다 |
| `[CYCLE-READY]` | Goal·Scope·계약 요구·검증 기준이 Agent handoff 가능한 상태다 |
| `[GAMEVIEW-GAP]` | authoritative 관찰이나 Action이 없으면 `spec.md` 의 Observable 절(plan)로 반환한다 |
| `[CAPABILITY-GAP]` | Renderer가 필요한 표현·입력 능력을 제공하지 않으면 기반 트랙으로 반환한다 |

---

# 1. 목적과 플레이어 질문 `[VIEW]`

Skill 화면은 전투 중 다음 질문에 즉시 답해야 한다.

```text
1. 지금 어떤 Skill을 쓸 수 있으며, 못 쓴다면 왜 못 쓰는가?
2. 입력한 Skill은 어디를 기준으로 누구에게 적용될 예정인가?
3. 현재 실행은 준비·유지·발사·충돌·반복 중 어느 단계인가?
4. 실제로 누구에게 어떤 결과가 적용되었는가?
5. 보이던 Projectile·Area·Trap은 언제, 어디서, 왜 사라졌는가?
```

1~3은 행동 전에 실수를 줄이고, 4~5는 행동 뒤 결과를 이해하게 한다. View는 범위 안 대상,
충돌, 피해량, 재사용 가능 시점을 계산하지 않는다. 관찰값이 없으면 `정보 없음`으로 안전하게
축소하고 GAP을 반환한다.

## 1.1 두 개의 관찰 깊이

하나의 화면에 모든 내부 정보를 항상 노출하지 않는다.

| 깊이 | 대상 | 기본 상태 | 보여 주는 것 |
|---|---|---|---|
| 플레이 HUD | 모든 플레이어 | 항상 사용 | 슬롯, 사용 가능 여부, 조준, Activation 진행, 눈앞의 실행, 결과 요약 |
| 관찰 오버레이 | 개발·검증 플레이 | 기본 닫힘 | Anchor, Query, 후보/필터/선택 수, Execution 단계, Effect 연결, Presence 생명주기 |

두 깊이는 **같은 GameView 계약**을 읽는다. 오버레이가 World 내부 객체를 직접 읽거나 플레이
HUD와 다른 판정을 만들어서는 안 된다. Observation Rule이 숨긴 Actor·Trap·Presence는
오버레이에도 나타나지 않는다.

# 2. 데스크톱 기본 화면 `[VIEW]`

## 2.1 플레이 HUD 와이어프레임 (1440×900 기준)

```text
┌──────────────────────────── WORLD VIEW ────────────────────────────────┐
│                         △ GroundPoint                                  │
│                    ╭──── 예상 범위 ────╮                              │
│                    │  대상 A  대상 B?  │   ← ?는 preview 불확실 표기  │
│                    ╰────────────────────╯                              │
│                                                                        │
│  TARGET                                                                │
│  늑대  34/50                                                           │
│                                                                        │
│                [시전: 화염구 ━━━━━━━░░ 1.2 / 1.5s]                    │
│                                                                        │
│ [HP 72/100]       [1 베기][2 화염구][3 장판][4 함정]      [최근 결과] │
│                   READY   2.4s      불가:거리   READY       -12 늑대   │
└────────────────────────────────────────────────────────────────────────┘
```

* Skill Bar는 화면 하단 중앙, 선택 대상은 전투 시야를 가리지 않는 가장자리, Activation 진행은
  캐릭터와 Skill Bar 사이에 둔다.
* World-space 표시는 Anchor와 관찰 가능한 Geometry를 보여 주되, 캐릭터·위험 지형·대상을
  완전히 가리지 않는다.
* 최근 결과는 2~4초 요약 후 사라지며, 영속적으로 확인할 필요가 있는 실패 사유는 슬롯과
  상세에 남긴다.

## 2.2 관찰 오버레이 와이어프레임

기본 바인딩은 `F8`이며 실제 표시는 Binding Registry를 읽는다.

```text
┌ SKILL OBSERVER ────────────────────────────────[Freeze view] [×]┐
│ 실행 목록                    │ 선택 실행: exec-104              │
│ ● 12.400 화염구 Cast         │ Skill / Caster  fireball / hero  │
│ ● 13.900 Presence Create     │ Activation      Cast / Executed  │
│ ● 14.220 Collision           │ Anchor          Direction (0.8,0.6)│
│ ● 14.220 Spatial Query       │ Execution       SpatialQuery      │
│ ● 14.220 Damage ×2           │ Origin          collision @ 12,7 │
│ ○ 14.221 Presence Remove     │ Geometry        Circle r=5        │
│                              │ Candidate 4 → Filtered 2 → Resolved 2│
│ [모두][실행][Presence][Effect]│ Targets         wolf-1, wolf-3   │
│ 검색 ID/이름                 │ Effect          Damage 12 / 9     │
└──────────────────────────────┴───────────────────────────────────┘
```

`Freeze view`는 오버레이의 선택과 목록 자동 스크롤만 멈춘다. World simulation을 정지시키지
않는다. 과거 행을 선택해도 현재 World에 다시 적용하거나 대상을 선택하지 않는다.

## 2.3 반응형 단계

| 폭 | 구성 |
|---|---|
| `≥ 1100px` | Skill Bar 1행, 결과 요약 우측, 오버레이 좌우 2열 |
| `720~1099px` | Skill Bar 2행 허용, 결과 요약 축소, 오버레이 상세 Drawer |
| `< 720px` | 이 Cycle 지원 대상 아님. 판정과 입력은 유지하되 모바일 전용 조준 UX는 후속 |

# 3. Skill 슬롯의 시각 언어 `[VIEW]`

```text
┌────────────────┐
│ 2        [KEY] │  좌상: 순번, 우상: 실제 바인딩
│      ICON      │  중앙: Skill 표현
│ ━━━━━━━░ 1.2s  │  하단: Activation 또는 재사용 진행
│ 불가 · 거리    │  마지막 줄: 상태와 짧은 사유
└────────────────┘
```

상태 우선순위는 `입력 대기 → 조준 중 → Activation 중 → 실행됨 → 재사용 대기 → 사용 불가`로
표현하되, 여러 상태가 함께 관찰되면 Primary 한 개와 Secondary 사유를 분리한다.

* `READY`는 색뿐 아니라 문구 또는 명확한 테두리로 표시한다.
* 재사용 대기는 남은 시간 숫자와 방사형/선형 진행을 함께 쓴다.
* 비용·거리·대상 부재 등 불가 사유는 World가 준 code/text를 표시한다. View가 우선순위를
  추측해야 한다면 계약 GAP이다.
* Toggle은 `ON/OFF`, Combo는 `현재 단계 / 전체 단계`, Charge는 관찰된 Parameter 변화값,
  Channel/Hold는 다음 Trigger까지의 진행을 각각 보인다.
* 알 수 없는 Skill·Activation·Execution code는 원문 fallback과 일반 아이콘으로 보이며
  슬롯 전체가 사라지지 않는다.

# 4. 선택·조준·실행 상호작용 `[VIEW]`

## 4.1 하나의 의미, 여러 입력

| 의미 행동 | Mouse | Keyboard | Gamepad | 요청 |
|---|---|---|---|---|
| Skill 선택 | 슬롯 좌클릭 | 숫자/등록 키 | Face/Shoulder 등록 키 | 없음 또는 observed select action |
| Unit Anchor | 대상 클릭 | Target Cycle 후 확인 | Lock-on 후 `A` | observed activation action + target ref |
| Direction Anchor | 포인터 방향 | 이동/조준 키 | Right Stick | activation action + observed direction |
| GroundPoint Anchor | 지면 클릭 | 커서 이동 후 `Enter` | Stick 이동 후 `A` | activation action + observed point |
| Self Anchor | 슬롯/키 즉시 | 등록 키 | 등록 키 | activation action; View가 self target을 추가하지 않음 |
| Charge/Hold 시작 | Press | Key down | Button down | observed begin action |
| Charge/Hold 종료 | Release | Key up | Button up | observed release action |
| 조준 취소 | 우클릭 | `Esc` | `B` | observed cancel action이 있으면 요청 |
| 관찰 오버레이 | UI 버튼 | `F8` | 기본 미지정 | 없음 |

입력 장치마다 다른 Skill 규칙을 만들지 않고 모두 같은 Semantic Action으로 수렴시킨다.
`Self`가 즉시 실행되는지 확인을 거치는지도 World가 제공한 Action 형태를 따른다.

## 4.2 조준 상태 기계

```text
idle → selected → aiming-valid   → request-pending → accepted → executing
                → aiming-invalid → remain-aiming  → cancel
                → cancelled
request-pending → rejected → 최신 상태로 aiming 또는 idle 복귀
```

* 조준 중 Anchor 마커는 굵은 점/십자, Geometry는 외곽선과 패턴, 방향은 화살표로 서로
  구분한다.
* `available=false`인 지점도 마커를 숨기지 않고 금지 표식과 사유를 보인다.
* 예상 대상 강조는 authoritative preview에 포함된 Actor만 사용한다. Preview가 없으면 범위
  도형만 보이고 `적용 대상은 실행 시 판정`이라고 표시한다.
* 요청 전에는 Projectile, Damage 숫자, 재사용 대기를 시작하지 않는다.

## 4.3 Anchor와 Resolution을 시각적으로 분리

Unit Anchor라고 해서 그 Unit만 맞는다고 약속하지 않는다.

```text
Anchor       작은 실선 마커 + "기준"
Geometry     큰 패턴 외곽선 + "판정 범위"
Preview 대상 개별 Outline + "예상"
실제 대상   순간 강조 + 결과 Event
```

Unit 중심 광역기에서는 기준 Unit과 예상 다수 대상이 동시에 보인다. Direction Skill은 방향선이
있어도 실제 대상 목록이 없을 수 있다. 이 분리는 Skill 설계의 핵심인
`Target Anchor ≠ Target Resolution`을 화면에서도 보존한다.

# 5. Activation 피드백 `[VIEW]`

| Activation | 실행 전/중 표시 | 완료/취소 표시 |
|---|---|---|
| Normal | 버튼 Press, pending 표시 | accepted Snapshot에서 실행 Pulse |
| Cast | Skill명, 진행/전체 시간, 중단 가능 여부(관찰 시) | 완료/중단 사유 |
| Charge | 유지 시간과 World가 준 Parameter Preview | Release 시 확정 Parameter |
| Hold / Channel | 유지 상태, 다음 반복까지 진행, 반복 횟수 | Release/중단 사유 |
| Combo | 현재 Step, 다음 입력 가능 창(관찰 시) | 종료/시간 만료 Step |
| Toggle | 명시적 `ON/OFF`, 활성 지속 상태 | 종료 요청 결과 |

프레임 시간으로 완료를 추측하지 않는다. 진행 Bar는 관찰된 시작·종료 시각 또는 진행률을
표현하는 보간일 뿐이며, 100%에 도달했다는 이유로 View가 Effect를 발생시키지 않는다.

# 6. Execution과 Spatial Presence 표현 `[VIEW]`

## 6.1 Execution 표현 어휘

| 의미 | 플레이 HUD | 관찰 오버레이 |
|---|---|---|
| Contact | 접촉 순간 짧은 강조 | 접촉 Actor와 resolved target 목록 |
| Direct | Source→Target 연결 Cue | target ref와 실행 Event |
| Spatial Query | Origin + Geometry 순간 Pulse | candidate → filtered → resolved 수와 ID |
| Spatial Presence | 관찰 가능한 존재와 이동/수명 | transform, shape, anchor, movement, remaining lifetime |
| Trigger | 발동 순간 Pulse/음향 Cue | trigger kind, 발생 시각, 다음 execution link |
| Composition | 플레이 결과를 연속 표현 | 부모/자식 execution을 접을 수 있는 Tree |

화려한 VFX의 크기·개수는 판정 범위를 약속하지 않는다. Gameplay Geometry가 공개되면
외곽선/Decal로 정확히 구분하고, VFX는 그 위에 장식 계층으로 둔다.

## 6.2 Presence 생명주기

```text
Create → Exist/Move → Trigger/Collision/Expire → Remove
```

* 동일 `presenceId`는 생성부터 제거까지 같은 관찰 개체로 유지한다.
* 남은 수명은 World가 공개했을 때만 Ring/Bar로 표시한다.
* 소멸은 `Expire / Collision / Triggered / AnchorLost / Removed`를 오버레이 Event에 남긴다.
* `AnchorLost`는 기준선 단절 Cue, `Collision`은 충돌 지점 Cue처럼 사유와 위치를 함께 연결한다.
* World에서 제거된 뒤 VFX 잔상이 남을 수 있으나 판정 가능한 Presence처럼 보이지 않게
  즉시 명도를 낮추고 입력/강조 대상에서 제외한다.

# 7. 실제 결과와 전투 로그 `[VIEW]`

실행 결과는 세 단계로 연결해 읽을 수 있어야 한다.

```text
Skill 실행 → Resolved Target[] → Effect Event → World State 변화
```

플레이 HUD는 대상 위 결과 숫자와 최근 결과 요약을 제공한다. 관찰 오버레이의 상세 순서는
다음으로 고정한다.

1. Skill, caster, 실행 시각, activation/phase
2. Anchor의 종류와 값
3. Execution 종류와 parent/trigger
4. Query origin, geometry, candidate/filtered/resolved
5. resolved target 목록과 결정 순서
6. 대상별 Effect
7. Damage라면 기존 Damage Breakdown
8. Presence를 만들거나 제거했다면 identity와 remove reason

Damage 상세은 `damageType`, `sourceOffense`, `targetDefense`, `skillBaseDamage`,
`skillAttackRatio`, `finalDamage`를 계약 그대로 표시한다. 여러 대상의 Damage를 합계 하나로만
보여 주거나 대상 수로 나누어 재계산하지 않는다. 같은 Actor에 반복 결과가 있다면 서로 다른
Trigger/Resolution Event로 연결되어야 한다.

# 8. 실패·경합·정보 부재 회복 `[VIEW]`

| 상황 | UX |
|---|---|
| 대상 없음/거리 밖/시야 불가 | 조준 마커 유지, 슬롯·마커 양쪽에 World 사유, 가능한 다음 행동 제시 |
| Cast/Channel 중단 | 진행을 멈추고 authoritative interrupt reason과 중단 시점을 남김 |
| 요청 거절 | 가짜 실행 VFX 없음, 최신 Snapshot으로 복귀, 해당 슬롯에 지속 사유 |
| 응답 지연 | 1초 뒤 `처리 중`, 5초 뒤 연결 상태 안내; 같은 request id 중복 전송 금지 |
| 대상 상태 경합 | 최신 Preview/Snapshot으로 갱신, `상태가 바뀌었습니다` + World 사유 |
| Preview 없음 | 범위만 표시하고 `대상은 실행 시 판정`; View가 공간 질의하지 않음 |
| Effect 상세 없음 | 결과 Event의 알려진 필드만 표시하고 `상세 정보 없음`; 역산 금지 |
| Presence 관찰 종료 Event 유실 | 조용히 제거하되 오버레이에 `종료 사유 알 수 없음`, GAP 생성 |
| 알 수 없는 code | 원문 code fallback, 일반 아이콘, Event 보존 |

Toast는 보조 수단이다. 실패 이유는 슬롯/조준 상세에도 남고, 성공은 World-space 변화와 Event
목록에서 다시 확인할 수 있어야 한다.

# 9. 접근성·가독성 완료 조건 `[VIEW]`

* Pointer 없이 Skill 선택, 네 Anchor 입력, 취소, 결과 확인, 오버레이 탐색이 가능해야 한다.
* 포커스 순서는 `대상 → Skill Bar → 상세/결과 → 오버레이`로 예측 가능하며, 오버레이를 닫으면
  열기 전 요소로 돌아간다.
* 접근성 이름은 `화염구, 2번, 재사용 2.4초, 대상 필요`처럼 이름·키·현재 상태·요구 입력을
  포함한다.
* Anchor, Geometry, 예상 대상, 실제 대상은 색만이 아니라 선 종류·패턴·아이콘으로 구분한다.
* 피해/회복 등 의미를 색 하나로 전달하지 않는다. 현재 미구현 Effect 이름을 미리 만들지 않는다.
* World-space Tooltip은 Hover와 Focus/Target Cycle 모두에서 열리고 `Esc`로 닫힌다.
* 200% 확대에서 Skill 상태와 실패 사유가 잘리지 않는다. 오버레이는 내부 스크롤을 제공한다.
* 애니메이션 감소 설정에서는 이동 Trail/화면 흔들림을 제거하고 위치 Outline과 Event 행 강조로
  대체한다.
* 빠른 반복 Effect는 숫자 난사를 합칠 수 있지만 오버레이 원본 Event와 대상별 값은 유실하지
  않는다.

# 10. GameView 계약 요구사항 `[GAMEVIEW-GAP]`

View는 World 내부 타입을 import하거나 Query를 재실행하지 않는다. `spec.md` 의 Observable 절은 최소 다음
의미를 Observer-specific projection으로 제공한다.

```yaml
skillSlots[]:
  - slotId
    skillId
    labelCode
    iconCode
    bindingId
    activationKind
    phase
    available
    unavailableReason: null | { code, textCode, priority }
    cooldown: null | { remaining, total }
    activationProgress: null | { elapsed, total, interruptible }
    toggleState: null | off | on
    combo: null | { step, totalSteps, windowRemaining }
    actions[]: { id, role, available, unavailableReason }

aiming: null | {
  actionId
  anchorKind                 # Self / Unit / Direction / GroundPoint
  anchorValue
  valid
  invalidReason
  preview: null | {
    originPosition
    geometry
    candidateTargets[]       # 공개가 허용된 경우에만
    predictedParameters[]    # Charge 등의 authoritative preview
  }
}

skillExecutions[]:
  - executionId
    parentExecutionId
    skillId
    casterId
    activationKind
    targetAnchor
    phase
    startedAt
    endedAt
    executionKind
    originPosition
    geometry
    candidateCount
    filteredCount
    resolvedTargets[]
    trigger: null | { kind, sourcePresenceId, occurredAt }

skillEffects[]:
  - eventId
    executionId
    skillId
    sourceActor
    targetActor
    effectKind
    position
    damageBreakdown: null | {
      damageType, sourceOffense, targetDefense,
      skillBaseDamage, skillAttackRatio, finalDamage
    }

spatialPresences[]:
  - presenceId
    sourceSkillId
    sourceActor
    position
    direction
    shape
    remainingLifetime
    anchorRef
    movementKind
presenceEvents[]:
  - presenceId
    role                       # created / moved / triggered / removed
    occurredAt
    position
    removeReason
```

모든 배열은 **그 Observer가 볼 수 있는 항목만** 포함한다. `candidateCount`는 숨은 Actor의 수를
노출할 수 있으므로 Observation Rule이 허용하지 않으면 `null`이어야 하며 View는 0으로
바꾸지 않는다. `resolvedTargets[]`의 순서는 World의 결정 순서다.

필요한 값이 없을 때 GAP 형식은 다음과 같다.

```text
GAMEVIEW GAP
Required   Unit Anchor와 실제 Resolved Targets를 서로 다르게 표현해야 함
Missing    executionId에 연결된 targetAnchor와 resolvedTargets
Reason     View가 화면 위치로 재판정하면 World와 다른 대상 약속을 만듦
Return To  GameView Specification
```

# 11. 구현 경계와 권장 파일 분해

```text
content/view/
  skill-bar-presentation.ts       슬롯 상태·사유·실제 Binding 표시
  skill-aiming-presentation.ts    Anchor/Geometry/Preview 표시 모델
  skill-execution-presentation.ts Activation·Execution·Trigger 타임라인
  skill-result-presentation.ts    대상별 Effect·Damage Breakdown
  spatial-presence-presentation.ts 생명주기·소멸 사유 표시
  skill-observer-panel.ts         필터·선택·Tree; 판정 없음
  code-text.ts                    알려진 code의 현지화와 원문 fallback
  tests/
    skill-observation.spec.ts     Fixture만으로 화면 결정 검증

engine/view-kernel/               View capability GAP일 때만 별도 기반 Cycle
world/                            View Stage에서 편집하지 않음
```

Renderer에 World-space marker, patterned geometry, press/release input, scrollable event list가 없으면
content에 전용 우회 판정을 만들지 않는다. `[CAPABILITY-GAP]`으로 반환하고 기존 Label·Button·
Outline으로 닫을 수 있는 Vertical Slice부터 완료한다.

# 12. 관찰 오버레이 운영 규칙 `[OBSERVATION]`

* 기본 목록은 시간 오름차순이며 같은 Tick은 World가 준 deterministic order를 유지한다.
* 행 하나는 `executionId`, `eventId`, `presenceId` 중 하나의 안정 식별자를 가진다.
* 필터는 표시만 바꾸며 Event를 삭제하거나 World를 멈추지 않는다.
* 최대 보존량을 넘으면 가장 오래된 **완료 묶음**부터 제거하고 `이전 N개 생략`을 표시한다.
* 자동 스크롤은 사용자가 과거 행을 선택하면 멈추고 `최신으로` 버튼으로 복귀한다.
* Actor/Presence 선택은 동일 ID의 공개된 World-space Outline과 양방향 연결한다.
* Clipboard 내보내기는 후속 범위다. 구현한다면 표시된 observer projection만 내보내고 World
  내부 상태나 숨은 ID를 추가하지 않는다.

# 13. Cycle 분할 — 직접 실행 가능한 단위

| 접두사 | Cycle Goal | 최소 Scope | 플레이 가능한 결과 | 선행 |
|---|---|---|---|---|
| VUX-SK-01 | 지금 쓸 Skill과 사유를 읽고 하나를 실행한다 | Skill Bar, 상태/Binding, Self·Unit, pending/거절 | 키보드와 Pointer로 선택→요청→결과 요약 확인 | Skill slot/action 관찰 |
| VUX-SK-02 | Direction·GroundPoint Skill의 기준과 범위를 오해 없이 조준한다 | Anchor marker, Geometry, valid/invalid, 취소 | 기준과 예상 범위를 보고 실행 또는 취소 | aiming preview + VUX-SK-01 |
| VUX-SK-03 | Cast·Charge·Hold·Combo·Toggle의 진행과 종료를 이해한다 | Activation progress, press/release, phase/reason | 시작→유지/진행→완료/중단을 구분 | Activation 관찰 + VUX-SK-01 |
| VUX-SK-04 | Projectile·Area·Trap의 생명주기를 따라간다 | Presence 표현, 이동/Anchor/수명, remove reason | 생성부터 충돌·발동·소멸까지 연결해 관찰 | Presence 관찰 + VUX-SK-02 |
| VUX-SK-05 | 실제 대상 선정과 Effect를 실행 경로로 설명한다 | Observer panel, execution tree, query counts, effects | Anchor→Resolution→대상별 Damage를 한 실행으로 추적 | Execution/Effect event + VUX-SK-01 |

**권장 첫 Cycle은 `VUX-SK-01`이다.** 오버레이부터 만들면 실제 플레이 입력·상태 피드백 없이
진단 화면만 남는다. Skill Bar의 공통 상태·Action·결과 표현을 먼저 닫아야 이후 조준과
타임라인이 같은 의미 어휘를 재사용한다.

## 13.1 VUX-SK-01 Cycle Definition 초안

```text
Goal              플레이어가 Skill Bar에서 지금 가능한 Skill과 불가능 사유를 읽고,
                  Self 또는 Unit Anchor Skill 하나를 실제 요청해 결과를 확인한다.
Playable Result   슬롯 Focus → 상태/사유 확인 → 대상 선택(필요 시) → 실행 요청
                  → pending → accepted/rejected → 최신 Snapshot과 결과 Event 확인.
Observable Result Skill/Binding, availability/reason, Anchor 요구, phase, pending,
                  resolved target, Effect 결과가 서로 구분된다.
In Scope          Skill Bar, Self·Unit 입력, 상태/사유, pending, 결과 요약, Fixture 테스트.
Out of Scope      Direction/GroundPoint Geometry, 복합 Activation, Presence, Observer panel,
                  새 Skill·Effect·Cooldown·Targeting 규칙, 모바일.
World Delta       NONE이 기본. 필요한 projection/action/event가 없으면 spec.md Observable 절의 GAP.
View Delta        기존 전투 화면에 Skill Bar와 최근 결과 요약을 추가한다.
Master Trace      DIRECT OBSERVATION — VUX-SK-D1
```

## 13.2 Stage별 Agent 전달 체크리스트

| Stage | Agent가 남겨야 할 것 | 금지 |
|---|---|---|
| 1 Cycle | 위 Goal을 한 플레이 흐름으로 닫고 직접 관찰 출처 기록 | 가짜 Master ID, VUX-SK-02 이후 Scope 포함 |
| 2 Intent | §1 질문, 입력 장치별 같은 의미 행동, 실패 회복 | 픽셀·컴포넌트 구현 결정 |
| 3 Semantic | 기존 Skill 의미 REUSED 확인, 새 의미가 없으면 명시 | UI 편의를 위한 Skill Type/Effect 추가 |
| 4 Spec | §10 중 Slice에 필요한 projection·action·event·사유 | World 내부 타입 참조, View의 대상 판정 |
| 5 Review | 가능/불가·대상 소멸·거절·지연 Fixture Human 확인 | Happy path만 승인 |
| 6 World | 원칙상 변화 없음; Spec GAP의 최소 투영만 추가 | HUD/layout 구현 |
| 7 View | `view/` 결정과 Fixture 테스트; 기반 부족은 capability GAP | World import, Damage 역산 |
| 8 Verify | Mouse+Keyboard, World 통합, View 단독 Fixture 실측 | 단위 테스트만으로 완료 선언 |

# 14. UI/UX 검증 매트릭스

## 14.1 필수 Fixture

| Fixture | 반드시 관찰할 것 |
|---|---|
| `VUX-SK-FX-READY` | Self/Unit 슬롯, 실제 Binding, READY, 실행과 결과 연결 |
| `VUX-SK-FX-UNAVAILABLE` | 거리·대상·재사용 등 서로 다른 World 사유와 우선순위 |
| `VUX-SK-FX-AIMING` | Unit/Direction/GroundPoint Anchor, Geometry, valid/invalid, Preview 부재 |
| `VUX-SK-FX-ACTIVATION` | Cast/Charge/Hold/Combo/Toggle phase와 완료·중단 사유 |
| `VUX-SK-FX-MULTI-TARGET` | Unit Anchor 한 개와 resolved target 여러 개, 대상별 Damage |
| `VUX-SK-FX-PRESENCE` | Create→Move/Anchor→Trigger/Collision→Remove와 소멸 사유 |
| `VUX-SK-FX-STALE` | pending 중 대상 소멸, 최신 Snapshot 복구, 중복 요청 없음 |
| `VUX-SK-FX-HIDDEN` | 숨은 Trap/Actor가 marker·count·오버레이 어디에도 유출되지 않음 |
| `VUX-SK-FX-UNKNOWN` | 미등록 code가 fallback으로 보이고 Event/슬롯이 유실되지 않음 |

## 14.2 자동 검증

```text
VUX-SK-V-01  모든 visible slot은 실제 bindingId, availability, reason을 그대로 표현한다.
VUX-SK-V-02  Mouse와 Keyboard가 동일 action id와 동일 Anchor payload로 수렴한다.
VUX-SK-V-03  View는 Preview 부재 시 resolved target이나 피해를 계산하지 않는다.
VUX-SK-V-04  Unit Anchor와 resolvedTargets[]는 서로 다른 시각 요소와 접근성 이름을 가진다.
VUX-SK-V-05  요청 응답 전 cooldown·phase·Projectile·Effect를 낙관적으로 만들지 않는다.
VUX-SK-V-06  candidate/filtered/resolved 수와 순서는 GameView 값 그대로다.
VUX-SK-V-07  대상별 finalDamage는 합치거나 나누지 않고 execution/effect event에 연결된다.
VUX-SK-V-08  동일 presenceId의 생성·상태·제거가 연결되고 removeReason이 보인다.
VUX-SK-V-09  observer projection에 없는 Actor/Presence/개수는 어떤 표면에도 나타나지 않는다.
VUX-SK-V-10  알 수 없는 code는 원문 fallback으로 보이고 예외가 나지 않는다.
VUX-SK-V-11  F8/닫기와 Freeze view는 World State와 simulation을 바꾸지 않는다.
VUX-SK-V-12  Fixture 테스트는 World 프로세스 없이 통과한다.
```

## 14.3 Human Play 완료 기준

처음 보는 플레이어가 별도 설명 없이 30초 안에 사용 가능한 Skill과 불가능한 Skill의 사유를
구분하고, 60초 안에 Unit 또는 GroundPoint Skill을 조준해 기준과 예상 범위를 설명한 뒤 실행
또는 취소할 수 있어야 한다. 실행 뒤에는 Anchor와 실제 대상이 같지 않을 수 있음을 화면으로
설명할 수 있어야 한다.

검증 플레이어는 오버레이에서 90초 안에 한 Fireball의 `Cast → Presence Create → Collision →
Spatial Query → 대상별 Damage → Presence Remove`를 같은 실행 묶음으로 추적하고, 빠진 대상이
Geometry·Filter·Selection 중 어느 단계에서 제외되었는지 **계약이 제공한 범위 안에서** 말할
수 있어야 한다. 이를 설명할 수 없으면 기능 테스트가 통과해도 Skill 관찰 UI/UX Cycle은
완료가 아니다.
