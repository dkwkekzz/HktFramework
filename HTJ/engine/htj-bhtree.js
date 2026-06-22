// htj-bhtree.js — HTJ 확장성 §3·§4 S6: Barnes-Hut 옥트리 중력(전역 항을 O(N log N)으로).
//
//   design/scalability.md §3("중력이 진짜 적")·§4 S6. 자기중력은 모든 질량이 모든 질량을 끄는 *전역* 항이라
//   직접합산은 O(N²)·격자 Poisson 은 전-격자 O(N³·iters) — 세계가 커지면 마지막 병목이다(0023 도 gravity
//   지배 확인·0030 도 dense gravity 천장). Barnes-Hut: 멀리 있는 질량 무리를 *하나의 질량(CoM)*으로 근사해
//   O(N log N) 으로 떨군다. 승격 개체(레버2)와 궁합이 좋다 — 개체가 곧 트리의 잎(§3 권장).
//
//   computeAccelerations(bodies, opts): bodies=[{x,y,z,mass}] (유체 블록 응집 + 승격 개체를 *한 트리*에).
//     opts { G(기본 1), theta(개방각·기본 0.5·작을수록 정확), soft(특이점 완화) }.
//     반환 { acc:[[ax,ay,az],…], interactions } — interactions=실제 상호작용 수(O(N log N) 실측 증거).
//     θ=0 이면 전부 재귀 → *직접합산과 기계 정밀도로 일치*(정확성 관문). θ>0 이면 O(N log N)·오차 O(θ²).
//
//   세계(법칙·솔버) 그 자체 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다). 순수 함수.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJBHTree = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 옥트리 노드: 빈 노드 / 잎(몸체 1개) / 내부(자식 8). mass·com 은 삽입 중 누적.
  function makeNode(cx, cy, cz, size) {
    return { cx, cy, cz, size, mass: 0, mx: 0, my: 0, mz: 0, body: -1, children: null };
  }
  // 위치가 노드 중심 기준 어느 옥탄트(0..7)인지.
  function octant(node, x, y, z) {
    return (x >= node.cx ? 1 : 0) | (y >= node.cy ? 2 : 0) | (z >= node.cz ? 4 : 0);
  }
  function childNode(node, oct) {
    const h = node.size / 2, q = h / 2;
    const cx = node.cx + ((oct & 1) ? q : -q);
    const cy = node.cy + ((oct & 2) ? q : -q);
    const cz = node.cz + ((oct & 4) ? q : -q);
    return makeNode(cx, cy, cz, h);
  }
  // 몸체 i 를 노드에 삽입(BH 표준: 잎이면 기존 몸체를 자식으로 밀어내려 세분). mass·com 누적.
  function insert(node, i, bodies, depth) {
    const b = bodies[i];
    node.mass += b.mass; node.mx += b.mass * b.x; node.my += b.mass * b.y; node.mz += b.mass * b.z;
    if (node.body === -1 && node.children === null) { node.body = i; return; }   // 빈 → 잎
    if (node.children === null) {                                                // 잎 → 내부(기존 몸체 내림)
      node.children = new Array(8).fill(null);
      const old = node.body; node.body = -1;
      if (depth < 32) { const oo = octant(node, bodies[old].x, bodies[old].y, bodies[old].z); (node.children[oo] || (node.children[oo] = childNode(node, oo))); insert(node.children[oo], old, bodies, depth + 1); }
    }
    if (depth >= 32) return;   // 같은 점이 여럿이면 무한 세분 방지(깊이 한계 — soft 가 힘은 막음)
    const o = octant(node, b.x, b.y, b.z);
    if (!node.children[o]) node.children[o] = childNode(node, o);
    insert(node.children[o], i, bodies, depth + 1);
  }

  // 몸체 i 에 작용하는 가속도를 노드로부터 누적(θ 기준: s/d<θ 면 CoM 한 점으로 근사·아니면 재귀).
  function accel(i, node, bodies, G, theta2, soft2, out) {
    let interactions = 0;
    if (node.mass === 0) return 0;
    const b = bodies[i];
    if (node.body === i && node.children === null) return 0;   // 자기 자신(잎) — 건너뜀
    // 노드 CoM.
    const comx = node.mx / node.mass, comy = node.my / node.mass, comz = node.mz / node.mass;
    const dx = comx - b.x, dy = comy - b.y, dz = comz - b.z;
    const d2 = dx * dx + dy * dy + dz * dz + soft2;
    if (node.children === null) {                              // 잎(다른 몸체) — 직접
      const inv = 1 / (d2 * Math.sqrt(d2));
      out[0] += G * node.mass * dx * inv; out[1] += G * node.mass * dy * inv; out[2] += G * node.mass * dz * inv;
      return 1;
    }
    if (node.size * node.size < theta2 * d2) {                 // s/d < θ → CoM 한 점으로 근사
      const inv = 1 / (d2 * Math.sqrt(d2));
      out[0] += G * node.mass * dx * inv; out[1] += G * node.mass * dy * inv; out[2] += G * node.mass * dz * inv;
      return 1;
    }
    for (let c = 0; c < 8; c++) if (node.children[c]) interactions += accel(i, node.children[c], bodies, G, theta2, soft2, out);
    return interactions;
  }

  function computeAccelerations(bodies, opts) {
    opts = opts || {};
    const G = opts.G != null ? opts.G : 1;
    const theta = opts.theta != null ? opts.theta : 0.5;
    const soft = opts.soft != null ? opts.soft : 0;
    const n = bodies.length, acc = new Array(n);
    for (let i = 0; i < n; i++) acc[i] = [0, 0, 0];
    if (n === 0) return { acc, interactions: 0 };
    let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
    for (const b of bodies) { if (b.x < minx) minx = b.x; if (b.y < miny) miny = b.y; if (b.z < minz) minz = b.z; if (b.x > maxx) maxx = b.x; if (b.y > maxy) maxy = b.y; if (b.z > maxz) maxz = b.z; }
    let size = Math.max(maxx - minx, maxy - miny, maxz - minz); if (!(size > 0)) size = 1; size *= 1.001;
    const root = makeNode((minx + maxx) / 2, (miny + maxy) / 2, (minz + maxz) / 2, size);
    for (let i = 0; i < n; i++) insert(root, i, bodies, 0);
    const theta2 = theta * theta, soft2 = soft * soft;
    let interactions = 0;
    for (let i = 0; i < n; i++) interactions += accel(i, root, bodies, G, theta2, soft2, acc[i]);
    return { acc, interactions };
  }

  // 직접합산(O(N²)) — 정확성 대조용 기준(verify 공유). 같은 soft·G.
  function directAccelerations(bodies, opts) {
    opts = opts || {};
    const G = opts.G != null ? opts.G : 1, soft2 = (opts.soft || 0) ** 2, n = bodies.length;
    const acc = new Array(n); for (let i = 0; i < n; i++) acc[i] = [0, 0, 0];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = bodies[j].x - bodies[i].x, dy = bodies[j].y - bodies[i].y, dz = bodies[j].z - bodies[i].z;
      const d2 = dx * dx + dy * dy + dz * dz + soft2, inv = 1 / (d2 * Math.sqrt(d2));
      acc[i][0] += G * bodies[j].mass * dx * inv; acc[i][1] += G * bodies[j].mass * dy * inv; acc[i][2] += G * bodies[j].mass * dz * inv;
    }
    return { acc, interactions: n * (n - 1) };
  }

  return { computeAccelerations, directAccelerations, VERSION: 1 };
});
