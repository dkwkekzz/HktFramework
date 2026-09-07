// 장면의 분위기 — **무슨 값이 걸리는가**와 **언제 다시 걸어야 하는가**만 검사한다
// (하늘과 빛을 실제로 칠하는 것은 화면이 있어야 한다).
//
// 이 층은 그 값을 무엇이 정했는지 모른다. 지시가 없으면 기본값이고, 값이 그대로면
// 아무것도 건드리지 않는다.

import { describe, expect, it } from 'vitest';
import { DEFAULT_AMBIENCE, sameAmbience, sceneAmbience } from '../renderer/renderer';
import type { SceneAmbience } from '../scene/scene-state';

const DUSK: SceneAmbience = {
  background: 0x1a1c2c,
  ambient: { color: 0x8090c0, intensity: 0.3 },
  sun: { color: 0x6070a0, intensity: 0.2 },
};

describe('장면의 분위기 — 무슨 값이 걸리는가', () => {
  it('지시가 없으면 기본값 그대로다 — 분위기를 모르는 장면도 그려진다', () => {
    expect(sceneAmbience(undefined)).toBe(DEFAULT_AMBIENCE);
  });

  it('지시가 있으면 그 값이 걸린다', () => {
    expect(sceneAmbience(DUSK)).toEqual(DUSK);
  });

  it('기본값은 지금까지 그려 온 하늘과 빛이다', () => {
    expect(DEFAULT_AMBIENCE).toEqual({
      background: 0x9fc4e0,
      ambient: { color: 0xffffff, intensity: 0.95 },
      sun: { color: 0xfff4d6, intensity: 1.1 },
    });
  });
});

describe('장면의 분위기 — 언제 다시 거는가', () => {
  it('값이 같으면 같은 것이다 — 다른 객체로 와도 다시 걸지 않는다', () => {
    expect(sameAmbience(DUSK, { ...DUSK, ambient: { ...DUSK.ambient } })).toBe(true);
  });

  it('세기 하나만 달라도 다시 걸어야 한다', () => {
    expect(sameAmbience(DUSK, { ...DUSK, sun: { ...DUSK.sun, intensity: 0.21 } })).toBe(false);
  });

  it('하늘 색이 달라도, 주변광 색이 달라도 다시 걸어야 한다', () => {
    expect(sameAmbience(DUSK, { ...DUSK, background: 0x000000 })).toBe(false);
    expect(sameAmbience(DUSK, { ...DUSK, ambient: { ...DUSK.ambient, color: 0x000000 } })).toBe(
      false,
    );
  });

  it('지시가 사라지면 기본값과 견주게 된다 — 되돌림도 한 번의 갈아 끼움이다', () => {
    expect(sameAmbience(DUSK, sceneAmbience(undefined))).toBe(false);
    expect(sameAmbience(DEFAULT_AMBIENCE, sceneAmbience(undefined))).toBe(true);
  });
});
