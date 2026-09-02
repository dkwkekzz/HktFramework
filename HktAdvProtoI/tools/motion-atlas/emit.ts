// Atlas Emitter — 분석 결과를 런타임이 읽을 TypeScript 모듈로 내보낸다.
//
// JSON 이 아니라 .ts 로 내보내는 이유: tsc --noEmit 과 vitest 가 별도 설정 없이 그대로 읽고,
// 타입이 붙어 오타가 컴파일 단계에서 잡힌다.

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { MotionAtlas } from '../../engine/view-kernel/motion/motion-geometry';

const HEADER = `// 이 파일은 생성물이다 — 직접 고치지 마라.
//
//   생성   tools/motion-atlas (npm run motions:scan · scripts/scan-motions.bat|sh)
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
import type { MotionAtlas } from '../../engine/view-kernel/motion/motion-geometry';

/** 분석에 쓰인 입력 지문 (motions/ 내용 + 분석기 판) — 값이 다르면 다시 만들어야 한다 */
export const MOTION_ATLAS_INPUT_HASH = ${JSON.stringify(inputHash)};

export const MOTION_ATLAS: MotionAtlas = {
${entries}
};
`;
}

function round(value: number): number {
  return Math.round(value * 100000) / 100000;
}

/**
 * 생성물 비교의 단일 기준 — 줄바꿈과 BOM 은 내용이 아니다.
 *
 * 도구는 항상 LF 로 쓰지만 작업 트리의 파일은 그렇지 않을 수 있다 (Git 의 `core.autocrlf`
 * 가 켜진 Windows 체크아웃은 CRLF 로 받는다). 글자 그대로 비교하면 그 시트가 하나도
 * 바뀌지 않았는데도 "어긋났다" 고 보고, 게임을 켤 때마다 생성물을 다시 쓴다.
 * 그래서 최신 여부는 이 함수로만 판단한다 — writeIfChanged · --check · 테스트가 함께 쓴다.
 */
export function sameGeneratedContent(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

function normalize(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

/** 내용이 같으면 쓰지 않는다 — 개발 서버 재시작마다 파일 시각이 바뀌는 것을 막는다 */
export function writeIfChanged(path: string, content: string): boolean {
  try {
    if (sameGeneratedContent(readFileSync(path, 'utf8'), content)) return false;
  } catch {
    // 아직 없다 — 새로 만든다
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
  return true;
}
