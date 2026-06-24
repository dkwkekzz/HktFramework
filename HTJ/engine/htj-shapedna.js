// htj-shapedna.js — 병합·형태 DNA 트랙 M2: 합쳐진 덩어리의 *형태*를 정규화된 hash(DNA)로 압축한다.
//
//   design/merge-dna.md §3·§4 M2 — M1(0061 coalesceSettled)으로 뭉친 원소를 *확실히* 한 개체로 합치게 됐지만,
//   합친 개체는 구성원 배치를 잃은 *민둥 구* 하나다(모양 소실). 그렇다고 개체마다 구성원 세부를 다 들면 압축이
//   0(기존과 동일·확장성 없음). 이 모듈은 그 사이를 푼다 = **형태 DNA**:
//     ① 정규화: 구성원 상대 배치 {r_i − CoM} 를 *평행이동·스케일 불변*으로 양자화 → canonical 형태(작고 표준화).
//     ② hash: canonical 을 해시 → shapeHash(DNA 코드).
//     ③ dedup: 세계 형태 사전(shapeDict: hash → canonical)에 없으면 추가·있으면 재사용 → **비슷한 덩어리는 한 항목 공유**.
//   결과: 물리적 개체는 hash(짧은 코드)만 들면 되고(O(1)), 형태는 세계 사전이 K(형태종류)개로 *공유*한다(K ≪ N 개체).
//   = 생물 수십억이 유전자 코드를 공유하듯, 개체가 형태 코드를 공유한다. 발현(그림)은 후속 M3(viewer 가 사전을 읽어 그림).
//
//   세계(법칙)의 *표현* 계층 — hash·사전은 물리량(질량·운동량·에너지)을 **절대 바꾸지 않는다**(순수 메타데이터·보존 불변).
//   정규화는 *손실*(양자화·dedup)이지만 물리는 *무손실*. 순수·결정론(같은 배치 → 같은 hash·같은 사전). 렌더 의존 0(Node 에서 돈다).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJShapeDNA = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FOURPI_3 = 4 * Math.PI / 3;                            // 등가 구 반지름(cells→radius)·htj-entity 와 동일

  // FNV-1a 32비트 — canonical 키 문자열 → 8자리 hex 코드(순수·결정론).
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  // 형태 DNA — 구성원 배치를 정규화해 { hash, canonical } 로. 순수(입력 안 변형).
  //   정규화 = 평행이동 불변(CoM 빼기) + 스케일 불변(RMS 거리로 나눔) + 양자화(해상도 q) + 순서 불변(정렬).
  //   회전은 정규화 안 함(축 정렬 양자화) — 회전한 같은 모양은 다른 hash(M2 한계·PCA 정렬은 후속). count 도 형태의 일부.
  //   members: [{cx,cy,cz,mass?}]. opts: { quantum(상대·스케일 후 양자화 격자·기본 0.25) }.
  function shapeDNA(members, opts) {
    opts = opts || {};
    const q = opts.quantum != null ? opts.quantum : 0.25;
    const n = members.length;
    // 질량가중 CoM(mergeGroup 과 같은 중심 — 형태를 물리 중심 기준으로).
    let M = 0, cx = 0, cy = 0, cz = 0;
    for (const m of members) { const w = m.mass > 0 ? m.mass : 1; M += w; cx += w * m.cx; cy += w * m.cy; cz += w * m.cz; }
    if (M > 0) { cx /= M; cy /= M; cz /= M; }
    // 상대 배치 + 특성 스케일(RMS 거리).
    let s2 = 0; const rel = [];
    for (const m of members) { const x = m.cx - cx, y = m.cy - cy, z = m.cz - cz; rel.push([x, y, z]); s2 += x * x + y * y + z * z; }
    const s = Math.sqrt(s2 / n) || 1;                          // 0(단일·겹침) → 1 폴백
    // 양자화(스케일 정규화 후 격자로 반올림) + 순서 불변 정렬.
    const pts = rel.map(p => [Math.round(p[0] / s / q), Math.round(p[1] / s / q), Math.round(p[2] / s / q)]);
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    const key = n + ':' + pts.map(p => p.join(',')).join(';');
    return { hash: fnv1a(key), canonical: { count: n, points: pts, key } };
  }

  // 형태 사전에 등록(dedup) — hash 가 없으면 canonical 추가, 있으면 재사용. hash 반환.
  //   dict = 평범한 객체 { [hash]: canonical }(세계가 소유). 같은 모양 여러 번 등록 → 항목 1개(K ≪ N).
  function registerShape(dict, members, opts) {
    const dna = shapeDNA(members, opts);
    if (dict && !dict[dna.hash]) dict[dna.hash] = dna.canonical;   // dedup(없을 때만 저장)
    return dna.hash;
  }

  // hash(8 hex) → [0,1) 단위 실수 — 색/뷰 매핑용 결정론 유틸(렌더 아님·순수 수치). viewer 가 DNA 를 색으로 보일 때.
  function hashToUnit(hash) {
    let h = 0; for (let i = 0; i < hash.length; i++) h = (Math.imul(h, 31) + hash.charCodeAt(i)) >>> 0;
    return (h >>> 0) / 4294967296;
  }

  // (M3) 형태 복원 — 개체의 shapeHash 로 세계 사전에서 canonical 형태를 꺼내, *민둥 구가 아니라* 원래 구성원
  //   배치(윤곽)를 개체 변환(위치·반경 스케일)으로 펼친 점 무리를 돌려준다 = "큰 원이 지형 모양으로 돌아온다".
  //   design/merge-dna.md §4 M3. 순수(입력 안 변형)·렌더 의존 0 — viewer/capture 가 이 점들을 *그리기만* 한다
  //   (세계↔확인용 단방향: 이 함수는 *어디에 그릴지*만 계산·픽셀은 viewer). hash 없음/사전에 없음 → null(단일 구 폴백).
  //   canonical.points 는 정규화(스케일 불변)점이라 절대 크기는 잃었다 → 개체 반경에 비례해 펼친다(proportion 보존).
  //     offset_i = q_i · quantum · radius · spread,   sub 반경 = radius / count^⅓ · subScale(≈원래 구성원 크기)
  //   entity: {cx,cy,cz,radius,shapeHash}. dict: {hash→canonical}. opts: { quantum(0.25), spread(1.5), subScale(1.5) }.
  function reconstructShape(entity, dict, opts) {
    opts = opts || {};
    const hash = entity && entity.shapeHash;
    if (!hash || !dict || !dict[hash]) return null;            // DNA 없음 → 단일 구 폴백(렌더가 알아서)
    const pts = dict[hash].points || [], count = pts.length || 1;
    const quantum = opts.quantum != null ? opts.quantum : 0.25;
    const spread = opts.spread != null ? opts.spread : 1.5;
    const R = entity.radius || 1;
    const k = quantum * R * spread;                            // 정규화 점 → 월드 오프셋 배율(반경 비례)
    const rsub = R / Math.cbrt(count) * (opts.subScale != null ? opts.subScale : 1.5);  // ≈원래 구성원 반경
    const out = [];
    for (const q of pts) out.push({ cx: entity.cx + q[0] * k, cy: entity.cy + q[1] * k, cz: (entity.cz || 0) + q[2] * k, r: rsub });
    return out;
  }

  // (M4) DNA 로 *물리* 되쪼갬 — reconstructShape(M3·렌더용 점)의 *물리 개체* 판. adaptLOD(0039) refine 이 합친
  //   개체를 *평면 고리*로 근사 복원하던 한계(design §5 난점 1)를, 개체의 shapeHash 가 가리키는 *원래 DNA 형태*
  //   위치로 되쪼개되 **4 보존량을 정확 보존**한다 = "렌더 LOD(0069)↔물리 LOD 합류"(merge-dna §4 M4·§5 T3).
  //   렌더(reconstructShape)와 *같은 사전·hash·배율*을 써 → 물리 조각이 렌더가 그리는 바로 그 형태를 차지한다.
  //
  //   보존(폭발 없음·dispersalFrac=0 판): 구성원은 모두 부모 CoM 속도 v_cm 를 받는다(상대 운동 0). offset 을
  //   *질량중심 0* 으로 맞춰(평균 빼기·Σoffset=0) →
  //     질량 Σm=M(균등 M/n) · 운동량 ΣP=M·v_cm=부모 P(전부 동일 속도·정확) ·
  //     각운동량(원점) Σ(L_i + r_i×p_i)=부모 intrinsic L + center×P=부모 L(Σoffset=0 이 궤도항을 정확히 닫음) ·
  //     총E Σ(KEcm_i+intE_i)=½M|v_cm|²+internalE=부모 E. 모양은 *유지*(평면 고리 아님)·물리는 *무손실*.
  //   entity: {cx,cy,cz,radius,mass,px,py,pz,Lx,Ly,Lz,energy/internalE/KEcm,cells,shapeHash}. dict:{hash→canonical}.
  //   opts: { quantum(0.25), spread(1.5) } — reconstructShape 와 *같은 값*을 줘야 렌더와 형태가 겹친다.
  //   반환: 구성원 개체 배열(보존 정확). hash 없음/사전에 없음/n<2 → null(호출자: fragmentEntity 평면 고리 폴백=0039).
  function refineByDNA(entity, dict, opts) {
    opts = opts || {};
    const hash = entity && entity.shapeHash;
    if (!hash || !dict || !dict[hash]) return null;            // DNA 없음 → 폴백(0039 평면 고리)
    const pts = dict[hash].points || [], n = pts.length;
    if (n < 2) return null;
    const quantum = opts.quantum != null ? opts.quantum : 0.25;
    const spread = opts.spread != null ? opts.spread : 1.5;
    const R = entity.radius || 1, k = quantum * R * spread;
    // 오프셋(엔티티 중심 기준·canonical 점을 월드 배율로) + 평균 빼기(Σoffset=0 → 궤도 각운동량 정확 보존).
    const ox = new Array(n), oy = new Array(n), oz = new Array(n); let mx = 0, my = 0, mz = 0;
    for (let i = 0; i < n; i++) { const q = pts[i], x = q[0] * k, y = q[1] * k, z = q[2] * k; ox[i] = x; oy[i] = y; oz[i] = z; mx += x; my += y; mz += z; }
    mx /= n; my /= n; mz /= n;
    const M = entity.mass || 0, EPS = 1e-12;
    const vcx = M > EPS ? entity.px / M : 0, vcy = M > EPS ? entity.py / M : 0, vcz = M > EPS ? entity.pz / M : 0;
    const m = M / n;
    const internalE = entity.internalE != null ? entity.internalE : ((entity.energy || 0) - (entity.KEcm || 0));
    const intEach = internalE / n;
    const Lx = (entity.Lx || 0) / n, Ly = (entity.Ly || 0) / n, Lz = (entity.Lz || 0) / n;  // intrinsic 스핀 균등 분배
    const cells = (entity.cells != null ? entity.cells : n) / n, rsub = Math.cbrt(Math.max(1e-9, cells) / FOURPI_3);
    const px = m * vcx, py = m * vcy, pz = m * vcz, KEcm = m > EPS ? 0.5 * (px * px + py * py + pz * pz) / m : 0;
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({
        cx: entity.cx + (ox[i] - mx), cy: entity.cy + (oy[i] - my), cz: (entity.cz || 0) + (oz[i] - mz),
        mass: m, px, py, pz, Lx, Ly, Lz,
        KEcm, internalE: intEach, energy: KEcm + intEach,
        cells, radius: rsub, temp: m > EPS ? intEach / m : 0, peak: entity.peak || 1, lodMembers: 1
      });
    }
    return out;
  }

  return { fnv1a, shapeDNA, registerShape, hashToUnit, reconstructShape, refineByDNA, VERSION: 3 };
});
