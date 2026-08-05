// C01 검증 장면 프리셋 — D 계층 런타임이 아니라 *초기 조건* 모음이다.
// 각 장면은 세계 상태 값만 바꾼다. 어떤 Situation 이 성립하는지는 D5 가 상태에서 계산한다
// (Situation 자체의 판정·발생은 E0 의 몫 — 여기서는 충돌 구조만 확인한다).
import { defineC01Ontology } from '../../ontology/src/c01Ontology.js';
import { createInitialWorldState, validateWorldState } from '../../ontology/src/worldOntology.js';
import { createC01Cast, createC01Player } from '../../subjects/src/c01Subjects.js';
import { buildC01RequirementGraph } from '../../world-requirements/src/c01Requirements.js';
import { C01_STRATEGIES } from '../../possibilities/src/c01Strategies.js';
import { compileC01World, fitPopulationToWorld, toWorldState, FORAGE_SLACK } from '../../world-compiler/src/c01World.js';

export const DEFAULT_SEED = 11;
export { FORAGE_SLACK as BASE_FORAGE_SLACK };

/**
 * 기준 장면 — 균형 잡힌 사냥터. 어느 시드에서도 압력 0·충돌 0 이어야 한다 (장면별 충돌의 대조군).
 * 지형·규칙·초기 재고는 손으로 적지 않고 W 가 요구(Q)에서 실체화한 정식 세계를 그대로 쓴다.
 */
export function buildBaseScene(seed = DEFAULT_SEED) {
  const ontology = defineC01Ontology();
  const world = compileC01World({ requirementGraph: buildC01RequirementGraph(C01_STRATEGIES), seed });
  const state = toWorldState(world, createInitialWorldState(ontology));

  const { subjects } = createC01Cast(seed, ontology);
  fitPopulationToWorld(world, subjects);          // 개체군은 세계 용량 안에 들어간다
  state.region.places['herd-valley'].carryingCapacity = world.places['herd-valley'].carryingCapacity;
  for (const s of Object.values(subjects)) state.subjects[s.id] = s;

  state.contracts = {
    'ct-1': { status: 'open', kind: 'cull' },
    'ct-2': { status: 'open', kind: 'subjugation' },
    'ct-3': { status: 'open', kind: 'survey' },
  };

  for (const [id, role] of [
    ['pl-tracker', 'tracker'], ['pl-hunter', 'hunter'],
    ['pl-crafter', 'dresser-crafter'], ['pl-trader', 'trader'],
  ]) state.subjects[id] = createC01Player(id, role, ontology);

  const errors = validateWorldState(state, ontology);
  if (errors.length) throw new Error(`장면 상태가 스키마 위반:\n${errors.join('\n')}`);
  return { ontology, world, state, subjects: state.subjects };
}

const findByArchetype = (state, archetype) =>
  Object.values(state.subjects).find((s) => s.archetype === archetype);

/**
 * Situation 별 초기 조건. 각 함수는 base 장면 상태를 제자리에서 변형한다.
 * 주석의 "→" 는 어떤 인과로 그 Situation 의 경합 자원이 부족해지는지를 적은 것이다.
 */
export const C01_SITUATION_SCENES = {
  // 남획 → 무리 붕괴 → 굶주린 포식자가 목장으로, 시장 재고도 마름
  'ST-C01-01': (scene) => {
    findByArchetype(scene.state, 'herd-beast').population.count = 2;
    findByArchetype(scene.state, 'apex-monster').attrs.injury = 2;
    Object.assign(scene.state.resources, { hide: 0, 'monster-organ': 0, meat: 0 });
    scene.state.region.places['hunter-outpost'].threat = 6;
  },
  // 사냥 공백 → 무리 과잉 → 목초지 포화, 습지 군락 훼손, 약초 고갈
  // 개체수는 수용력 대비 상대값으로 둔다 — 절대값은 시드에 따라 의미가 달라진다 (I-1)
  'ST-C01-02': (scene) => {
    const capacity = scene.state.region.places['herd-valley'].carryingCapacity;
    findByArchetype(scene.state, 'herd-beast').population.count = capacity - 2;
    scene.state.resources['healing-herb'] = 0;
  },
  // 변이 조건 충족 → 희귀 개체 1 출현
  'ST-C01-03': (scene) => { scene.state.region.rareIndividuals = 1; },
  // 위험 사냥 누적 → 부상 조합원 급증, 치료제·약초 고갈
  'ST-C01-04': (scene) => {
    findByArchetype(scene.state, 'hunters-guild').injuredHunters = 4;
    Object.assign(scene.state.resources, { 'healing-potion': 1, 'healing-herb': 2 });
    findByArchetype(scene.state, 'villager').attrs.health = 5; // 부상 주민 1명
  },
  // 공급 과잉·붕괴 → 시장 재고와 반출 용량 경합
  'ST-C01-05': (scene) => {
    Object.assign(scene.state.resources, { hide: 1, 'monster-organ': 1, meat: 1 });
    scene.state.region.routes['export-route'].capacity = 2;
  },
};

export function buildSituationScene(situationId, seed = DEFAULT_SEED) {
  const apply = C01_SITUATION_SCENES[situationId];
  if (!apply) throw new Error(`미지 장면: ${situationId}`);
  const scene = buildBaseScene(seed);
  apply(scene);
  const errors = validateWorldState(scene.state, scene.ontology);
  if (errors.length) throw new Error(`${situationId} 장면이 스키마 위반:\n${errors.join('\n')}`);
  return scene;
}
