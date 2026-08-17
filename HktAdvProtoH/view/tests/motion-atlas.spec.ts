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
import {
  frameUv,
  frameWorldSize,
  uniformGeometry,
  type MotionFrameGeometry,
} from '../motion/motion-geometry';

const ROOT = projectRoot();

function detect(path: string, cols: number, rows: number) {
  return detectSheet(readPngAlpha(readFileSync(join(ROOT, path))), cols, rows);
}

describe('실제 시트 — 절단선이 그림을 관통하지 않는다', () => {
  const clean = [
    'motions/rabbit-swordsman/idle.3x3.9f.8fps.png',
    'motions/rabbit-swordsman/attack.3x3.9f.12fps.png',
    'motions/rabbit-swordsman/hit.3x3.9f.12fps.png',
    // move 는 한때 1·2행이 맞닿아 valley 로 잘렸으나 재추출되어 빈 줄이 생겼다
    // (커밋 420111a). 지금은 네 시트 모두 gutter 로 깨끗하게 나뉜다.
    'motions/rabbit-swordsman/move.3x3.9f.8fps.png',
  ];

  for (const path of clean) {
    it(`${path.split('/').pop()} — 관통 0px`, () => {
      const detected = detect(path, 3, 3);
      expect(detected.bleed).toEqual([]);
      expect(detected.method).toEqual({ x: 'gutter', y: 'gutter' });
    });
  }

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

  // 기준점의 시트 절대 y — anchor.v 는 사각형 아래에서 위로 재는 값이다
  const groundOf = (f: MotionFrameGeometry) => f.rect[1] + f.rect[3] - 1 - f.anchor[1] * f.rect[3];

  it('세로 기준점이 그림 안에 있다 — 빈 여백에 놓여 몸이 뜨지 않는다', () => {
    // 예전에는 기준점을 검출 사각형 바닥에서 잡았다. 그 바닥은 *빈 줄의 한가운데*라
    // 아래 칸의 그림이 멀수록 아래로 내려간다 — `downed` 는 누운 포즈라 여백이 특히 커서
    // 기준점이 그림보다 157px(대표 높이의 42%) 아래에 놓였고, 그만큼 몸이 땅에서 떴다.
    for (const [key, geometry] of motions) {
      for (let i = 0; i < geometry.frames.length; i++) {
        const f = geometry.frames[i]!;
        const ground = groundOf(f);
        expect(ground, `${key} #${i} 기준점이 그림보다 아래다`).toBeLessThanOrEqual(
          f.content[1] + f.content[3],
        );
        expect(ground, `${key} #${i} 기준점이 그림보다 위다`).toBeGreaterThanOrEqual(f.content[1]);
      }
    }
  });

  it('늘어뜨린 칼끝이 아니라 발을 접지점으로 삼는다', () => {
    // 이 캐릭터는 칼을 아래로 늘어뜨린다. 가장 낮은 잉크를 접지점으로 쓰면 칼이 흔들릴 때마다
    // 몸이 따라 흔들린다. `move` 는 칼끝이 발보다 한참 아래이고, `idle` 은 발이 가장 낮다.
    const lift = (key: string) => {
      const geometry = motions.find(([k]) => k.includes(key))![1];
      return geometry.frames.map(
        (f) => ((f.content[1] + f.content[3] - 1 - groundOf(f)) / geometry.refHeightPx) * 100,
      );
    };

    // 걷기 — 칼끝이 발보다 대표 높이의 8% 넘게 아래로 내려온다. 그것을 지나쳐야 한다.
    for (const v of lift('rabbit-swordsman/move')) expect(v).toBeGreaterThan(8);
    // 대기 — 두 발이 가장 낮다. 지나칠 것이 없으므로 그림 바닥이 그대로 접지선이다.
    // (생성물의 anchor 는 소수 5자리라 되돌리면 0.001% 안팎의 오차가 남는다)
    for (const v of lift('rabbit-swordsman/idle')) expect(v).toBeCloseTo(0, 2);
  });

  it('가로 기준점이 선언 격자 위에 있다 — 검출 사각형 폭에 끌려다니지 않는다', () => {
    // 기준점의 시트 절대 좌표 = rect.x + anchor.x × rect.w.
    // 그것이 "칸 중심 + 모션 하나의 치우침" 이어야 한다. 즉 칸 중심과의 차이가
    // 프레임마다 같은 값이어야 한다 — 사각형 폭이 프레임마다 달라도 마찬가지다.
    for (const [key, geometry] of motions) {
      const cellWidth = geometry.sheet[0] / geometry.cols;
      const bias = geometry.frames.map((f, i) => {
        const pivot = f.rect[0] + f.anchor[0] * f.rect[2];
        return pivot - ((i % geometry.cols) + 0.5) * cellWidth;
      });
      // 생성물의 anchor 는 소수 5자리로 반올림되어 있다 — 사각형 폭(≈450px)을 곱하면
      // 0.005px 안팎의 오차가 남는다. 그보다 큰 차이만 "격자를 벗어났다"로 본다.
      const first = bias[0]!;
      for (const b of bias) expect(Math.abs(b - first), key).toBeLessThan(0.01);
    }
  });

  it('제자리 모션은 몸 중심이 기준점 위에 머문다 — 걸을 때 좌우로 흔들리지 않는다', () => {
    // idle 과 move 는 제자리에서 도는 모션이다. 그림이 좌우로 이동할 이유가 없으므로
    // 그림 중심과 기준점의 어긋남은 곧 흔들림이다. 대표 높이 대비 비율로 잰다.
    //
    // 검출 사각형 중심을 기준점으로 쓰던 때의 실측: idle 1.26% · move 14.55%.
    // 절단선이 *빈 줄의 한가운데*라 이웃 칸의 그림 폭까지 기준점을 밀었기 때문이다.
    const LIMIT = 6; // %
    for (const [key, geometry] of motions) {
      if (!/\/(idle|move)\./.test(key)) continue;

      const drift = geometry.frames.map((f) => {
        const pivot = f.rect[0] + f.anchor[0] * f.rect[2];
        return ((f.content[0] + f.content[2] / 2 - pivot) / geometry.refHeightPx) * 100;
      });
      const swing = Math.max(...drift) - Math.min(...drift);
      expect(swing, `${key} 좌우 진폭 ${swing.toFixed(2)}%`).toBeLessThan(LIMIT);
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
