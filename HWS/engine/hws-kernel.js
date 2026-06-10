/* HWS 공통 커널 — *동결된 원시형*. 모든 step 이 공유하는, step 간 변하지 않는 기반 함수만 둔다.
 *
 * 설계 동기(STATE §2 law-pipeline): step-0001~0010 은 sim-core.js 를 통째로 복사하며 진화했다 —
 *   그런데 그중 ~20개 헬퍼(disc·장부·측정·해시·centroid…)는 step 사이 *바이트 단위로 동일*했다.
 *   UI 를 engine/hws-ui.js 로 한 번 분리했듯(0007), 이 커널은 그 sim 쪽 중복을 끝낸다.
 *   여기 있는 것은 시뮬 *상태를 바꾸지 않는*(또는 외부 주입을 장부 보정하는) 순수/준순수 함수뿐 —
 *   세계의 *법칙*(매 tick E 를 흐르게/먹게/굳게 하는 항)은 engine/hws-laws.js 에 따로 산다.
 *
 * 불변 규칙: 이 파일은 *동결*이다. 한 번 들어온 함수의 산술은 바꾸지 않는다 — 바꾸면 과거 step 의
 *   재현 수치가 흔들린다(아카이브 재현성). 회귀의 골든 레퍼런스는 engine/validate/golden.json 의
 *   상태 해시(hashState)다: 커널/법칙을 수정하면 `node engine/validate/verify-engine.js` 가 전 시나리오
 *   해시를 재검증해 드리프트를 즉시 잡는다(동결 파일 대신 동결 해시).
 *
 * 브라우저: window.HWS_KERNEL / Node: module.exports.
 */
(function (global) {
  'use strict';

  /* ── 결정론적 PRNG (mulberry32) — 초기 노이즈에만 사용 ── */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), a | 1);
      t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── 결정론적 tumble 해시 (정수 avalanche) — 탐사 방향을 *구배와 무상관*으로 뽑되 시드 결정론 유지.
   * (x,y,tick,seed) 의 순수 함수 → Math.random 금지(척추), 같은 시드 2회 비트 동일. 두 셀이 같은 tick 에
   * 같은 칸일 수 없으므로(점유) 개체별 고유. "무작위"는 *생성이 비결정*이 아니라 *구배와 탈상관*을 뜻한다. */
  function tumbleHash(x, y, t, seed) {
    var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) +
             Math.imul(t | 0, 2246822519) + Math.imul(seed | 0, 3266489917)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  /* 결정론적 3D tumble 해시(step-0028 V1) — tumbleHash 의 z-확장. z=0 이면 imul(0,·)=0 이라 tumbleHash(x,y,t,seed) 와 *비트 동일*
   * (2D 해시 = 3D 해시의 z=0 슬라이스 → 기존 법칙은 tumbleHash 를 그대로 써 회귀 0; 3D 에이전트/별 siting 만 이걸 쓴다). */
  function tumbleHash3(x, y, z, t, seed) {
    var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) +
             Math.imul(z | 0, 2147483647) + Math.imul(t | 0, 2246822519) + Math.imul(seed | 0, 3266489917)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  /* 반경 r 원판에 포함되는 셀 인덱스 목록 (wrap) */
  function discCells(W, H, cx, cy, r) {
    var cells = [];
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          var x = (cx + dx + W) % W, y = (cy + dy + H) % H;
          cells.push(y * W + x);
        }
      }
    }
    return cells;
  }

  /* 반경 r 원판의 (dx,dy) 오프셋 목록 — 중심 제외, 스캔 순서(dy 바깥·dx 안쪽) 고정. */
  function discOffsets(r) {
    var offs = [];
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (dx * dx + dy * dy <= r * r) offs.push([dx, dy]);
      }
    }
    return offs;
  }

  /* 반경 r 공(ball)에 포함되는 셀 인덱스 목록(step-0028 V1) — x·y wrap, z 벽(클램프). 인덱스 (z·H+y)·W+x.
   * D=1·cz=0 이면 dz=0 만 살아 discCells(W,H,cx,cy,r) 와 *셀·순서 비트 동일*(dz 바깥 루프 1회) → 3D 헬퍼가 2D 의 진부분집합(회귀 안전). */
  function discCells3(W, H, D, cx, cy, cz, r) {
    var cells = [];
    for (var dz = -r; dz <= r; dz++) {
      var z = cz + dz; if (z < 0 || z >= D) continue;                 // z 는 wrap 안 함 — 바닥/천장 벽
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy + dz * dz <= r * r) {
            var x = (cx + dx + W) % W, y = (cy + dy + H) % H;
            cells.push((z * H + y) * W + x);
          }
        }
      }
    }
    return cells;
  }

  /* 반경 r 공의 (dx,dy,dz) 오프셋 목록(step-0028 V1) — 중심 제외, 스캔 순서(dz·dy·dx) 고정. D=1 호출부는 dz=0 만 쓰면 discOffsets 와 등가. */
  function ballOffsets(r) {
    var offs = [];
    for (var dz = -r; dz <= r; dz++) {
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          if (dx * dx + dy * dy + dz * dz <= r * r) offs.push([dx, dy, dz]);
        }
      }
    }
    return offs;
  }

  /* 농도 창 커널 — 포물선 bump. m=mc 에서 1, |m-mc|>=w 에서 0 (compact support). */
  function aggKernel(m, mc, w) {
    var t = (m - mc) / w;
    t = t * t;
    return t < 1 ? 1 - t : 0;
  }

  /* 생명 스폰 — (x,y)에 에이전트를 놓는다. 초기 생물량은 터에서 끌어온다(E↓ m↑, 닫힌 장부). */
  function spawnAgent(sim, x, y, m0) {
    var p = sim.p;
    var cx = ((x % p.W) + p.W) % p.W, cy = ((y % p.H) + p.H) % p.H;
    var center = cy * p.W + cx;
    var want = m0 != null ? m0 : p.mSeed;
    var seedM = sim.E[center] < want ? sim.E[center] : want;
    sim.E[center] -= seedM;
    var a = {
      x: cx, y: cy, m: seedM,
      cells: discCells(p.W, p.H, cx, cy, p.lifeR),
      center: center, bornTick: sim.tick
    };
    sim.agents.push(a);
    return a;
  }

  /* 별 스폰(step-0011 bootstrap) — (x,y)에 별을 놓는다. 연료는 *외부 할당*(별의 질량) — E 를 깎지 않는다.
   * 별이 연료를 태워 E 로 주입할 때 비로소 sim.injected 로 장부에 들어온다(외부 source 와 같은 경계). 활성도
   * 축의 *소산 극단*(SPINE 결정2): R 누적 핵에서 점화하는 내생 주입원이며, 그 자리를 떠돈다(서행 채식지). */
  function spawnStar(sim, x, y, fuel0) {
    var p = sim.p;
    var cx = ((x % p.W) + p.W) % p.W, cy = ((y % p.H) + p.H) % p.H;
    var center = cy * p.W + cx;
    var f = fuel0 != null ? fuel0 : p.starFuel0;
    var DIR = [[1, 0], [-1, 0], [0, 1], [0, -1]], d = DIR[tumbleHash(cx, cy, sim.tick, sim.seed) & 3];
    var st = { x: cx, y: cy, center: center, fuel: f, cells: discCells(p.W, p.H, cx, cy, p.starR),
      vx: d[0], vy: d[1], age: 0, bornTick: sim.tick };
    sim.stars.push(st);
    return st;
  }

  /* 유전 씨앗(step-0015 bootstrap) — (cx,cy) 반경 r 원판에 R 을 amount 씩 굳히고 유전형 태그 tag 를 박는다.
   * 최초 복제자(genotype)를 세계에 심는 setup 연산 — 외부에서 들여온 질량이라 E0 를 함께 올려 장부를 보정한다
   * (paintStore 와 같은 정신). geneInit 을 켜 해시가 G 를 먹게 한다(결정론·재현에 유전형 포함). 이후 ⑤d replicate
   * 이 이 주형에서 자기복제한다(E→R 쌍 거래 + 태그 복사). tag 는 1..geneTypes(다양성은 *속성*에 — 단일 척추). */
  function spawnGene(sim, cx, cy, r, tag, amount) {
    var cells = discCells(sim.p.W, sim.p.H, cx, cy, r), R = sim.R, G = sim.G, added = 0;
    var am = amount != null ? amount : 1.0, tg = tag != null ? tag : 1;
    for (var k = 0; k < cells.length; k++) { R[cells[k]] += am; G[cells[k]] = tg; added += am; }
    sim.E0 += added; sim.geneInit = true;
    return added;
  }

  /* 총 생물량 M = Σ 에이전트.m */
  function totalBiomass(sim) {
    var M = 0, ag = sim.agents;
    for (var k = 0; k < ag.length; k++) M += ag[k].m;
    return M;
  }

  /* 총 별 연료 F = Σ 별.fuel (장부 항. step-0011 — 별이 없으면 0, 회귀 무관). */
  function totalFuel(sim) {
    var f = 0, st = sim.stars;
    if (st) for (var i = 0; i < st.length; i++) f += st[i].fuel;
    return f;
  }

  /* 총 저장체 R = Σ R[i] (장부 항. step-0008) */
  function totalStore(sim) {
    var s = 0, R = sim.R;
    for (var i = 0; i < R.length; i++) s += R[i];
    return s;
  }

  /* 닫힌 장부 검사: sumE + M + R + evaporated + sunk + metabolized - injected = E0
   * 기복(step-0009)은 확산 방향만, 탐사(step-0010)는 위치만 바꿀 뿐 — 둘 다 새 거래가 없어 장부 식 불변.
   * 별(step-0011)은 *내생 주입원*이다 — 별의 연료(F)는 *외부 할당*(별의 질량, 아직 장에 안 든 대기 에너지)이라
   * 닫힌 장부에 들지 않는다. 별이 연료를 태워 E 로 *주입*하면 sim.injected 가 늘고(외부 source 와 같은 경계 항)
   * sumE 가 같이 늘어 식이 그대로 닫힌다. 즉 step-0010 장부 식과 동일 — 별은 source 의 위치를 내생화할 뿐. */
  function ledger(sim) {
    var sumE = 0, E = sim.E;
    for (var i = 0; i < E.length; i++) sumE += E[i];
    var M = totalBiomass(sim), R = totalStore(sim);
    var lhs = sumE + M + R + sim.evaporated + sim.sunk + sim.metabolized - sim.injected;
    var scale = Math.max(1, sim.E0 + sim.injected);
    return { sumE: sumE, biomass: M, store: R, fuel: totalFuel(sim), residual: Math.abs(lhs - sim.E0) / scale };
  }

  /* 측정: 총량·평균·공간 분산·최대 */
  function measure(sim) {
    var E = sim.E, N = E.length, sum = 0, i;
    for (i = 0; i < N; i++) sum += E[i];
    var mean = sum / N, v = 0, mx = -Infinity;
    for (i = 0; i < N; i++) {
      var dd = E[i] - mean; v += dd * dd;
      if (E[i] > mx) mx = E[i];
    }
    return { sumE: sum, mean: mean, varE: v / N, maxE: mx };
  }

  /* 저장체 측정 — 총량·최대·점유 셀 수(R>eps). 저장체가 어디에 얼마나 굳었나. */
  function measureStore(sim, eps) {
    var R = sim.R, N = R.length, sum = 0, mx = 0, cells = 0;
    var e = eps != null ? eps : 0.01;
    for (var i = 0; i < N; i++) {
      sum += R[i];
      if (R[i] > mx) mx = R[i];
      if (R[i] > e) cells++;
    }
    return { total: sum, maxR: mx, cells: cells };
  }

  /* 개체(다세포='계') 측정 — step-0017. 차등 응집(adhere)이 빚은 *표면장력 액적*을 author 아닌 *측정*으로 읽는다(척추 체크 2).
   * 개체 = *4-인접* + *같은 유전형(kin=같은 a.g)* 생명의 연결 성분(= flux 결합 도메인: 붙어 사는 kin 생명 무리). 무유전(g=0)은 kin
   *   정체성이 없어 개체로 안 묶는다("유전이 개체보다 먼저") — 태그 생명만 성분으로 센다. 위치(center)·태그(g)만 읽는 순수 측정
   *   (E/R/agent 동역학에 되먹임 0 — 둘째 척추 아님). 반환: 태그 생명 수·개체(성분) 수·평균/최대 개체 크기·단세포 비율·kin 접촉 비율.
   *   kinFrac = (같은 태그 4-인접 쌍) / (점유–점유 4-인접 쌍) — 1 에 가까울수록 sorting 완성(이종 경계 최소화=표면장력). */
  function measureOrganisms(sim) {
    var ag = sim.agents, W = sim.p.W, H = sim.p.H, N = W * H;
    var cellTag = sim._orgTag; if (!cellTag || cellTag.length !== N) cellTag = sim._orgTag = new Int16Array(N);
    cellTag.fill(0);                                                 // 0 = 빈칸 또는 무유전(개체 셈에서 동등 취급)
    var tagged = 0, k;
    for (k = 0; k < ag.length; k++) { var g = ag[k].g | 0; if (g > 0) { cellTag[ag[k].center] = g; tagged++; } }
    /* 연결 성분(4-인접 + 같은 태그) — union-find. 동시에 kin 접촉 비율(인접 쌍 셈, 우/하 변만 세 중복 회피). */
    var parent = sim._orgUF; if (!parent || parent.length !== N) parent = sim._orgUF = new Int32Array(N);
    function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
    for (k = 0; k < ag.length; k++) { var c = ag[k].center; if (cellTag[c] > 0) parent[c] = c; }
    var samePairs = 0, allPairs = 0;
    for (k = 0; k < ag.length; k++) {
      var ci = ag[k].center; if (cellTag[ci] === 0) continue;
      var x = ci % W, y = (ci - x) / W, t = cellTag[ci];
      var rx = ci - x + (x + 1) % W, dy = ((y + 1) % H) * W + x;     // 우(+x)·하(+y) 이웃만(쌍 중복 방지)
      var tr = cellTag[rx]; if (tr > 0) { allPairs++; if (tr === t) { samePairs++; parent[find(ci)] = find(rx); } }
      var td = cellTag[dy]; if (td > 0) { allPairs++; if (td === t) { samePairs++; parent[find(ci)] = find(dy); } }
    }
    var sizes = {}, nOrg = 0, maxSize = 0, singles = 0;
    for (k = 0; k < ag.length; k++) {
      var cc = ag[k].center; if (cellTag[cc] === 0) continue;
      var root = find(cc), s = (sizes[root] = (sizes[root] || 0) + 1);
      if (s > maxSize) maxSize = s;
    }
    for (var r in sizes) { nOrg++; if (sizes[r] === 1) singles++; }
    return {
      tagged: tagged, nOrg: nOrg, meanSize: nOrg ? tagged / nOrg : 0, maxSize: maxSize,
      singleFrac: nOrg ? singles / nOrg : 0, kinFrac: allPairs ? samePairs / allPairs : 0
    };
  }

  /* 막/flux 결합 측정 — step-0018. couple(⑥c)이 빚은 *막*(경계 단차)·*내부 E 공유*를 author 아닌 *측정*으로 읽는다.
   * 액적이 측정 윤곽(0017)에서 *물리적 flux 결합 도메인*으로 올랐는지 본다. 위치(center)·태그(g)·필드 E 만 *읽고* 동역학에
   *   되먹이지 않는다(둘째 척추 아님 — 측정 읽기전용). couple 법칙 자체는 전역 성분을 안 쓰지만, *측정*은 도메인 통계를 읽어도 된다.
   * 반환:
   *   interior — 같은 kin 4-인접 쌍(우/하)의 평균 |ΔE|(액적 *내부* — E 공유로 ↓; 막이 셀 거래의 결합 도메인이면 내부가 균질).
   *   boundary — kin 셀 vs 빈칸/타-태그 4-인접의 평균 |ΔE|(액적 *경계* = 막 단차 — 내부 plateau 와 외부의 대비).
   *   index    — boundary/interior(>1 → 막 창발: 내부 균질·경계 단차. =1 ≈ 공유 없음[kMembrane=0]·구조 없음). 형태 측정(4기둥 ④).
   *   intraVar — kin 점유 셀 E 의 전역 분산(보조 — 공유로 균질화하면 ↓). */
  function measureMembrane(sim) {
    var ag = sim.agents, E = sim.E, W = sim.p.W, H = sim.p.H, N = W * H, k;
    var tag = sim._memTag; if (!tag || tag.length !== N) tag = sim._memTag = new Int16Array(N);
    tag.fill(0);
    var sumE = 0, cnt = 0;
    for (k = 0; k < ag.length; k++) { var g = ag[k].g | 0; if (g > 0) { tag[ag[k].center] = g; sumE += E[ag[k].center]; cnt++; } }
    var inSum = 0, inN = 0, bSum = 0, bN = 0;
    for (var s = 0; s < ag.length; s++) {
      var a = ag[s], t = a.g | 0; if (t <= 0) continue;
      var c = a.center, x = a.x, y = a.y;
      var rc = c - x + (x + 1) % W, dc = ((y + 1) % H) * W + x;                        // 우·하 (interior 쌍 중복 방지)
      var lc = c - x + (x - 1 + W) % W, uc = ((y - 1 + H) % H) * W + x;                // 좌·상 (boundary 만)
      var dr = E[c] - E[rc]; if (dr < 0) dr = -dr;
      var dd = E[c] - E[dc]; if (dd < 0) dd = -dd;
      var dl = E[c] - E[lc]; if (dl < 0) dl = -dl;
      var du = E[c] - E[uc]; if (du < 0) du = -du;
      if (tag[rc] === t) { inSum += dr; inN++; } else { bSum += dr; bN++; }            // 우 — kin=interior, 그 외=막 경계
      if (tag[dc] === t) { inSum += dd; inN++; } else { bSum += dd; bN++; }            // 하
      if (tag[lc] !== t) { bSum += dl; bN++; }                                         // 좌 — kin 이면 우에서 이미 셈(중복), 비kin 만 경계로
      if (tag[uc] !== t) { bSum += du; bN++; }                                         // 상 — 하에서 이미 셈(중복), 비kin 만 경계로
    }
    var mean = cnt ? sumE / cnt : 0, v = 0;
    for (k = 0; k < ag.length; k++) { if ((ag[k].g | 0) > 0) { var dv = E[ag[k].center] - mean; v += dv * dv; } }
    var interior = inN ? inSum / inN : 0, boundary = bN ? bSum / bN : 0;
    return { interior: interior, boundary: boundary, index: interior > 1e-9 ? boundary / interior : 0,
      intraVar: cnt ? v / cnt : 0, intraPairs: inN, bndPairs: bN };
  }

  /* 세포 분화 측정 — step-0021. differentiate(⑥f)가 빚은 *위치 의존 phenotype*(soma/germ 분업)을 author 아닌 *측정*으로 읽는다.
   * 역할은 위치(4-근방 점유)의 함수다 — *갇힌 내부* 세포(빈칸 0 = 번식 불가)는 soma(체세포·provision), 빈칸 있는 *표면* 세포는 germ(생식).
   * 위치(center)·태그(g)·m 만 *읽고* 동역학에 되먹이지 않는다(둘째 척추 아님 — 측정 읽기전용). 반환:
   *   soma/germ — 각 역할 세포 수(같은 genotype 인데 위치로 갈린 두 phenotype). somaFrac = soma/(soma+germ).
   *   somaM/germM — 각 역할 평균 m. roleGap = germM − somaM(분화 시 germ 이 fed → 양수: 표면이 번식 자원을 받음. 분업의 4기둥 ④ 측정).
   * 격자 기하상 번식은 표면에서 일어나므로(내부는 자리 없음) germ=표면이다 — Volvox(생식 내부)와 방향이 뒤집힌 점은 step 문서 §발견에 기록. */
  function measureDifferentiation(sim) {
    var ag = sim.agents, W = sim.p.W, H = sim.p.H, N = W * H;
    var occ = sim._diffMeas; if (!occ || occ.length !== N) occ = sim._diffMeas = new Int32Array(N);
    occ.fill(0);
    for (var i = 0; i < ag.length; i++) occ[ag[i].center] = i + 1;                     // *모든* 생명(빈칸 판정용)
    var somaN = 0, germN = 0, somaM = 0, germM = 0;
    for (var s = 0; s < ag.length; s++) {
      var a = ag[s], t = a.g | 0; if (t <= 0) continue;
      var x = a.x, y = a.y, c = a.center;
      var occN = 0;                                                                     // 4-근방 점유 수 — 4면 갇힘(번식 불가=soma), <4면 표면(germ)
      if (occ[c - x + (x + 1) % W] > 0) occN++;                                         // 우
      if (occ[c - x + (x - 1 + W) % W] > 0) occN++;                                     // 좌
      if (occ[((y + 1) % H) * W + x] > 0) occN++;                                       // 하
      if (occ[((y - 1 + H) % H) * W + x] > 0) occN++;                                   // 상
      if (occN >= 4) { somaN++; somaM += a.m; } else { germN++; germM += a.m; }
    }
    var sMean = somaN ? somaM / somaN : 0, gMean = germN ? germM / germN : 0;
    return { soma: somaN, germ: germN, somaM: sMean, germM: gMean,
      somaFrac: (somaN + germN) ? somaN / (somaN + germN) : 0, roleGap: gMean - sMean };
  }

  /* 생식세포 계통 측정 — step-0022. sequester(⑦b)가 빚은 *불가역 상속 계통*(germ/soma)을 author 아닌 *측정*으로 읽는다.
   * 0021 measureDifferentiation 은 역할을 *위치*(4-근방 점유)로 읽었으나, germline 은 역할이 *계통 속성 a.soma*(불가역 fate)에 산다 — 위치 무관. 위치·태그·m·a.soma 만 *읽고* 동역학에 되먹이지 않는다(측정 읽기전용). 반환:
   *   soma/germ — 각 계통 세포 수(같은 genotype 인데 *상속된* 두 계통). somaFrac = soma/(soma+germ) ≈ kGermline(할당 비율, 안정).
   *   somaM/germM — 각 계통 평균 m. roleGap = germM − somaM(germ 이 soma 의 export 로 fed → 양수·큼: 생식세포 계통에 자원 집중).
   *   somaMaxM — soma 계통 최대 m(Weismann 격리 지표: < mDiv 면 soma 가 번식 임계에 못 닿음 = 번식이 germ 전용).
   *   somaSurface/somaSurfaceFrac — *표면*(빈 4-근방 ≥1)에 있는 soma 세포 수 / (전체 soma 대비) 비율. >0 이면 fate 가 *위치 무관*(불가역 계통) 증거 — 0021 위치 분화라면 soma≡갇힌 내부라 0.
   *   surfaceSomaFrac — *표면 세포 중* soma 계통 비율(= somaSurface/(표면 세포 총수)). 위치 무관 fate 의 *강한* 서명: 계통이면 ≈kGermline(표면도 무작위 할당), 0021 위치 분화면 표면=전부 germ → 0.
   *   committed — fate 가 정해진(a.soma!==undefined) 유전형 세포 수(계통 격리가 도는 범위). */
  function measureGermline(sim) {
    var ag = sim.agents, W = sim.p.W, H = sim.p.H, N = W * H, mDiv = sim.p.mDiv;
    var occ = sim._germMeas; if (!occ || occ.length !== N) occ = sim._germMeas = new Int32Array(N);
    occ.fill(0);
    for (var i = 0; i < ag.length; i++) occ[ag[i].center] = i + 1;                       // *모든* 생명(표면 판정용)
    var somaN = 0, germN = 0, somaM = 0, germM = 0, somaMax = 0, somaSurf = 0, germSurf = 0, committed = 0;
    for (var s = 0; s < ag.length; s++) {
      var a = ag[s], t = a.g | 0; if (t <= 0) continue;
      if (a.soma === undefined) continue;                                                // 미커밋(계통 격리 off 또는 무유전) — 셈에서 제외
      committed++;
      var x = a.x, y = a.y, occN = 0;                                                     // 표면 판정 — 빈 4-근방 ≥1 면 표면(번식 자리 있음)
      if (occ[a.center - x + (x + 1) % W] > 0) occN++;
      if (occ[a.center - x + (x - 1 + W) % W] > 0) occN++;
      if (occ[((y + 1) % H) * W + x] > 0) occN++;
      if (occ[((y - 1 + H) % H) * W + x] > 0) occN++;
      var surface = occN < 4;
      if (a.soma === 1) { somaN++; somaM += a.m; if (a.m > somaMax) somaMax = a.m; if (surface) somaSurf++; }
      else { germN++; germM += a.m; if (surface) germSurf++; }
    }
    var sMean = somaN ? somaM / somaN : 0, gMean = germN ? germM / germN : 0, surfN = somaSurf + germSurf;
    return { soma: somaN, germ: germN, somaM: sMean, germM: gMean, somaMaxM: somaMax,
      somaFrac: (somaN + germN) ? somaN / (somaN + germN) : 0, roleGap: gMean - sMean,
      somaSurface: somaSurf, somaSurfaceFrac: somaN ? somaSurf / somaN : 0,
      surfaceSomaFrac: surfN ? somaSurf / surfN : 0, committed: committed, weismann: somaMax < mDiv };
  }

  /* 정착 생활사 측정 — step-0023. anchor(⑥0)가 빚은 *고착*(sessile)과 그 귀결(큰 안정 조직·갇힌 내부)을 author 아닌 *측정*으로 읽는다.
   * 위치(center)·태그(g)·m·a.sessile 만 *읽고* 동역학에 되먹이지 않는다(측정 읽기전용). a.sessile 은 anchor 가 매 tick 재계산한 게이트 — 측정 시점의 스냅샷을 읽는다. 반환:
   *   sessile/sessileFrac — 고착한 유전형 생명 수 / (유전형 생명 대비) 비율. >0 이면 정착이 도는 증거.
   *   interior/interiorFrac — *갇힌 내부*(같은 태그 4-근방 점유 ≥3, 번식 자리 거의 없음 = 분화/격리의 대상) 세포 수 / 비율. 정착이 confluent 조직을 키우면 ↑(0021·0022 가 발현할 토대).
   *   sessileM — 고착 생명 평균 m(잘 먹은 코어인지). */
  function measureAnchor(sim) {
    var ag = sim.agents, W = sim.p.W, H = sim.p.H, N = W * H;
    var occ = sim._ancMeas; if (!occ || occ.length !== N) occ = sim._ancMeas = new Int32Array(N);
    occ.fill(0);
    for (var i = 0; i < ag.length; i++) occ[ag[i].center] = i + 1;                       // *모든* 생명(갇힘 판정용)
    var tagged = 0, sessileN = 0, sessileM = 0, interiorN = 0;
    for (var s = 0; s < ag.length; s++) {
      var a = ag[s], t = a.g | 0; if (t <= 0) continue;
      tagged++;
      if (a.sessile) { sessileN++; sessileM += a.m; }
      var x = a.x, y = a.y, nKin = 0;                                                     // 같은 태그(kin) 4-근방 점유 수 — ≥3 이면 갇힌 내부(분화/격리 대상)
      if (occ[a.center - x + (x + 1) % W] > 0 && (ag[occ[a.center - x + (x + 1) % W] - 1].g | 0) === t) nKin++;
      if (occ[a.center - x + (x - 1 + W) % W] > 0 && (ag[occ[a.center - x + (x - 1 + W) % W] - 1].g | 0) === t) nKin++;
      if (occ[((y + 1) % H) * W + x] > 0 && (ag[occ[((y + 1) % H) * W + x] - 1].g | 0) === t) nKin++;
      if (occ[((y - 1 + H) % H) * W + x] > 0 && (ag[occ[((y - 1 + H) % H) * W + x] - 1].g | 0) === t) nKin++;
      if (nKin >= 3) interiorN++;
    }
    return { tagged: tagged, sessile: sessileN, sessileFrac: tagged ? sessileN / tagged : 0,
      sessileM: sessileN ? sessileM / sessileN : 0, interior: interiorN, interiorFrac: tagged ? interiorN / tagged : 0 };
  }

  /* 곡률 표면장력 측정 — step-0024. tension(⑥a2)이 *E-막에* 얹은 Young-Laplace 곡률 구배를 author 아닌 *측정*으로 읽는다(형태 사다리 R2 — 형태는 바닥 E 필드에 산다).
   * 같은 태그 4-근방 수 n4(coordination = 이산 곡률: 0 볼록 경계 … 4 속)별로 그 칸 점유 생명의 E 를 모아, 표면장력의 서명을 잰다. 위치·태그·E 만 *읽고* 동역학에 되먹이지 않는다(측정 읽기전용). 반환:
   *   convexE / interiorE — *볼록 경계*(n4 ≤ 1, 튀어나온 곡률 큰 자리)·*오목/속*(n4 ≥ 3) 점유 칸의 평균 E. coreRatio = interiorE / convexE.
   *     Young-Laplace: 표면장력은 볼록 경계의 E 를 속으로 밀어 *속이 더 뜨겁고 볼록 경계가 식는다* → coreRatio > 1(tension on). couple 만(균등화) 이면 coordination 무관 ≈ 균일 → coreRatio ≈ 1. 형태 측정(4기둥 ④ — E-돔이 둥글어졌나).
   *   coreCirc — *고-E 핵*(도메인 평균 E 의 1.1배 이상인 점유 칸)의 4-연결 원형도(16A/P²). 표면장력이 E 를 둥근 돔으로 모으면, 셀 footprint 가 울퉁불퉁해도 *고-E 형태*는 둥글다(→1, 렌즈가 그리는 형태). footCirc — 전체 footprint 원형도(비교 기준).
   *   nOrg/meanSize — 개체 수·평균 크기(union-find, measureOrganisms 와 같은 셈 — 보조). */
  function measureRoundness(sim) {
    var ag = sim.agents, E = sim.E, W = sim.p.W, H = sim.p.H, N = W * H, k;
    var tag = sim._rndTag; if (!tag || tag.length !== N) tag = sim._rndTag = new Int16Array(N);
    tag.fill(0);                                                                       // 0 = 빈칸/무유전
    for (k = 0; k < ag.length; k++) { var g = ag[k].g | 0; if (g > 0) tag[ag[k].center] = g; }
    /* union-find(4-인접 같은 태그) + footprint 둘레 + coordination(n4)별 E 통계 + 도메인 평균 E(고-E 핵 문턱). */
    var parent = sim._rndUF; if (!parent || parent.length !== N) parent = sim._rndUF = new Int32Array(N);
    function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
    for (k = 0; k < ag.length; k++) { var c0 = ag[k].center; if (tag[c0] > 0) parent[c0] = c0; }
    var perimOf = {}, totEdge = 0, sumDomE = 0, nDom = 0;
    var cxE = 0, cxN = 0, inE = 0, inN = 0;                                            // 볼록(n4≤1)·오목속(n4≥3) E 누적
    for (k = 0; k < ag.length; k++) {
      var ci = ag[k].center; if (tag[ci] === 0) continue;
      var x = ci % W, y = (ci - x) / W, t = tag[ci];
      var rx = ci - x + (x + 1) % W, lx = ci - x + (x - 1 + W) % W;
      var dy2 = ((y + 1) % H) * W + x, uy = ((y - 1 + H) % H) * W + x;
      var per = 0, n4 = 0;
      if (tag[rx] === t) { parent[find(ci)] = find(rx); n4++; } else per++;
      if (tag[lx] === t) { parent[find(ci)] = find(lx); n4++; } else per++;
      if (tag[dy2] === t) { parent[find(ci)] = find(dy2); n4++; } else per++;
      if (tag[uy] === t) { parent[find(ci)] = find(uy); n4++; } else per++;
      perimOf[ci] = per; totEdge += per;
      var ev = E[ci]; sumDomE += ev; nDom++;
      if (n4 <= 2) { cxE += ev; cxN++; } else { inE += ev; inN++; }                   // 볼록/경계(n4≤2: 모서리·튀어나온 자리) vs 오목/속(n4≥3)
    }
    var meanDomE = nDom ? sumDomE / nDom : 0, coreThr = meanDomE * 1.1;
    /* 개체별 넓이·둘레(footprint) + 고-E 핵 넓이·둘레(coreCirc). */
    var area = {}, perim = {}, coreA = {}, coreP = {};
    for (k = 0; k < ag.length; k++) {
      var cc = ag[k].center; if (tag[cc] === 0) continue;
      var root = find(cc), tt = tag[cc], xx = cc % W, yy = (cc - xx) / W;
      area[root] = (area[root] || 0) + 1; perim[root] = (perim[root] || 0) + perimOf[cc];
      if (E[cc] >= coreThr) {                                                          // 고-E 핵 — 4-이웃 중 (같은 태그 & 고-E) 가 아니면 핵 둘레
        coreA[root] = (coreA[root] || 0) + 1;
        var cp = 0, nb = [cc - xx + (xx + 1) % W, cc - xx + (xx - 1 + W) % W, ((yy + 1) % H) * W + xx, ((yy - 1 + H) % H) * W + xx];
        for (var d = 0; d < 4; d++) { var j = nb[d]; if (!(tag[j] === tt && E[j] >= coreThr)) cp++; }
        coreP[root] = (coreP[root] || 0) + cp;
      }
    }
    var nOrg = 0, tagged = 0, sumWC = 0, sumA = 0, sumWCore = 0, sumACore = 0;
    for (var r in area) {
      nOrg++; var A = area[r], P = perim[r] || 1, circ = 16 * A / (P * P); if (circ > 1) circ = 1;
      tagged += A; sumWC += A * circ; sumA += A;
      var Ac = coreA[r] || 0; if (Ac > 0) { var Pc = coreP[r] || 1, cc2 = 16 * Ac / (Pc * Pc); if (cc2 > 1) cc2 = 1; sumWCore += Ac * cc2; sumACore += Ac; }
    }
    return { nOrg: nOrg, tagged: tagged, meanSize: nOrg ? tagged / nOrg : 0,
      footCirc: sumA ? sumWC / sumA : 0, coreCirc: sumACore ? sumWCore / sumACore : 0, totEdge: totEdge,
      convexE: cxN ? cxE / cxN : 0, interiorE: inN ? inE / inN : 0, coreRatio: (cxN && inN && cxE > 1e-9) ? (inE / inN) / (cxE / cxN) : 0 };
  }

  /* 방향성 결정화 측정 — step-0025. anisotropy(⑤e)가 빚은 *R 하이트필드의 이방성*(가지·결정축 vs 등방 blob)을 author 아닌 *측정*으로 읽는다.
   * R 분포(저장체 = 물질 하이트필드)의 *2차 모멘트*(관성 텐서)의 주축비로 이방성을 잰다 — 등방 blob 이면 주축이 같아(≈1), 한 축으로 자란 needle/결정축이면 비율이 크다(>1).
   *   토러스 wrap 은 *편차*를 최소거리로 보정한다(결정은 국소라 보통 wrap 안 함 — 안전장치). R 동역학에 되먹임 0(둘째 척추 아님 — 측정 읽기전용). 반환:
   *   aniso — 주축비 λ1/λ2(이방성 지수, ≥1; >1 → 방향성 결정·1 ≈ 등방 blob). 형태 측정(4기둥 ④). · axisX/axisY — x/y 분산(Ixx/Iyy, 어느 축으로 자랐나) · l1/l2 주고유값 · cells/sumR(R 점유 셀·총 R). */
  function measureAnisotropy(sim, eps) {
    var R = sim.R, W = sim.p.W, H = sim.p.H, N = W * H, e = eps != null ? eps : 0.05;
    var sw = 0, sx = 0, sy = 0, cells = 0, i, x, y;
    for (i = 0; i < N; i++) { if (R[i] <= e) continue; x = i % W; y = (i - x) / W; sw += R[i]; sx += R[i] * x; sy += R[i] * y; cells++; }
    if (sw <= 1e-12) return { aniso: 1, axisX: 0, axisY: 0, l1: 0, l2: 0, cells: 0, sumR: 0 };
    var cx = sx / sw, cy = sy / sw, Ixx = 0, Iyy = 0, Ixy = 0, hW = W / 2, hH = H / 2;
    for (i = 0; i < N; i++) {
      if (R[i] <= e) continue;
      x = i % W; y = (i - x) / W;
      var dx = x - cx; if (dx > hW) dx -= W; else if (dx < -hW) dx += W;             // 토러스 편차 보정(결정 wrap 안전장치)
      var dy = y - cy; if (dy > hH) dy -= H; else if (dy < -hH) dy += H;
      var w = R[i]; Ixx += w * dx * dx; Iyy += w * dy * dy; Ixy += w * dx * dy;
    }
    Ixx /= sw; Iyy /= sw; Ixy /= sw;
    var tr = Ixx + Iyy, det = Ixx * Iyy - Ixy * Ixy;
    var disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    var l1 = tr / 2 + disc, l2 = tr / 2 - disc;
    var aniso = l2 > 1e-9 ? l1 / l2 : (l1 > 1e-9 ? Infinity : 1);
    return { aniso: aniso, axisX: Ixx, axisY: Iyy, l1: l1, l2: l2, cells: cells, sumR: sw };
  }

  /* 튜링 패턴 측정 — step-0026. turing(⑤f)이 빚은 *반응-확산 패턴*(반점/줄무늬)을 author 아닌 *측정*으로 읽는다.
   * 균일이 깨졌는가(대칭 깨짐 = 진폭↑)와 *특성 파장*이 있는가(공간 자기상관의 첫 음수 lag·음의 dip)를 본다 — Turing 의 서명.
   *   진폭(std) ↑ + 자기상관이 *유한 lag 에서 음수*(반점→골 = 특성 간격)면 패턴(노이즈는 진폭≈초기·자기상관 평탄). 위치(R 필드)만 *읽고* 동역학에 되먹이지 않는다(측정 읽기전용). 반환:
   *   meanR/stdR/maxR — R 필드의 평균·표준편차(진폭 = 대칭 깨짐 세기)·최대(반점 봉우리).
   *   firstNeg — 공간 자기상관(행+열, 토러스)이 처음 음수가 되는 lag(특성 *반*파장 — 반점에서 골까지). 0 이면 음수 없음(패턴 없음=노이즈/균일). 노이즈는 lag1 에서 바로 ≈0, 패턴은 lag>1 에서 양수→음수(공간 진동).
   *   minAC — 자기상관 최소값(음의 dip 깊이 — 클수록 또렷한 반점/골 교대). 노이즈는 ≈0, 패턴은 뚜렷이 음수.
   *   ac1 — lag1 자기상관(근방 양의 상관 = 반점 폭 > 1셀; 격자 체커보드면 음수 — 단파 catastrophe 의 서명). */
  function measureTuring(sim, opt) {
    opt = opt || {};
    var R = sim.R, W = sim.p.W, H = sim.p.H, N = W * H, maxLag = opt.maxLag || 16, i, x, y, L;
    var mean = 0; for (i = 0; i < N; i++) mean += R[i]; mean /= N;
    var varR = 0, mx = 0; for (i = 0; i < N; i++) { var d = R[i] - mean; varR += d * d; if (R[i] > mx) mx = R[i]; }
    var norm = varR;                                                                   // = Σ(R−mean)²
    var ac = new Float64Array(maxLag + 1);
    if (norm > 1e-12) {
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        var a0 = R[y * W + x] - mean;
        for (L = 1; L <= maxLag; L++) ac[L] += a0 * ((R[y * W + (x + L) % W] - mean) + (R[((y + L) % H) * W + x] - mean));
      }
      for (L = 1; L <= maxLag; L++) ac[L] /= (2 * norm);                               // 행+열 평균 → 정규화 자기상관(ac[0]=1)
    }
    var firstNeg = 0, minAC = 0;
    for (L = 1; L <= maxLag; L++) { if (ac[L] < minAC) minAC = ac[L]; if (firstNeg === 0 && ac[L] < 0) firstNeg = L; }
    return { meanR: mean, stdR: Math.sqrt(varR / N), maxR: mx, firstNeg: firstNeg, minAC: minAC, ac1: ac[1] };
  }

  /* 덴드라이트 가지 측정 — step-0027. dendrite(⑤g)이 빚은 *가지친 결정 전선*(옆가지)을 author 아닌 *측정*으로 읽는다.
   * 자라는 결정이 *컴팩트한가*(둥근 덩이) *가지쳤는가*(경계 불안정 → 옆가지)를 *경계의 거칠기*로 본다 — Mullins-Sekerka 의 서명.
   *   고체 = R[i] ≥ thr 셀. area = 고체 칸 수(결정 질량/넓이). perim = 고체-빈칸 경계 변 수(둘레 길이). tips = 빈 4-이웃 ≥3 인 고체 칸 수(튀어나온 가지 끝).
   *   roughness = perim / (2·√(π·area)) — *크기 정규화* 거칠기(같은 넓이 원판 둘레로 나눔). 컴팩트 원판 ≈ 1, 가지친 덴드라이트 ≫ 1(가는 가지라 둘레가 길다). 위치(R 필드)만 *읽고* 동역학에 안 되먹인다(측정 읽기전용). */
  function measureDendrite(sim, opt) {
    opt = opt || {};
    var R = sim.R, W = sim.p.W, H = sim.p.H, N = W * H, thr = opt.thr != null ? opt.thr : (sim.p.dendThresh || 0.5);
    var area = 0, perim = 0, tips = 0, sumR = 0, i, x, y;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      i = y * W + x; if (R[i] < thr) continue;
      area++; sumR += R[i];
      var empty = 0;                                                                    // 빈(비고체) 4-이웃 수 — 경계 변·가지 끝 판정
      if (R[((y - 1 + H) % H) * W + x] < thr) empty++;
      if (R[((y + 1) % H) * W + x] < thr) empty++;
      if (R[y * W + (x - 1 + W) % W] < thr) empty++;
      if (R[y * W + (x + 1) % W] < thr) empty++;
      perim += empty;                                                                   // 고체-빈칸 경계 변 수(둘레)
      if (empty >= 3) tips++;                                                            // 빈 이웃 ≥3 = 튀어나온 가지 끝(컴팩트 덩이엔 거의 없음)
    }
    var rough = area > 0 ? perim / (2 * Math.sqrt(Math.PI * area)) : 0;                  // 크기 정규화 거칠기(원판≈1·덴드라이트≫1)
    return { area: area, perim: perim, tips: tips, roughness: rough, sumR: sumR };
  }

  /* 고임 검출 — step-0002 와 동일. */
  function detectPools(sim, opt) {
    opt = opt || {};
    var minE = opt.minE != null ? opt.minE : 1.5;
    var prom = opt.prom != null ? opt.prom : 0.3;
    var excl = opt.excl != null ? opt.excl : sim.p.source.r + 4;
    var p = sim.p, W = p.W, H = p.H, E = sim.E;
    var sx = p.source.x, sy = p.source.y;
    var out = [];
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var i = y * W + x, ei = E[i];
        if (ei < minE) continue;
        var dxs = Math.min((x - sx + W) % W, (sx - x + W) % W);
        var dys = Math.min((y - sy + H) % H, (sy - y + H) % H);
        if (dxs * dxs + dys * dys <= excl * excl) continue;
        var isMax = true, ring = 0, cnt = 0;
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            var nx = (x + dx + W) % W, ny = (y + dy + H) % H, en = E[ny * W + nx];
            if (en > ei) isMax = false;
            ring += en; cnt++;
          }
        }
        if (!isMax) continue;
        var pr = ei - ring / cnt;
        if (pr < prom) continue;
        out.push({ x: x, y: y, e: ei, prom: pr });
      }
    }
    out.sort(function (a, b) { return b.e - a.e; });
    return out;
  }

  /* 수확 — step-0002 와 동일. */
  function harvest(sim, cx, cy, r) {
    var cells = discCells(sim.p.W, sim.p.H, cx, cy, r), E = sim.E, removed = 0;
    for (var k = 0; k < cells.length; k++) { removed += E[cells[k]]; E[cells[k]] = 0; }
    sim.sunk += removed;
    return removed;
  }

  /* 저장체 칠하기 — (cx,cy) 반경 r 원판에 R 을 amount 씩 더한다. 검증(deflect 프로브)·데모용.
   * 외부에서 들여온 양이므로 E0 를 함께 올려 장부를 보정한다(닫힌 장부 유지 — harvest 의 sunk 와 같은 정신). */
  function paintStore(sim, cx, cy, r, amount) {
    var cells = discCells(sim.p.W, sim.p.H, cx, cy, r), R = sim.R, added = 0;
    for (var k = 0; k < cells.length; k++) { R[cells[k]] += amount; added += amount; }
    sim.E0 += added;
    return added;
  }

  /* E 칠하기 — (cx,cy) 반경 r 원판에 E 를 amount 씩 더한다. 검증(escape 프로브)·데모용.
   * 외부에서 들여온 양이므로 E0 를 함께 올려 장부를 보정한다(닫힌 장부 유지 — paintStore 와 같은 정신). */
  function paintE(sim, cx, cy, r, amount) {
    var cells = discCells(sim.p.W, sim.p.H, cx, cy, r), E = sim.E, added = 0;
    for (var k = 0; k < cells.length; k++) { E[cells[k]] += amount; added += amount; }
    sim.E0 += added;
    return added;
  }

  /* 국소 E 합 — (cx,cy) 중심 반경 r 원판의 E 총합. */
  function localE(sim, cx, cy, r) {
    var cells = discCells(sim.p.W, sim.p.H, cx, cy, r), E = sim.E, s = 0;
    for (var k = 0; k < cells.length; k++) s += E[cells[k]];
    return s;
  }

  /* 국소 R 합 — (cx,cy) 중심 반경 r 원판의 저장체 총합. 저장체가 어디에 쌓였나. */
  function localStore(sim, cx, cy, r) {
    var cells = discCells(sim.p.W, sim.p.H, cx, cy, r), R = sim.R, s = 0;
    for (var k = 0; k < cells.length; k++) s += R[cells[k]];
    return s;
  }

  /* 토러스 거리(wrap) */
  function torusDist(W, H, ax, ay, bx, by) {
    var dx = Math.abs(ax - bx); if (dx > W - dx) dx = W - dx;
    var dy = Math.abs(ay - by); if (dy > H - dy) dy = H - dy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* 개체군 무게중심(생물량 가중, 토러스) */
  function centroid(sim) {
    var ag = sim.agents, W = sim.p.W, H = sim.p.H;
    if (!ag.length) return null;
    var sx = 0, sy = 0, cx = 0, cy = 0, sw = 0;
    var tx = 2 * Math.PI / W, ty = 2 * Math.PI / H;
    for (var k = 0; k < ag.length; k++) {
      var ww = ag[k].m > 0 ? ag[k].m : 1e-9;
      sx += Math.cos(ag[k].x * tx) * ww; cx += Math.sin(ag[k].x * tx) * ww;
      sy += Math.cos(ag[k].y * ty) * ww; cy += Math.sin(ag[k].y * ty) * ww;
      sw += ww;
    }
    var ax = Math.atan2(cx / sw, sx / sw); if (ax < 0) ax += 2 * Math.PI;
    var ay = Math.atan2(cy / sw, sy / sw); if (ay < 0) ay += 2 * Math.PI;
    return { x: ax / tx, y: ay / ty };
  }

  /* 개체군 공간 확산 반경 */
  function spread(sim) {
    var ag = sim.agents;
    if (!ag.length) return 0;
    var ct = centroid(sim), W = sim.p.W, H = sim.p.H;
    var sw = 0, sd = 0;
    for (var k = 0; k < ag.length; k++) {
      var ww = ag[k].m > 0 ? ag[k].m : 1e-9;
      var dd = torusDist(W, H, ag[k].x, ag[k].y, ct.x, ct.y);
      sd += ww * dd * dd; sw += ww;
    }
    return Math.sqrt(sd / sw);
  }

  /* 무게중심 → source 추적 거리(토러스) */
  function trackDist(sim) {
    var ct = centroid(sim);
    if (!ct) return null;
    return torusDist(sim.p.W, sim.p.H, ct.x, ct.y, sim.p.source.x, sim.p.source.y);
  }

  /* 상태 해시 (FNV-1a 32bit) — 결정론(비트 동일) 검사용 + 골든 레퍼런스(아카이브 재현성).
   * E + R 비트열 + 기본 장부 + 생명(metabolized) + 각 에이전트 x,y,m. (step-0008 이래 동일.) */
  function hashState(sim) {
    var h = 0x811c9dc5 >>> 0;
    function feed(buf) {
      var dv = new DataView(buf);
      for (var j = 0; j < dv.byteLength; j++) {
        h = (h ^ dv.getUint8(j)) >>> 0; h = Math.imul(h, 0x01000193) >>> 0;
      }
    }
    feed(sim.E.buffer);
    feed(sim.R.buffer);
    feed(new Float64Array([sim.injected, sim.evaporated, sim.sunk, sim.metabolized, sim.tick]).buffer);
    var ag = sim.agents;
    feed(new Float64Array([ag.length]).buffer);
    for (var k = 0; k < ag.length; k++) feed(new Float64Array([ag[k].x, ag[k].y, ag[k].m]).buffer);
    /* 생명 유전형 a.g(step-0016) — *가법*: 생명 유전이 활성(lifeGeneInit)일 때만 먹인다(kInherit=0 이면 false → skip → 과거 골든 전부 불변).
     * 이산 유전 정보(생명 태그)가 결정론·재현에 들어간다(같은 시드 2회 a.g 도 비트 동일). 위 x,y,m 뒤에 *태그*만 더한다. */
    if (sim.lifeGeneInit) for (var kg = 0; kg < ag.length; kg++) feed(new Float64Array([ag[kg].g || 0]).buffer);
    /* 생식세포 계통 fate a.soma(step-0022) — *가법*: 계통 격리가 활성(germInit)일 때만 먹인다(kGermline=0 이면 false → skip → 과거 골든 전부 불변).
     * 불가역 계통 정보(germ=0/soma=1, 미커밋=0)가 결정론·재현에 들어간다(같은 시드 2회 a.soma 도 비트 동일). */
    if (sim.germInit) for (var kf = 0; kf < ag.length; kf++) feed(new Float64Array([ag[kf].soma ? 1 : 0]).buffer);
    /* 별(step-0011) — *가법*: 별이 있을 때만 먹인다. 별 없는 과거 시나리오(0001~0010)는 이 분기 skip →
     * 해시 비트 동일(골든 불변, verify-sim-engine 으로 증명). 별 위치·연료로 결정론·재현 보장. */
    var st = sim.stars;
    if (st && st.length) {
      feed(new Float64Array([st.length]).buffer);
      for (var j2 = 0; j2 < st.length; j2++) {
        feed(new Float64Array([st[j2].x, st[j2].y, st[j2].fuel]).buffer);
        /* 연소 FSM state(step-0013) — *가법*: state 가 있을 때만 먹인다(FSM off 면 undefined → skip → 골든 endo@ 불변).
         * 이산 라벨이 결정론·재현에 들어간다(상태 라벨이 해시에). */
        if (st[j2].state !== undefined) feed(new Float64Array([st[j2].state]).buffer);
      }
    }
    /* 활성도 필드 A(step-0014) — *가법*: 계량이 활성(fluxInit)일 때만 먹인다(kFlux=0 이면 false → skip → 과거 골든 전부 불변).
     * 활성도(측정값)가 결정론·재현에 들어간다(같은 시드 2회 A 도 비트 동일). A 는 읽기 전용 계기지만 결정론 검증엔 포함. */
    if (sim.fluxInit) feed(sim.A.buffer);
    /* 유전형 필드 G(step-0015) — *가법*: 복제가 활성(geneInit)일 때만 먹인다(kTemplate=0·미파종이면 false → skip → 과거 골든 전부 불변).
     * 이산 유전 정보(태그)가 결정론·재현에 들어간다(같은 시드 2회 G 도 비트 동일). R 은 이미 위에서 먹였으므로 G 는 *태그*만 더한다. */
    if (sim.geneInit) feed(sim.G.buffer);
    return ('00000000' + h.toString(16)).slice(-8);
  }

  /* source/sink 위치·반경 변경 후 셀 목록 재계산 — 검증 시나리오·데모용. */
  function setSource(sim, opts) {
    sim.p.source = Object.assign({}, sim.p.source, opts || {});
    sim.srcCells = discCells(sim.p.W, sim.p.H, sim.p.source.x, sim.p.source.y, sim.p.source.r);
    sim.srcBase = { x: sim.p.source.x, y: sim.p.source.y };
    sim.srcBaseTick = sim.tick;
  }
  function setSink(sim, opts) {
    sim.p.sink = Object.assign({}, sim.p.sink, opts || {});
    sim.sinkCells = discCells(sim.p.W, sim.p.H, sim.p.sink.x, sim.p.sink.y, sim.p.sink.r);
  }

  var api = {
    mulberry32: mulberry32, tumbleHash: tumbleHash, tumbleHash3: tumbleHash3,
    discCells: discCells, discOffsets: discOffsets, discCells3: discCells3, ballOffsets: ballOffsets, aggKernel: aggKernel, spawnAgent: spawnAgent, spawnStar: spawnStar, spawnGene: spawnGene,
    totalBiomass: totalBiomass, totalStore: totalStore, totalFuel: totalFuel, ledger: ledger,
    measure: measure, measureStore: measureStore, measureOrganisms: measureOrganisms, measureMembrane: measureMembrane, measureDifferentiation: measureDifferentiation, measureGermline: measureGermline, measureAnchor: measureAnchor, measureRoundness: measureRoundness, measureAnisotropy: measureAnisotropy, measureTuring: measureTuring, measureDendrite: measureDendrite,
    detectPools: detectPools, harvest: harvest, paintStore: paintStore, paintE: paintE,
    localE: localE, localStore: localStore,
    torusDist: torusDist, centroid: centroid, spread: spread, trackDist: trackDist,
    hashState: hashState, setSource: setSource, setSink: setSink
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.HWS_KERNEL = api;
})(typeof window !== 'undefined' ? window : globalThis);
