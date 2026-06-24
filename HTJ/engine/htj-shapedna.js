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

  return { fnv1a, shapeDNA, registerShape, hashToUnit, VERSION: 1 };
});
