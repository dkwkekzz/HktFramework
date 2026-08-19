// Observer Projection 조립기 — WorldState 를 관찰자 한 사람의 Semantic Snapshot 으로 투영한다.
// VIEW-MULTI-OBSERVER-001 (cycles/C004-multi-observer/04-gameview.spec.yaml) 이 계약이다.
//
// 사실 3 — 관찰(04 spec)은 전체가 하나의 계약이다. 그래서 도메인은 자기 Snapshot 을
// 만들지 않는다. 이 조립기가 세계의 골격(존재의 몸·행동·이어짐)을 세우고, 정해진 순서로
// 도메인 기여 함수를 불러 하나의 Snapshot 을 만든다. 계약은 그대로다 — 구현만 조합이 된다.
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
  HudItemView,
  InteractionView,
} from '../../protocol/gameview';
import type { ActorViewDraft, ProjectionContext, SnapshotFields, WorldDomain } from '../domain';
import { actionProgress, actionTargetId } from './action';
import type { ActorState } from './actor';
import {
  actorOfObserver,
  findObserver,
  isAttended,
  presentObserverCount,
  type WorldState,
} from './world-state';

export const SPEC_ID = 'VIEW-BASIC-COMBAT-POLICY-001';

/**
 * 도메인 기여를 하나의 투영 함수로 조립한다.
 * 기여를 부르는 순서는 넘겨받은 도메인 배열 순서다 — 순서의 단일 출처는 조립(index)이다.
 */
export function composeProjection(
  domains: readonly WorldDomain[],
): (state: WorldState, observerId: string) => GameViewSnapshot | null {
  const decorators = domains.flatMap((d) =>
    d.projection?.decorateActor ? [d.projection.decorateActor.bind(d.projection)] : [],
  );
  const entityParts = domains.flatMap((d) =>
    d.projection?.entities ? [d.projection.entities.bind(d.projection)] : [],
  );
  const interactionParts = domains.flatMap((d) =>
    d.projection?.interactions ? [d.projection.interactions.bind(d.projection)] : [],
  );
  const hudParts = domains.flatMap((d) =>
    d.projection?.hud ? [d.projection.hud.bind(d.projection)] : [],
  );
  const fieldParts = domains.flatMap((d) =>
    d.projection?.snapshotFields ? [d.projection.snapshotFields.bind(d.projection)] : [],
  );

  // 관찰자가 세계에 없으면 관찰 결과도 없다 — 세계는 모르는 이에게 자신을 보여주지 않는다.
  return function projectObserverView(state, observerId) {
    const observer = findObserver(state, observerId);
    const self = actorOfObserver(state, observerId);
    if (!observer || !self) return null;

    const ctx: ProjectionContext = { observerId, self };

    // entities.character — 세계의 모든 Actor 를 같은 계약으로 투영한다 (cardinality: many).
    // role 만 보는 이에 따라 달라진다. 골격은 여기가 세우고, 도메인 필드는 기여가 채운다.
    const entities: EntityView[] = state.actors.map((actor) => {
      const draft = baseActorView(state, actor, ctx);
      for (const decorate of decorators) decorate(draft, actor, state, ctx);
      // 계약의 완전성(AttributesView 의 모든 자리가 찼는가)은 04 spec 검증이 지킨다.
      return draft as unknown as EntityView;
    });
    for (const part of entityParts) entities.push(...part(state, ctx));

    // interactions — 모두 관찰자 자신의 몸을 주체로 판정된다
    // (interactions.subject: observer-character)
    const interactions: InteractionView[] = [];
    for (const part of interactionParts) interactions.push(...part(state, ctx));

    // hud — 도메인의 것이 먼저 오고 세계 골격의 것이 뒤에 온다.
    const hud: HudItemView[] = [];
    for (const part of hudParts) hud.push(...part(state, ctx));
    hud.push(...baseHud(state, ctx));

    // Snapshot 뿌리 — 계약이 요구하는 자리는 언제나 있다. 도메인이 없으면 빈 채로 나간다.
    let fields: SnapshotFields = { strikes: [], debug: { open: false }, commands: [] };
    for (const part of fieldParts) fields = { ...fields, ...part(state, ctx) };

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
      hud,
      strikes: fields.strikes ?? [],
      debug: fields.debug ?? { open: false },
      commands: fields.commands ?? [],
    };
  };
}

// 세계 골격이 아는 존재의 관찰 — 몸·행동·이어짐. 어느 도메인도 없이 성립한다.
function baseActorView(
  state: WorldState,
  actor: ActorState,
  ctx: ProjectionContext,
): ActorViewDraft {
  const progress = actionProgress(actor.currentAction);
  const target = actionTargetId(actor.currentAction);
  const isSelf = actor.id === ctx.self.id;
  const isOtherPlayer = !isSelf && actor.control === 'player';

  return {
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
    // C007 R2 — 모든 Actor 의 모든 속성을 싣는다. 가리는 경계를 두지 않는다
    // (INTENT-ATTRIBUTE-OBSERVE-001). 늘 화면에 띄울지는 View 의 선택이다.
    attributes: {
      control: actor.control,
      // TempoStats (C007) — 세계의 속도. 종류(character-catalog)가 정하는 몸의 값이며
      // 이동과 전투가 함께 읽는다.
      tempoStats: {
        moveSpeed: actor.moveSpeed,
        runSpeedMultiplier: actor.runSpeedMultiplier,
        actionSpeed: actor.actionSpeed,
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
  };
}

// 세계 골격의 HUD — 내 행동, 세계의 시계, 함께 보는 사람의 수, 그리고 몸의 템포.
// 내 몸의 것만 실린다. 다른 관찰자의 소지품과 가용성은 실리지 않는다
// (INTENT-PER-OBSERVER-PROJECTION-001).
function baseHud(state: WorldState, ctx: ProjectionContext): HudItemView[] {
  const self = ctx.self;
  const selfProgress = actionProgress(self.currentAction);
  return [
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
    { id: 'self.tempo.moveSpeed', kind: 'counter', value: self.moveSpeed },
    { id: 'self.tempo.runSpeedMultiplier', kind: 'counter', value: self.runSpeedMultiplier },
    { id: 'self.tempo.actionSpeed', kind: 'counter', value: self.actionSpeed },
  ];
}
