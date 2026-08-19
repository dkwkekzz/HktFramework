// Atlas Emitter — 분석 결과를 런타임이 읽을 TypeScript 모듈로 내보낸다.
//
// JSON 이 아니라 .ts 로 내보내는 이유: tsc --noEmit 과 vitest 가 별도 설정 없이 그대로 읽고,
// 타입이 붙어 오타가 컴파일 단계에서 잡힌다.

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { MotionAtlas } from '../../engine/view-kernel/motion/motion-geometry';

const HEADER = `// 이 파일은 생성물이다 — 직접 고치지 마라.
//
//   생성   tools/motion-atlas (npm run motions:scan · scan-motions.bat/sh)
//   원본   motions/**/*.png
//
// 개발 서버와 빌드가 시작할 때 motions/ 가 바뀌었으면 자동으로 다시 만든다.
// 값의 의미는 view/motion/motion-geometry.ts 를 보라.
`;

export function renderAtlasModule(atlas: MotionAtlas, inputHash: string): string {
  const entries = Object.keys(atlas)
    .sort()
    .map((key) => {
      const g = atlas[key]!;
      const frames = g.frames
        .map(
          (f) =>
            `      { rect: [${f.rect.join(', ')}], content: [${f.content.join(
              ', ',
            )}], anchor: [${f.anchor.map((v) => round(v)).join(', ')}] },`,
        )
        .join('\n');
      const warnings = g.warnings.map((w) => `      ${JSON.stringify(w)},`).join('\n');
      return [
        `  ${JSON.stringify(key)}: {`,
        `    sheet: [${g.sheet.join(', ')}],`,
        `    cols: ${g.cols},`,
        `    rows: ${g.rows},`,
        `    refHeightPx: ${g.refHeightPx},`,
        `    frames: [`,
        frames,
        `    ],`,
        g.warnings.length > 0 ? `    warnings: [\n${warnings}\n    ],` : `    warnings: [],`,
        `  },`,
      ].join('\n');
    })
    .join('\n');

  return `${HEADER}
import type { MotionAtlas } from '../../../engine/view-kernel/motion/motion-geometry';

/** 분석에 쓰인 motions/ 내용 지문 — 값이 다르면 다시 만들어야 한다 */
export const MOTION_ATLAS_INPUT_HASH = ${JSON.stringify(inputHash)};

export const MOTION_ATLAS: MotionAtlas = {
${entries}
};
`;
}

function round(value: number): number {
  return Math.round(value * 100000) / 100000;
}

/** 내용이 같으면 쓰지 않는다 — 개발 서버 재시작마다 파일 시각이 바뀌는 것을 막는다 */
export function writeIfChanged(path: string, content: string): boolean {
  try {
    if (readFileSync(path, 'utf8') === content) return false;
  } catch {
    // 아직 없다 — 새로 만든다
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
  return true;
}
