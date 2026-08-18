// Observer Projection — WorldState 를 관찰자 한 사람의 Semantic Snapshot 으로 투영한다.
// VIEW-MULTI-OBSERVER-001 (cycles/C004-multi-observer/04-gameview.spec.yaml) 이 계약이다.
//
// C004 CHANGED — 관찰 결과는 관찰자마다 만들어진다 (INTENT-PER-OBSERVER-PROJECTION-001).
//   세계의 사실(누가 어디 있고 무엇을 하는가)은 모든 관찰자에게 같고,
//   "어느 것이 내 몸인가"와 "나만의 것"(가용성 · 소지품)은 관찰자마다 다르다.
//
// 의미만 투영한다 — role/state/값/사유 코드. 표현(sprite·모션 파일·크기·라벨 형식·문구)은
// View 의 Presentation 결정 Layer 책임이며 여기 싣지 않는다.

import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { actionProgress, actionTargetId } from '../semantic/action';
import { actionCollider } from '../semantic/collision';
import { evaluateAttributeSetAvailability } from '../rules/attribute-set';
import { evaluateMinePreconditions } from '../rules/mine';
import { evaluateMoveAvailability } from '../rules/move';
import { evaluateGuardBegin } from '../rules/guard';
import { evaluateMoveModeRun } from '../rules/move-mode';
import { evaluateSkillPreconditions } from '../rules/skill';
import {
  actorModifiers,
  defenseShape,
  defenseMultiplier,
  effectiveDefense,
  isDowned,
  isGuardBroken,
  rawDamage,
  skillDefinition,
} from '../semantic/combat';
import { projectCommandCatalog } from '../semantic/command-catalog';
import { hasMiningTool, itemCount } from '../semantic/inventory';
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

  // entities.character — 세계의 모든 Actor 를 같은 계약으로 투영한다 (cardinality: many).
  // role 만 보는 이에 따라 달라진다.
  for (const actor of state.actors) {
    const progress = actionProgress(actor.currentAction);
    const target = actionTargetId(actor.currentAction);
    const isSelf = actor.id === self.id;
    const isOtherPlayer = !isSelf && actor.control === 'player';
    // Collision.ActionColliders (C006) — attack 진행 중에만 존재하는 파생 상태
    const swing = actionCollider(actor);
    // C007 R2 — 모든 Actor 의 모든 속성을 싣는다. 가리는 경계를 두지 않는다
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
      name: actor.name, // C007 — 불러 줄 이름
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
        // 전투 능력치 (C010 → C012) — 네 값과 두 방어 배율. 체감식이라 수치만 보고는
        // 효과를 알 수 없기 때문이다 (INTENT-TYPED-DEFENSE-001).
        // 상대의 값도 실린다 — 방어를 읽는 것이 이 Cycle 의 플레이다.
        combatStats: {
          physicalAttack: actor.physicalAttack,
          auraAttack: actor.auraAttack,
          armor: actor.armor,
          resistance: actor.resistance,
          // C013 — 관통 둘. 상대의 관통도 실린다 — 저 존재가 내 방어를 얼마나
          // 무력화하는지는 내가 얼마나 위험한지를 아는 일이다 (INTENT-PENETRATION-OBSERVE-001).
          armorPenetration: actor.armorPenetration,
          resistancePenetration: actor.resistancePenetration,
          armorMultiplier: defenseMultiplier(actor.armor),
          resistanceMultiplier: defenseMultiplier(actor.resistance),
        },
        // 이 존재의 두 방어가 보는 이의 관통에게 얼마로 읽히는가 (C013 ADDED).
        // 세계가 계산해 내놓는다 — View 가 두 수를 곱하지 않는다
        // (DC-WORLD-OWNS-THE-SURFACE-LIST). 치기 전에 보여야 고르는 일이 판단이 된다.
        versusObserver: {
          armor: effectiveDefense(actor.armor, self.armorPenetration),
          resistance: effectiveDefense(actor.resistance, self.resistancePenetration),
          armorMultiplier: defenseMultiplier(
            effectiveDefense(actor.armor, self.armorPenetration),
          ),
          resistanceMultiplier: defenseMultiplier(
            effectiveDefense(actor.resistance, self.resistancePenetration),
          ),
        },
        // 어느 쪽이 더 단단한가 (C012) — 세계가 계산해 내놓는 판정이다
        // (INTENT-DAMAGE-TYPE-OBSERVE-001 · DC-WORLD-OWNS-THE-SURFACE-LIST).
        defenseShape: defenseShape(actor),
        // 막기 (C011) — 모든 존재에 실린다. 자율 존재는 이번 Cycle 에서 막지 않으므로
        // 늘 거짓이지만 그래도 싣는다. "지금은 아무도 안 막는다" 와
        // "세계가 안 알려준다" 는 다른 일이다 (INTENT-GUARD-OBSERVE-001).
        guard: {
          guarding: actor.guarding,
          broken: isGuardBroken(actor, state.time),
        },
      },
      ...(progress !== null ? { progress } : {}),
      ...(target ? { targetEntityId: target } : {}),
      // Character.Attended — 다른 관찰자의 몸에만 의미가 있다.
      // 거짓이면 그 사람은 떠났고 몸만 세계에 남은 것이다 (INTENT-OBSERVER-LEAVE-001).
      ...(isOtherPlayer ? { attended: isAttended(state, actor.id) } : {}),
      // Collision.Bodies (C006) — 충돌체 관찰은 언제나 제공된다 (INTENT-COLLISION-OBSERVE-001).
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

  // interactions.attack / skill-heavy (C007) — 대상이 없다. 무엇이 맞을지는
  // 요청할 때가 아니라 휘두름 구간의 접촉이 정한다.
  // profile 이 함께 나간다 — 쓰기 전에 무엇이 오갈지 알아야
  // "지금 고급 스킬을 쓸 것인가" 를 판단할 수 있다 (INTENT-SELF-OBSERVE-001).
  // C010 CHANGED — damage 하나가 셋으로 나뉜다. rawDamage 는 지금 내 공격 능력으로
  // 이 스킬을 쓰면 나오는 공격 피해이며, 최종 피해는 실리지 않는다 —
  // 대상이 정해지기 전에는 세계도 모르는 값이다.
  const basicFailure = evaluateSkillPreconditions(self, 'attack');
  const basic = skillDefinition('attack');
  interactions.push({
    id: 'attack',
    role: 'skill-basic',
    available: basicFailure === null,
    ...(basicFailure ? { reason: basicFailure } : {}),
    profile: {
      baseDamage: basic.baseDamage,
      attackRatio: basic.attackRatio,
      rawDamage: rawDamage(self, 'attack'),
      charge: basic.cpCharge,
      cost: basic.cpCost,
      damageType: basic.damageType, // C012 — 각 스킬이 어떤 방식인지 세계가 밝힌다
    },
  });

  const heavyFailure = evaluateSkillPreconditions(self, 'heavy-attack');
  const heavy = skillDefinition('heavy-attack');
  interactions.push({
    id: 'skill-heavy',
    role: 'skill-heavy',
    available: heavyFailure === null,
    ...(heavyFailure ? { reason: heavyFailure } : {}),
    profile: {
      baseDamage: heavy.baseDamage,
      attackRatio: heavy.attackRatio,
      rawDamage: rawDamage(self, 'heavy-attack'),
      charge: heavy.cpCharge,
      cost: heavy.cpCost,
      damageType: heavy.damageType, // C012
    },
  });

  // interactions.skillAura (C012 ADDED) — 오라 방식으로 친다.
  // 새 관문도 새 사유도 없다. 기존 스킬이 지나는 자리를 그대로 지난다
  // (INTENT-AURA-SKILL-001). rawDamage 가 기본 스킬과 다르게 나오는 것은
  // 내 두 공격 능력이 다르기 때문이지 스킬 값이 달라서가 아니다.
  const auraFailure = evaluateSkillPreconditions(self, 'aura-strike');
  const aura = skillDefinition('aura-strike');
  interactions.push({
    id: 'skill-aura',
    role: 'skill-aura',
    available: auraFailure === null,
    ...(auraFailure ? { reason: auraFailure } : {}),
    profile: {
      baseDamage: aura.baseDamage,
      attackRatio: aura.attackRatio,
      rawDamage: rawDamage(self, 'aura-strike'),
      charge: aura.cpCharge,
      cost: aura.cpCost,
      damageType: aura.damageType, // C012
    },
  });

  // interactions.guardBegin / guardRelease (C011) — 세계가 "막기를 걸 수 있다" 와
  // "지금 걸 수 있는가" 와 "안 되면 왜인가" 를 함께 싣는다.
  // View 는 이 목록을 읽을 뿐 스스로 만들지 않는다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
  const guardFailure = evaluateGuardBegin(self, state.time);
  interactions.push({
    id: 'guard-begin',
    role: 'guard-begin',
    available: guardFailure === null,
    ...(guardFailure ? { reason: guardFailure } : {}),
  });
  // 놓는 데에는 조건이 없다 — 힘이 빠져 손을 내리는 것을 막을 이유가 없다.
  interactions.push({
    id: 'guard-release',
    role: 'guard-release',
    available: true,
  });

  // interactions.moveMode (C007) — 지금 달릴 수 있는가. 걷기로 돌아오는 것은 언제나 된다.
  const runFailure = evaluateMoveModeRun(self);
  interactions.push({
    id: 'move-mode',
    role: 'set-move-mode',
    available: runFailure === null,
    ...(runFailure ? { reason: runFailure } : {}),
  });

  // interactions.setAttribute (C007 R2) — 세계가 권한을 닫아 두면 가용하지 않다.
  const attributeFailure = evaluateAttributeSetAvailability(state);
  interactions.push({
    id: 'set-attribute',
    role: 'debug-set-attribute',
    available: attributeFailure === null,
    ...(attributeFailure ? { reason: attributeFailure } : {}),
  });

  // entities.deposit + interactions.mine
  for (const deposit of state.deposits) {
    entities.push({
      id: deposit.id,
      role: 'resource-deposit',
      state: deposit.resourceAmount > 0 ? 'available' : 'depleted',
      kind: deposit.resourceKind,
      position: { x: deposit.position.x, z: deposit.position.z },
      labelValue: deposit.resourceAmount,
    });

    const failure = evaluateMinePreconditions(self, deposit);
    interactions.push({
      id: 'mine',
      role: 'mine-deposit',
      targetEntityId: deposit.id,
      available: failure === null,
      ...(failure ? { reason: failure } : {}),
    });
  }

  const selfProgress = actionProgress(self.currentAction);
  const selfModifiers = actorModifiers(self);

  return {
    specId: SPEC_ID,
    scene: 'mining-field',
    // observer.self — 화면 속 여러 몸 중 어느 것이 내 것인지 알려면 이것이 필요하다.
    // acknowledgedMark (C005) — 세계가 나에게서 어디까지 받았는가.
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
      { id: 'inventory.stone', kind: 'counter', value: itemCount(self.inventory, 'stone') },
      { id: 'tool.hasMiningTool', kind: 'flag', value: hasMiningTool(self.inventory) },
      {
        id: 'player.action',
        kind: 'label',
        value: self.currentAction.kind,
        ...(selfProgress !== null ? { progress: selfProgress } : {}),
      },
      // World.Time (C003) — 세계가 자기 시계로 어디까지 왔는가.
      { id: 'world.time', kind: 'counter', value: state.time },
      // Observers.PresentCount (C004) — 지금 이 세계를 함께 보고 있는 사람의 수 (나 포함).
      // 누가 있는지(이름)는 실리지 않는다 — 이번 Cycle 의 의미가 아니다.
      { id: 'observers.present', kind: 'counter', value: presentObserverCount(state) },
      // hud.self (C007) — 같은 값을 남에 대해서도 볼 수 있다 (entities[].attributes).
      // 여기가 특별한 것은 "늘 눈앞에 있다" 는 점뿐이다.
      { id: 'self.hp', kind: 'counter', value: self.hp },
      { id: 'self.hpMax', kind: 'counter', value: self.hpMax },
      { id: 'self.cp', kind: 'counter', value: self.cp },
      { id: 'self.cpMax', kind: 'counter', value: self.cpMax },
      { id: 'self.downed', kind: 'flag', value: isDowned(self) },
      { id: 'self.moveMode', kind: 'label', value: self.moveMode },
      // hud.self.guard (C011) — 막기는 스스로 끝나지 않는다. 내가 들고 있다는 것을 잊으면
      // 스킬이 왜 안 나가는지 알 수 없게 되므로 늘 눈앞에 둔다.
      // 기력은 self.cp 가 이미 싣는다 — 막기의 대가는 그 값이 줄어드는 것으로 이미 보인다.
      { id: 'self.guard.guarding', kind: 'flag', value: self.guarding },
      { id: 'self.guard.broken', kind: 'flag', value: isGuardBroken(self, state.time) },
      // hud.self.combatStats (C010) — 내가 얼마나 세게 때리고 얼마나 덜 맞는가.
      // 값을 바꾼 직후 그 변화가 여기서 즉시 확인되어야 한다.
      { id: 'self.combat.physicalAttack', kind: 'counter', value: self.physicalAttack },
      { id: 'self.combat.auraAttack', kind: 'counter', value: self.auraAttack },
      { id: 'self.combat.armor', kind: 'counter', value: self.armor },
      { id: 'self.combat.resistance', kind: 'counter', value: self.resistance },
      // C013 — 내 관통. 0 인 쪽도 싣는다. 없다는 것을 아는 것이
      // "그쪽으로는 벽을 깎을 수 없다" 를 아는 것이다.
      { id: 'self.combat.armorPenetration', kind: 'counter', value: self.armorPenetration },
      {
        id: 'self.combat.resistancePenetration',
        kind: 'counter',
        value: self.resistancePenetration,
      },
      { id: 'self.combat.armorMultiplier', kind: 'counter', value: defenseMultiplier(self.armor) },
      {
        id: 'self.combat.resistanceMultiplier',
        kind: 'counter',
        value: defenseMultiplier(self.resistance),
      },
      // 내 두 방어 중 어느 쪽이 무른지 (C012) — 상대도 같은 규칙으로 나를 고른다.
      { id: 'self.combat.defenseShape', kind: 'label', value: defenseShape(self) },
      { id: 'self.tempo.moveSpeed', kind: 'counter', value: self.moveSpeed },
      { id: 'self.tempo.runSpeedMultiplier', kind: 'counter', value: self.runSpeedMultiplier },
      { id: 'self.tempo.actionSpeed', kind: 'counter', value: self.actionSpeed },
      { id: 'self.modifier.cpCharge', kind: 'counter', value: selfModifiers.cpCharge },
      { id: 'self.modifier.cpConsume', kind: 'counter', value: selfModifiers.cpConsume },
      { id: 'self.modifier.moveSpeed', kind: 'counter', value: selfModifiers.moveSpeed },
      { id: 'self.modifier.actionSpeed', kind: 'counter', value: selfModifiers.actionSpeed },
    ],
    // World.StrikeEvents (C007) — 남의 타격 결과도 보인다. 세계가 판정을 마친 값이다.
    strikes: state.strikeEvents.map((event) => ({
      attackerId: event.attackerId,
      targetId: event.targetId,
      skill: event.skill,
      amount: event.amount,
      at: { x: event.position.x, z: event.position.z },
      since: event.time,
      // C010 — 그 숫자가 왜 그만큼인지. 세계가 계산한 경위를 그대로 낸다.
      breakdown: { ...event.breakdown },
    })),
    // World.DebugAuthority (C007 R2) — 이 세계가 조작을 허용하는가.
    debug: {
      open: state.debugAuthority.open,
    },
    // World.CommandCatalog (C009 ADDED) — 세계 밖에서 무엇을 걸 수 있는지 세계가 밝힌다.
    // 늘 실린다: 걸 수 있는 것은 언제나 먼저 밝혀져 있어야 하고 (INTENT-COMMAND-CATALOG-001),
    // available 이 거짓이어도 무엇을 할 수 있는 세계인지는 알 수 있어야 한다.
    // 무엇을 어디까지 바꿀 수 있는지(구 mutableAttributes)는 set-attribute 가 받는
    // 값의 Domain 으로 이 안에 들어 있다 — View 가 목록을 만들지 않는다는 규율은 그대로다.
    commands: projectCommandCatalog((commandId) =>
      commandId === 'set-attribute' ? evaluateAttributeSetAvailability(state) : null,
    ),
  };
}
