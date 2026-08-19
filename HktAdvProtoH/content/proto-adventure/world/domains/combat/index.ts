// combat 도메인 — 몸이 서로에게 무엇을 하는가.
//
// 소유 필드 (base/actor.ts 의 [combat] 구획)
//   hp · hpMax · cp · cpMax · physicalAttack · auraAttack · armor · resistance ·
//   armorPenetration · resistancePenetration · guarding · guardBrokenUntil · actionSpeed
// 소유 State  WorldState.strikeEvents
// 다른 도메인이 hp·cp 를 바꾸려면 여기의 함수를 부른다 (예: debug → ruleDowned).

import type { InteractionHandler, WorldSystem } from '../../../../../engine/world-kernel/content';
import type { HudItemView, InteractionView } from '../../../protocol/gameview';
import { withActor } from '../../base/interaction';
import type { WorldState } from '../../base/world-state';
import type { ActorViewDraft, ProjectionContext, SnapshotFields, WorldDomain } from '../../domain';
import {
  actorModifiers,
  defenseMultiplier,
  defenseShape,
  effectiveDefense,
  isDowned,
  isGuardBroken,
  rawDamage,
  skillDefinition,
  type SkillKind,
} from './combat';
import { ruleCpRunDrain } from './cp-run-drain';
import { evaluateGuardBegin, ruleGuardBegin, ruleGuardRelease } from './guard';
import { evaluateSkillPreconditions, ruleSkillBegin } from './skill';
import { ruleStrikeEventExpire } from './strike-event-expire';
import { actionCollider } from './swing';
import { ruleSwingStrike } from './swing-strike';

const interactions: readonly InteractionHandler<WorldState>[] = [
  {
    id: 'attack',
    // 기본 스킬 — 대상을 받지 않는다 (C002)
    handle: withActor((_state, actor) => ruleSkillBegin(actor, 'attack')),
  },
  {
    id: 'skill-heavy',
    // 고급 스킬 (C007)
    handle: withActor((_state, actor) => ruleSkillBegin(actor, 'heavy-attack')),
  },
  {
    // C012 — 오라 스킬. 같은 Rule 을 그대로 지난다. 다른 것은 피해의 방식뿐이다
    // (INTENT-AURA-SKILL-001).
    id: 'skill-aura',
    handle: withActor((_state, actor) => ruleSkillBegin(actor, 'aura-strike')),
  },
  {
    // C011 — 막기는 몸이 세계 안에서 하는 일이므로 interaction 이다 (command 가 아니다).
    // 시작과 해제가 따로 있다 — 토글이 아니라 명시값이어야 같은 요청이 두 번 와도 결과가 같다.
    id: 'guard-begin',
    handle: withActor((state, actor) => ruleGuardBegin(actor, state.time)),
  },
  {
    id: 'guard-release',
    handle: withActor((_state, actor) => ruleGuardRelease(actor)),
  },
];

const systems = {
  /** RULE-SWING-STRIKE-001 — 휘두름 구간의 접촉이 타격을 정한다 */
  swingStrike: (state: WorldState) => {
    ruleSwingStrike(state);
  },
  /** RULE-CP-RUN-DRAIN-001 — 달린 만큼 기력을 치른다 */
  cpRunDrain: (state: WorldState, dt: number) => {
    ruleCpRunDrain(state, dt);
  },
  /** RULE-STRIKE-EVENT-EXPIRE-001 — 관찰된 타격 결과가 세계에서 사라진다 */
  strikeEventExpire: (state: WorldState) => {
    ruleStrikeEventExpire(state);
  },
};

// interactions.attack / skill-heavy / skill-aura (C007 → C012) — 대상이 없다.
// 무엇이 맞을지는 요청할 때가 아니라 휘두름 구간의 접촉이 정한다.
// profile 이 함께 나간다 — 쓰기 전에 무엇이 오갈지 알아야
// "지금 고급 스킬을 쓸 것인가" 를 판단할 수 있다 (INTENT-SELF-OBSERVE-001).
// C010 CHANGED — damage 하나가 셋으로 나뉜다. rawDamage 는 지금 내 공격 능력으로
// 이 스킬을 쓰면 나오는 공격 피해이며, 최종 피해는 실리지 않는다 —
// 대상이 정해지기 전에는 세계도 모르는 값이다.
const SKILL_ROLES: ReadonlyArray<{ id: string; role: string; kind: SkillKind }> = [
  { id: 'attack', role: 'skill-basic', kind: 'attack' },
  { id: 'skill-heavy', role: 'skill-heavy', kind: 'heavy-attack' },
  // C012 ADDED — 새 관문도 새 사유도 없다. 기존 스킬이 지나는 자리를 그대로 지난다
  // (INTENT-AURA-SKILL-001). rawDamage 가 기본 스킬과 다르게 나오는 것은
  // 내 두 공격 능력이 다르기 때문이지 스킬 값이 달라서가 아니다.
  { id: 'skill-aura', role: 'skill-aura', kind: 'aura-strike' },
];

export const combat = {
  id: 'combat',
  interactions,
  systems,
  projection: {
    decorateActor(view: ActorViewDraft, actor, state: WorldState, ctx: ProjectionContext): void {
      const self = ctx.self;
      const modifiers = actorModifiers(actor);

      view.vitality = {
        health: actor.hp,
        healthMaximum: actor.hpMax,
        downed: isDowned(actor),
      };

      view.attributes.energy = actor.cp;
      view.attributes.energyMaximum = actor.cpMax;
      view.attributes.modifiers = {
        energyCharge: modifiers.cpCharge,
        energyConsume: modifiers.cpConsume,
        moveSpeed: modifiers.moveSpeed,
        actionSpeed: modifiers.actionSpeed,
      };
      // 전투 능력치 (C010 → C012) — 네 값과 두 방어 배율. 체감식이라 수치만 보고는
      // 효과를 알 수 없기 때문이다 (INTENT-TYPED-DEFENSE-001).
      // 상대의 값도 실린다 — 방어를 읽는 것이 이 Cycle 의 플레이다.
      view.attributes.combatStats = {
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
      };
      // 이 존재의 두 방어가 보는 이의 관통에게 얼마로 읽히는가 (C013 ADDED).
      // 세계가 계산해 내놓는다 — View 가 두 수를 곱하지 않는다
      // (DC-WORLD-OWNS-THE-SURFACE-LIST). 치기 전에 보여야 고르는 일이 판단이 된다.
      view.attributes.versusObserver = {
        armor: effectiveDefense(actor.armor, self.armorPenetration),
        resistance: effectiveDefense(actor.resistance, self.resistancePenetration),
        armorMultiplier: defenseMultiplier(effectiveDefense(actor.armor, self.armorPenetration)),
        resistanceMultiplier: defenseMultiplier(
          effectiveDefense(actor.resistance, self.resistancePenetration),
        ),
      };
      // 어느 쪽이 더 단단한가 (C012) — 세계가 계산해 내놓는 판정이다
      // (INTENT-DAMAGE-TYPE-OBSERVE-001 · DC-WORLD-OWNS-THE-SURFACE-LIST).
      view.attributes.defenseShape = defenseShape(actor);
      // 막기 (C011) — 모든 존재에 실린다. 자율 존재는 이번 Cycle 에서 막지 않으므로
      // 늘 거짓이지만 그래도 싣는다. "지금은 아무도 안 막는다" 와
      // "세계가 안 알려준다" 는 다른 일이다 (INTENT-GUARD-OBSERVE-001).
      view.attributes.guard = {
        guarding: actor.guarding,
        broken: isGuardBroken(actor, state.time),
      };

      // Collision.ActionColliders (C006) — 스킬 진행 중에만 존재하는 파생 상태
      const swing = actionCollider(actor);
      if (swing) {
        view.swing = {
          center: { x: swing.center.x, z: swing.center.z },
          radius: swing.radius,
          active: swing.active,
          struck: [...(actor.currentAction.struckActorIds ?? [])],
        };
      }
    },
    interactions(state: WorldState, ctx: ProjectionContext): InteractionView[] {
      const self = ctx.self;
      const views: InteractionView[] = SKILL_ROLES.map(({ id, role, kind }) => {
        const failure = evaluateSkillPreconditions(self, kind);
        const skill = skillDefinition(kind);
        return {
          id,
          role,
          available: failure === null,
          ...(failure ? { reason: failure } : {}),
          profile: {
            baseDamage: skill.baseDamage,
            attackRatio: skill.attackRatio,
            rawDamage: rawDamage(self, kind),
            charge: skill.cpCharge,
            cost: skill.cpCost,
            damageType: skill.damageType, // C012 — 각 스킬이 어떤 방식인지 세계가 밝힌다
          },
        };
      });

      // interactions.guardBegin / guardRelease (C011) — 세계가 "막기를 걸 수 있다" 와
      // "지금 걸 수 있는가" 와 "안 되면 왜인가" 를 함께 싣는다.
      // View 는 이 목록을 읽을 뿐 스스로 만들지 않는다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
      const guardFailure = evaluateGuardBegin(self, state.time);
      views.push({
        id: 'guard-begin',
        role: 'guard-begin',
        available: guardFailure === null,
        ...(guardFailure ? { reason: guardFailure } : {}),
      });
      // 놓는 데에는 조건이 없다 — 힘이 빠져 손을 내리는 것을 막을 이유가 없다.
      views.push({ id: 'guard-release', role: 'guard-release', available: true });

      return views;
    },
    hud(state: WorldState, ctx: ProjectionContext): HudItemView[] {
      const self = ctx.self;
      const modifiers = actorModifiers(self);
      return [
        // hud.self (C007) — 같은 값을 남에 대해서도 볼 수 있다 (entities[].attributes).
        // 여기가 특별한 것은 "늘 눈앞에 있다" 는 점뿐이다.
        { id: 'self.hp', kind: 'counter', value: self.hp },
        { id: 'self.hpMax', kind: 'counter', value: self.hpMax },
        { id: 'self.cp', kind: 'counter', value: self.cp },
        { id: 'self.cpMax', kind: 'counter', value: self.cpMax },
        { id: 'self.downed', kind: 'flag', value: isDowned(self) },
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
        {
          id: 'self.combat.armorMultiplier',
          kind: 'counter',
          value: defenseMultiplier(self.armor),
        },
        {
          id: 'self.combat.resistanceMultiplier',
          kind: 'counter',
          value: defenseMultiplier(self.resistance),
        },
        // 내 두 방어 중 어느 쪽이 무른지 (C012) — 상대도 같은 규칙으로 나를 고른다.
        { id: 'self.combat.defenseShape', kind: 'label', value: defenseShape(self) },
        { id: 'self.modifier.cpCharge', kind: 'counter', value: modifiers.cpCharge },
        { id: 'self.modifier.cpConsume', kind: 'counter', value: modifiers.cpConsume },
        { id: 'self.modifier.moveSpeed', kind: 'counter', value: modifiers.moveSpeed },
        { id: 'self.modifier.actionSpeed', kind: 'counter', value: modifiers.actionSpeed },
      ];
    },
    snapshotFields(state: WorldState): SnapshotFields {
      // World.StrikeEvents (C007) — 남의 타격 결과도 보인다. 세계가 판정을 마친 값이다.
      return {
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
      };
    },
  },
} satisfies WorldDomain;
