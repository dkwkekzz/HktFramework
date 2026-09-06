// Observer Projection — WorldState 를 관찰자 한 사람의 Semantic Snapshot 으로 투영한다.
// VIEW-MULTI-OBSERVER-001 (GameView Specification) 이 계약이다.
//
// 관찰 결과는 관찰자마다 만들어진다 (INTENT-PER-OBSERVER-PROJECTION-001).
//   세계의 사실(누가 어디 있고 무엇을 하는가)은 모든 관찰자에게 같고,
//   "어느 것이 내 몸인가"와 "나만의 것"(가용성 · 소지품)은 관찰자마다 다르다.
//
// 의미만 투영한다 — role/state/값/사유 코드. 표현(sprite·모션 파일·크기·라벨 형식·문구)은
// View 의 Presentation 결정 Layer 책임이며 여기 싣지 않는다.
//
// C001 CHANGED (02-world R6) — 관찰은 방으로 잘린다. scene = 관찰자의 몸이 선 Region 의 id 이고,
// 존재는 같은 Region 의 몸·원천(C011) + 그 Region 의 anchor 마다 region-exit 하나다. 목적지 Region 의 이름 ·
// Connector 의 방향 · 다른 방의 존재 · Graph 전체는 싣지 않는다 — "목적지는 건너야 안다".

import type {
  EntityView,
  GameViewSnapshot,
  InteractionView,
  RegionStateView,
} from '../../protocol/gameview';
import { actionProgress, actionTargetId } from '../semantic/action';
import { actionCollider } from '../semantic/collision';
import { evaluateAttributeSetAvailability } from '../rules/attribute-set';
import { evaluateEmergencyReturnAvailability } from '../rules/emergency-return';
import { evaluateMinePreconditions } from '../rules/mine';
import { evaluateMoveAvailability } from '../rules/move';
import { evaluateMoveModeRun } from '../rules/move-mode';
import { evaluateSkillPreconditions } from '../rules/skill';
import { evaluateTransitPreconditions } from '../rules/transit';
import { actorModifiers, isDowned, skillDefinition } from '../semantic/combat';
import { projectCommandCatalog } from '../semantic/command-catalog';
import { hasMiningTool, itemCount } from '../semantic/inventory';
import type { ItemKind } from '../semantic/item';
import {
  sourceConditions,
  sourcePositionOf,
  sourceStateOf,
  sourcesInRegion,
} from '../semantic/resource';
import {
  anchorPosition,
  isConnectorOpen,
  regionExitsOf,
  regionHash,
  regionSpecOf,
} from '../semantic/region';
import { regionRuleOf } from '../semantic/region-state';
// 재료 표는 content/regions 의 것이다 — HUD 의 자리 순서를 그 표가 정한다 (C011).
import { MATERIAL_SEEDS } from '../../regions';
import { conditionTagsAt } from '../semantic/terrain';
import {
  actorOfObserver,
  findObserver,
  isAttended,
  presentObserverCount,
  type WorldState,
} from '../semantic/world-state';

export const SPEC_ID = 'VIEW-BASIC-COMBAT-POLICY-001';

// 관찰자가 세계에 없으면 관찰 결과도 없다 — 세계는 모르는 이에게 자신을 보여주지 않는다.
export function projectObserverView(
  state: WorldState,
  observerId: string,
): GameViewSnapshot | null {
  const observer = findObserver(state, observerId);
  const self = actorOfObserver(state, observerId);
  if (!observer || !self) return null;

  const entities: EntityView[] = [];
  const interactions: InteractionView[] = [];

  const region = regionSpecOf(self.regionId);

  // entities.character — 같은 Region 의 모든 Actor 를 같은 계약으로 투영한다 (cardinality: many).
  // role 만 보는 이에 따라 달라진다. 다른 방의 몸은 실리지 않는다 (C001 R6).
  for (const actor of state.actors) {
    if (actor.regionId !== self.regionId) continue;
    const progress = actionProgress(actor.currentAction);
    const target = actionTargetId(actor.currentAction);
    const isSelf = actor.id === self.id;
    const isOtherPlayer = !isSelf && actor.control === 'player';
    // Collision.ActionColliders — attack 진행 중에만 존재하는 파생 상태
    const swing = actionCollider(actor);
    // 모든 Actor 의 모든 속성을 싣는다. 가리는 경계를 두지 않는다
    // (INTENT-ATTRIBUTE-OBSERVE-001). 늘 화면에 띄울지는 View 의 선택이다.
    const modifiers = actorModifiers(actor);

    entities.push({
      id: actor.id,
      role: isSelf
        ? 'player-character'
        : actor.control === 'player'
          ? 'other-player-character'
          : 'npc-character',
      state: actor.currentAction.kind, // idle | move | attack | heavy-attack | mine | hit | downed
      name: actor.name, // 불러 줄 이름
      kind: actor.characterKind,
      position: { x: actor.position.x, z: actor.position.z },
      vitality: {
        health: actor.hp,
        healthMaximum: actor.hpMax,
        downed: isDowned(actor),
      },
      attributes: {
        energy: actor.cp,
        energyMaximum: actor.cpMax,
        moveMode: actor.moveMode,
        control: actor.control,
        tempoStats: {
          moveSpeed: actor.moveSpeed,
          runSpeedMultiplier: actor.runSpeedMultiplier,
          actionSpeed: actor.actionSpeed,
        },
        modifiers: {
          energyCharge: modifiers.cpCharge,
          energyConsume: modifiers.cpConsume,
          moveSpeed: modifiers.moveSpeed,
          actionSpeed: modifiers.actionSpeed,
        },
      },
      ...(progress !== null ? { progress } : {}),
      ...(target ? { targetEntityId: target } : {}),
      // Character.Attended — 다른 관찰자의 몸에만 의미가 있다.
      // 거짓이면 그 사람은 떠났고 몸만 세계에 남은 것이다 (INTENT-OBSERVER-LEAVE-001).
      ...(isOtherPlayer ? { attended: isAttended(state, actor.id) } : {}),
      // Collision.Bodies — 충돌체 관찰은 언제나 제공된다 (INTENT-COLLISION-OBSERVE-001).
      // 보일지 말지는 관찰자(View)의 선택이다.
      body: {
        radius: actor.bodyRadius,
        height: actor.bodyHeight,
        mass: actor.bodyMass,
        facing: { x: actor.facing.x, z: actor.facing.z },
        velocity: { x: actor.velocity.x, z: actor.velocity.z },
      },
      ...(swing
        ? {
            swing: {
              center: { x: swing.center.x, z: swing.center.z },
              radius: swing.radius,
              active: swing.active,
              struck: [...(actor.currentAction.struckActorIds ?? [])],
            },
          }
        : {}),
    });
  }

  // interactions — 모두 관찰자 자신의 몸을 주체로 판정된다 (interactions.subject: observer-character)
  const moveFailure = evaluateMoveAvailability(self);
  interactions.push({
    id: 'move',
    role: 'move-to',
    available: moveFailure === null,
    ...(moveFailure ? { reason: moveFailure } : {}),
  });

  // interactions.attack / skill-heavy — 대상이 없다. 무엇이 맞을지는
  // 요청할 때가 아니라 휘두름 구간의 접촉이 정한다.
  // profile(damage/charge/cost)이 함께 나간다 — 쓰기 전에 무엇이 오갈지 알아야
  // "지금 고급 스킬을 쓸 것인가" 를 판단할 수 있다 (INTENT-SELF-OBSERVE-001).
  const basicFailure = evaluateSkillPreconditions(self, 'attack');
  const basic = skillDefinition('attack');
  interactions.push({
    id: 'attack',
    role: 'skill-basic',
    available: basicFailure === null,
    ...(basicFailure ? { reason: basicFailure } : {}),
    profile: { damage: basic.damage, charge: basic.cpCharge, cost: basic.cpCost },
  });

  const heavyFailure = evaluateSkillPreconditions(self, 'heavy-attack');
  const heavy = skillDefinition('heavy-attack');
  interactions.push({
    id: 'skill-heavy',
    role: 'skill-heavy',
    available: heavyFailure === null,
    ...(heavyFailure ? { reason: heavyFailure } : {}),
    profile: { damage: heavy.damage, charge: heavy.cpCharge, cost: heavy.cpCost },
  });

  // interactions.moveMode — 지금 달릴 수 있는가. 걷기로 돌아오는 것은 언제나 된다.
  const runFailure = evaluateMoveModeRun(self);
  interactions.push({
    id: 'move-mode',
    role: 'set-move-mode',
    available: runFailure === null,
    ...(runFailure ? { reason: runFailure } : {}),
  });

  // interactions.setAttribute — 세계가 권한을 닫아 두면 가용하지 않다.
  const attributeFailure = evaluateAttributeSetAvailability(state);
  interactions.push({
    id: 'set-attribute',
    role: 'debug-set-attribute',
    available: attributeFailure === null,
    ...(attributeFailure ? { reason: attributeFailure } : {}),
  });

  // interactions.emergencyReturn — 그 방이 비상 자리를 밝혀 두었는가 (C009 ADDED · 01-spec R3).
  // 같은 판정이 commands 자리에도 실린다 (아래 projectCommandCatalog) — set-attribute 의 선례 그대로.
  // 어느 자리로 가는지는 싣지 않는다: 세계는 "걸 수 있는가" 만 말한다.
  const emergencyFailure = evaluateEmergencyReturnAvailability(self);
  interactions.push({
    id: 'emergency-return',
    role: 'emergency-return',
    available: emergencyFailure === null,
    ...(emergencyFailure ? { reason: emergencyFailure } : {}),
  });

  // entities.resource-source + interactions.mine — 그 방이 낳는 원천만 (C011 CHANGED · R5).
  //
  // RULE-OBSERVE-PROJECTION (C013 AFFECTED · spec R8) — state 가 셋이 되고(available ·
  // depleted · recovering), 자리는 **지금 마디**이며, 마디를 여럿 가진 원천에는 siteIndex 가,
  // 무너진 것이 있는 원천에는 collapsedSites 가 함께 실린다. 관찰은 여전히 방으로 잘린다.
  //
  // 광맥이 있던 자리에 원천이 온다. 다른 방의 원천은 실리지 않는다 — 목록 자체가 방으로
  // 잘려 나온다 (sourcesInRegion). 원천은 State 가 아니라 데이터에서 유도된 사실이므로
  // 매 관찰마다 같은 목록이 같은 순서로 나온다 (결정론).
  for (const source of sourcesInRegion(self.regionId)) {
    // 그 원천에 지금 걸린 조건들 (C012 ADDED · RULE-SOURCE-CONDITION-001).
    // 걸린 것이 없으면 **자리 자체가 없다** — 빈 배열로 지어내지 않는다.
    const conditions = sourceConditions(state.regionStates, source);
    const sourceState = sourceStateOf(state.regionStates, self.regionId, source.id);
    // C013 ADDED — 지금 선 자리. 원천이 마디를 옮겨 다니므로 데이터의 마디 0 이 아니다.
    const here = sourcePositionOf(state.regionStates, source);
    const collapsedSites = sourceState.collapsedSites;

    entities.push({
      id: source.id,
      role: 'resource-source',
      // C012 CHANGED · C013 CHANGED — 캐고 난 자국과 되돌아옴이 여기 실린다. 셋 중 하나다
      // (available · depleted · recovering). taken 도 harvests 도 progress 도
      // recoverySeconds 도 싣지 않는다: 세계는 "지금 캘 수 있는가" 만 말하고 몇 번 남았는지도
      // **언제 돌아오는지도** 말하지 않는다 (spec Observable — 예보는 흙과 그림이 말한다).
      state: sourceState.phase,
      // kind 는 자연 형태(무엇처럼 생겼는가), material 은 그것이 무엇인가다 (SPEC-002).
      kind: source.form,
      material: source.materialId,
      position: { x: here.x, z: here.z },
      ...(conditions.length > 0 ? { conditions } : {}),
      // C013 ADDED — 마디를 여럿 가진 원천에만 지금 마디 번호를, 무너진 것이 있는 원천에만
      // 무너진 마디들을 싣는다. 없으면 **자리 자체가 없다** (0 이나 빈 배열로 지어내지 않는다).
      // 마디 목록도 그 좌표도 싣지 않는다 — 관찰자가 자기 content/regions 의 뿌리 곡선에서
      // 번호로 얻는다 (땅 · 흔적 · 붕괴를 스스로 얻는 C005~C007 · C011 · C012 의 규율 그대로).
      ...(source.sites.length > 1 ? { siteIndex: sourceState.siteIndex } : {}),
      ...(collapsedSites && collapsedSites.length > 0
        ? { collapsedSites: [...collapsedSites] }
        : {}),
      // labelValue 를 싣지 않는다 — 세계 위에 글자가 없다 (C026 R4 RULE-QUIET-GROUND-001).
      // 되돌아오는 중인 자리에도 글자는 없다 (C013 R9) — 예보는 흙과 그림이 말하고,
      // 이름과 사유는 물었을 때 판이 답한다.
      // 무엇이 무엇에 매달렸는지 · 붕괴 자리의 모양 · 흔적의 세기도 싣지 않는다: 관찰자가
      // 자기 content/regions 와 실려 온 phase 로 스스로 얻는다 (spec Observable).
    });

    const failure = evaluateMinePreconditions(state, self, source);
    interactions.push({
      id: 'mine',
      role: 'harvest-source',
      targetEntityId: source.id,
      available: failure === null,
      ...(failure ? { reason: failure } : {}),
    });
  }

  // entities.region-exit + interactions.transit — 이 Region 의 anchor 마다 하나 (C001 R6).
  // id 는 Connector 의 id, kind 는 transition. 건너간 뒤의 Region 은 어디에도 실리지 않는다.
  // exitsOf 의 순서(connectors 배열 순서) 그대로 낸다 (결정론).
  //
  // C002 CHANGED (02-world R2) — state 가 열림과 닫힘으로 갈린다. 여기까지가 표식이다.
  //
  // C009 CHANGED — 그 표식이 이제 **그 방의 지금 패턴 따라 바뀐다** (01-spec R1 · Observable).
  // 몸이 아무것도 하지 않아도 바뀌는 값이다 — 활성은 몸이 아니라 방의 State 가 정한다.
  // 어느 패턴이 그 문을 여는가는 여전히 싣지 않는다: 세계는 "지금 열렸는가" 만 말하고
  // "무엇이 그것을 열었는가" 는 말하지 않는다 (01-spec Observable · Region §17).
  // 싣지 않는 것: 경계(frontier) 목록 · 닫힌 Connector 목록 · 건너간 뒤 Region 의 id/이름 ·
  // Connector 의 방향. "아직 없는 곳" 은 표식이 아니라 요청의 대답(reason)으로만 드러난다 —
  // 경계를 가리키는 출구도 state 는 open 이다 (01-spec SPEC-007 경계).
  for (const exit of regionExitsOf(self.regionId)) {
    const here = anchorPosition(exit.here.region, exit.here.anchor);
    entities.push({
      id: exit.connector.id,
      role: 'region-exit',
      state: isConnectorOpen(state.regionStates, exit.connector.id) ? 'open' : 'locked',
      kind: exit.connector.transition,
      position: { x: here.x, z: here.z },
    });

    const failure = evaluateTransitPreconditions(state, self, exit);
    interactions.push({
      id: 'transit',
      role: 'transit-connector',
      targetEntityId: exit.connector.id,
      available: failure === null,
      ...(failure ? { reason: failure } : {}),
    });
  }

  const selfProgress = actionProgress(self.currentAction);
  const selfModifiers = actorModifiers(self);

  // 그 방이 규칙을 품고 있으면 그 방의 State 를 싣는다 (C008 R1 Feedback · SPEC-007).
  // 규칙 없는 방에서는 자리 자체가 없다 — 0 으로 지어내지 않는다 (SPEC-007 경계).
  // 임계값(pressureLimit)을 함께 싣는 것은 "얼마나 찼는가" 를 View 가 재기 위해서다.
  // 패턴 표는 싣지 않는다 — 관찰자가 자기 content/regions 에서 읽는다.
  const regionRule = regionRuleOf(self.regionId);
  // C012 CHANGED — 방의 State 가 규칙과 원천을 함께 든다. 여기가 싣는 것은 규칙 쪽뿐이다.
  const regionRuleState = state.regionStates[self.regionId]?.rule;
  const regionStateView: RegionStateView | undefined =
    regionRule && regionRuleState
      ? {
          pattern: regionRuleState.pattern,
          pressure: regionRuleState.pressure,
          pressureLimit: regionRule.pressureLimit,
          ...(regionRuleState.rearrangedAt === undefined
            ? {}
            : { rearrangedAt: regionRuleState.rearrangedAt }),
        }
      : undefined;

  return {
    specId: SPEC_ID,
    scene: self.regionId, // C001 — 관찰자의 몸이 선 Region
    // observer.self — 화면 속 여러 몸 중 어느 것이 내 것인지 알려면 이것이 필요하다.
    // acknowledgedMark — 세계가 나에게서 어디까지 받았는가.
    // 이것만이 세계가 이어짐에 대해 알려주는 값이다. 나머지 수치는 관찰자가 잰다.
    observer: {
      id: observerId,
      characterId: self.id,
      acknowledgedMark: observer.acknowledgedMark,
    },
    entities,
    interactions,
    hud: [
      // 내 몸의 것만 실린다. 다른 관찰자의 소지품과 가용성은 실리지 않는다
      // (INTENT-PER-OBSERVER-PROJECTION-001).
      // 지닌 재료마다 자리 하나 (C011 CHANGED · SPEC-010). **0 인 재료의 자리는 없다** —
      // 0 으로 지어내면 "세지 않은 것" 과 "없는 것" 을 화면이 가르지 못한다.
      // 순서는 MATERIAL_SEEDS 의 순서 그대로다 (결정론).
      ...MATERIAL_SEEDS.flatMap((seed) => {
        const count = itemCount(self.inventory, seed.id as ItemKind);
        return count > 0
          ? [{ id: `inventory.${seed.id}`, kind: 'counter' as const, value: count }]
          : [];
      }),
      { id: 'tool.hasMiningTool', kind: 'flag', value: hasMiningTool(self.inventory) },
      {
        id: 'player.action',
        kind: 'label',
        value: self.currentAction.kind,
        ...(selfProgress !== null ? { progress: selfProgress } : {}),
      },
      // World.Time — 세계가 자기 시계로 어디까지 왔는가.
      { id: 'world.time', kind: 'counter', value: state.time },
      // Observers.PresentCount — 지금 이 세계를 함께 보고 있는 사람의 수 (나 포함).
      // 누가 있는지(이름)는 실리지 않는다 — 이번 Cycle 의 의미가 아니다.
      { id: 'observers.present', kind: 'counter', value: presentObserverCount(state) },
      // hud.self — 같은 값을 남에 대해서도 볼 수 있다 (entities[].attributes).
      // 여기가 특별한 것은 "늘 눈앞에 있다" 는 점뿐이다.
      { id: 'self.hp', kind: 'counter', value: self.hp },
      { id: 'self.hpMax', kind: 'counter', value: self.hpMax },
      { id: 'self.cp', kind: 'counter', value: self.cp },
      { id: 'self.cpMax', kind: 'counter', value: self.cpMax },
      { id: 'self.downed', kind: 'flag', value: isDowned(self) },
      { id: 'self.moveMode', kind: 'label', value: self.moveMode },
      { id: 'self.tempo.moveSpeed', kind: 'counter', value: self.moveSpeed },
      { id: 'self.tempo.runSpeedMultiplier', kind: 'counter', value: self.runSpeedMultiplier },
      { id: 'self.tempo.actionSpeed', kind: 'counter', value: self.actionSpeed },
      { id: 'self.modifier.cpCharge', kind: 'counter', value: selfModifiers.cpCharge },
      { id: 'self.modifier.cpConsume', kind: 'counter', value: selfModifiers.cpConsume },
      { id: 'self.modifier.moveSpeed', kind: 'counter', value: selfModifiers.moveSpeed },
      { id: 'self.modifier.actionSpeed', kind: 'counter', value: selfModifiers.actionSpeed },
      // Region.depth — 깊이 태그만 준다. 문구(방 이름 · "문명의 경계를 넘었다")는 View 의 표가 정한다 (C001 R6).
      { id: 'region.depth', kind: 'label', value: region.depth },
    ],
    // 관찰자의 몸이 선 Region — hash 는 Description 에서 결정적으로 나온다 (C001 R6).
    region: {
      id: self.regionId,
      hash: regionHash(self.regionId),
      ...(regionStateView ? { state: regionStateView } : {}),
    },
    // RULE-SAFEBY-001 (C006 R4) — 몸이 선 자리에 걸린 안전의 조건들.
    // 매 관찰마다 그 방의 땅에서 유도된다 — 세계 State 에는 없다. 아무 area 에도 들지 않았으면
    // 빈 배열이고, 겹쳐 있으면 걸린 것이 전부 실린다. 이것은 hud 가 아니라 봉투의 새 자리다.
    standingConditions: conditionTagsAt(self.regionId, self.position),
    // World.StrikeEvents — 남의 타격 결과도 보인다. 세계가 판정을 마친 값이다.
    strikes: state.strikeEvents.map((event) => ({
      attackerId: event.attackerId,
      targetId: event.targetId,
      skill: event.skill,
      amount: event.amount,
      at: { x: event.position.x, z: event.position.z },
      since: event.time,
    })),
    // World.DebugAuthority — 이 세계가 조작을 허용하는가.
    debug: {
      open: state.debugAuthority.open,
    },
    // World.CommandCatalog — 세계 밖에서 무엇을 걸 수 있는지 세계가 밝힌다.
    // 늘 실린다: 걸 수 있는 것은 언제나 먼저 밝혀져 있어야 하고 (INTENT-COMMAND-CATALOG-001),
    // available 이 거짓이어도 무엇을 할 수 있는 세계인지는 알 수 있어야 한다.
    // 무엇을 어디까지 바꿀 수 있는지(구 mutableAttributes)는 set-attribute 가 받는
    // 값의 Domain 으로 이 안에 들어 있다 — View 가 목록을 만들지 않는다는 규율은 그대로다.
    // C009 CHANGED — 명령이 둘이 되었고 가용성 판정도 둘이다. 판정 자체는 각 Rule 이 소유하고
    // (evaluateAttributeSetAvailability · evaluateEmergencyReturnAvailability) 여기는 잇기만 한다 —
    // 그래서 "가용하다고 밝혀 놓고 걸면 거절하는" 일이 생기지 않는다.
    // 목록은 둘 다 늘 실린다: available 이 거짓이어도 무엇을 걸 수 있는 세계인지는 밝혀져 있다.
    commands: projectCommandCatalog((commandId) => {
      if (commandId === 'set-attribute') return evaluateAttributeSetAvailability(state);
      if (commandId === 'emergency-return') return evaluateEmergencyReturnAvailability(self);
      return null;
    }),
  };
}
