// ===========================================================================
//  HktCharacter · apply-fit — eval/out/loft-fit.json → src/proportions.js 반영
//  (수작업 붙여넣기 실수 방지 — loft 절만 기계적으로 재생성한다)
// ===========================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROP = join(ROOT, 'src', 'proportions.js');
// 빌드 산출물을 직접 병합 — loft-fit.json(apply 스테이지 산출)은 낡았을 수 있다 (교훈)
const fit = {
  ...JSON.parse(readFileSync(join(ROOT, 'eval', 'out', 'fit-torso.json'), 'utf8')),
  ...JSON.parse(readFileSync(join(ROOT, 'eval', 'out', 'fit-legs.json'), 'utf8')),
};

const ORDER = ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'HeadTop_End', 'Leg', 'Foot', 'UpLeg'];
const NOTE = {
  HeadTop_End: `    // 두정: round-cone 은 "구 껍질" — 마지막 원판의 구형 돔이 정수리를 그린다 (fit 이
    // crown 높이에 정확히 맞춰 자름. 급한 테이퍼 원판을 더 얹으면 두정이 솟는다 — 교훈)\n`,
  Leg: `    // 허벅지: 상단은 돔 가드로 잘림(새들백 방지 — 힙 크레스트 위 실루엣은 골반 loft 담당),
    // k0 = 골반 살과의 관절 경계 blend\n`,
};
const fmtDisk = d => {
  const parts = [`t: ${d.t}`, `rx: ${d.rx}`, `zf: ${d.zf}`, `zb: ${d.zb}`];
  if (d.xo != null) parts.push(`xo: ${d.xo}`);
  return `      { ${parts.join(', ')} },`;
};
let out = '';
for (const key of ORDER) {
  const s = fit[key];
  if (!s) continue;
  out += NOTE[key] ?? '';
  const head = [`group: '${s.group}'`];
  if (s.k != null) head.push(`k: ${s.k}`);
  if (s.k0 != null) head.push(`k0: ${s.k0}`);
  if (s.k1 != null) head.push(`k1: ${s.k1}`);
  if (s.pancake != null) head.push(`pancake: ${s.pancake}`);
  if (!s.disks.length) {
    out += `    '${key}': { ${head.join(', ')}, disks: [] }, // 골반·허벅지 loft 가 대체 — 캡슐 억제\n`;
    continue;
  }
  out += `    '${key}': { ${head.join(', ')}, disks: [\n${s.disks.map(fmtDisk).join('\n')}\n    ] },\n`;
}

const src = readFileSync(PROP, 'utf8');
const re = /(loft: \{\n)[\s\S]*?(\n  \},\n  defaults:)/;
if (!re.test(src)) { console.error('loft 절 마커를 찾지 못했습니다'); process.exit(1); }
writeFileSync(PROP, src.replace(re, `$1${out.replace(/\n$/, '')}$2`));
console.log('src/proportions.js loft 절 갱신 완료 — 스택', Object.keys(fit).length, '개');
