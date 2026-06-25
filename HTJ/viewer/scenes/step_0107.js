// viewer/scenes/step_0107.js — (조립) 바이옴 지형 3D 음영 표면: biome+terrain 높이장을 0074/0068 표면 파이프라인으로
//   점→면(heights+normals) 환원하고 *hillshade*(n·L)로 3D 입체 발현. 0090~0096 은 *평평한 top-down 색*이었다 —
//   여기선 같은 바이옴 지형을 *음영 표면*으로(산이 산처럼·골이 골처럼·바이옴이 색). 프레임마다 빛을 돌려(새벽→해질녘)
//   relief 가 살아나는 걸 보인다(진짜 3D 표면이라 빛 따라 음영이 바뀐다). engine 변경 0(viewer 표면 유틸+biomeField).
//   UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0107'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Surf = require ? require('../htj-surface.js') : self.HTJSurface;
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  const M = 30, SCALE = 0.10, AMP = 14, RES = 64;
  const elevFn = (x, y) => AMP * Stream.fbm(x * SCALE, y * SCALE, { salt: 'TERR', octaves: 4, gain: 0.55 });
  const elev01 = (x, y) => Stream.fbm(x * SCALE, y * SCALE, { salt: 'TERR', octaves: 4, gain: 0.55 });
  const bf = Stream.biomeField({ scale: SCALE, nTemp: 3, nHum: 3, octaves: 4, gain: 0.55, lapse: 0.6, latAmp: 0.4, latPeriod: 60, elevFn: elev01 });
  // 9 바이옴 팔레트(찬→따뜻 × 건조→습) — band=q(effTemp,3)*3+q(hum,3).
  const PAL = [[185, 190, 200], [205, 210, 222], [214, 224, 240], [170, 150, 95], [110, 150, 70], [55, 120, 52], [212, 188, 120], [150, 170, 80], [42, 112, 50]];

  function build(w) {
    const pts = [];
    for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) pts.push({ cx: x, cy: y, cz: elevFn(x, y), r: 1.3 });
    w.__surf = Surf.pointCloudSurface(pts, { res: RES, pad: 0.02 });
    w.__li = 0;
  }

  const CAN = 64, AZ = [[-0.7, -0.4], [-0.1, -0.7], [0.6, -0.4], [0.4, 0.6]];   // 빛 방위(새벽→정오→오후→해질녘)
  return {
    label: 'step_0107 — (조립) 바이옴 지형 3D 음영 표면: 평평 top-down 색 → hillshade 입체 relief',
    title: 'HTJ — 바이옴 지형 3D 음영 표면: 같은 바이옴 지형을 점→면+hillshade 로 입체 발현(빛 따라 relief)',
    sub: '0090~0096 은 평평한 top-down 색이었다. 여기선 biome+terrain 높이장을 표면 파이프라인(0068 pointCloudSurface)으로 점→면(heights+normals) 환원하고 hillshade(n·L)로 3D 음영. 바이옴이 색·고도가 relief·빛 돌리면 입체가 산다. engine 변경 0.',
    mode: 'energy', dynamics: false, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { w.__li = Math.min(AZ.length - 1, w.__li + 1); },

    makeWorld() { return { N: CAN }; },
    frames: [0, 1, 2, 3],
    // v = biomeBand + brightness(0..1). color: 팔레트[band] × (0.3+0.7·shade).
    captureOpts: {
      N: CAN, color: (v) => {
        let band = Math.floor(v); if (band < 0) band = 0; if (band > 8) band = 8;
        const sh = 0.30 + 0.70 * Math.max(0, Math.min(0.999, v - band)), c = PAL[band];
        return [c[0] * sh, c[1] * sh, c[2] * sh];
      }
    },
    toFrame(w) {
      const s = w.__surf, pts = []; const az = AZ[w.__li];
      const Lx = az[0], Ly = az[1], Lz = 0.95, Lm = Math.hypot(Lx, Ly, Lz), lx = Lx / Lm, ly = Ly / Lm, lz = Lz / Lm;
      const sc = CAN / Math.max(s.nx, s.ny);
      for (let J = 0; J < s.ny; J++) for (let I = 0; I < s.nx; I++) {
        const k = J * s.nx + I, n = s.normals[k];
        const wx = s.x0 + I * s.dx, wy = s.y0 + J * s.dy;
        const b = bf(Math.max(0, Math.min(M - 1, wx)), Math.max(0, Math.min(M - 1, wy)));
        const bright = Math.max(0.05, n.x * lx + n.y * ly + n.z * lz);
        pts.push({ cx: (I + 0.5) * sc, cy: (s.ny - 0.5 - J) * sc, r: 0.55, v: b.biome + Math.min(0.999, bright) });
      }
      return { pts, count: s.count, light: w.__li };
    },

    note: '<b>0090~0096 은 바이옴을 *평평한 top-down 색*으로 그렸다 — 여기선 같은 바이옴 지형을 *3D 음영 표면*으로 발현한다(산이 산처럼·골이 골처럼).</b> 같은 높이장을 두 트랙이 공유한다: ⓐ 0074/0068 *표면 파이프라인*(<code>pointCloudSurface</code>·점 무리→연속 높이장+정점 법선) ⓑ 바이옴(<code>biomeField</code>·effTemp=temp−lapse·고도 → 색). 각 표면 정점에서 <b>hillshade</b> brightness = max(0, n·L)(법선·빛) 로 음영을 입히고, 바이옴 9칸(찬→따뜻 × 건조→습) 팔레트로 색칠한다(v = biomeBand + brightness 인코딩). <b>측정(verify)</b>: ① <b>표면 재구성 충실</b> corr(표면 heights, terrain)=0.983(점→면) ② <b>음영 입체감</b> 경사 셀 밝기 std 0.312 > 평지 0.149×1.5·대비 1.00(평평 색 아닌 3D 음영) ③ <b>바이옴 결합</b> 찬 바이옴 평균 고도 6.5 > 따뜻 4.7(산이 차다·relief 로 보임·0095 결합) ④ 결정론. <b>흐름</b>(capture 4 프레임): 빛 방위를 새벽→정오→오후→해질녘으로 *돌리면* 같은 표면의 음영이 바뀌며 능선·골짜기가 또렷이 *입체*로 산다(진짜 3D 표면이라 빛 따라 relief 가 변한다) — 찬 고지는 흰빛 산, 따뜻 저지는 초록·모래. <b>큰 그림</b>: 환경(TW)이 *딛고 다닐 대륙* 으로 — 평면 기후도 → 입체 지형(PW 사다리 "걸을 수 있는 땅"의 *눈*). <b>원칙 준수</b>: 표면·음영 모두 generic(타입 0·터레인 전용 코드 0·0065 의 deprecated terrainSurface 와 달리 pointCloudSurface 는 점이면 뭐든)·engine 변경 0. <b>정직한 한계</b>: top-down hillshade(오블리크/메시 아님)·바이옴 색=칸 팔레트(연속 아님)·물/바다 미포함(여긴 지형 표면만). 다음(디테일 마무리): 안정 분절 침식 또는 PW 사다리(걸을 수 있는 한 조각 땅).'
  };
});
