// ============================================================================
// 결정론 월드 유도 — 재시딩 트릭 (설계 문서 §4, HktSim_Design §2.5)
//
// 자원 노드·몬스터의 "배치와 용량" 은 동기화하지 않는다. 서버·클라가
// 같은 시드에서 같은 배치를 유도하고, 서버는 "잔고" 만 권위로 가진다.
// ============================================================================

import { mulberry32, randInt } from './rng.js';
import {
  WORLD_SEED, WORLD_SIZE, NODE_COUNT, NODE_MIN_MAX, NODE_MAX_MAX,
  MOB_COUNT, MOB_ENERGY, POOL,
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
      max: randInt(rng, NODE_MIN_MAX, NODE_MAX_MAX),
    });
  }

  const mobs = [];
  for (let i = 0; i < MOB_COUNT; i++) {
    mobs.push({
      id: `${POOL.MOB}${i}`,
      x: randInt(rng, margin, WORLD_SIZE - margin),
      y: randInt(rng, margin, WORLD_SIZE - margin),
      max: MOB_ENERGY,
    });
  }

  return { nodes, mobs };
}
