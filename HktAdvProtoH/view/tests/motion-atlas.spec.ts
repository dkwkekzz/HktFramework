// Motion Atlas 회귀 고정 — 지금 motions/ 에 들어 있는 실제 시트를 대상으로 한다.
//
// 왜 이 테스트가 있는가: 예전에는 시트를 `크기 ÷ 격자` 로 균등 분할했는데, 시트마다
// 바깥 여백과 칸 간격이 달라서 절단선이 그림을 관통하고 있었다 (attack 은 절단선 4개가
// 전부 25~43px 씩 잘라먹었다). 그 상태로 되돌아가지 않도록 "관통 0px" 를 고정한다.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAtlas } from '../../tools/motion-atlas/build-atlas';
import { detectSheet } from '../../tools/motion-atlas/detect-frames';
import { renderAtlasModule } from '../../tools/motion-atlas/emit';
import { readPngAlpha } from '../../tools/motion-atlas/png-alpha';
import { ATLAS_MODULE_PATH, projectRoot } from '../../tools/motion-atlas/scan';
import { MOTION_ATLAS } from '../motion/motion-atlas.generated';
import { frameUv, frameWorldSize, uniformGeometry } from '../motion/motion-geometry';

const ROOT = projectRoot();

function detect(path: string, cols: number, rows: number) {
  return detectSheet(readPngAlpha(readFileSync(join(ROOT, path))), cols, rows);
}

describe('실제 시트 — 절단선이 그림을 관통하지 않는다', () => {
  // move 는 예전에 1·2행이 맞닿아 있어 최소값(18px)에서 자를 수밖에 없었다.
  // 행 사이에 빈 줄이 있는 시트로 갈아 끼워 지금은 넷 다 관통 0px 이다.
  const clean = [
    'motions/rabbit-swordsman/idle.3x3.9f.8fps.png',
    'motions/rabbit-swordsman/move.3x3.9f.8fps.png',
    'motions/rabbit-swordsman/attack.3x3.9f.12fps.png',
    'motions/rabbit-swordsman/hit.3x3.9f.12fps.png',
  ];

  for (const path of clean) {
    it(`${path.split('/').pop()} — 관통 0px`, () => {
      expect(detect(path, 3, 3).bleed).toEqual([]);
    });
  }

  it('모든 시트가 빈 줄로 잘린다 — valley 로 물러선 시트가 없다', () => {
    for (const path of clean) {
      const { method } = detect(path, 3, 3);
      expect([method.x, method.y], path).toEqual(['gutter', 'gutter']);
    }
  });

  it('균등 분할이었다면 관통했을 자리를 실제로 피해 간다', () => {
    // attack 은 균등 분할 절단선(418, 836)이 넷 다 그림을 관통했다.
    const detected = detect('motions/rabbit-swordsman/attack.3x3.9f.12fps.png', 3, 3);
    const xs = detected.frames.map((f) => f.rect.x);
    const ys = detected.frames.map((f) => f.rect.y);

    expect(xs).not.toContain(418);
    expect(ys).not.toContain(418);
    // 칸 크기가 서로 다르다 — 하나의 repeat 값으로는 표현할 수 없다는 증거
    expect(new Set(detected.frames.map((f) => f.rect.w)).size).toBeGreaterThan(1);
    expect(new Set(detected.frames.map((f) => f.rect.h)).size).toBeGreaterThan(1);
  });
});

describe('생성물이 motions/ 와 일치한다', () => {
  it('motion-atlas.generated.ts 가 최신이다 (아니면 npm run motions:scan)', () => {
    const { atlas, inputHash } = buildAtlas(ROOT);
    const expected = renderAtlasModule(atlas, inputHash);
    expect(readFileSync(join(ROOT, ATLAS_MODULE_PATH), 'utf8')).toBe(expected);
  });

  it('주입된 시트마다 기하가 하나씩 있다', () => {
    const { atlas, reports } = buildAtlas(ROOT);
    expect(Object.keys(atlas)).toHaveLength(reports.filter((r) => !r.skipped).length);
    expect(Object.keys(atlas).length).toBeGreaterThan(0);
  });
});

describe('정규화 — 모션 단위로 맞추고 프레임 단위 표현은 남긴다', () => {
  const motions = Object.entries(MOTION_ATLAS);

  it('한 모션 안에서 픽셀 배율이 일정하다 — 웅크림·도약이 살아 있다', () => {
    for (const [key, geometry] of motions) {
      const scales = geometry.frames.map(
        (f, i) => frameWorldSize(geometry, i, 3.4).height / f.rect[3],
      );
      const first = scales[0]!;
      for (const s of scales) expect(s, key).toBeCloseTo(first, 10);
    }
  });

  it('한 모션 안에서 발 기준점이 셀 바닥에서 같은 픽셀 거리다 — 위아래로 떨지 않는다', () => {
    for (const [key, geometry] of motions) {
      const feet = geometry.frames.map((f) => f.anchor[1] * f.rect[3]);
      const first = feet[0]!;
      for (const foot of feet) expect(foot, key).toBeCloseTo(first, 6);
    }
  });

  it('대표 높이는 그 모션에서 가장 큰 그림의 높이다 — 캐릭터가 크기 기준을 넘지 않는다', () => {
    for (const [key, geometry] of motions) {
      const tallest = Math.max(...geometry.frames.map((f) => f.content[3]));
      expect(geometry.refHeightPx, key).toBe(tallest);
    }
  });

  it('시트가 달라도 캐릭터의 화면 높이가 같아진다 — 행동이 바뀔 때 크기가 튀지 않는다', () => {
    const size = 3.4;
    for (const [key, geometry] of motions) {
      // 가장 큰 포즈의 그림 높이 = size
      const tallest = geometry.frames.reduce((a, b) => (a.content[3] >= b.content[3] ? a : b));
      const index = geometry.frames.indexOf(tallest);
      const quad = frameWorldSize(geometry, index, size);
      const drawn = (quad.height * tallest.content[3]) / tallest.rect[3];
      expect(drawn, key).toBeCloseTo(size, 6);
    }
  });
});

describe('frameUv — UV 변환', () => {
  it('시트는 위에서 아래로, UV 는 아래에서 위로 읽는다', () => {
    const geometry = uniformGeometry(300, 300, 3, 3);

    const first = frameUv(geometry, 0); // 왼쪽 위
    expect(first.offsetX).toBeCloseTo(0, 10);
    expect(first.offsetY).toBeCloseTo(2 / 3, 10);

    const last = frameUv(geometry, 8); // 오른쪽 아래
    expect(last.offsetX).toBeCloseTo(2 / 3, 10);
    expect(last.offsetY).toBeCloseTo(0, 10);
  });

  it('inset 은 프레임을 안쪽으로 좁힌다 — 선형 보간이 이웃을 집지 않게', () => {
    const geometry = uniformGeometry(300, 300, 3, 3);
    const plain = frameUv(geometry, 4);
    const inset = frameUv(geometry, 4, 0.5);

    expect(inset.offsetX).toBeGreaterThan(plain.offsetX);
    expect(inset.repeatX).toBeLessThan(plain.repeatX);
    expect(inset.offsetX + inset.repeatX).toBeLessThan(plain.offsetX + plain.repeatX);
  });

  it('실제 프레임 사각형이 시트 안에 들어 있다', () => {
    for (const [key, geometry] of Object.entries(MOTION_ATLAS)) {
      const [sheetW, sheetH] = geometry.sheet;
      for (let i = 0; i < geometry.frames.length; i++) {
        const uv = frameUv(geometry, i);
        expect(uv.offsetX, key).toBeGreaterThanOrEqual(0);
        expect(uv.offsetY, key).toBeGreaterThanOrEqual(0);
        expect(uv.offsetX + uv.repeatX, key).toBeLessThanOrEqual(1 + 1e-9);
        expect(uv.offsetY + uv.repeatY, key).toBeLessThanOrEqual(1 + 1e-9);
      }
      expect(sheetW * sheetH, key).toBeGreaterThan(0);
    }
  });
});
