// content/regions — 이 팩의 Region 데이터 (C001 ADDED · C002 에서 방 여섯 · Connector 열 ·
// C003 에서 방 아홉 · Connector 열셋 · 중첩 둘 · C008 에서 방 열 · Connector 열넷 · 경계 둘 ·
// C009 에서 방 열하나 · Connector 열여섯 · 중첩 셋 · 경계 셋 ·
// C016 에서 Connector 열일곱 · 경계 넷 ·
// C019 에서 방 열셋 · Connector 열여덟 · 경계 셋 ·
// C020 에서 Connector 열아홉 · 경계 넷).
//
// world 와 view 가 함께 읽는 정적 사실이다. 세계 State 에 들어가지 않고 저장되지도 않는다 —
// 컨텐츠 데이터에서 다시 온다 (C001 02-world R7 · character-catalog 와 같은 성격).
// 소비처는 이 파일 하나만 import 한다. 경계 규칙 4 — 이 폴더는 engine 만 import 한다.

export type { RegionSpec, RegionRuleSpec } from './spec';
export { ANCHOR_LAYER } from './spec';
// 세계가 아는 방들의 목록 — C029 에서 이 파일에서 specs.ts 로 **옮겼다** (값도 차례도 그대로).
// 이 폴더 안에서 방 목록을 읽어야 하는 데이터 파일(access.ts)이 생겼고, 그것이 이 문(門)을
// 되부르면 순환이 나기 때문이다. 소비처가 읽는 이름과 자리는 한 글자도 달라지지 않는다.
export { REGION_SPECS, regionSpec } from './specs';
// 이 세계의 성질 어휘 — 축 다섯 · 관계 일곱 · answers 다섯 (C029 ADDED).
// terrain-rules · resource-ecology 와 같은 갈래의 "world 와 view 가 함께 읽는 데이터" 다.
export * from './properties';
// 방이 묻는 것 — Lock 의 형 · 흔적 · 현상의 코드 · Lock 색인 셋 (C029 ADDED).
// 문의 활성 조건과 표식의 요구가 여기로 옮겨 왔다 (graph.ts 의 표 둘이 사라졌다).
export * from './access';
// 지면의 표면·통행 규칙 표 — world 와 view 가 함께 읽는다 (C006 ADDED).
// 값의 원본은 terrain-rules.ts 이고, 이 문(門)을 통해 나간다.
export * from './terrain-rules';
// 이 숲의 재료 계통 — Material Seed 표 · 원천의 성질 · 흔적의 layer 와 태그 (C011 ADDED).
// terrain-rules 와 같은 갈래의 "world 와 view 가 함께 읽는 데이터" 다.
export * from './resource-ecology';
// 철이 방을 바꾸는 형 — 철 이름 · 덧씌움 layer 둘 · RegionSpec.phases 의 형들 (C016 ADDED).
// 같은 갈래다: 세계도 화면도 이 문(門)을 통해 읽는다.
export * from './phases';
// 이 세계를 지나가는 것들의 경로 — 시간표 · 마디 · 지나는 동안 하는 일 · 남기는 것 (C018 ADDED).
// 같은 갈래다: 세계는 시간표와 마디를, 화면은 경로 선의 이름을 이 문(門)을 통해 읽는다.
export * from './presence-routes';
// 이 세계의 생명 — 탄생 방식 넷의 어휘 · Life Seed 표 · 개체군의 id (C022 ADDED).
// 재료 계통(resource-ecology)과 같은 갈래의 "world 와 view 가 함께 읽는 데이터" 다.
export * from './lives';
// 방이 품은 생명 계통의 데이터 계약 — 탄생지 · 개체군 · 요구의 형과 조건 코드들 (C022 ADDED).
export * from './ecology';
export {
  REGION_GRAPH,
  FRONTIER_REGIONS,
  CLOSED_CONNECTORS,
  START_REGION_ID,
  FOREST_PATH,
  RUIN_TRAIL,
  DEEP_TRAIL,
  NEST_TRAIL,
  ORE_TRAIL,
  TREE_APPROACH,
  ORE_TREE_TRAIL,
  ANCIENT_GATE,
  RED_WASTE_PASS,
  ICE_CANYON_PASS,
  TREE_INNER_DOOR,
  TREE_FALL,
  HEART_RIVER,
  MAZE_GATE_RETURN,
  MAZE_HEART_GATE,
  INVERTED_GARDEN_DOOR,
  WALKING_FOREST_DOOR,
  // C019 ADDED — 협곡 안쪽으로 드는 오솔길
  FROST_CANYON_TRAIL,
  // C020 ADDED — 빙결 심층으로 드는 문 (그 문이 묻는 것은 이제 그 방의 access.locks 가 적는다)
  FROST_DEPTH_DOOR,
  RED_WASTE,
  INVERTED_GARDEN,
  WALKING_FOREST,
  FROST_DEPTH,
} from './graph';
export { WHITE_KING_DOMAIN, WHITE_GIANT_TREE } from './white-king-domain';
export { FOREST_EDGE } from './forest-edge';
export { FOREST_DEEP } from './forest-deep';
export { EXPLORER_RUIN } from './explorer-ruin';
export { PREDATOR_NEST } from './predator-nest';
export { BIO_ORE_FIELD } from './bio-ore-field';
// RED_EYE_TREE 는 C002 까지 graph.ts 의 경계 이름이었다 — 지어진 지금은 자기 방 파일이 소유한다.
// 소비처가 읽는 이름은 그대로다.
export { RED_EYE_TREE } from './red-eye-tree';
export { TREE_INNER_WORLD } from './tree-inner-world';
export { HEART_LAKE } from './heart-lake';
// FANTASY_MAZE 는 C007 까지 graph.ts 의 경계 이름이었다 — 지어진 지금은 자기 방 파일이 소유한다
// (RED_EYE_TREE 의 선례). 그 방의 layer 이름 셋과 식물 태그 넷도 그 파일이 소유한다:
// 세계는 통로 layer 를, 화면은 구역·통로·식물을 이 이름으로 읽는다.
export {
  FANTASY_MAZE,
  MAZE_PATTERN_DEFAULT,
  MAZE_PATTERN_P1,
  MAZE_PATTERN_P2,
  CELL_LAYER,
  PASSAGE_LAYER,
  CLUE_LAYER,
  SILVER_FERN,
  AMBER_FERN,
  CRIMSON_FERN,
  INDIGO_FERN,
} from './fantasy-maze';
// MAZE_HEART 는 C008 까지 이름조차 없던 곳이다 — C009 가 지었다 (01-spec SPEC-001).
export { MAZE_HEART } from './maze-heart';
// ICE_CANYON 은 C002 부터 graph.ts 의 경계 이름이었다 — 지어진 지금은 자기 방 파일이 소유한다
// (RED_EYE_TREE · FANTASY_MAZE 의 선례 · C019). FROST_CANYON 은 경계였던 적이 없다:
// 그 이름은 C019 가 처음 짓고 처음부터 방이다.
export { ICE_CANYON } from './ice-canyon';
export { FROST_CANYON } from './frost-canyon';
