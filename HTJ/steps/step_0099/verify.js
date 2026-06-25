// step_0099/verify.js — (조립) 강이 바이옴을 적신다(riparian): 흐름 누적(0098)이 강가의 유효 습도를 올려 *강 회랑*이
//   주변보다 풍성한 바이옴이 된다(사막을 가르는 초록 띠·오아시스). 두 트랙을 한 무대에서 합친다(engine 변경 0·새 법칙 0):
//   ① 흐름 누적(0098 flowAccumulation) ② 바이옴(0090~0097 biomeField). effHum = clamp01(humidity + ripW·normLogAcc).
//   부품 보존(라우팅·바이옴 순수)은 부품 verify 가 보증 → 여기선 *합쳐서 생긴 cross-thread 창발*만. 순수·독립·영구.
//   실행: node HTJ/steps/step_0099/verify.js
'use strict';
const path = require('path');
const S = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);
const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);

const SCALE = 0.06, X0 = 200, Y0 = -150, W = 80, H = 80, NT = 3, NH = 3;
const elevFn = (i, j) => S.fbm(i * SCALE, j * SCALE, { salt: 'TERR', octaves: 4, gain: 0.55 });
const bf = S.biomeField({ scale: SCALE, nTemp: NT, nHum: NH, octaves: 4, gain: 0.55, lapse: 0.4, elevFn });

// riparian 조립 — flow 누적을 정규화 log 로 습도에 보탠다(ripW=0 → 회귀 0). 반환: 셀별 base/eff 습도열·바이옴.
function build(ripW) {
  const F = S.flowAccumulation({ elevFn, x0: X0, y0: Y0, W, H });
  const lmax = Math.log(F.maxAcc + 1);
  const cells = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const k = r * W + c, b = bf(X0 + c, Y0 + r);
    const normLogAcc = Math.log(F.acc[k] + 1) / lmax;             // [0,1] 강일수록 1
    const T = 0.4, ramp = normLogAcc <= T ? 0 : (normLogAcc - T) / (1 - T);  // 강가만 적심(임계 이하=무보정)
    const effHum = Math.min(0.999999, b.humidity + ripW * ramp);
    const q = (v, n) => { let i = Math.floor(v * n); return i < 0 ? 0 : (i >= n ? n - 1 : i); };
    cells.push({ acc: F.acc[k], base: b.humidity, eff: effHum, baseCol: q(b.humidity, NH), effCol: q(effHum, NH), normLogAcc });
  }
  return cells;
}

const cells = build(0.5);

// ① cross-thread 창발(핵심) — 강가(high acc)는 유효 습도가 올라 더 풍성한 바이옴: corr(normLogAcc, effHum−base) > 0 강하게.
const da = cells.map(c => c.normLogAcc), dd = cells.map(c => c.eff - c.base);
(() => {
  const n = da.length, mx = mean(da), my = mean(dd); let sxy = 0, sxx = 0, syy = 0;
  for (let k = 0; k < n; k++) { const x = da[k] - mx, y = dd[k] - my; sxy += x * y; sxx += x * x; syy += y * y; }
  const cr = sxy / (Math.sqrt(sxx * syy) || 1e-300);
  ok(cr > 0.7, `강가 적심 — corr(흐름, 습도증가) ${cr.toFixed(2)} > 0.7(강일수록 유효 습도↑·임계 이하=무보정 ramp)`);
})();

// ② 사막을 가르는 초록 띠 — 건조 지역(base 습도 하위 1/3)에서, 강 셀이 비-강 셀보다 *습한 바이옴 칸*으로 자주 올라간다.
const dry = cells.filter(c => c.baseCol === 0);                     // 가장 건조한 습도 칸
const dryRiver = dry.filter(c => c.normLogAcc > 0.6), dryLand = dry.filter(c => c.normLogAcc < 0.3);
const upR = mean(dryRiver.map(c => c.effCol > 0 ? 1 : 0)), upL = mean(dryLand.map(c => c.effCol > 0 ? 1 : 0));
ok(dryRiver.length >= 3 && upR > upL + 0.2,
  `사막 속 강 회랑 — 건조지 강 셀 ${(upR * 100).toFixed(0)}% > 비-강 ${(upL * 100).toFixed(0)}% 가 습한 칸으로(Δ${((upR - upL) * 100).toFixed(0)}%·표본 ${dryRiver.length}/${dryLand.length})`);

// ③ 유효 습도 ∈ [0,1] 유한.
ok(cells.every(c => Number.isFinite(c.eff) && c.eff >= 0 && c.eff < 1), `effHum ∈ [0,1) 유한 — max ${Math.max(...cells.map(c => c.eff)).toFixed(3)}`);

// ④ 항등(회귀 0) — ripW=0 → 유효 습도 = base, 바이옴 칸 = 원래(riparian 끄면 0097 동일).
const off = build(0);
show(L.identity('ripW=0 → 바이옴 불변', cells.map(c => c.baseCol), off.map(c => c.effCol)));

// ⑤ 결정론 — 같은 법칙 → 같은 riparian 장.
show(L.deterministic('같은 법칙 → 같은 riparian', () => build(0.5).map(c => c.eff.toFixed(5))));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
