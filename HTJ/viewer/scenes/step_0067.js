// viewer/scenes/step_0067.js — T2(A) 지형 DNA 배선: 지형 청크가 shapeHash 만 들고 세계 사전이 K종 타일을 공유.
//
//   merge-dna.md §5 T2 — 0067 되돌림에서 배운 정답 경로. 지형을 engine 지형 전용 함수(terrainSurface·폐기)가
//   아니라 *제너릭 DNA 경로*로 태운다:
//     ① 지형 = 무한질량(정적 앵커) 구체 *청크* 배열. 각 청크의 앵커 배치를 registerShape(제너릭 engine 함수)로
//        정규화→shapeHash + 세계 shapeDict 에 dedup 등록. 같은 타일(봉우리/계곡/평지)→같은 hash→사전 1항목 공유.
//     ② 청크 개체 = {위치·스케일·shapeHash}(구성원 세부 버림). 사전 크기 K(타일 종류) ≪ 청크 수 N = 확장성.
//     ③ 발현 = viewer 의 *제너릭* DNA 렌더 경로(0063·render:'entities'+__shapeDict→reconstructShape). 지형 전용 코드 0.
//
//   engine·viewer 변경 0 — 기존 제너릭 함수(htj-shapedna)·렌더 경로만 *조립*. engine 은 "지형"을 모른다(절대 원칙·
//   HTJ/CLAUDE.md). 확인용 도구라 engine 을 읽기만. UMD(브라우저·Node 양립).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0067'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const D = require ? require('../../engine/htj-shapedna.js') : self.HTJShapeDNA;

  // 로컬 타일 = 3×3 앵커 패치. kind 가 가운데 높이만 바꾼다(봉우리/계곡/평지) → 정규화 후 K=3 종.
  function tile(kind) {
    const m = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      let z = 0;
      if (kind === 'peak' && i === 0 && j === 0) z = 1.2;
      else if (kind === 'valley' && i === 0 && j === 0) z = -1.2;
      m.push({ cx: i, cy: j, cz: z });
    }
    return m;
  }
  // 4×4 청크 지형 — K=3 타일 종류를 16 청크가 공유(dedup). 줄마다 패턴 반복.
  const KINDS = [
    'flat', 'peak', 'peak', 'flat',
    'valley', 'peak', 'peak', 'valley',
    'valley', 'peak', 'peak', 'valley',
    'flat', 'valley', 'valley', 'flat',
  ];

  function build(w) {
    const N = w.N, G = 4, SP = N / (G + 0.5), cen = (N - SP * (G - 1)) / 2;
    const dict = {}, chunks = [];
    for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
      const kind = KINDS[r * G + c];
      const hash = D.registerShape(dict, tile(kind));                 // ← 제너릭 DNA 등록(dedup)
      chunks.push({
        cx: cen + c * SP, cy: cen + r * SP, cz: N * 0.5,
        radius: SP * 0.42, mass: 1e9, anchored: true, shapeHash: hash, kind,
        peak: 0.3 + 0.6 * D.hashToUnit(hash),                         // 같은 타일=같은 색(DNA 서명)
        px: 0, py: 0, pz: 0,
      });
    }
    w.__entities = chunks; w.__shapeDict = dict;
    w.__ropt = { quantum: 0.25, spread: 1.4, subScale: 0.7 };         // reconstructShape 발현 노브
  }

  return {
    label: 'step_0067 — 지형 DNA 배선(청크가 hash 만·사전 K종 타일 공유)',
    title: 'HTJ — 지형이 DNA 경로를 탄다: 청크는 shapeHash 만, 세계 사전이 K종 타일을 공유(K≪N)',
    sub: '지형을 engine 지형 전용 함수가 아니라 제너릭 DNA(registerShape→shapeDict→reconstructShape)로 태운다. 16 청크가 K=3 타일 종류를 공유(dedup·확장성). merge-dna §5 T2(A) — engine·viewer 변경 0.',
    mode: 'energy', dynamics: false, render: 'entities',
    defaults: {},

    init(w) { build(w); },
    advance(w) { /* 정적 지형(무한질량 앵커) — 동역학 없음 */ },

    // ── 헤드리스 캡처(범용 러너·제너릭 DNA 경로와 동일하게 reconstructShape 발현) ──
    makeWorld() { return { N: 40 }; },
    frames: [1],
    captureOpts: { N: 48 },
    toFrame(w) {                                                       // top-down: 청크를 reconstructShape 로 펼친 점 무리
      const Nc = 48, sc = Nc / w.N, pts = [];
      for (const e of w.__entities) {
        const shape = D.reconstructShape(e, w.__shapeDict, w.__ropt);
        if (shape) for (const p of shape) pts.push({ cx: p.cx * sc, cy: p.cy * sc, r: Math.max(0.5, p.r * sc), v: e.peak });
        else pts.push({ cx: e.cx * sc, cy: e.cy * sc, r: e.radius * sc, v: e.peak });
      }
      return { pts, dictSize: Object.keys(w.__shapeDict).length, chunkCount: w.__entities.length };
    },

    note: '<b>지형이 *DNA 경로*를 탄다 — 청크는 shapeHash(코드) 하나만, 세계 사전이 K종 타일을 공유(K≪N).</b> 0067 되돌림에서 배운 정답: 지형을 engine 지형 전용 함수(terrainSurface·폐기)가 아니라 <b>제너릭 DNA 경로</b>로 태운다(merge-dna §5 T2·절대 원칙 "engine 타입전용 처리 금지"). <b>① 배선</b>: 지형 = 무한질량(정적 앵커) 구체 *청크* 배열. 각 청크의 앵커 배치를 <code>registerShape</code>(제너릭 engine 함수)로 정규화→<b>shapeHash</b> + 세계 <code>shapeDict</code> 에 dedup. 같은 타일(봉우리/계곡/평지)→같은 hash→사전 1항목 공유 → <b>16 청크가 K=3 종 타일</b> 공유(확장성). <b>② 발현</b>: viewer 의 <i>제너릭</i> DNA 렌더 경로(0063·<code>reconstructShape</code>)가 모든 청크를 사전에서 꺼내 그린다 — <b>지형 전용 렌더 코드 0</b>. <b>engine·viewer 변경 0</b>(기존 제너릭 함수·경로 조립만) → 구조적 회귀 0. <b>세계↔확인용 단방향</b>: shapeHash·사전은 순수 메타(물리량 불변)·reconstructShape 는 *어디에 그릴지*만. <b>정직한 한계</b>: 발현이 아직 *점 무리*(B표현=점→면 표면 승급은 다음 단위 T2b·제너릭 표면 발현)·회전 미정규화(M2 한계)·타일 손수 골격(절차 생성=후속). 다음: T2b 제너릭 표면 발현(점→면·매끄러움도 렌더 도메인).'
  };
});
