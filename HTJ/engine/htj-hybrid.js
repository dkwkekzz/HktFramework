// htj-hybrid.js — HTJ 확장성 레버 2 의 *자동 트리거(스케줄러 층)*: 동결된 덩어리를 자동 승격한다.
//
//   design/scalability.md §0 목적 ②·§2 레버2·§4 S5·§5("측정으로 결정"). 그동안 부품을 따로 박았다 —
//   검출(0014)·동결=안정 판정(0025)·보존 이관(0026/0029)·개체 동역학(0027/0028). 이 파일은 그 부품을
//   *잇는 스케줄러*다(법칙을 더하는 게 아니라 컨테이너/스케줄러 층 — design §5 "법칙 대체 말고 층을 갈아끼움").
//
//   autoPromoteStable(world, tracker, opts): 활동도 추적기(S3)가 *동결*(streak≥hold)로 판정한 블록에
//     온전히 든 덩어리를, 검출(S4)→승격(S5)으로 격자에서 빼낸다. = "안정되면(동결) 개체로 올린다"의 배선.
//     반환 { entities, removedCells, promoted }. 흔들리는(아직 활성) 덩어리는 *안* 올린다 — 동결만 올린다.
//
//   레버2 실현 측정(§5 게이트): 승격은 *활성 격자 칸을 실제로 줄인다*(별 본체가 격자서 빠짐) — 레버1(0023)이
//     블록 점유 100% 천장에 막혀 못 한 일. activeCellCount 로 전후를 잰다. (단 dense 법칙[gravity 등]은 여전
//     전-격자 → 완전 실현은 S6 + 전 법칙 sparse 필요. 이 단위는 *객체 칸 제거*를 측정 — 정직한 부분 실현.)
//
//   세계(스케줄러) 그 자체 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다). cluster·promote·
//   entity 모듈만 잇는다(engine→engine 단방향). 자동 *강등*(외란→유체 복원)은 후속 단위.
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./htj-cluster.js'), require('./htj-promote.js'), require('./htj-entity.js'));
  } else {
    root.HTJHybrid = factory(root.HTJCluster, root.HTJPromote, root.HTJEntity);
  }
})(typeof self !== 'undefined' ? self : this, function (HTJCluster, HTJPromote, HTJEntity) {
  'use strict';

  const RHO = 'energy';

  // 격자의 비-영(활성) 셀 수 — 활성-배선 법칙의 작업량 프록시(레버2 실현 측정 공유, 0018/0023 류).
  function activeCellCount(world) {
    const r = world.fields[RHO]; let c = 0;
    for (let i = 0; i < r.length; i++) if (r[i] !== 0) c++;
    return c;
  }

  // 동결된 덩어리 자동 승격 — tracker 가 streak≥hold(동결=안정)로 본 블록에 *온전히* 든 덩어리만 promote.
  //   opts: { hold(기본 3), eps(검출 임계·필수에 가까움), minCells(기본 2) }.
  //   "온전히 든"=덩어리의 모든 셀이 동결 블록 소속. 한 셀이라도 아직 활성(흔들림)이면 안 올린다(보수적·안전).
  function autoPromoteStable(world, tracker, opts) {
    opts = opts || {};
    const hold = opts.hold != null ? opts.hold : 3;
    const minCells = opts.minCells != null ? opts.minCells : 2;
    const N = world.N, NN = N * N, bs = tracker.blockSize;
    const clumps = HTJCluster.detectClumps(world, { eps: opts.eps, minCells, collectCells: true });
    const entities = [];
    let removedCells = 0;
    for (let c = 0; c < clumps.length; c++) {
      const cells = clumps[c].cellList;
      let allFrozen = true;
      for (let k = 0; k < cells.length; k++) {
        const i = cells[k], x = i % N, y = ((i - x) / N) % N, z = (i - x - y * N) / NN;
        if (tracker.streakOf((x / bs) | 0, (y / bs) | 0, (z / bs) | 0) < hold) { allFrozen = false; break; }
      }
      if (!allFrozen) continue;                       // 아직 안 멈춤 → 안 올림(흔들리는 유체는 격자에)
      entities.push(HTJPromote.promote(world, cells));  // 동결 → 승격(격자서 빼냄·활성 칸 급감)
      removedCells += cells.length;
    }
    return { entities, removedCells, promoted: entities.length };
  }

  // 승격된 개체들을 한 step 굴린다(편의) — 개체간 중력(0028) + 위치 적분(0027·토러스).
  //   opts: { dt, G, soft, N }. 개체 동역학은 격자와 독립(O(개체)) — 격자는 흐르는 유체만 돈다.
  function stepEntities(entities, opts) {
    opts = opts || {};
    const dt = opts.dt != null ? opts.dt : 0.05;
    if (opts.G) HTJEntity.applyEntityGravity(entities, dt, { G: opts.G, soft: opts.soft });
    HTJEntity.stepEntities(entities, dt, { N: opts.N });
    return entities;
  }

  return { autoPromoteStable, stepEntities, activeCellCount, VERSION: 1 };
});
