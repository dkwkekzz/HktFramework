// proto-adventure 팩의 GameView 확장 (P2 ADDED) — World → View 계약의 팩 소유분.
//
// 봉투(entities/interactions/hud/commands/outcomes 구조)는 engine/protocol-core 가
// 소유하고, 이 세계의 의미는 **도메인 파일**이 소유한다 — 트랙이 자기 파일만 고치므로
// 병렬 작업이 이 파일을 다투지 않는다 (guides/works.md 병렬 규칙):
//
//   gameview-combat.ts   전투 — 생명·능력치·타격 경위·앎·지목·태도 (COMBAT 트랙)
//   gameview-item.ts     아이템 — 소지품·자리·적용 (ITEM 트랙)
//   gameview-terrain.ts  땅 — 자리의 범위·지금 걸린 법칙 (TERRAIN 트랙)
//   gameview-growth.ts   성장 — 자란 것·방금 쌓인 일들 (GROWTH 트랙)
//   이 파일              봉투 재수출 + 스냅샷 조립만. 새 도메인 타입을 여기 더하지 않는다
//
// 팩의 world 가 채우고 팩의 view 가 읽으므로 타입 안전은 팩 안에서 완결된다.
// 소비처는 언제나 이 파일 하나만 import 한다 — 도메인 파일을 직접 import 하지 않는다.
// 구체 계약의 원본은 cycles/<CycleId>/04-gameview.spec.yaml 이다.

import type {
  EntityView as CoreEntityView,
  GameViewSnapshot as CoreGameViewSnapshot,
  InteractionView as CoreInteractionView,
} from '../../../engine/protocol-core/gameview';
import type {
  AllocationChoiceView,
  AttributesView,
  CancelEventView,
  CurrentTargetView,
  SkillProfileView,
  StrikeEventView,
  UnharmedContactView,
  VitalityView,
} from './gameview-combat';
import type {
  EquipmentSlotView,
  InventoryItemView,
  InventoryRoomView,
} from './gameview-item';
import type { GrowthEventView, GrowthView } from './gameview-growth';
import type { GroundView } from './gameview-terrain';

// 봉투 타입은 그대로 다시 내보낸다 — 팩 코드는 자기 protocol 하나만 바라본다.
export type {
  BodyView,
  CommandDomainKind,
  CommandDomainOptionView,
  CommandDomainView,
  CommandParameterView,
  CommandView,
  DebugAuthorityView,
  GameViewPosition,
  HudItemView,
  ObserverView,
  RequestOutcomeView,
  SwingView,
} from '../../../engine/protocol-core/gameview';

// 도메인 타입도 여기서 전부 다시 내보낸다.
export type * from './gameview-combat';
export type * from './gameview-item';
export type * from './gameview-terrain';
export type * from './gameview-growth';

// 이 팩의 존재 관찰 — 봉투의 EntityView 에 생명과 속성이 더해진다.
export interface EntityView extends CoreEntityView {
  vitality?: VitalityView; // C007 — character 에만 실린다
  attributes?: AttributesView; // C007 R2 — character 에만 실린다
  // C019 ADDED — 진행 중인 기술이 지금 어느 구간인가 (INTENT-STARTUP-IS-OBSERVABLE-001).
  // **기술을 쓰는 중일 때만 실린다** — 걷거나 캐거나 살펴보는 행동에는 선딜이라는
  // 의미가 없다. 없음은 "모른다" 가 아니라 "구간이라는 것이 없는 행동이다" 를 뜻한다.
  //
  // 세계가 판정한 값이다. View 는 progress 와 경계로 이 값을 만들어내지 않는다 —
  // 경계는 기술마다 다르고 세계 안에만 있으므로, 복제하면 두 개의 진실이 생긴다
  // (DC-WORLD-OWNS-THE-SURFACE-LIST).
  //
  // 읽는 법: startup 이면 지금 넣은 개입이 그 기술을 없앤다.
  //          active · recovery 면 같은 개입을 넣어도 그 기술은 끝까지 나간다.
  actionPhase?: string; // startup | active | recovery
}

export interface InteractionView extends CoreInteractionView {
  profile?: SkillProfileView;
}

// 이 팩의 관찰 결과 — 봉투에 타격 결과가 더해지고, 존재/interaction 이 팩 형으로 좁혀진다.
export interface GameViewSnapshot extends CoreGameViewSnapshot {
  entities: EntityView[];
  interactions: InteractionView[];
  strikes: StrikeEventView[]; // C007 ADDED
  contacts: UnharmedContactView[]; // C018 ADDED — 닿았으나 성립하지 않은 접촉
  cancels: CancelEventView[]; // C019 ADDED — 선딜 중에 끊긴 기술
  currentTarget: CurrentTargetView; // C017 ADDED — 늘 실린다
  inventory: InventoryItemView[]; // C020 ADDED — 내 몸이 지닌 것 전부
  inventoryRoom: InventoryRoomView; // C022 ADDED — 쓴 자리와 전체
  equipment: EquipmentSlotView[]; // C023 ADDED — 적용 자리 전부 (빈 자리 포함)
  // C-TERRAIN-001 ADDED — 무대의 자리들과 지금 내게 걸린 법칙.
  // **몸이 아닌 것이 실리는 첫 항목이다** (gameview-terrain.ts).
  ground: GroundView;
  // C-COMBAT-001 ADDED — 고를 수 있는 배분 전부 (지금 고를 수 없는 것도 포함).
  // 소지품·적용 자리와 나란한 세 번째 목록이며 내 몸의 것만 실린다.
  allocations: AllocationChoiceView[];
  // C-GROWTH-001 ADDED — 자란 것. 내 몸의 것만 실리며 **언제나 실린다**
  // (아직 아무것도 쌓지 않았어도 온다).
  growth: GrowthView;
  // C-GROWTH-001 ADDED — 방금 쌓인 일들. strikes · contacts · cancels 와 나란한
  // 네 번째 목록이며 같은 수명을 가진다. 내 것만 실린다.
  growthEvents: GrowthEventView[];
}
