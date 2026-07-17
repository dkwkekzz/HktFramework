// ===========================================================================
//  HktCharacter · rmt-verify — RMT 스캐터의 수학·배치 검증 (Node, 브라우저 불필요)
//
//  실행: npm run verify:rmt
//  검사:
//   [1] GUE 간격열이 Wigner surmise P(s)=(32/π²)s²e^{-4s²/π} 를 따르는가
//       — 평균 1, 준위 반발 P(s<0.25), 히스토그램 L1 거리.
//   [2] 지니브르 2D 점과정이 일반 난수 대비 실제로 반발하는가
//       — 최근접 거리(NN) 최소·평균, "너무 가까운 쌍" 비율.
//   [3] 배치 결정론 — 같은 seed 는 같은 배치.
//   [4] 캡처 — 실제 buildScatterLayout 결과를 SVG 로 렌더 (무작위 vs RMT
//       나란히 + 간격 히스토그램). → verify/out/rmt-scatter.svg
// ===========================================================================
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gueSpacings, ginibrePoints, uniformDiskPoints } from '../src/rmt.js';
import { buildScatterLayout, SCATTER } from '../src/scatterLayout.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(OUT, { recursive: true });

let fails = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? '✔' : '✘'} ${name} — ${detail}`);
  if (!ok) fails++;
};

// --------------------------------------------------------------------------
// [1] GUE 간격 통계 vs Wigner surmise
// --------------------------------------------------------------------------
const wigner = s => (32 / Math.PI ** 2) * s * s * Math.exp((-4 / Math.PI) * s * s);
const spac = [];
for (let seed = 11; seed < 19; seed++) spac.push(...gueSpacings(400, seed));
const mean = spac.reduce((a, b) => a + b, 0) / spac.length;
const pSmall = spac.filter(s => s < 0.25).length / spac.length;
// 히스토그램 L1 (bin 0.1, 0..3)
const BW = 0.1, NB = 30;
const hist = new Array(NB).fill(0);
for (const s of spac) { const b = Math.floor(s / BW); if (b < NB) hist[b]++; }
let l1 = 0;
for (let b = 0; b < NB; b++) {
  const emp = hist[b] / spac.length / BW;
  l1 += Math.abs(emp - wigner((b + 0.5) * BW)) * BW;
}
check('GUE 간격 평균 ≈ 1', Math.abs(mean - 1) < 0.03, `mean=${mean.toFixed(4)} (표본 ${spac.length})`);
check('준위 반발 P(s<0.25)', pSmall < 0.03,
  `실측 ${(pSmall * 100).toFixed(2)}% · Wigner 이론 1.7% · 푸아송(일반 난수)이면 22.1%`);
check('Wigner surmise 히스토그램 L1', l1 < 0.12, `L1=${l1.toFixed(4)} (<0.12)`);

// --------------------------------------------------------------------------
// [2] 2D 최근접 거리 — 지니브르 vs 일반 난수 (단위원판, 같은 N)
// --------------------------------------------------------------------------
function nnStats(p) {
  const n = p.x.length, nn = [];
  for (let i = 0; i < n; i++) {
    let best = Infinity;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = Math.hypot(p.x[i] - p.x[j], p.y[i] - p.y[j]);
      if (d < best) best = d;
    }
    nn.push(best);
  }
  const m = nn.reduce((a, b) => a + b, 0) / n;
  return { min: Math.min(...nn), mean: m, fracClose: nn.filter(d => d < 0.4 * m).length / n };
}
const N2 = 220;
const gin = nnStats(ginibrePoints(N2, 21));
const uni = nnStats(uniformDiskPoints(N2, 21));
check('2D 반발: 최소 NN 거리', gin.min > 2 * uni.min,
  `RMT ${gin.min.toFixed(4)} vs 무작위 ${uni.min.toFixed(4)} (${(gin.min / uni.min).toFixed(1)}×)`);
// 2D β=2 의 NN CDF 는 ∝r⁴ (푸아송은 ∝r²) — 0.4·평균 이하 비율의 평형값은 ~2% 대,
// 푸아송은 ~13%. 완전 0 이 아니라 "수 배 억제" 가 이론적 기대치다.
check('2D 반발: 근접쌍(NN<0.4·평균) 비율', gin.fracClose < 0.05 && uni.fracClose > 2 * gin.fracClose,
  `RMT ${(gin.fracClose * 100).toFixed(1)}% vs 무작위 ${(uni.fracClose * 100).toFixed(1)}%`);

// --------------------------------------------------------------------------
// [3] 배치 결정론
// --------------------------------------------------------------------------
const a = JSON.stringify(buildScatterLayout('rmt', 1));
const b = JSON.stringify(buildScatterLayout('rmt', 1));
check('배치 결정론 (같은 seed=같은 배치)', a === b, `items=${JSON.parse(a).length}`);

// --------------------------------------------------------------------------
// [4] SVG 캡처 — 실제 배치 함수 결과 (무작위 vs RMT) + 간격 히스토그램
// --------------------------------------------------------------------------
const COLOR = { grass: '#6a9955', rock: '#9aa4b0', crystal: '#66aaff', tree: '#2e8b57' };
const RAD = { grass: 2.2, rock: 3, crystal: 2.6, tree: 6 };

function panel(items, cx, title) {
  const S = 340 / (SCATTER.R_OUT * 2); // 월드 → px
  let s = `<text x="${cx}" y="26" fill="#dfe3ea" font-size="15" text-anchor="middle">${title}</text>`;
  s += `<circle cx="${cx}" cy="210" r="${SCATTER.R_OUT * S}" fill="#1a1e24" stroke="#39424e"/>`;
  s += `<circle cx="${cx}" cy="210" r="${SCATTER.R_CLEAR * S}" fill="none" stroke="#3b82f6" stroke-dasharray="3 3" opacity="0.6"/>`;
  for (const it of items)
    s += `<circle cx="${(cx + it.x * S).toFixed(1)}" cy="${(210 + it.z * S).toFixed(1)}" r="${RAD[it.type]}" fill="${COLOR[it.type]}" opacity="0.9"/>`;
  return s;
}
const uniItems = buildScatterLayout('uniform', 1);
const rmtItems = buildScatterLayout('rmt', 1);

// 히스토그램 패널 (0..3, 실측 막대 + Wigner/푸아송 곡선)
function histPanel(x0, y0, w, h) {
  const maxY = 1.1;
  let s = `<text x="${x0 + w / 2}" y="${y0 - 10}" fill="#dfe3ea" font-size="14" text-anchor="middle">GUE 간격 분포 (실측 ${spac.length}개) vs 이론</text>`;
  s += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#1a1e24" stroke="#39424e"/>`;
  for (let bIdx = 0; bIdx < NB; bIdx++) {
    const emp = hist[bIdx] / spac.length / BW;
    const bh = Math.min(h, (emp / maxY) * h);
    s += `<rect x="${x0 + (bIdx / NB) * w}" y="${y0 + h - bh}" width="${w / NB - 1}" height="${bh}" fill="#3b82f6" opacity="0.55"/>`;
  }
  const curve = (f, color, dash) => {
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const sv = (i / 120) * 3;
      pts.push(`${x0 + (sv / 3) * w},${y0 + h - Math.min(h, (f(sv) / maxY) * h)}`);
    }
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2"${dash ? ' stroke-dasharray="5 4"' : ''}/>`;
  };
  s += curve(wigner, '#4ade80');            // Wigner (GUE 이론)
  s += curve(sv => Math.exp(-sv), '#f87171', true); // 푸아송 (일반 난수 이론)
  s += `<text x="${x0 + w - 8}" y="${y0 + 18}" fill="#4ade80" font-size="12" text-anchor="end">— Wigner surmise (제타/GUE)</text>`;
  s += `<text x="${x0 + w - 8}" y="${y0 + 34}" fill="#f87171" font-size="12" text-anchor="end">--- 푸아송 (일반 난수)</text>`;
  s += `<text x="${x0 + 4}" y="${y0 + h + 16}" fill="#8b95a3" font-size="11">s=0 (뭉침) — 일반 난수는 여기가 최빈, RMT 는 0 으로 죽는다 → 준위 반발</text>`;
  return s;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="420" font-family="system-ui,sans-serif">
<rect width="1180" height="420" fill="#14161a"/>
${panel(uniItems, 200, `무작위 배치 (${uniItems.length}개) — 뭉침·공백`)}
${panel(rmtItems, 590, `RMT 배치 (${rmtItems.length}개) — 준위 반발`)}
${histPanel(810, 60, 350, 300)}
<text x="200" y="404" fill="#8b95a3" font-size="11" text-anchor="middle">파랑 점선 = 캐릭터 공터 · 색: 잔디/바위/수정/나무</text>
<text x="590" y="404" fill="#8b95a3" font-size="11" text-anchor="middle">buildScatterLayout('rmt') 실제 배치 그대로</text>
</svg>`;
const svgPath = join(OUT, 'rmt-scatter.svg');
writeFileSync(svgPath, svg);
console.log(`📷 캡처: ${svgPath}`);

process.exit(fails ? 1 : 0);
