// =====================================================================
// 지역 지도 — 이동·접근권 (콘텐츠 단계 C3·C4·C7)
// ---------------------------------------------------------------------
// world-composition.yaml `regions` 를 살아있는 이동 그래프로 읽는다. 좌표가 아니라
// 인접·이동 비용(틱)이다 (§4.1). 이동은 틱을 소모하므로 주기 시계(CycleClock)와
// 맞물려 "위험·거리·시간이 가격"(배치 원칙 ㉢)의 실체가 된다.
// R0(신의 거처)은 월식 창에만 통행 가능 — blocked 훅으로 접근권을 잠근다.
// =====================================================================
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { dataPath } from '../paths.js';

export function loadComposition(file = dataPath('world-composition.yaml')) {
  return yaml.load(readFileSync(file, 'utf8'));
}

export class RegionMap {
  constructor(regions) {
    this.regions = regions;
    this.byId = new Map(regions.map((r) => [r.id, r]));
  }

  static load() { return new RegionMap(loadComposition().regions); }

  get(id) { return this.byId.get(id) ?? null; }
  adjacent(id) { return this.get(id)?.adjacent ?? []; }
  moveCost(from, to) { return this.get(from)?.move_cost?.[to] ?? null; }
  environment(id) { return this.get(id)?.environment ?? {}; }
  stagesOf(id) { return this.get(id)?.stages ?? []; }
  regionOfStage(sid) {
    for (const r of this.regions) if ((r.stages ?? []).includes(sid)) return r.id;
    return null;
  }

  // 다익스트라 최단 이동 비용 경로 (틱). blocked(regionId) → true 면 통행 불가
  // (단, 목적지 자신은 blocked 여부와 무관하게 도착 대상으로 허용).
  path(from, to, { blocked = () => false } = {}) {
    if (from === to) return { cost: 0, path: [from] };
    const dist = new Map([[from, 0]]);
    const prev = new Map();
    const pq = [[0, from]];
    while (pq.length) {
      pq.sort((a, b) => a[0] - b[0]);
      const [d, u] = pq.shift();
      if (u === to) break;
      if (d > (dist.get(u) ?? Infinity)) continue;
      for (const v of this.adjacent(u)) {
        if (blocked(v) && v !== to) continue;
        const w = this.moveCost(u, v) ?? 1;
        const nd = d + w;
        if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); pq.push([nd, v]); }
      }
    }
    if (!dist.has(to)) return null;
    const seq = [to];
    let c = to;
    while (c !== from) { c = prev.get(c); if (c === undefined) return null; seq.unshift(c); }
    return { cost: dist.get(to), path: seq };
  }
}
