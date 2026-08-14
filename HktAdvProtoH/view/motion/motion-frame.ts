// Motion Frame 선택 — Render Plan 의 모션 지시에서 지금 그릴 프레임을 고른다 (C002).
// 04-gameview.spec.yaml 의 motion.progress 계약:
//   withDuration     진행도(0..1)에 맞추어 1회 재생
//   withoutDuration  fps 로 반복 재생
// 순수 함수 — 시간과 지시만 받는다.

import type { SceneMotion } from '../scene/scene-state';
import { frameUv, uniformGeometry } from './motion-geometry';

export function motionFrameIndex(motion: SceneMotion, timeSeconds: number): number {
  const count = Math.max(1, motion.frames);

  if (motion.mode === 'progress') {
    const p = Math.min(1, Math.max(0, motion.progress ?? 0));
    return Math.min(count - 1, Math.floor(p * count));
  }

  const fps = motion.fps > 0 ? motion.fps : 1;
  const index = Math.floor(timeSeconds * fps) % count;
  return index < 0 ? index + count : index;
}

// 시트 안에서 프레임이 차지하는 UV 영역 (좌하단 원점).
//
// 정적 분석이 실제 프레임 사각형을 실어 보냈으면 그것을 쓴다. 없으면 예전처럼
// 격자로 균등 분할한다 — 시트마다 여백과 칸 간격이 달라서 균등 분할은 그림을 관통한다
// (실측 근거는 tools/motion-atlas/detect-frames.ts 의 주석).
export function motionFrameUv(
  motion: SceneMotion,
  frame: number,
): { offsetX: number; offsetY: number; repeatX: number; repeatY: number } {
  const geometry =
    motion.geometry ?? uniformGeometry(motion.cols, motion.rows, motion.cols, motion.rows);
  return frameUv(geometry, frame);
}
