// step_0022/verify.js — S2 *번지는* 힘 법칙(압력 g←g−dt·∇P)을 활성 순회 + halo 로 일반화. 순수·독립·영구.
//
//   step_0020 이 *번지는* stencil 을 ρ 장(확산)에 일반화했고, step_0021 이 *수송* stencil 을 advect 에
//   일반화했다. 남은 가족: ∇ 기반 *힘* 법칙(pressure/thermal/viscosity) — ∇P/∇q 가 ±1 이웃 stencil 로
//   *g(운동량)* 에 번진다. 이 step 은 그 첫·가장 단순한 것 applyPressure 를 active∪halo 로 일반화한다.
//
//   핵심 비트 동일 논리: ∇P[i]≠0 이려면 i 의 ±1 이웃 중 ρ>0 인 게 있어야 한다(P=K·ρ^γ, ρ=0→P=0).
//   그 이웃은 활성 블록 → i 는 활성 블록이거나 그 6-면 이웃(=halo). active∪halo 밖 셀은 자신·6-이웃 모두
//   ρ=0 → P 전부 0 → ∇P=0 → g 불변. 그래서 originsWithHalo 만 돌아도 조밀과 비트 동일.
//   압력은 ρ 를 *안 바꾸는* 힘 법칙 → 활성 집합이 자라지 않음(확산과 달리 activateFrom 불필요).
//
//   검증 대상:
//     1. 비트 동일(관문)  — active∪halo 압력 = 조밀 압력 → mom_x/y/z 비트 동일.
//     2. halo 필요성     — halo *없이*(활성 블록만) 돌면 조밀과 *달라진다*(rim 의 ∇P 누락) → 왜 halo 인가.
//     3. 활성 커버리지   — 조밀이 g 를 바꾼 셀이 *모두* active∪halo 안(밖에서 dense Δg=0, missed=0).
//     4. 순 운동량 보존  — 내부 압력은 질량중심을 못 가속: 활성 경로 ΣΔg≈0(주기 중심차분 telescoping).
//     5. 재스캔 없음     — active∪halo 방문 셀이 전-격자 N³ ≪ (활성 비례, 재스캔 아님).
//     6. 회귀 0          — opts.active 생략 → 기존 조밀 경로(손 계산 1스텝과 byte 일치).
//     7. 결정론          — 같은 입력 두 번 → 동일 지문.
//   (벽시계 ms 는 머신 의존 → 정보용 출력만, 단언 안 함 — step_0015 정직성 정책.)
//
//   실행: node HTJ/steps/step_0022/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-energy.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));
const Sp = require(path.resolve(__dirname, '../../engine/htj-sparse.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

const N = 64, BS = 8, K = 0.5, GAMMA = 2, DT = 0.2;
const POPT = { K, gamma: GAMMA };

// 희소 핫스팟 ρ + 결정론적 초기 운동량(active∪halo *밖*도 비-영 → "밖은 불변" 을 진짜로 검증).
//   핫큐브를 블록 경계(31|32)에 *딱 붙여* [26..31]³ 에 둔다 → 한 블록(3,3,3)만 활성이고, 그 high rim(x=32
//   등)은 *빈 이웃 블록(4)* 로 넘친다. 그래야 halo 없이 돌면 rim ∇P 를 놓쳐 조밀과 달라진다(테스트 2).
function seededWorld() {
  const w = W.createWorld(N);
  const E = w.fields.energy; E.fill(0);
  const lo = 26, hi = 31, per = 1000 / ((hi - lo + 1) ** 3);
  for (let z = lo; z <= hi; z++) for (let y = lo; y <= hi; y++) for (let x = lo; x <= hi; x++) E[(z * N + y) * N + x] = per;
  for (const nm of ['mom_x', 'mom_y', 'mom_z']) {
    const f = w.fields[nm] || w.addField(nm, { type: Float64Array });
    for (let i = 0; i < f.length; i++) f[i] = ((i * 2654435761 >>> 0) % 2000) / 1000 - 1;  // 결정론적 [-1,1)
  }
  return w;
}
const gfp = (w) => `${w.fingerprint('mom_x').toString(16)}/${w.fingerprint('mom_y').toString(16)}/${w.fingerprint('mom_z').toString(16)}`;

// active∪halo 블록 키 집합(멤버십 테스트용) — origins 목록을 블록 좌표 문자열 집합으로.
function haloKeySet(iter) {
  const s = new Set();
  for (const [ox, oy, oz] of iter) s.add(`${ox / BS | 0},${oy / BS | 0},${oz / BS | 0}`);
  return s;
}

// ── 1. 비트 동일(관문) — active∪halo 압력 = 조밀 압력 ──
{
  const wd = seededWorld();                                 // 조밀
  const wa = seededWorld();                                 // active∪halo
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  const iter = set.originsWithHalo();
  Pr.applyPressure(wd, DT, POPT);                           // 조밀 전-격자
  Pr.applyPressure(wa, DT, Object.assign({ active: iter, blockSize: BS }, POPT));
  const same = gfp(wd) === gfp(wa);
  check('비트 동일(관문) — active∪halo 압력 = 조밀 압력 (mom_x/y/z 비트 동일)',
    same, `g fp ${gfp(wa)} (동일)`);
}

// ── 2. halo 필요성 — halo 없이(활성 블록만) 돌면 조밀과 달라진다(rim ∇P 누락) ──
{
  const wd = seededWorld();
  const wn = seededWorld();                                 // halo 없는(활성 블록만) 경로
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wn.fields.energy);
  Pr.applyPressure(wd, DT, POPT);
  Pr.applyPressure(wn, DT, Object.assign({ active: set.origins(), blockSize: BS }, POPT));  // halo 없이!
  const differs = gfp(wd) !== gfp(wn);
  // rim(ρ=0 인데 ρ>0 이웃이 있는 셀)의 ∇P 를 누락 → 그 셀 g 가 조밀과 달라진다.
  check('halo 필요성 — halo 없이 활성 블록만 돌면 조밀과 *달라진다*(rim 의 ∇P 누락) → 왜 halo 인가',
    differs, `조밀 g ${gfp(wd)} ≠ halo없음 g ${gfp(wn)}`);
}

// ── 3. 활성 커버리지 — 조밀이 g 를 바꾼 셀이 모두 active∪halo 안(missed=0) ──
{
  const wd = seededWorld();
  const g0 = ['mom_x', 'mom_y', 'mom_z'].map(nm => Float64Array.from(wd.fields[nm]));
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wd.fields.energy);
  const keys = haloKeySet(set.originsWithHalo());
  Pr.applyPressure(wd, DT, POPT);                           // 조밀
  const g1 = ['mom_x', 'mom_y', 'mom_z'].map(nm => wd.fields[nm]);
  let changed = 0, missed = 0;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (z * N + y) * N + x;
    const moved = g1[0][i] !== g0[0][i] || g1[1][i] !== g0[1][i] || g1[2][i] !== g0[2][i];
    if (!moved) continue;
    changed++;
    if (!keys.has(`${x / BS | 0},${y / BS | 0},${z / BS | 0}`)) missed++;  // 바뀌었는데 active∪halo 밖 = 누락
  }
  check('활성 커버리지 — 조밀이 g 를 바꾼 셀이 모두 active∪halo 안(밖에서 dense Δg=0, missed=0)',
    changed > 0 && missed === 0, `g 바뀐 셀 ${changed}개 · active∪halo 밖 ${missed}개`);
}

// ── 4. 순 운동량 보존 — 활성 경로 ΣΔg≈0(주기 중심차분 telescoping, 내부력은 CoM 못 가속) ──
{
  const wa = seededWorld();
  const sum = (nm) => { const f = wa.fields[nm]; let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };
  const s0 = ['mom_x', 'mom_y', 'mom_z'].map(sum);
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  Pr.applyPressure(wa, DT, Object.assign({ active: set.originsWithHalo(), blockSize: BS }, POPT));
  const s1 = ['mom_x', 'mom_y', 'mom_z'].map(sum);
  // |ΣΔg| 를 압력 충격량 규모 Σ|Δg per-cell| 로 정규화(순 힘이 상쇄되는 비율).
  const wd = seededWorld(); const g0 = Float64Array.from(wd.fields.mom_x);
  Pr.applyPressure(wd, DT, POPT);
  let scale = 0; for (let i = 0; i < g0.length; i++) scale += Math.abs(wd.fields.mom_x[i] - g0[i]);
  const dAbs = Math.max(Math.abs(s1[0] - s0[0]), Math.abs(s1[1] - s0[1]), Math.abs(s1[2] - s0[2]));
  const rel = scale > 0 ? dAbs / scale : 0;
  check('순 운동량 보존 — 내부 압력은 CoM 못 가속: 활성 경로 ΣΔg≈0(telescoping, rel ≤1e-12)',
    rel <= 1e-12, `|ΣΔg|max=${dAbs.toExponential(2)} / 충격량 Σ|δ|=${scale.toFixed(2)} → rel=${rel.toExponential(1)}`);
}

// ── 5. 재스캔 없음 — active∪halo 방문 셀이 전-격자 N³ ≪ ──
{
  const wa = seededWorld();
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  const stats = {}, dense = N * N * N;
  Pr.applyPressure(wa, DT, Object.assign({ active: set.originsWithHalo(), blockSize: BS, stats }, POPT));
  check('재스캔 없음(O(활성)) — active∪halo 방문 셀이 전-격자 N³ ≪ (활성 비례, 재스캔 아님)',
    stats.cellsVisited < dense, `방문 ${stats.cellsVisited}셀 ≪ 전-격자 ${dense}셀`);
}

// ── 6. 회귀 0 — opts.active 생략 → 기존 조밀 경로(손 계산 1스텝과 byte 일치) ──
{
  const w = seededWorld();
  const rho = Float64Array.from(w.fields.energy);
  const g0 = ['mom_x', 'mom_y', 'mom_z'].map(nm => Float64Array.from(w.fields[nm]));
  const wrap = (a) => (a + N) % N;
  const Pof = (j) => { const r = rho[j]; return r > 0 ? K * Math.pow(r, GAMMA) : 0; };
  const exp = g0.map(a => Float64Array.from(a));            // 손 계산 기대값(조밀 공식 그대로)
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (z * N + y) * N + x;
    const xm = (z * N + y) * N + wrap(x - 1), xp = (z * N + y) * N + wrap(x + 1);
    const ym = (z * N + wrap(y - 1)) * N + x, yp = (z * N + wrap(y + 1)) * N + x;
    const zm = (wrap(z - 1) * N + y) * N + x, zp = (wrap(z + 1) * N + y) * N + x;
    exp[0][i] -= DT * (Pof(xp) - Pof(xm)) / 2;
    exp[1][i] -= DT * (Pof(yp) - Pof(ym)) / 2;
    exp[2][i] -= DT * (Pof(zp) - Pof(zm)) / 2;
  }
  Pr.applyPressure(w, DT, POPT);                            // opts.active 없음 = 조밀
  const fld = ['mom_x', 'mom_y', 'mom_z'].map(nm => w.fields[nm]);
  let same = true;
  for (let c = 0; c < 3 && same; c++) for (let i = 0; i < exp[c].length; i++) if (exp[c][i] !== fld[c][i]) { same = false; break; }
  check('회귀 0 — opts.active 생략 → 기존 조밀 경로(손 계산 1스텝과 byte 일치)', same, 'dense path 불변');
}

// ── 7. 결정론 — 같은 입력 두 번 → 동일 지문 ──
{
  const a = seededWorld(), b = seededWorld();
  const sa = Sp.createActiveSet(N, BS).rebuildFromField(a.fields.energy);
  const sb = Sp.createActiveSet(N, BS).rebuildFromField(b.fields.energy);
  Pr.applyPressure(a, DT, Object.assign({ active: sa.originsWithHalo(), blockSize: BS }, POPT));
  Pr.applyPressure(b, DT, Object.assign({ active: sb.originsWithHalo(), blockSize: BS }, POPT));
  check('결정론 — 같은 입력 두 번 active∪halo 압력 → 동일 지문', gfp(a) === gfp(b), gfp(a));
}

// ── 벽시계(정보용·머신 의존·비단언) — active∪halo vs 조밀 ──
let msDense = 0, msActive = 0;
{
  const S = 200;
  const wd = seededWorld();
  let t0 = process.hrtime.bigint();
  for (let t = 0; t < S; t++) Pr.applyPressure(wd, DT, POPT);
  msDense = Number(process.hrtime.bigint() - t0) / 1e6 / S;
  const wa = seededWorld();
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  const iter = set.originsWithHalo();
  t0 = process.hrtime.bigint();
  for (let t = 0; t < S; t++) Pr.applyPressure(wa, DT, Object.assign({ active: iter, blockSize: BS }, POPT));
  msActive = Number(process.hrtime.bigint() - t0) / 1e6 / S;
}

console.log('\n=== step_0022 수치 검증: *번지는* 힘 법칙(압력 g←g−dt·∇P)을 활성 순회 + halo 로 일반화 ===');
console.log(`  [정보용·비단언] 벽시계 ms/step: 조밀 ${msDense.toFixed(3)} · active∪halo ${msActive.toFixed(3)} → ${(msDense / msActive).toFixed(1)}× (희소 핫스팟).`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
