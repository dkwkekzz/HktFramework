// Motion Data Injection Format v1 (C002)
//
//   motions/<characterKind>/<action>[.<옵션>…].png
//
// 폴더 이름이 캐릭터 종류, 파일명 첫 토큰이 행동이다.
// 옵션 토큰은 `.` 으로 구분하며 순서는 상관없다.
//
//   3x3 | cols3 | rows3     시트 격자 (기본 1x1 — 단일 프레임)
//   9f  | frames9           실제 프레임 수 (기본 cols × rows)
//   8fps | fps8             초당 프레임 (기본 8) — 진행도가 없는 행동의 반복 재생 속도
//
// 예)  motions/rabbit-swordsman/idle.3x3.png
//      motions/rabbit-swordsman/attack.4x1.12fps.png
//      motions/slime/idle.cols3rows3frames9.png
//
// 이 파일은 순수 파서다 — 파일 시스템도 번들러도 모른다.

export interface MotionAsset {
  id: string; // 진단용 식별자 (예: rabbit-swordsman/idle)
  characterKind: string;
  action: string;
  url: string;
  cols: number;
  rows: number;
  frames: number;
  fps: number;
}

export const DEFAULT_FPS = 8;
export const ROOT_DIR = 'motions';

const TOKEN_PATTERNS: Array<[RegExp, (m: RegExpMatchArray, o: Options) => void]> = [
  [/(\d+)x(\d+)/, (m, o) => { o.cols = Number(m[1]); o.rows = Number(m[2]); }],
  [/cols(\d+)/, (m, o) => { o.cols = Number(m[1]); }],
  [/rows(\d+)/, (m, o) => { o.rows = Number(m[1]); }],
  [/frames(\d+)/, (m, o) => { o.frames = Number(m[1]); }],
  [/fps(\d+)/, (m, o) => { o.fps = Number(m[1]); }],
  [/(\d+)fps/, (m, o) => { o.fps = Number(m[1]); }],
  [/(\d+)f(?![a-z0-9])/, (m, o) => { o.frames = Number(m[1]); }],
];

interface Options {
  cols?: number;
  rows?: number;
  frames?: number;
  fps?: number;
}

// 토큰을 읽어내고, 읽어낸 부분을 제거한 나머지를 돌려준다.
function readTokens(text: string, options: Options): string {
  let rest = text;
  for (const [pattern, apply] of TOKEN_PATTERNS) {
    const match = rest.match(pattern);
    if (!match) continue;
    apply(match, options);
    rest = rest.replace(pattern, '');
  }
  return rest;
}

/**
 * 파일 경로 하나를 MotionAsset 으로 해석한다.
 * 포맷에 맞지 않으면 null — 잘못 놓인 파일이 게임을 멈추지 않는다.
 */
export function parseMotionPath(path: string, url: string): MotionAsset | null {
  // motions/<종류>/<파일> 구조여야 한다 — 루트에 흘린 파일이나 더 깊은 폴더는 무시한다.
  const segments = path.split('/').filter(Boolean);
  const root = segments.lastIndexOf(ROOT_DIR);
  if (root < 0 || segments.length !== root + 3) return null;

  const characterKind = segments[root + 1] ?? '';
  const file = segments[root + 2] ?? '';
  if (!characterKind || !file) return null;
  if (!/\.(png|webp)$/i.test(file)) return null;

  const parts = file.replace(/\.(png|webp)$/i, '').split('.');
  const options: Options = {};
  const head = parts.shift() ?? '';
  for (const part of parts) readTokens(part, options);
  const action = readTokens(head, options).replace(/[-_]+$/, '').trim();
  if (!action) return null;

  const cols = options.cols ?? 1;
  const rows = options.rows ?? 1;
  if (cols < 1 || rows < 1) return null;
  const frames = Math.min(options.frames ?? cols * rows, cols * rows);
  if (frames < 1) return null;

  return {
    id: `${characterKind}/${action}`,
    characterKind,
    action,
    url,
    cols,
    rows,
    frames,
    fps: options.fps && options.fps > 0 ? options.fps : DEFAULT_FPS,
  };
}
