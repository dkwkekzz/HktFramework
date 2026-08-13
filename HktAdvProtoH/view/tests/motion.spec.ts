// Motion Data Injection 단독 테스트 — World 미기동, 파일 경로 문자열만으로 검증한다.
// 04-gameview.spec.yaml 의 motion 계약(selectedBy · progress · fallback)이 대상이다.

import { describe, expect, it } from 'vitest';
import { parseMotionPath } from '../motion/motion-format';
import { createMotionLibrary } from '../motion/motion-library';
import { motionFrameIndex, motionFrameUv } from '../motion/motion-frame';
import { motionLibrary } from '../motion/motion-source';
import type { SceneMotion } from '../scene/scene-state';

describe('parseMotionPath — 데이터 주입 포맷 v1', () => {
  it('폴더 = 캐릭터 종류, 파일 첫 토큰 = 행동', () => {
    const asset = parseMotionPath('/motions/rabbit-swordsman/idle.3x3.9f.8fps.png', '/a.png');

    expect(asset).toMatchObject({
      characterKind: 'rabbit-swordsman',
      action: 'idle',
      cols: 3,
      rows: 3,
      frames: 9,
      fps: 8,
    });
  });

  it('옵션이 없으면 단일 프레임 · 기본 fps', () => {
    const asset = parseMotionPath('/motions/slime/move.png', '/b.png');
    expect(asset).toMatchObject({ action: 'move', cols: 1, rows: 1, frames: 1, fps: 8 });
  });

  it('토큰 순서는 상관없고 대체 표기(cols/rows/frames/fps)도 인식한다', () => {
    const a = parseMotionPath('/motions/slime/attack.12fps.4x1.png', '/c.png');
    const b = parseMotionPath('/motions/slime/attack.cols4rows1frames4fps12.png', '/c.png');

    expect(a).toMatchObject({ cols: 4, rows: 1, frames: 4, fps: 12 });
    expect(b).toMatchObject({ cols: 4, rows: 1, frames: 4, fps: 12 });
  });

  it('프레임 수는 격자 칸 수를 넘지 않는다', () => {
    expect(parseMotionPath('/motions/slime/idle.2x2.99f.png', '/d.png')?.frames).toBe(4);
  });

  it('포맷에 맞지 않는 파일은 무시된다 (게임을 멈추지 않는다)', () => {
    expect(parseMotionPath('/motions/notes.txt', '/e.txt')).toBeNull();
    expect(parseMotionPath('/motions/loose.png', '/f.png')).toBeNull(); // 종류 폴더가 없다
  });
});

describe('MotionLibrary — (종류, 행동) 선택과 fallback', () => {
  const library = createMotionLibrary({
    '/motions/rabbit-swordsman/idle.3x3.png': '/rabbit-idle.png',
    '/motions/rabbit-swordsman/attack.4x1.png': '/rabbit-attack.png',
    '/motions/slime/move.2x1.png': '/slime-move.png',
  });

  it('정확히 일치하는 시트를 고른다', () => {
    expect(library.resolve('rabbit-swordsman', 'attack')?.url).toBe('/rabbit-attack.png');
  });

  it('없으면 같은 종류의 idle 로 대체한다', () => {
    expect(library.resolve('rabbit-swordsman', 'mine')?.url).toBe('/rabbit-idle.png');
  });

  it('그것도 없으면 다른 종류의 같은 행동으로 대체한다', () => {
    expect(library.resolve('slime', 'attack')?.url).toBe('/rabbit-attack.png');
  });

  it('아무 데이터도 없으면 null — 절차 생성 그림이 맡는다', () => {
    expect(createMotionLibrary({}).resolve('ghost', 'idle')).toBeNull();
  });
});

describe('motionFrameIndex — 재생 방식', () => {
  const sheet = (mode: 'loop' | 'progress', progress?: number): SceneMotion => ({
    id: 'x/y',
    url: '/x.png',
    cols: 3,
    rows: 3,
    frames: 9,
    fps: 8,
    mode,
    ...(progress === undefined ? {} : { progress }),
  });

  it('소요 시간이 없는 행동은 fps 로 반복한다', () => {
    expect(motionFrameIndex(sheet('loop'), 0)).toBe(0);
    expect(motionFrameIndex(sheet('loop'), 0.5)).toBe(4); // 0.5초 × 8fps
    expect(motionFrameIndex(sheet('loop'), 9 / 8)).toBe(0); // 한 바퀴 → 처음으로
  });

  it('소요 시간이 있는 행동은 진행도 0→1 에 맞춰 1회 재생한다', () => {
    expect(motionFrameIndex(sheet('progress', 0), 123)).toBe(0);
    expect(motionFrameIndex(sheet('progress', 0.5), 123)).toBe(4);
    expect(motionFrameIndex(sheet('progress', 1), 123)).toBe(8); // 마지막 프레임에서 끝난다
    expect(motionFrameIndex(sheet('progress', 2), 123)).toBe(8); // 범위를 넘지 않는다
  });

  it('프레임은 왼쪽 위에서 오른쪽으로, 그다음 아래 줄로 읽는다', () => {
    const uv0 = motionFrameUv(sheet('loop'), 0); // 첫 프레임은 시트 왼쪽 위
    expect(uv0.offsetX).toBeCloseTo(0);
    expect(uv0.offsetY).toBeCloseTo(2 / 3);
    expect(uv0.repeatX).toBeCloseTo(1 / 3);
    expect(uv0.repeatY).toBeCloseTo(1 / 3);

    const uv4 = motionFrameUv(sheet('loop'), 4); // 2행 2열
    expect(uv4.offsetX).toBeCloseTo(1 / 3);
    expect(uv4.offsetY).toBeCloseTo(1 / 3);
  });
});

describe('motions/ 자동 발견', () => {
  it('폴더에 놓인 시트가 등록 코드 없이 색인된다', () => {
    const found = motionLibrary.all();

    expect(found.length).toBeGreaterThan(0);
    const idle = motionLibrary.resolve('rabbit-swordsman', 'idle');
    expect(idle).toMatchObject({ characterKind: 'rabbit-swordsman', action: 'idle', frames: 9 });
    expect(idle?.url).toBeTruthy();
  });
});
