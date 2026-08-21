// Observer Projection — WorldState 를 관찰자 한 사람의 Semantic Snapshot 으로 투영한다.
// VIEW-MULTI-OBSERVER-001 (cycles/C004-multi-observer/04-gameview.spec.yaml) 이 계약이다.
//
// C004 CHANGED — 관찰 결과는 관찰자마다 만들어진다 (INTENT-PER-OBSERVER-PROJECTION-001).
//   세계의 사실(누가 어디 있고 무엇을 하는가)은 모든 관찰자에게 같고,
//   "어느 것이 내 몸인가"와 "나만의 것"(가용성 · 소지품)은 관찰자마다 다르다.
//
// 의미만 투영한다 — role/state/값/사유 코드. 표현(sprite·모션 파일·크기·라벨 형식·문구)은
// View 의 Presentation 결정 Layer 책임이며 여기 싣지 않는다.

import type {
  EntityView,
  GameViewSnapshot,
  InteractionView,
  InventoryItemView,
  ItemActionView,
} from '../../protocol/gameview';
import { actionProgress, actionTargetId } from '../semantic/action';
import { ruleStance } from '../rules/relation';
import { actionCollider } from '../semantic/collision';
import { evaluateAttributeSetAvailability } from '../rules/attribute-set';
import { evaluateForgetAcquaintance, evaluateObserveBegin } from '../rules/observe';
import { evaluateMineTargeted } from '../rules/mine';
import { evaluateTargetSelect } from '../rules/target';
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
  skillPhase,
} from '../semantic/combat';
import { concealedKeys, isAcquainted, isSeatOpen } from '../semantic/acquaintance';
import { projectCommandCatalog } from '../semantic/command-catalog';
import { selectedEntityId } from '../semantic/target-selection';
import type { ActorState } from '../semantic/actor';
import { inventoryEntries } from '../semantic/inventory';
import { isStackable, itemDefinition } from '../semantic/item';
import { evaluateItemUse } from '../rules/item-use';
import { evaluateItemDiscard } from '../rules/item-discard';
import { ruleInventoryRoom } from '../rules/inventory-room';
import {
  actorOfObserver,
  findObserver,
  INVENTORY_CAPACITY,
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
    // C014 — 이 관찰자가 이 존재를 살펴봤는가 (INTENT-OBSERVE-KNOWLEDGE-001).
    // 자기 몸은 언제나 참이다. 아는 것은 값이 아니라 자리이므로, 열려 있으면
    // 아래에서 **그 순간의 Actor** 를 읽는다 — 살펴본 때의 숫자를 베껴 두지 않는다.
    const learned = isAcquainted(state.acquaintances, observerId, actor.id, self.id);
    // C016 — 가려짐이 자리마다 갈린다 (RULE-INSIGHT-REVEAL-001).
    // 여는 통찰은 **보는 이가 지금 조종하는 몸**의 것이다 (INTENT-INSIGHT-001) —
    // 앎은 사람에게 남고 통찰은 몸에 붙어 있으므로 한 칸을 되짚어 읽는다.
    const concealed = concealedKeys(learned, self.insight);
    // C016 CHANGED — 뜻이 "살펴봤다" 에서 **"가려진 자리가 하나도 없다"** 로 넓어진다.
    // 살펴봤거나 · 통찰이 세 문턱을 모두 넘었거나 · 자기 몸이면 참이다.
    const acquainted = concealed.length === 0;
    const seatOpen = (key: 'combatStats' | 'versusObserver' | 'defenseShape') =>
      isSeatOpen(key, learned, self.insight);
    // Collision.ActionColliders (C006) — attack 진행 중에만 존재하는 파생 상태
    const swing = actionCollider(actor);
    // C007 R2 — 모든 Actor 의 모든 속성을 싣는다. 가리는 경계를 두지 않는다
    // (INTENT-ATTRIBUTE-OBSERVE-001). 늘 화면에 띄울지는 View 의 선택이다.
    const modifiers = actorModifiers(actor);

    const phase = skillPhase(actor); // C019 — 기술 중에만 값이 있다
    entities.push({
      id: actor.id,
      role: isSelf
        ? 'player-character'
        : actor.control === 'player'
          ? 'other-player-character'
          : 'npc-character',
      state: actor.currentAction.kind, // idle | move | attack | heavy-attack | mine | hit | downed
      // C019 ADDED — 기술을 쓰는 중이면 그 구간이 함께 온다 (RULE-SKILL-PHASE-001).
      // 가려지지 않는다: 살펴보지 않아도, 통찰이 0 이어도 실린다 — 가리면 끊는 판단
      // 자체가 성립하지 않는다. 자기 몸에도 남의 몸에도 같은 규칙으로 실린다.
      ...(phase !== null ? { actionPhase: phase } : {}),
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
        // C014 ADDED — 앎의 상태. 아는 존재에도 모르는 존재에도 **언제나** 실린다.
        // "지금은 아무도 안 막는다" 와 "세계가 안 알려준다" 를 가른 C011 의 원칙과
        // 같은 이유다 — 모른다는 것 자체가 관찰이어야 한다
        // (INTENT-UNSEEN-IS-OBSERVABLE-001).
        acquainted,
        // 가려진 항목의 이름들. 목록의 단일 출처는 세계다 (semantic/acquaintance.ts) —
        // View 가 "가려질 수 있는 것은 이 셋" 을 자기 코드에 적지 않는다
        // (DC-WORLD-OWNS-THE-SURFACE-LIST).
        concealed,
        // 왜 비어 있는가. 사유 코드로 둔다 — 값 하나로 굳히면 다음 사유가 생길 때 계약이 깨진다.
        ...(acquainted ? {} : { unacquaintedReason: 'not-observed' }),
        // C016 ADDED — 통찰 (INTENT-INSIGHT-OBSERVE-001). 모든 존재에 언제나 실린다.
        // 가려지는 목록에 넣지 않는다 — 겨루는 힘이 아니라 아는 힘이고, 목록은
        // C014 가 정한 셋 그대로다 (01 EXCLUDED). 이 값이 보여야 가려진 목록이
        // 왜 그 길이인지가 설명된다.
        insight: actor.insight,
        // C018 ADDED — 둘 사이의 태도 두 방향 (INTENT-STANCE-OBSERVE-001).
        // 언제나 실리고 가려지지 않는다 — 가리면 물러날 판단 자체가 성립하지 않는다.
        // 매 관찰마다 다시 계산된다: 걸어 들어가면 neutral 이 hostile 이 되고
        // 걸어 나오면 되돌아간다. 세계가 기억하지 않으므로 화면에도 원한이 생기지 않는다.
        // 자기 몸에도 실린다 (둘 다 neutral) — 언제나 같다고 빼면 View 가
        // "자기 몸에는 없다" 는 또 하나의 경우를 알아야 한다.
        stanceTowardObserver: ruleStance(actor, self),
        stanceFromObserver: ruleStance(self, actor),
        // 전투 능력치 (C010 → C012 → C014) — 네 값과 두 방어 배율. 체감식이라 수치만
        // 보고는 효과를 알 수 없기 때문이다 (INTENT-TYPED-DEFENSE-001).
        // C014 CHANGED — 남의 것은 살펴본 뒤에만 실린다. 값의 뜻은 그대로이고
        // 달라지는 것은 **언제 실리는가** 뿐이다 (INTENT-UNSEEN-CAPABILITY-001).
        // C016 CHANGED — 세 자리가 **따로** 실린다. 통찰이 얕은 자리부터 열기 때문에
        // 관계값만 온 존재와 형태만 온 존재가 있다 (04 SEAT NOTE).
        ...(seatOpen('combatStats')
          ? {
              combatStats: {
                physicalAttack: actor.physicalAttack,
                auraAttack: actor.auraAttack,
                armor: actor.armor,
                resistance: actor.resistance,
                // C013 — 관통 둘. 상대의 관통도 실린다 — 저 존재가 내 방어를 얼마나
                // 무력화하는지는 내가 얼마나 위험한지를 아는 일이다
                // (INTENT-PENETRATION-OBSERVE-001).
                armorPenetration: actor.armorPenetration,
                resistancePenetration: actor.resistancePenetration,
                armorMultiplier: defenseMultiplier(actor.armor),
                resistanceMultiplier: defenseMultiplier(actor.resistance),
                // C015 — Critical 둘. 저 존재가 얼마나 자주 크게 터뜨리는 몸인지는
                // 내가 얼마나 위험한지를 아는 일이다 (INTENT-CRITICAL-OBSERVE-001).
                // 새 관문을 만들지 않는다 — C014 가 세운 그 하나의 관문 안쪽에 놓일 뿐이다.
                criticalChance: actor.criticalChance,
                criticalDamage: actor.criticalDamage,
              },
            }
          : {}),
        // 이 존재의 두 방어가 보는 이의 관통에게 얼마로 읽히는가 (C013 ADDED).
        // 세계가 계산해 내놓는다 — View 가 두 수를 곱하지 않는다
        // (DC-WORLD-OWNS-THE-SURFACE-LIST). 치기 전에 보여야 고르는 일이 판단이 된다.
        // C014 — 두 존재 사이의 값이므로 한쪽을 모르는 채로는 성립하지 않는다.
        // C016 — combatStats 보다 얕은 자리다. 수치가 가려진 채 이것만 오는 존재가 있다.
        ...(seatOpen('versusObserver')
          ? {
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
            }
          : {}),
        // 어느 쪽이 더 단단한가 (C012) — 세계가 계산해 내놓는 판정이다
        // (INTENT-DAMAGE-TYPE-OBSERVE-001 · DC-WORLD-OWNS-THE-SURFACE-LIST).
        // C014 — 이것이 가려지지 않으면 "무엇으로 칠지" 의 답이 그대로 새어 나가고
        // 살펴봄이 할 일이 없어진다.
        // C016 — 세 자리 중 가장 얕다. 통찰이 조금만 있어도 이것부터 열린다.
        ...(seatOpen('defenseShape') ? { defenseShape: defenseShape(actor) } : {}),
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

    // interactions.selectTarget (C017 ADDED) — 존재마다 하나.
    // C014 의 observe 가 있던 자리를 그대로 물려받는다: 존재마다 실리고, 자기 몸에도
    // 실리며(available 거짓 · 사유 target-is-self), 왜 안 되는지를 세계가 말한다.
    // 바뀐 것은 **무엇이 그 자리에 오는가** 다 — 살펴봄이 아니라 고르기다.
    //
    // 사유를 세계가 내놓는 이유는 그대로다: View 가 스스로 판정하면 세계가 규칙을
    // 바꿔도 화면이 따라오지 않는다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
    const selectFailure = evaluateTargetSelect(state, observerId, actor.id);
    interactions.push({
      id: 'select-target',
      role: 'select-target',
      targetEntityId: actor.id,
      available: selectFailure === null,
      ...(selectFailure ? { reason: selectFailure } : {}),
    });
  }

  // interactions.observe (C014 → C017 CHANGED) — 존재마다에서 **하나**로 줄었다.
  // 대상은 고른 것이며, 아무것도 고르지 않았어도 목록에서 사라지지 않는다:
  // available 이 거짓이고 사유가 no-target-selected 다. 걸 수 있는 일은 언제나
  // 먼저 밝혀져 있어야 한다 (INTENT-COMMAND-CATALOG-001).
  const observeFailure = evaluateObserveBegin(state, observerId);
  interactions.push({
    id: 'observe',
    role: 'observe-character',
    available: observeFailure === null,
    ...(observeFailure ? { reason: observeFailure } : {}),
  });

  // interactions.clearTarget (C017 ADDED) — 조건이 없다 (guardRelease 와 같은 모양).
  // 고른 것이 없을 때도 실리고 가용하다: 한 번도 고른 적 없는 사람도 푸는 길을 안다.
  interactions.push({
    id: 'clear-target',
    role: 'clear-target',
    available: true,
  });

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
      swingBegin: basic.swingBegin, // C019 — 고르기 전에 아는 선딜
      swingEnd: basic.swingEnd,
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
      swingBegin: heavy.swingBegin, // C019
      swingEnd: heavy.swingEnd,
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
      swingBegin: aura.swingBegin, // C019
      swingEnd: aura.swingEnd,
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

  // interactions.forgetAcquaintance (C014 ADDED) — 알게 된 것을 되돌린다.
  // 대상을 받지 않는 자리다(지목은 요청에서 한다) — set-attribute 와 같은 모양이며
  // 같은 관문(World.DebugAuthority)을 지난다. 살펴보기 전과 후를 견주는 경로다.
  const forgetFailure = evaluateForgetAcquaintance(state);
  interactions.push({
    id: 'forget-acquaintance',
    role: 'debug-forget-acquaintance',
    available: forgetFailure === null,
    ...(forgetFailure ? { reason: forgetFailure } : {}),
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

    // C017 CHANGED — 광맥에도 고르기가 실린다. 광맥은 고를 수 있고(available 참),
    // 그에게 무엇을 할 수 있는지는 아래 mine 하나가 말한다.
    const depositSelectFailure = evaluateTargetSelect(state, observerId, deposit.id);
    interactions.push({
      id: 'select-target',
      role: 'select-target',
      targetEntityId: deposit.id,
      available: depositSelectFailure === null,
      ...(depositSelectFailure ? { reason: depositSelectFailure } : {}),
    });
  }

  // interactions.mine (C001 → C017 CHANGED) — 광맥마다에서 **하나**로 줄었다.
  // observe 와 같은 자리, 같은 이유다.
  const mineFailure = evaluateMineTargeted(state, self, observerId);
  interactions.push({
    id: 'mine',
    role: 'mine-deposit',
    available: mineFailure === null,
    ...(mineFailure ? { reason: mineFailure } : {}),
  });

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
    // C020 — 가진 것 전부가 한 목록으로 나온다. 종류 전용 칸이 사라진 자리다.
    inventory: projectInventory(state, self, observerId),
    // C022 — 자리는 **목록 밖에** 있다. 물건의 성질이 아니라 몸의 형편이기 때문이다.
    // 화면은 이 둘을 받아 옮길 뿐 세지 않는다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
    inventoryRoom: {
      used: ruleInventoryRoom(self.inventory),
      capacity: INVENTORY_CAPACITY,
    },
    hud: [
      // 내 몸의 것만 실린다. 다른 관찰자의 소지품과 가용성은 실리지 않는다
      // (INTENT-PER-OBSERVER-PROJECTION-001).
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
      // C015 — 내 Critical 둘. 0 인 쪽도 싣는다 — 없다는 것을 아는 것이
      // "나는 터뜨릴 수 없다" 를 아는 것이다 (C013 이 관통 0 을 싣기로 한 판단 그대로).
      // 값을 바꾼 직후 이 자리에서 즉시 확인되어야 "빈도와 크기가 달라진다" 가 읽힌다.
      { id: 'self.combat.criticalChance', kind: 'counter', value: self.criticalChance },
      { id: 'self.combat.criticalDamage', kind: 'counter', value: self.criticalDamage },
      // C016 — 내 통찰. 0 도 싣는다 — 없다는 것을 아는 것이 "나는 다가가야만 안다" 를
      // 아는 것이다 (C013 이 관통 0 을, C015 가 가능성 0 을 실은 판단 그대로).
      // 값을 바꾼 직후 이 자리에서 즉시 확인되어야 "올렸더니 가려진 목록이 짧아졌다" 가
      // 한 화면에서 읽힌다. combat 이 아닌 자기 자리를 쓴다 — 겨루는 힘이 아니다.
      { id: 'self.insight', kind: 'counter', value: self.insight },
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
      // C015 — 그 안에 critical 이 함께 실린다. 타격 경위는 살펴봄 관문 뒤가 아니다 —
      // 모르는 상대에게 크게 터진 것은 보인다. 그 상대가 **얼마나 자주** 터뜨리는
      // 몸인지는 여전히 살펴봐야 안다 (combatStats 안이다).
      breakdown: { ...event.breakdown },
    })),
    // World.UnharmedContacts (C018) — 닿았으나 해가 성립하지 않은 접촉.
    // 타격 결과와 나란히 실린다. 이것이 없으면 화면에서 무산은 빗나감과 구분되지 않는다
    // (INTENT-UNHARMED-IS-OBSERVABLE-001). 사유 목록의 단일 출처는 세계다.
    contacts: state.unharmedContacts.map((contact) => ({
      attackerId: contact.attackerId,
      targetId: contact.targetId,
      skill: contact.skill,
      at: { x: contact.position.x, z: contact.position.z },
      since: contact.time,
      reason: contact.reason,
    })),
    // World.CancelEvents (C019) — 선딜 중에 끊겨 없던 일이 된 기술들.
    // 타격 결과·무산된 접촉과 나란히 실린다. 이것이 없으면 화면에서 캔슬은 "그냥 맞았다"
    // 와 구분되지 않는다 (INTENT-CANCEL-IS-OBSERVABLE-001).
    cancels: state.cancelEvents.map((event) => ({
      attackerId: event.attackerId,
      targetId: event.targetId,
      skill: event.skill,
      at: { x: event.position.x, z: event.position.z },
      since: event.time,
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
    // C017 ADDED — 지금 고른 존재 (INTENT-TARGET-OBSERVE-001).
    // Id 하나뿐이다. 값은 entities 에서 읽는다 — 여기에 베끼지 않는다.
    currentTarget: (() => {
      const entityId = selectedEntityId(state.targetSelections, observerId);
      return entityId === undefined ? {} : { entityId };
    })(),
    commands: projectCommandCatalog((commandId) => {
      if (commandId === 'set-attribute') return evaluateAttributeSetAvailability(state);
      // C014 — 되돌림도 같은 권한을 지난다
      if (commandId === 'forget-acquaintance') return evaluateForgetAcquaintance(state);
      return null;
    }),
  };
}


/**
 * 소지품 투영 (C020 ADDED) — INTENT-INVENTORY-IS-ONE-CONTRACT-001 ·
 *                            INTENT-USE-AVAILABILITY-001
 *
 * 여기에 **종류 이름이 한 번도 나오지 않는다.** 목록은 지닌 것에서 나오고, 각 항목이
 * 무엇이 되는지는 정의가 답하며, 되지 않는 사유는 실제 실행이 쓰는 것과 같은 판정에서
 * 나온다 (evaluateItemUse). 그래서 화면에 불가로 보이는 것을 억지로 요청해도
 * 같은 사유로 거절된다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
 *
 * 종류가 늘어도 이 함수는 바뀌지 않는다 — 정의가 하나 늘어날 뿐이다.
 */
function projectInventory(
  state: WorldState,
  self: ActorState,
  observerId: string,
): InventoryItemView[] {
  return inventoryEntries(self.inventory).map(({ kind, count }) => {
    const definition = itemDefinition(kind)!;
    const actions: ItemActionView[] = [];

    if (definition.use) {
      const failure = evaluateItemUse(state, self, observerId, kind);
      actions.push({
        id: 'use-item',
        role: 'use-item',
        available: failure === null,
        ...(failure ? { unavailableReason: failure } : {}),
      });
    }

    // C022 — 덜어내기는 **지닌 모든 항목**에 붙는다. 쓸 수 있는 물건만 놓을 수 있는
    // 것이 아니기 때문이다. 되는지와 왜 안 되는지는 실제 실행이 쓰는 판정에서 나온다.
    const discardFailure = evaluateItemDiscard(state, self, kind);
    actions.push({
      id: 'discard-item',
      role: 'discard-item',
      available: discardFailure === null,
      ...(discardFailure ? { unavailableReason: discardFailure } : {}),
    });

    return {
      kind,
      count,
      category: definition.category,
      ...(definition.origin ? { origin: definition.origin } : {}),
      stackable: isStackable(definition),
      actions,
    };
  });
}
