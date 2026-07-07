// ============================================================================
// 결정론 월드 유도 — 재시딩 트릭 (설계 문서 §4, HktSim_Design §2.5)
//
// 자원 노드·몬스터의 "배치와 용량" 은 동기화하지 않는다. 서버·클라가
// 같은 시드에서 같은 배치를 유도하고, 서버는 "잔고" 만 권위로 가진다.
// ============================================================================

import { mulberry32, randInt } from './rng.js';
import {
  WORLD_SEED, WORLD_SIZE, WORLD_HEIGHT, NODE_COUNT, NODE_MIN_MAX, NODE_MAX_MAX,
  MOB_COUNT, MOB_ENERGY, POOL, FIELD_GRID, FIELD_RICH_MIN, FIELD_RICH_MAX,
} from './constants.js';

export function generateWorld(seed = WORLD_SEED) {
  const rng = mulberry32(seed);
  const margin = 100;

  const nodes = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    nodes.push({
      id: `${POOL.NODE}${i}`,
      x: randInt(rng, margin, WORLD_SIZE - margin),
      y: randInt(rng, margin, WORLD_SIZE - margin),
      z: randInt(rng, margin, WORLD_HEIGHT - margin),   // 3D 배치 (높이)
      max: randInt(rng, NODE_MIN_MAX, NODE_MAX_MAX),
    });
  }

  const mobs = [];
  for (let i = 0; i < MOB_COUNT; i++) {
    mobs.push({
      id: `${POOL.MOB}${i}`,
      x: randInt(rng, margin, WORLD_SIZE - margin),
      y: randInt(rng, margin, WORLD_SIZE - margin),
      z: randInt(rng, margin, WORLD_HEIGHT - margin),
      max: MOB_ENERGY,
    });
  }

  return { nodes, mobs };
}

// A7-2 필드 이질화: 셀별 풍요도(배수)를 시드에서 유도한다 (배치처럼 동기화하지 않는 시드 유도).
// 노드/몹 유도와 독립 스트림(seed 파생)이라 generateWorld 결정론에 영향 없음. 결정론 정수.
// 반환: Map `cx_cy` -> 풍요도 배수 [FIELD_RICH_MIN..FIELD_RICH_MAX].
export function generateFieldRichness(seed = WORLD_SEED) {
  const rng = mulberry32((seed ^ 0x0f1e1d2c) >>> 0);
  const richness = new Map();
  for (let cy = 0; cy < FIELD_GRID; cy++)
    for (let cx = 0; cx < FIELD_GRID; cx++)
      richness.set(`${cx}_${cy}`, randInt(rng, FIELD_RICH_MIN, FIELD_RICH_MAX));
  return richness;
}
