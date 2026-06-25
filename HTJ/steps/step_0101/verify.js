// step_0101/verify.js — (조립) 기후·강·호수·바다 통합 맵: 물순환 사다리(0097~0100)+바이옴(0090~0096)을 한 무대에서.
//   같은 지형 높이장 하나가 ⓐ 바이옴 고도축(높은 곳=찬 산) ⓑ 강의 라우팅(흐름 누적 0098) ⓒ 호수 분지(lakeFill 0100)
//   ⓓ 바다(저지 임계 아래) 를 모두 결정한다 → 모든 물 요소가 *자기일관*(바다=최저·호수=중간 분지·강은 산서 발원해 물에 닿음·
//   바다=따뜻 저지·산=찬 고지). 조립 step(engine 변경 0·새 법칙 0). 부품 보존은 부품 verify 가 보증 → 여기선 통합 cross-thread만.
//   순수·독립·영구. 실행: node HTJ/steps/step_0101/verify.js
'use strict';
const path = require('path');
const S = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);
const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);

const SCALE = 0.06, X0 = 200, Y0 = -150, W = 80, H = 80, N = W * H;
const elevFn = (i, j) => S.fbm(i * SCALE, j * SCALE, { salt: 'TERR', octaves: 4, gain: 0.55 });
const bf = S.biomeField({ scale: SCALE, nTemp: 3, nHum: 3, octaves: 4, gain: 0.55, lapse: 0.6, elevFn });

function world() {
  const F = S.flowAccumulation({ elevFn, x0: X0, y0: Y0, W, H });
  const Lk = S.lakeFill({ elevFn, x0: X0, y0: Y0, W, H });
  const terr = Array.from(F.elev).slice().sort((a, b) => a - b);
  const seaLevel = terr[Math.floor(N * 0.30)];                    // 저지 30% 아래 = 바다
  const klass = new Int8Array(N);                                 // 0=땅·1=바다·2=호수·3=강
  const lmax = Math.log(F.maxAcc + 1);
  for (let k = 0; k < N; k++) {
    if (F.elev[k] < seaLevel) klass[k] = 1;                       // 바다(최저 분지)
    else if (Lk.depth[k] > 1e-6) klass[k] = 2;                    // 내륙 호수(해수면 위 분지)
    else if (Math.log(F.acc[k] + 1) / lmax > 0.6) klass[k] = 3;   // 강(높은 흐름 누적)
  }
  return { F, Lk, seaLevel, klass, lmax };
}
const Wd = world();

// ① 물 위계(drainage hierarchy) — 바다(최저) < 호수(중간 분지) < 마른 땅(높음): 지형 평균이 위계대로.
const tOf = (cls) => { const a = []; for (let k = 0; k < N; k++) if (Wd.klass[k] === cls) a.push(Wd.F.elev[k]); return a; };
const tSea = mean(tOf(1)), tLake = mean(tOf(2)), tLand = mean(tOf(0));
ok(tOf(1).length >= 5 && tOf(2).length >= 3 && tSea < tLake && tLake < tLand,
  `물 위계 — 바다지형 ${tSea.toFixed(3)} < 호수 ${tLake.toFixed(3)} < 마른땅 ${tLand.toFixed(3)}(바다 최저·호수 중간 분지)`);

// ② 강은 물에 닿는다(통합 일관) — 흐름 종착(sink)은 호수로 채워진다: 모든 내부 sink 가 lakeFill depth>0(강이 호수로 모임).
(() => {
  let sinks = 0, filled = 0;
  for (let k = 0; k < N; k++) {
    const c = k % W, r = (k - c) / W;
    if (c === 0 || c === W - 1 || r === 0 || r === H - 1) continue;  // 경계 sink = 유출구(바다/창밖)·호수 아님
    if (Wd.F.down[k] === -1) { sinks++; if (Wd.Lk.depth[k] > 1e-9) filled++; }
  }
  ok(sinks >= 3 && filled / sinks > 0.95,
    `강→호수 종착 — 내부 sink ${sinks}개 중 ${filled}개(${(100 * filled / sinks).toFixed(0)}%)가 호수로 채워짐(흐름이 분지에 모여 호수)`);
})();

// ③ 기후 자기일관(cross-thread) — 같은 지형장이 바다이자 고도축이라: 바다=따뜻 저지·산=찬 고지(effTemp 바다 > 고지대).
(() => {
  const seaT = [], highT = [];
  const ts = Array.from(Wd.F.elev).slice().sort((a, b) => b - a);
  const hi = ts[Math.floor(N * 0.20)];                            // 상위 20% 고도 = 산
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const k = r * W + c, b = bf(X0 + c, Y0 + r);
    if (Wd.klass[k] === 1) seaT.push(b.effTemp);
    if (Wd.F.elev[k] >= hi) highT.push(b.effTemp);
  }
  const mS = mean(seaT), mH = mean(highT);
  ok(mS > mH + 0.05, `바다=따뜻·산=차다 — 바다 effTemp ${mS.toFixed(2)} > 산(고지 20%) ${mH.toFixed(2)}(Δ${(mS - mH).toFixed(2)}·같은 지형장이 분지이자 고도축)`);
})();

// ④ 결정론 — 같은 법칙 → 같은 통합 세계(분류 지문).
show(L.deterministic('같은 법칙 → 같은 통합 맵', () => Array.from(world().klass)));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
