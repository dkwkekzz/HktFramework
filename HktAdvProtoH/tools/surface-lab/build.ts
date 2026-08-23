// Surface Lab — 겹침 표면 capability 가 실제로 무엇을 그리는지 눈으로 보는 자리.
//
//     npx tsx tools/surface-lab/build.ts        tools/surface-lab/out/lab.html 을 만든다
//
// **여기에는 게임의 결정이 하나도 없다.** 이 랩이 확인하는 것은 capability 쪽 성질뿐이다 —
// 빈 칸이 그려지는가, 안 되는 줄이 사라지지 않는가, 초점과 고른 것이 다른 자리에
// 표시되는가, 모르는 코드가 와도 화면이 멈추지 않는가.
//
// 어떤 글자가 어느 칸에 들어가는가는 팩의 결정 Layer 가 정한다 (C026 Stage 7).
// 그러므로 아래 장면들은 **그 화면의 미리보기가 아니라 능력의 표본**이다.
//
// 장면 이름은 C026 04-gameview.spec.yaml 의 fixtures 를 따른다 — 같은 것을 두 자리에서
// 다른 이름으로 부르지 않기 위해서다.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { surfaceMarkup } from '../../engine/view-kernel/hud/surface';
import type { SceneSurface } from '../../engine/view-kernel/scene/scene-state';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** 자리 넷 — 세계가 준 두 수(used · capacity)로 칸을 놓는다 */
function cells(
  filled: Array<{ text: string; detail?: string; selected?: boolean }>,
  capacity: number,
) {
  const out = filled.map((f, i) => ({
    id: `cell.${i}`,
    text: f.text,
    ...(f.detail ? { detail: f.detail } : {}),
    empty: false,
    selected: f.selected ?? false,
  }));
  // 빈 칸은 **수**이지 대상이 아니다 — 서로 구별되지 않는다
  for (let i = out.length; i < capacity; i += 1) {
    out.push({ id: `cell.empty.${i}`, text: '', empty: true, selected: false });
  }
  return out;
}

const SCENES: Array<{ name: string; note: string; surface: SceneSurface }> = [
  {
    name: 'VUX-IE-FX-EMPTY',
    note: '지닌 것이 없다 — 빈 칸 넷이 자리의 유한함을 보인다',
    surface: {
      id: 'bag',
      open: true,
      title: '가진 것',
      sections: [
        { id: 'room', rows: [{ id: 'room', text: '자리 0 / 4' }] },
        { id: 'cells', columns: 4, cells: cells([], 4) },
        { id: 'detail', title: '고른 것', rows: [], emptyText: '소지품 없음' },
      ],
      footer: ['닫기 Esc', '고르기 ← →', '실행 Enter'],
    },
  },
  {
    name: 'VUX-IE-FX-PARTIAL',
    note: '되는 것과 안 되는 것이 나란하다 — 안 되는 줄이 사라지지 않는다',
    surface: {
      id: 'bag',
      open: true,
      title: '가진 것',
      focusId: 'cell.1',
      sections: [
        { id: 'room', rows: [{ id: 'room', text: '자리 2 / 4' }] },
        {
          id: 'cells',
          columns: 4,
          cells: cells(
            [
              { text: '🪨 돌', detail: '×3', selected: true },
              { text: '⛏ 철 곡괭이', detail: '×1' },
            ],
            4,
          ),
        },
        {
          id: 'detail',
          title: '고른 것 — 돌',
          rows: [
            { id: 'use', text: '쓰기', state: 'available', hint: '1' },
            { id: 'discard', text: '덜어내기', state: 'available', hint: 'B → 1' },
            { id: 'equip', text: '걸기 — 걸 수 있는 물건이 아니다', state: 'blocked' },
            { id: 'exchange', text: '바꿔 걸기 — 걸 수 있는 물건이 아니다', state: 'blocked' },
          ],
        },
      ],
      footer: ['닫기 Esc', '고르기 ← →', '실행 Enter'],
    },
  },
  {
    name: 'VUX-IE-FX-FULL',
    note: '가득 찼는데 같은 화면에서 어떤 손은 막히고 어떤 손은 열려 있다 — C024 의 비대칭',
    surface: {
      id: 'bag',
      open: true,
      title: '가진 것',
      focusId: 'cell.3',
      sections: [
        { id: 'room', rows: [{ id: 'room', text: '자리 4 / 4 · 가득' }] },
        {
          id: 'cells',
          columns: 4,
          cells: cells(
            [
              { text: '🪨 돌', detail: '×3' },
              { text: '⛏ 철 곡괭이', detail: '×1' },
              { text: '🛡 나무 방패', detail: '×1' },
              { text: '🧪 약초', detail: '×2', selected: true },
            ],
            4,
          ),
        },
        {
          id: 'detail',
          title: '고른 것 — 나무 방패',
          rows: [
            { id: 'equip', text: '걸기 — 빈 자리가 없다', state: 'blocked' },
            { id: 'exchange', text: '바꿔 걸기', state: 'available', hint: ', → 3 → 걸린 번호' },
            { id: 'unequip', text: '풀기 — 가방에 빈자리가 없다', state: 'blocked' },
          ],
        },
      ],
      footer: ['닫기 Esc', '고르기 ← →', '실행 Enter'],
    },
  },
  {
    name: 'VUX-IE-FX-STALE',
    note: '보냈고 아직 대답이 없다 — 그동안 수량도 자리도 값도 바뀌지 않는다',
    surface: {
      id: 'bag',
      open: true,
      title: '가진 것',
      focusId: 'cell.0',
      sections: [
        { id: 'room', rows: [{ id: 'room', text: '자리 2 / 4' }] },
        {
          id: 'cells',
          columns: 4,
          cells: cells(
            [
              { text: '🪨 돌', detail: '×3', selected: true },
              { text: '⛏ 철 곡괭이', detail: '×1' },
            ],
            4,
          ),
        },
        {
          id: 'detail',
          title: '고른 것 — 돌',
          rows: [
            { id: 'use', text: '쓰기 — 보냈다', state: 'pending' },
            { id: 'discard', text: '덜어내기', state: 'available', hint: 'B → 1' },
            { id: 'last', text: '지난 요청: 상태가 바뀌어 실행하지 못했다 (not-enough)', state: 'blocked' },
          ],
        },
      ],
      footer: ['닫기 Esc', '대답을 기다리는 동안 같은 요청을 다시 보내지 않는다'],
    },
  },
  {
    name: 'VUX-IE-FX-UNKNOWN',
    note: '표에 없는 종류·분류·역할·사유 — 코드 그대로 보이고 화면이 멈추지 않는다',
    surface: {
      id: 'bag',
      open: true,
      title: '가진 것',
      focusId: 'cell.0',
      sections: [
        { id: 'room', rows: [{ id: 'room', text: '자리 1 / 4' }] },
        {
          id: 'cells',
          columns: 4,
          cells: cells([{ text: 'moonshard', detail: '×1', selected: true }], 4),
        },
        {
          id: 'detail',
          title: '고른 것 — moonshard',
          rows: [
            { id: 'x', text: 'attune-item', state: 'available', hint: '?' },
            { id: 'y', text: 'discard-item — moon-is-not-yours', state: 'blocked' },
          ],
        },
      ],
      footer: ['닫기 Esc'],
    },
  },
];

/** 진짜 화면이 쓰는 CSS 를 그대로 가져온다 — 랩이 자기 모양을 따로 갖지 않게 */
function realCss(): string {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const style = /<style>([\s\S]*?)<\/style>/.exec(html);
  if (!style) throw new Error('index.html 에서 <style> 을 찾지 못했다');
  return style[1]!;
}

const page =
  `<!doctype html><html lang="ko"><head><meta charset="utf-8">` +
  `<title>Surface Lab — 겹침 표면 capability</title><style>${realCss()}\n` +
  // 랩 전용 — 표면들을 겹치지 않고 나란히 늘어놓기 위한 것뿐이다
  `body { margin: 0; padding: 24px; background: #070910; font-family: system-ui, sans-serif; }
   h1 { color: #eaf0ff; font-size: 16px; margin: 0 0 4px; }
   .lab-lead { color: #7f8aa0; font-size: 12px; margin: 0 0 24px; max-width: 760px; line-height: 1.6; }
   .lab-case { margin-bottom: 28px; }
   .lab-name { color: #9dcaff; font-size: 12px; font-weight: 700; font-family: ui-monospace, monospace; }
   .lab-note { color: #7f8aa0; font-size: 11.5px; margin: 2px 0 8px; }
   /* 랩에서는 표면을 겹쳐 띄우지 않고 제자리에 편다 */
   .lab-case .sf { position: static; transform: none; display: block; width: 100%; max-width: 680px; max-height: none; }
  </style></head><body>` +
  `<h1>Surface Lab — 겹침 표면 capability</h1>` +
  `<p class="lab-lead">engine/view-kernel/hud/surface.ts 의 <code>surfaceMarkup</code> 이 낸 글자를 ` +
  `실제 화면의 CSS 그대로 그린 것이다. <b>어떤 글자가 어느 칸에 들어가는지는 여기서 정하지 않는다</b> — ` +
  `그것은 팩의 결정 Layer 가 하는 일이며 아직 서지 않았다 (C026 Stage 7). ` +
  `이 장면들이 보이는 것은 능력 쪽 성질이다: 빈 칸이 그려지는가 · 안 되는 줄이 사라지지 않는가 · ` +
  `초점과 고른 것이 다른 자리에 표시되는가 · 모르는 코드가 와도 멈추지 않는가.</p>` +
  SCENES.map(
    (scene) =>
      `<div class="lab-case"><div class="lab-name">${scene.name}</div>` +
      `<div class="lab-note">${scene.note}</div>` +
      `<section class="sf sf-open">${surfaceMarkup(scene.surface)}</section></div>`,
  ).join('') +
  `</body></html>`;

const outDir = join(ROOT, 'tools', 'surface-lab', 'out');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'lab.html');
writeFileSync(outPath, page, 'utf8');
console.log(`surface lab → ${outPath}  (${SCENES.length} 장면)`);
