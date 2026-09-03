// 키가 지금 뜻하는 interaction 고르기 — 게임 명사 없이 자리만으로 판정한다.

import { describe, expect, it } from 'vitest';
import {
  chooseByKey,
  choosePrompt,
  selfPosition,
  targetDistance,
} from '../scene/interaction-choice';
import type { SceneEntity, SceneInteraction, SceneState } from '../scene/scene-state';

const entity = (id: string, x: number, z: number, cameraFollow = false): SceneEntity => ({
  id,
  spriteId: `${id}:idle`,
  size: 1,
  position: { x, z },
  cameraFollow,
  trail: false,
});

const scene = (
  entities: SceneEntity[],
  interactions: SceneInteraction[],
): SceneState =>
  ({
    specId: 'TEST',
    terrain: 'ROOM',
    entities,
    interactions,
    hud: [],
    strikes: [],
    effects: [],
    worldTime: 0,
    commandSurface: { entries: [], history: [], open: false, text: '', guide: [] },
    surfaces: [],
    slotBars: [],
    zones: [],
  }) as unknown as SceneState;

// 몸은 원점, 대상 셋이 가까운 순서와 다른 순서로 실려 온다
const BODY = entity('me', 0, 0, true);
const near = entity('near', 1, 0);
const mid = entity('mid', 6, 0);
const far = entity('far', 18, 0);

const act = (
  id: string,
  extra: Partial<SceneInteraction> = {},
): SceneInteraction => ({ id, available: false, ...extra }) as SceneInteraction;

describe('selfPosition · targetDistance', () => {
  it('자기 몸은 카메라가 따르는 것이다', () => {
    expect(selfPosition(scene([near, BODY], []))).toEqual({ x: 0, z: 0 });
  });

  it('대상이 없는 것은 잴 수 없다 — 무한대로 뒤에 선다', () => {
    const s = scene([BODY], []);
    expect(targetDistance(s, act('skill', { key: 'KeyF' }))).toBe(Number.POSITIVE_INFINITY);
  });

  it('없는 대상을 가리키면 잴 수 없다 (사라진 대상)', () => {
    const s = scene([BODY], []);
    expect(targetDistance(s, act('a', { targetEntityId: 'gone' }))).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it('대상까지의 평면 거리를 잰다', () => {
    const s = scene([BODY, entity('t', 3, 4)], []);
    expect(targetDistance(s, act('a', { targetEntityId: 't' }))).toBe(5);
  });
});

describe('chooseByKey — 같은 키에 여럿이 걸릴 때', () => {
  it('가용한 것이 먼저다 — 가까워도 불가면 지지 않는다', () => {
    const s = scene(
      [BODY, near, far],
      [
        act('go', { key: 'KeyQ', targetEntityId: 'near' }),
        act('go', { key: 'KeyQ', targetEntityId: 'far', available: true }),
      ],
    );
    expect(chooseByKey(s, 'KeyQ')?.targetEntityId).toBe('far');
  });

  it('전부 불가면 몸에 가장 가까운 것 — 목록 맨 앞이 아니다', () => {
    const s = scene(
      [BODY, near, mid, far],
      [
        act('go', { key: 'KeyQ', targetEntityId: 'far' }),
        act('go', { key: 'KeyQ', targetEntityId: 'mid' }),
        act('go', { key: 'KeyQ', targetEntityId: 'near' }),
      ],
    );
    expect(chooseByKey(s, 'KeyQ')?.targetEntityId).toBe('near');
  });

  it('전부 가용이면 그 중 가장 가까운 것', () => {
    const s = scene(
      [BODY, near, far],
      [
        act('go', { key: 'KeyQ', targetEntityId: 'far', available: true }),
        act('go', { key: 'KeyQ', targetEntityId: 'near', available: true }),
      ],
    );
    expect(chooseByKey(s, 'KeyQ')?.targetEntityId).toBe('near');
  });

  it('같은 거리면 실려 온 순서 그대로 (결정론)', () => {
    const s = scene(
      [BODY, entity('a', 5, 0), entity('b', 0, 5)],
      [
        act('go', { key: 'KeyQ', targetEntityId: 'a' }),
        act('go', { key: 'KeyQ', targetEntityId: 'b' }),
      ],
    );
    expect(chooseByKey(s, 'KeyQ')?.targetEntityId).toBe('a');
  });

  it('그 키에 아무것도 없으면 없다', () => {
    expect(chooseByKey(scene([BODY], [act('x', { key: 'KeyE' })]), 'KeyQ')).toBeUndefined();
  });
});

describe('choosePrompt — 자리의 일이 재주보다 먼저다', () => {
  const skill = act('skill', { key: 'KeyF', available: true, prompt: '기본 스킬' });

  it('대상이 있는 가용한 것이 늘 가용인 재주를 이긴다', () => {
    const s = scene(
      [BODY, near],
      [skill, act('go', { key: 'KeyQ', targetEntityId: 'near', available: true })],
    );
    expect(choosePrompt(s)?.id).toBe('go');
  });

  it('대상이 있는 가용한 것이 여럿이면 가까운 것', () => {
    const s = scene(
      [BODY, near, far],
      [
        act('go', { key: 'KeyQ', targetEntityId: 'far', available: true }),
        act('go', { key: 'KeyQ', targetEntityId: 'near', available: true }),
      ],
    );
    expect(choosePrompt(s)?.targetEntityId).toBe('near');
  });

  it('자리의 일이 하나도 가용하지 않으면 재주가 선다 — 불가 문구가 화면을 붙잡지 않는다', () => {
    const s = scene(
      [BODY, near],
      [skill, act('go', { key: 'KeyQ', targetEntityId: 'near', unavailableText: '잠겨 있다' })],
    );
    expect(choosePrompt(s)?.id).toBe('skill');
  });

  it('가용한 것이 아무것도 없으면 가까운 대상의 불가 문구', () => {
    const s = scene(
      [BODY, near, far],
      [
        act('go', { key: 'KeyQ', targetEntityId: 'far', unavailableText: '너무 멀다' }),
        act('go', { key: 'KeyQ', targetEntityId: 'near', unavailableText: '잠겨 있다' }),
      ],
    );
    expect(choosePrompt(s)?.unavailableText).toBe('잠겨 있다');
  });

  it('대상 있는 것이 아무 말도 없으면 재주의 불가 문구', () => {
    const s = scene(
      [BODY, near],
      [
        act('skill', { key: 'KeyF', unavailableText: '기운이 모자라다' }),
        act('go', { key: 'KeyQ', targetEntityId: 'near' }),
      ],
    );
    expect(choosePrompt(s)?.unavailableText).toBe('기운이 모자라다');
  });

  it('키 지시가 없는 것은 프롬프트에 서지 않는다', () => {
    const s = scene([BODY], [act('move', { available: true, terrainTarget: true })]);
    expect(choosePrompt(s)).toBeUndefined();
  });
});
