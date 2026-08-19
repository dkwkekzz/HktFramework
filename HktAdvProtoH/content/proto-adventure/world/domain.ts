// WorldDomain — 이 팩 안의 도메인 모듈 규약 (design/Design-Pack-Domain-Modules.md)
//
// 모듈은 **부품을 내놓는 파츠 상자**다. 순서·State 한 벌·계약 전체는 base/조립이 소유한다.
//   사실 1  Tick 순서는 결정론상 한 곳에 적혀야 한다
//           → 도메인은 이름 붙은 시스템을 내놓을 뿐 자기 순서를 소유하지 않는다.
//             순서는 world/index.ts 의 단일 배열이 소유한다.
//   사실 2  Actor 는 하나의 몸이다
//           → 도메인은 자기 State 타입을 소유하지 않는다. State 는 base 가 한 벌로
//             소유하고, 그 필드를 *바꾸는 함수* 만 소유 도메인에 둔다.
//   사실 3  관찰(04 spec)은 전체가 하나의 계약이다
//           → 도메인은 자기 Snapshot 을 만들지 않는다. base/projection.ts 의 조립기가
//             정해진 순서로 아래 기여 함수를 불러 하나의 Snapshot 을 만든다.
//
// 승격 규칙(rule of two)에 따라 이 규약은 **팩 내부 convention** 이다 —
// engine/ 에 올리지 않는다. 두 번째 팩이 같은 규약을 원할 때 승격을 검토한다.
//
// 경계는 부드럽다. 도메인 간 읽기 import 는 허용된다 (boundary:check 가 막지 않는다).
// 경계의 뜻은 격리가 아니라 **소유 표시**다 — 어디를 열면 그 의미가 있고 누가 그 필드를 바꾸는가.

import type { InteractionHandler, WorldSystem } from '../../../engine/world-kernel/content';
import type { ActionCompletions } from './base/action-progress';
import type {
  AttributesView,
  EntityView,
  GameViewSnapshot,
  HudItemView,
  InteractionView,
  VitalityView,
} from '../protocol/gameview';
import type { ActorState } from './base/actor';
import type { WorldState } from './base/world-state';

/** 투영 조립기가 만들어 도메인 기여 함수에 넘기는 관찰의 문맥 */
export interface ProjectionContext {
  /** 이 관찰 결과를 받는 관찰자 */
  observerId: string;
  /** 그 관찰자의 몸 — "나만의 것" 판정의 기준 */
  self: ActorState;
}

/**
 * 조립 중인 Actor 관찰 — 도메인이 자기 자리를 채운다 (사실 2).
 * base 가 골격을 세우고 각 도메인이 자기 필드를 더한 뒤 EntityView 계약이 된다.
 * attributes 가 Partial 인 것은 조립 중이기 때문이다 — 계약의 완전성은 04 spec 검증이 지킨다.
 */
export interface ActorViewDraft extends Omit<EntityView, 'attributes' | 'vitality'> {
  attributes: Partial<AttributesView>;
  vitality?: VitalityView;
}

/** 도메인이 Snapshot 뿌리에 채우는 자리 (예: combat → strikes · debug → commands) */
export type SnapshotFields = Partial<
  Pick<GameViewSnapshot, 'strikes' | 'commands' | 'debug'>
>;

export interface DomainProjection {
  /**
   * Actor 관찰에 자기 도메인 필드를 더한다 (예: combat → vitality·combatStats).
   * state 를 함께 받는 이유: 파생 관찰 중에는 세계 시각을 읽는 것이 있다
   * (예: Guard.Broken 은 GuardBrokenUntil 과 World.Time 의 비교다).
   */
  decorateActor?(
    view: ActorViewDraft,
    actor: ActorState,
    state: WorldState,
    ctx: ProjectionContext,
  ): void;
  /** 자기 도메인의 비-Actor 존재 (예: mining → 광맥) */
  entities?(state: WorldState, ctx: ProjectionContext): EntityView[];
  /** 가용성 목록 기여 (예: combat → 스킬 3종 + 막기) */
  interactions?(state: WorldState, ctx: ProjectionContext): InteractionView[];
  /** HUD 기여 (예: mining → inventory.stone) */
  hud?(state: WorldState, ctx: ProjectionContext): HudItemView[];
  /** Snapshot 뿌리의 자기 자리 (예: combat → strikes) */
  snapshotFields?(state: WorldState, ctx: ProjectionContext): SnapshotFields;
}

export interface WorldDomain {
  /** 이 도메인의 이름 — 조립·관찰에서 도메인을 부르는 이름이다 */
  id: string;
  /** 이 도메인의 interaction 항목들 — index 가 도메인 순서대로 잇는다 */
  interactions: readonly InteractionHandler<WorldState>[];
  /** 이름 붙은 시스템 부품 — 순서는 index 의 배열이 소유한다 (사실 1) */
  systems: Readonly<Record<string, WorldSystem<WorldState>>>;
  /**
   * 자기 도메인이 소유한 행동이 Duration 을 채웠을 때 하는 일 (표 항목).
   * base 의 RULE-ACTION-PROGRESS-001 이 이 표를 보고 부른다 — base 는 도메인을 알지 않는다.
   */
  actionCompletions?: ActionCompletions;
  /** 투영 기여 (사실 3) — base/projection 조립기가 정해진 순서로 부른다 */
  projection?: DomainProjection;
}
