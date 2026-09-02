// Motion Source — 이 세계의 motions/ 폴더를 자동 발견한다.
//
// 등록 코드는 없다. 정해진 위치에 정해진 이름으로 파일을 놓으면 빌드/개발 서버가
// 그것을 그대로 집어 온다. 파일을 지우면 그 모션은 사라지고 fallback 으로 관찰된다.
// 재생·색인 기계장치는 engine/view-kernel/motion 이 소유하고, 어떤 그림이 있는지
// (폴더·아틀라스)는 팩인 이 파일이 소유한다.
//
// 포맷은 engine/view-kernel/motion/motion-format.ts, 폴더 규약은 motions/README.md 를 보라.

import {
  createMotionLibrary,
  type MotionLibrary,
} from '../../engine/view-kernel/motion/motion-library';
import { MOTION_ATLAS } from './motion-atlas.generated';

// Vite glob — 경로는 프로젝트 루트(HktAdvProtoI/) 기준이며 리터럴이어야 한다.
// 팩이 자기 폴더를 이름으로 안다 — 엔진은 어느 팩의 그림인지 모른다.
const sources = import.meta.glob('/content/motions/**/*.{png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const motionLibrary: MotionLibrary = createMotionLibrary(sources, MOTION_ATLAS);
