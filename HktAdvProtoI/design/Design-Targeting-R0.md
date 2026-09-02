# SYSTEM DESIGN DOCUMENT
## Targeting R0 — 선택 · 관찰 · 공격 · 상호작용

> 상태: **기초 기획 초안**  
> 범위: MMORPG식 단일 하드 타겟의 최소 구조  
> 목적: 플레이어가 세계의 존재 하나를 선택해 계속 관찰하고, 그 대상을 향해 공격하거나
> 상호작용할 수 있게 한다.

---

# 0. 한 문장 설계

> **타겟은 행동 성공을 보장하는 자동 조준이 아니라, 플레이어가 지금 누구에게 관심과
> 의도를 두었는지를 세계에 명시하는 관계다.**

기본 MMORPG와 Warcraft 계열의 익숙한 흐름을 참고한다.

```text
대상을 선택한다
    ↓
대상 프레임으로 현재 상태를 계속 관찰한다
    ↓
가능한 공격 / 관찰 / 상호작용을 고른다
    ↓
World가 거리·상태·접촉 등 실제 성공 조건을 판정한다
    ↓
성공 또는 실패 사유를 같은 대상 문맥에서 확인한다
```

타겟 선택 자체에는 피해, 어그로, 이동, 지식 획득 효과가 없다. 선택은 이후 행동이 참조할
대상을 정할 뿐이다.

# 1. 현재 시스템에 필요한 이유

현재 세계에는 이미 존재를 `targetEntityId`로 지목하는 봉투와 대상 지정 행동이 있다.

- `observe`, `mine`, 디버그 속성 변경은 대상 ID를 받는다.
- 공격은 대상을 받지 않고 전방의 Swing Collider 접촉으로만 맞은 존재를 정한다.
- 관찰 결과는 관찰자별로 투영되며, 살펴봄·통찰 층에 의해 상대 정보가 공개·가림·통찰 공개로
  나뉜다.

따라서 없는 것은 새로운 공격 계산이 아니라 다음의 공통 연결점이다.

```text
선택한 대상
├─ 대상 프레임에서 관찰
├─ Observe의 기본 대상
├─ Attack의 의도 대상
└─ Mine 등 문맥 상호작용의 기본 대상
```

각 행동이 화면에서 별도로 대상을 찾게 두면 같은 존재를 보고도 관찰은 A, 공격은 B,
상호작용은 C에게 나가는 문제가 생긴다. R0는 이를 `CurrentTarget` 하나로 통일한다.

# 2. 핵심 개념

## 2.1 Current Target

`CurrentTarget`은 **관찰자의 몸이 현재 선택한 존재 하나**다.

```text
TargetSelection
  observerId       누가 선택했는가
  actorId          그 관찰자가 조종하는 몸
  targetEntityId   무엇을 선택했는가 (없을 수 있음)
```

한 플레이어는 R0에서 타겟을 최대 하나만 가진다. 여러 대상을 기억하는 포커스 타겟,
파티 타겟, 공격대 표식은 이후 확장이다.

타겟은 대상에게 붙는 상태가 아니다. 같은 늑대를 A는 선택하고 B는 선택하지 않을 수 있으므로
**관찰자/조종 Actor별 관계**다. 대상은 자신이 선택되었다는 이유만으로 상태가 변하지 않는다.

## 2.2 Hard Target

R0는 단일 **하드 타겟**을 사용한다.

- 새 대상을 선택하기 전까지 선택이 유지된다.
- 카메라 중앙이나 마우스 Hover가 바뀌어도 자동으로 바뀌지 않는다.
- 공격과 상호작용은 선택된 대상의 ID를 명시적으로 참조한다.
- 타겟이 있다고 해서 행동이 반드시 성공하지는 않는다.

이는 빠르게 지나가는 Hover 대상보다 MMORPG의 대상 프레임과 단축키 행동에 적합하다.

## 2.3 Target와 Acquaintance의 분리

선택과 앎은 서로 다르다.

```text
Target       지금 관심을 둔 존재
Acquaintance 살펴보기를 마쳐 전투 정보를 알게 된 존재
Insight      살펴보지 않아도 일부 정보를 드러내는 Actor 성질
```

처음 보는 적도 선택할 수 있고 공격할 수 있다. 다만 살펴봄 층의 가려진 전투 정보는 그대로
가려진다. `Observe`를 완료하거나 통찰 층의 Insight 문턱을 만족해야 정보가 열린다.

# 3. 플레이 흐름

## 3.1 선택

R0의 기본 입력은 다음과 같다.

| 입력 | 결과 |
|---|---|
| 월드의 존재를 좌클릭 | 그 존재를 Current Target으로 선택 |
| `Tab` | 선택 가능한 가까운 적대 Actor를 다음 순서로 선택 |
| `Shift+Tab` | 반대 순서로 순환 |
| `Esc` | 타겟 해제 |
| 이미 선택한 존재 클릭 | 선택 유지; 토글 해제하지 않음 |

Tab 순서는 결정론적으로 계산한다.

```text
1. 선택 가능하고 쓰러지지 않은 적대 Actor만 후보로 둔다.
2. 플레이어로부터 TARGET_CYCLE_RANGE 안의 후보만 둔다.
3. 화면/시야 판정이 있는 후보를 우선한다.
4. 거리 오름차순, 같은 거리면 EntityId 오름차순으로 고정한다.
5. 현재 타겟 다음 후보로 이동하고 끝이면 처음으로 순환한다.
```

R0에서는 아군/중립 존재 Tab 순환 키를 별도로 만들지 않는다. 마우스로는 공격 가능 여부와
관계없이 주소 지정 가능한 Actor와 상호작용 Entity를 선택할 수 있다.

## 3.2 계속 관찰

타겟을 선택하면 대상 프레임이 열린다. 프레임은 선택 순간의 복사본이 아니라 매 World
Snapshot의 **현재 투영값**을 보여 준다.

최소 표시:

```text
항상 표시 가능한 것
  이름 / 종류 / 관계(적대·중립·우호)
  생명과 현재 행동
  거리 및 쓰러짐 여부

조건부 표시
  CombatStats / DefenseShape / versusObserver
  → 살펴봄의 Acquaintance와 통찰의 Insight 규칙을 그대로 사용

행동 문맥
  공격 가능 여부와 불가 사유
  Observe 가능 여부와 불가 사유
  대상이 제공하는 상호작용 목록과 각 불가 사유
```

모르는 값은 View가 임의로 `???`로 바꾸어 짐작하지 않는다. World가 기존 관찰 계약대로
`concealed`와 사유를 보내고 View가 그것을 표현한다.

## 3.3 Observe

타겟을 선택한 상태에서 `Observe`를 사용하면 Current Target이 대상이 된다.

```text
CurrentTarget 없음          → 실패: no-target-selected
대상이 존재하지 않음        → 실패: no-such-target
자기 자신                   → 실패: target-is-self
관찰 거리 밖                → 실패: out-of-range
더 열 정보가 없음           → 실패: already-known
다른 행동 중                → 실패: action-busy
그 외                       → 기존 Observe 시작
```

시간, 거리, 중단, Acquaintance 획득은 살펴봄 층의 규칙을 바꾸지 않는다. 타겟 시스템은 기존
`targetEntityId`를 채워 주는 공통 선택 문맥만 제공한다.

## 3.4 공격

공격은 Current Target을 **의도 대상**으로 받는다. 그러나 실제 타격은 기존 물리 접촉을
폐기하지 않는다.

```text
공격 입력
    ↓
선택 대상이 유효한가?
    ↓ yes
공격 시작 순간 대상 방향으로 Actor의 Facing을 고정한다
    ↓
기존 Skill Action / Swing Collider 실행
    ↓
Collider가 의도 대상 Body에 접촉했는가?
    ↓ yes
기존 피해·방어·관통·치명타 공식 실행
```

R0 판정 원칙:

1. **타겟이 없으면 대상 지정 공격을 시작하지 않는다.** 실패 사유는
   `no-target-selected`다.
2. **사거리 밖이면 자동 이동하지 않는다.** `out-of-range`로 실패하며 플레이어가 직접
   접근한다.
3. **공격 시작 시에만 방향을 맞춘다.** 공격 도중 대상이 움직인다고 Swing이 자동 추적하지
   않는다.
4. **선택은 명중 보장이 아니다.** Collider가 닿지 않으면 피해가 없다.
5. **대상이 쓰러졌거나 공격 불가 관계면 시작하지 않는다.** 각각 `target-downed`,
   `invalid-hostile-target`을 관찰 가능하게 돌려준다.
6. **피해 공식은 바꾸지 않는다.** Target은 Base Damage, Ratio, Defense, Penetration,
   Critical 계산에 어떤 보너스도 주지 않는다.

현재의 비지정 전방 공격을 즉시 삭제하지 않는다. 이행 기간에는 입력을 구분한다.

```text
Targeted Attack  선택 대상에게 의도를 둔 MMORPG식 기본 공격
Free Swing       방향과 접촉만으로 휘두르는 기존 전투/디버그 경로
```

최종적으로 둘을 함께 유지할지는 실제 플레이 후 결정한다. R0 구현의 안전한 첫 단계는
기존 Swing 판정을 재사용하면서 Targeted Attack만 추가하는 것이다.

## 3.5 상호작용

대상 프레임은 대상이 제공하는 행동을 문맥 목록으로 보여 준다.

예:

| 대상 | 가능한 행동 예 | 비고 |
|---|---|---|
| 적대 Actor | Observe, Attack | 공격 가능 관계여야 함 |
| 광맥 | Mine | 도구·거리 등 기존 조건 적용 |
| NPC | Talk | Talk가 설계되는 Cycle에서 추가 |
| 쓰러진 존재 | Loot | Loot가 설계되는 Cycle에서 추가 |

상호작용 키 `F`는 목록에서 현재 **Primary Interaction** 하나를 실행한다. 우선순위는 View가
추측하지 않고 World가 대상의 상태와 Actor의 관계를 근거로 제공한다. R0에 실제로 존재하는
행동만 목록에 싣는다. 아직 없는 Talk/Loot를 가짜 버튼으로 만들지 않는다.

공격은 전용 전투 입력을 유지하며 `F` 우선순위에 섞지 않는다. 실수로 대화하려다 공격하거나
공격하려다 채굴하는 것을 막기 위해서다.

# 4. 유효성과 수명

## 4.1 선택할 수 있는 대상

R0에서 다음을 만족하는 존재만 선택할 수 있다.

- 현재 관찰자의 Snapshot에 주소 지정 가능한 Entity로 투영되어 있다.
- 자기 자신이 아니다.
- 선택 금지 역할(장식, 보이지 않는 Trigger 등)이 아니다.

선택 가능함과 공격/상호작용 가능함은 다르다. 멀리 있는 적을 선택해 상태를 볼 수는 있어도
공격은 거리 때문에 실패할 수 있다.

## 4.2 유지

다음 변화만으로 타겟을 자동 해제하지 않는다.

- 공격/관찰 거리 밖으로 이동함
- 대상이 현재 화면 밖으로 나감
- 대상이 다른 행동을 시작함
- 대상 정보가 아직 가려져 있음

이때 대상 프레임은 유지하고 행동 불가 사유를 갱신한다. 그래야 플레이어가 왜 지금 공격할 수
없는지 이해할 수 있다.

## 4.3 자동 해제

다음 경우에는 World가 Current Target을 비운다.

- 대상 Entity가 세계에서 제거됨
- 관찰자의 몸이 세계를 떠남
- 대상이 더 이상 그 관찰자에게 주소 지정 가능한 존재가 아님
- 플레이어가 명시적으로 해제함

대상이 쓰러졌을 때는 즉시 해제하지 않는다. 쓰러진 상태 확인이나 이후 Loot 확장을 위해
프레임을 유지한다. 다만 적대 Actor Tab 순환에서는 제외한다.

# 5. Engine API와 Content 조립 설계

타겟팅을 전부 `content/`에만 구현하면 현재 `view-kernel`의 클릭 경로와
충돌한다. 지금 Engine Input은 Entity 클릭을 곧바로 "그 Entity를 대상으로 하는 첫
Interaction 실행"으로 해석한다. 타겟팅 이후의 클릭은 먼저 선택 요청이어야 하므로 Engine에
**입력 해석 정책을 주입하는 자리**가 필요하다.

반대로 `적대`, `Observe`, `Attack`, 공격 가능 거리 같은 의미를 Engine으로 올리면
`Design-System-Content-Separation`의 경계를 깨뜨린다. Engine API는 게임 명사 없이
"지목한 존재를 어떤 요청으로 바꿀지"와 "선택된 존재를 어떻게 강조해 그릴지"만 제공하고,
선택의 의미와 Rule은 Content가 소유한다.

## 5.1 변경 경계 요약

```text
Engine이 추가로 제공
  view-kernel/input       Entity/Ground 지목 → ActionRequest 변환 정책 주입
  view-kernel/scene       선택 강조와 대상 패널을 위한 범용 Render Directive
  renderer / hud          위 Directive를 그리는 기계장치

기존 Engine API 재사용
  ActionRequest           interactionId + targetEntityId 봉투 그대로 사용
  Interaction Registry    select-target / clear-target도 Content Handler로 등록
  State Generic           Content WorldState가 selections를 확장
  projectObserver         관찰자별 선택 결과를 컨텐츠 GameView로 투영

Content가 구현
  선택 상태와 선택 가능 조건
  select-target / clear-target Rule
  적대 관계, Tab 후보, 공격/관찰/채굴 가용성
  컨텐츠 GameView의 target 의미
  Target Frame 문구·색·행동 우선순위
```

`engine/protocol-core/actions.ts`에는 이미 `targetEntityId`가 있으므로 새 필드를 추가하지 않는다.
`CoreWorldState`와 코어 `GameViewSnapshot`에도 타겟 필드를 강제하지 않는다. 타겟 없는
세계도 계속 성립해야 하며, 컨텐츠 고유 Snapshot 의미는 기존 규약대로 컨텐츠 Protocol이
확장한다.

## 5.2 Engine View API — Pointer Intent Policy

현재 `attachInput`의 "클릭한 Entity의 첫 Interaction을 즉시 실행"하는 결정을 밖으로 뺀다.
Engine은 Picking까지만 하고, 무엇을 요청할지는 주입된 정책에 묻는다.

제안 파일: `engine/view-kernel/input/pointer-intent.ts`

```ts
import type { ActionRequest } from '../../protocol-core/actions';
import type { SceneState } from '../scene/scene-state';

export interface PointerIntentPolicy {
  entity(entityId: string, scene: SceneState): ActionRequest | null;
  ground(position: { x: number; z: number }, scene: SceneState): ActionRequest | null;
}

export const interactionPointerIntent: PointerIntentPolicy;
```

`attachInput`은 다음처럼 확장한다.

```ts
export function attachInput(
  renderer: GameRenderer,
  send: ActionSink,
  latestScene: () => SceneState,
  pointerIntent: PointerIntentPolicy = interactionPointerIntent,
): void;
```

기본값은 기존 동작을 그대로 구현한다. 따라서 기존 조립은 변경 없이 동작하고,
컨텐츠만 자신의 정책을 주입한다.

```ts
// content/view/pointer-intent.ts
export const POINTER_INTENT: PointerIntentPolicy = {
  entity: (entityId) => ({
    interactionId: 'select-target',
    targetEntityId: entityId,
  }),
  ground: (position, scene) => {
    // 빈 땅 클릭을 해제로 쓸지 이동으로 쓸지는 컨텐츠 결정이다.
    // R0 권장안은 이동을 보존하고 Esc만 clear-target으로 사용한다.
    const move = scene.interactions.find((entry) => entry.terrainTarget);
    return move ? { interactionId: move.id, position } : null;
  },
};
```

이 API가 필요한 이유는 Targeting 자체를 Engine에 넣기 위해서가 아니다. Pointer Picking이라는
기계장치가 Content의 행동을 하나로 확정해 버리지 않도록 **결정 지점을 되돌려 주기 위해서**다.

## 5.3 Engine View API — 범용 선택 표현

Engine Renderer와 HUD는 선택이 무엇을 뜻하는지 몰라도 다음 두 지시를 그릴 수 있어야 한다.

제안 파일: `engine/view-kernel/scene/scene-state.ts`

```ts
export interface SceneEntitySelection {
  entityId: string;
  emphasis: 'selected';
  color: number;
}

export interface SceneFocusPanel {
  title: string;
  subtitle?: string;
  meters: Array<{
    id: string;
    value: number;
    maximum: number;
    label: string;
  }>;
  lines: string[];
}

export interface SceneState {
  // 기존 필드...
  selection?: SceneEntitySelection;
  focusPanel?: SceneFocusPanel;
}
```

- Renderer는 `selection.entityId`의 그림에 외곽선/발밑 링을 그린다.
- HUD는 `focusPanel`의 제목, Meter, 이미 형식화된 줄을 그린다.
- `적대 = 빨강`, `HP`, `관찰하지 않음` 같은 결정은 Engine에 넣지 않는다.
- Content View가 관계색, Meter 내용, 문구를 확정한 뒤 범용 지시로 내보낸다.

처음부터 범용 Panel 시스템 전체를 만들 필요는 없다. T1은 `selection`과 생명 Meter 하나가 있는
작은 `focusPanel`만 구현하고, 두 번째 세계/패널이 실제로 요구될 때 일반화한다.

## 5.4 World 쪽은 Engine Kernel 변경 없이 조립한다

World Kernel은 이미 필요한 확장점을 제공한다. 선택도 몸이 세계 안에서 보내는 요청이므로
Interaction Registry를 그대로 사용한다.

```ts
// content/world/semantic/targeting.ts
export interface TargetSelectionState {
  observerId: string;
  targetEntityId: string;
}

export function selectedTarget(
  selections: readonly TargetSelectionState[],
  observerId: string,
): string | undefined;
```

```ts
// content/world/semantic/world-state.ts
export interface WorldState extends CoreWorldState {
  // 기존 컨텐츠 상태...
  targetSelections: TargetSelectionState[];
}
```

```ts
// content/world/rules/target-select.ts
export function ruleTargetSelect(
  state: WorldState,
  observerId: string,
  targetEntityId: string,
): ActionResult;

export function ruleTargetClear(
  state: WorldState,
  observerId: string,
): ActionResult;
```

Rule의 판정 순서는 고정한다.

```text
SelectTarget
  관찰자가 세계에 있는가?         → unknown-observer
  관찰자의 몸이 있는가?           → no-body
  Entity가 존재하는가?             → no-such-target
  자기 몸인가?                     → target-is-self
  이 관찰자에게 주소 지정 가능한가? → not-addressable
  선택 금지 Role인가?              → not-selectable
  그 외                            → observerId의 기존 선택을 교체

ClearTarget
  관찰자가 세계에 있는가?         → unknown-observer
  그 외                            → 선택이 없어도 성공 (멱등)
```

Interaction 등록은 기존 Registry에 두 항목만 더한다.

```ts
// content/world/actions/interactions.ts
{
  id: 'select-target',
  handle: (state, observerId, action) =>
    action.targetEntityId
      ? ruleTargetSelect(state, observerId, action.targetEntityId)
      : { status: 'failure', rule: DISPATCH, reason: 'missing-target' },
},
{
  id: 'clear-target',
  handle: (state, observerId) => ruleTargetClear(state, observerId),
},
```

`select-target`를 Engine Dispatch의 특별 분기로 만들지 않는다. Engine은 지금처럼
unknown observer와 unknown interaction만 판정하고, 주소 지정 가능성이나 선택 가능 Role은
컨텐츠 Rule이 판정한다.

## 5.5 Content Protocol API

컨텐츠 Protocol은 World가 확정한 현재 선택과 대상 문맥을 Snapshot에 추가한다.

제안 파일: `content/protocol/gameview.ts`

```ts
export interface TargetContextView {
  entityId: string;
  relation: 'hostile' | 'neutral' | 'friendly';
  validity: 'valid';
  distance: number;
  concealed: ConcealedCombatKey[];
  actions: Array<{
    id: string;
    available: boolean;
    reason?: string;
    primary?: boolean;
  }>;
}

export interface GameViewSnapshot extends CoreGameViewSnapshot {
  // 기존 컨텐츠 필드...
  target?: TargetContextView;
}
```

대상 이름·생명·행동 등 Entity 자체의 값은 `entities`와 중복 저장하지 않는다. `target.entityId`로
해당 Entity를 참조하고, Target에만 필요한 관계·거리·가용성·가림 문맥만 둔다. View Resolver가
Entity와 TargetContext를 합쳐 Target Frame을 만든다.

거리와 관계는 View가 Entity 좌표를 다시 계산해 만들지 않는다. 공격/상호작용 가용성에 영향을
주는 의미이므로 World Projection이 Rule과 같은 평가 함수를 사용해 투영한다.

## 5.6 Projection과 View 조립

`projectObserver`는 다음 순서로 선택 문맥을 만든다.

```text
selectedTarget(state, observerId)
    ↓ 없음
target 필드를 싣지 않음

    ↓ 있음
Entity 존재 / addressable 재확인
    ↓ 무효
선택 정리 시스템이 다음 Tick에 제거하고 이번 Snapshot에는 싣지 않음

    ↓ 유효
기존 Entity Projection 재사용
Acquaintance + Insight로 concealed 계산
evaluateObserveBegin / evaluateTargetedAttack / Interaction 평가
    ↓
TargetContextView 투영
```

Content View는 컨텐츠의 의미를 Engine의 범용 Scene 지시로 결정한다.

```ts
// content/view/resolve-target.ts
export function resolveTarget(
  snapshot: GameViewSnapshot,
): Pick<SceneState, 'selection' | 'focusPanel'>;
```

```text
relation=hostile  → 관계색 빨강 + "적대"
relation=neutral  → 관계색 노랑 + "중립"
relation=friendly → 관계색 초록 + "우호"
concealed         → codeText를 거친 "관찰하지 않음"
actions           → 컨텐츠 interaction-presentation의 키·프롬프트
```

조립 경로는 다음 하나로 닫는다.

```text
World State.targetSelections
  → projectObserver
  → 컨텐츠 GameView.target
  → resolveTarget (컨텐츠 결정)
  → SceneState.selection / focusPanel
  → Engine Renderer / HUD
```

## 5.7 Content에서 공격과 상호작용이 사용하는 API

행동 Rule은 Client가 요청에 다시 실어 보낸 임의 Target보다 World의 CurrentTarget을 먼저
기준으로 삼는다. 요청에 Target ID도 실을 경우에는 둘이 같은지 확인해 오래된 화면/조작 요청을
거절한다.

```ts
export function requireCurrentTarget(
  state: WorldState,
  observerId: string,
  requestedTargetId?: string,
): { actor: ActorState; target: EntityState } | TargetFailure;
```

```text
선택 없음                       → no-target-selected
요청 target과 현재 선택이 다름  → stale-target
선택 대상이 사라짐              → no-such-target
그 외                           → 주체와 대상 반환
```

사용 예:

```ts
// observe
const context = requireCurrentTarget(state, observerId, action.targetEntityId);
if (isFailure(context)) return context.result;
return ruleObserveBegin(state, observerId, context.target.id);

// mine
const context = requireCurrentTarget(state, observerId, action.targetEntityId);
if (isFailure(context)) return context.result;
return ruleMine(state, context.actor, context.target.id);

// targeted attack
const context = requireCurrentTarget(state, observerId, action.targetEntityId);
if (isFailure(context)) return context.result;
return ruleTargetedSkillBegin(state, context.actor, context.target, 'attack');
```

`stale-target`가 필요한 이유는 선택 A를 본 화면에서 공격을 보낸 직후, 선택 B 요청이 먼저
처리되는 경우다. World가 단순히 최신 CurrentTarget B를 공격하면 플레이어가 누른 대상과 다른
대상을 공격한다. `targetEntityId`를 요청의 기대값으로 함께 보내면 World가 이 경쟁을 명시적으로
거절할 수 있다.

## 5.8 타겟 수명 시스템

대상 제거 시 정리는 컨텐츠의 `systems` 배열에 명시적으로 등록한다.

```ts
export const systems: readonly WorldSystem<WorldState>[] = [
  // 기존 순서...
  pruneInvalidTargetSelections,
  // action progress / NPC / collision 등 기존 순서...
];
```

정리 시스템은 "Entity가 존재하는가 / 이 관찰자에게 계속 주소 지정 가능한가"만 본다. 거리,
화면 밖, Downed는 해제 조건이 아니므로 읽지 않는다. 정확한 시스템 순서는 그 Cycle 의 `02-world.md` 에서
기존 시스템 배열과 함께 확정한다.

## 5.9 무엇을 Engine으로 올리지 않는가

프로젝트의 승격 규칙(rule of two)에 따라 다음은 `content/` 에 먼저 둔다.

- `TargetSelectionState` 저장 구조와 선택 Rule
- `requireCurrentTarget`, Tab 후보 정렬, 적대 관계 판정
- TargetContextView와 Target Frame 내용
- 대상 공격의 거리/Facing/Collider 연결

두 번째 세계가 동일한 선택 장부와 수명 규칙을 실제로 요구할 때만
`engine/world-kernel/selection.ts` 같은 순수 라이브러리 승격을 검토한다. 그때도 Engine은
Entity 목록을 직접 알지 않고 Content가 `isAddressable(observerId, entityId)` 판정을 주입하는
형태여야 한다.

# 6. World / View 책임

## 6.1 World Authority

World가 소유한다.

```text
관찰자별 CurrentTarget
선택 요청의 유효성
Targeted Action이 실제로 참조한 targetEntityId
관계·거리·상태·접촉에 따른 성공/실패
대상별 가능한 Interaction 목록과 불가 사유
타겟 자동 해제
관찰 가능한 대상 정보
```

Client가 보낸 Target ID는 요청일 뿐이다. World가 선택 가능한지 판정하고 성공한 선택만
상태로 남긴다. 다른 플레이어의 보이지 않는 Entity ID를 조작해 보내도 선택하거나 공격할 수
없어야 한다.

## 6.2 View Responsibility

View가 소유한다.

```text
클릭 Picking과 Tab/Esc 입력
현재 타겟 외곽선 / 발밑 링
대상 프레임의 배치와 표현
World가 준 Interaction의 키 바인딩과 프롬프트
실패 사유의 읽기 쉬운 문구
선택 요청 응답 전의 짧은 시각 피드백
```

View는 가장 가까운 적을 자체적으로 공격 대상으로 확정하거나, 거리·관계만 보고 공격 성공을
예측하지 않는다. World의 선택 상태와 가용성 판정을 표시한다.

# 7. 관찰 계약 초안

GameView에는 관찰자별로 다음 의미가 필요하다. 필드명은 그 Cycle 의 `04-gameview.md` 에서 확정한다.

```yaml
target:
  entityId: rabbit-1
  relation: hostile
  validity: valid
  distance: 3.2

  concealed:
    - combatStats

  actions:
    attack:
      available: true
      failureReason: null
    observe:
      available: true
      failureReason: null
    primaryInteraction: observe
```

선택 실패와 행동 실패도 기존 ActionResult 규율을 따른다.

```text
SelectTarget 실패     no-such-target | not-addressable | target-is-self
TargetedAttack 실패   no-target-selected | no-such-target | out-of-range |
                      target-downed | invalid-hostile-target | action-busy
ContextAction 실패    no-target-selected | no-available-interaction |
                      각 기존 Interaction의 실패 사유
```

# 8. 입력과 화면의 최소안

```text
화면 중앙/월드
  선택 대상: 얇은 흰색 또는 관계색 외곽선 + 발밑 링

상단 중앙 Target Frame
  [이름 / 종류] [관계]
  [HP]
  [현재 행동]
  [거리]
  [알려진 방어 형태 또는 '관찰하지 않음']

프롬프트
  F: 살펴보기       (Primary Interaction이 Observe일 때)
  1: 기본 공격      (가능/불가와 사유 표시)
  Esc: 대상 해제
```

색만으로 관계를 전달하지 않는다. `적대`, `중립`, `우호` 텍스트/아이콘을 함께 사용한다.
가려진 정보와 0인 수치를 같은 모양으로 표현하지 않는다.

# 9. 결정론과 플레이어 인과

같은 Snapshot과 같은 입력이라면 같은 대상이 선택되어야 한다.

- Tab 후보 정렬에 명시적 Tie-breaker를 둔다.
- 공격 대상은 World가 승인한 Current Target이다.
- 공격 성공은 기존 거리/상태/Collider 규칙으로 설명된다.
- 타겟 선택은 피해 보정이나 명중 확률을 만들지 않는다.
- 실패는 항상 기계 판정 사유로 관찰할 수 있다.

플레이어는 결과를 다음처럼 설명할 수 있어야 한다.

> “늑대를 선택했고, 가까이 가서 공격했으며, 공격 시작 때 늑대 쪽을 향했지만 휘두르는 동안
> 늑대가 빠져나가서 맞지 않았다.”

이는 “타겟했으니 자동으로 맞았다”보다 현재의 물리 전투 인과를 보존한다.

# 10. R0에서 하지 않을 것

- 자동 추적 이동, 자동 사거리 진입, 자동 길찾기
- 공격 중 목표를 따라 도는 Lock-on Camera
- Soft Target / Mouseover Cast / Focus Target
- 파티·공격대 타겟 공유, 징표, Target-of-Target
- 위협도(Threat), 어그로, 전투 상태 진입
- 시야 차폐와 은신/탐지의 완전한 규칙
- 아군 치유·버프 타겟 규칙
- 광역기, 지면 지정기, 투사체의 별도 타겟 정책
- NPC 대화, Loot 등 아직 존재하지 않는 상호작용의 구현
- 타겟 선택에 따른 Damage/Accuracy/Critical 보너스

이 항목들은 Current Target의 필요조건이 아니라 이후 각 Capability가 생길 때 연결할 확장이다.

# 11. 구현 Cycle 분할 제안

한 Cycle에 선택·UI·공격 변경·모든 상호작용을 한꺼번에 넣지 않는다.

## Cycle T1 — 선택하고 계속 본다

```text
Select / Clear Target
관찰자별 CurrentTarget
대상 링과 Target Frame
공개·가림·Insight 정보를 기존 규칙대로 표시
대상 소멸 시 자동 해제
```

플레이 결과: “내가 선택한 상대의 현재 상태가 계속 보인다.”

## Cycle T2 — 선택한 대상을 관찰하고 상호작용한다

```text
Observe가 CurrentTarget을 기본 대상으로 사용
대상별 Interaction 목록
Primary Interaction + F 입력
기존 Mine을 같은 문맥으로 연결
```

플레이 결과: “보고 있는 바로 그 대상에게 살펴보기/채굴을 실행한다.”

## Cycle T3 — 선택한 대상을 공격한다

```text
Targeted Attack
거리·관계·쓰러짐 가용성
공격 시작 Facing 고정
기존 Swing Collider와 피해 공식을 재사용
실패 사유 및 Free Swing 회귀 검증
```

플레이 결과: “선택한 적에게 공격 의도를 두되, 실제 접촉해야 피해를 준다.”

Tab 순환은 T1에 함께 넣기보다 클릭 선택이 닫힌 뒤 별도 작은 Delta로 추가해도 된다.

# 12. 수용 기준

R0 전체가 닫혔다고 판단하려면 다음이 실제 플레이와 검증에서 성립해야 한다.

1. 두 관찰자가 같은 세계에서 서로 다른 Current Target을 가질 수 있다.
2. 선택한 대상 프레임이 대상의 현재 생명·행동·거리 변화에 맞춰 갱신된다.
3. 관찰하지 않은 상대의 살펴봄 정보는 타겟했다고 열리지 않는다.
4. Current Target으로 Observe를 완료하면 기존 Acquaintance/Insight 규칙대로 정보가 열린다.
5. 타겟이 없거나, 사거리 밖이거나, 공격 불가능한 대상을 공격하면 정확한 사유로 실패한다.
6. 유효한 타겟을 공격해도 Collider가 닿지 않으면 피해가 발생하지 않는다.
7. 접촉하면 전투 사다리(기본 공식 ~ Aura/Nen 층)의 피해·방어·관통·치명타 계산이 같은 값으로 실행된다.
8. 광맥을 선택하고 Primary Interaction을 실행하면 기존 Mine 규칙이 동작한다.
9. 멀어지거나 화면 밖으로 나간 것만으로 타겟이 풀리지 않으며 불가 사유가 갱신된다.
10. 대상이 세계에서 제거되면 타겟과 대상 프레임이 함께 정리된다.
11. 조작된 Entity ID로 보이지 않는 대상을 선택하거나 공격할 수 없다.
12. 기존 Free Swing을 유지하는 동안 그 경로의 플레이와 계산이 회귀하지 않는다.

# 13. 검토가 필요한 결정

Cycle로 올리기 전에 Human이 다음 세 가지를 선택하면 된다.

1. **기본 공격에 타겟을 필수로 할 것인가?**  
   권장: R0에서는 Targeted Attack을 추가하고 기존 Free Swing을 유지한 뒤 플레이로 결정한다.

2. **공격 시작 시 자동으로 Facing을 맞출 것인가?**  
   권장: 시작 순간 한 번만 맞춘다. 자동 추적은 하지 않는다.

3. **쓰러진 대상을 유지할 것인가?**  
   권장: 유지한다. 상태 관찰과 이후 Loot 확장에 유리하며, Tab 후보에서만 제외한다.

4. **빈 땅 클릭으로 타겟을 해제할 것인가?**
   권장: 현재 클릭 이동을 보존하기 위해 빈 땅은 이동, `Esc`는 해제로 분리한다.

# 14. 요약

```text
Targeting R0

선택은 관찰자별로 유지되는 의도 관계다.
선택만으로 정보·피해·명중·어그로는 생기지 않는다.
대상 프레임은 World가 허용한 현재 정보를 계속 보여 준다.
Observe와 상호작용은 같은 CurrentTarget을 사용한다.
공격은 대상을 향하지만 기존 Collider가 실제 명중을 결정한다.
자동 이동과 자동 추적은 하지 않는다.
World가 선택·가용성·성공을 판정하고 View는 그것을 표현한다.
```
