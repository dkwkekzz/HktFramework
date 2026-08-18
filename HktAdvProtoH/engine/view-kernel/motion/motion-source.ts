// Motion Source — motions/ 폴더를 자동 발견한다 (C002).
//
// 등록 코드는 없다. 정해진 위치에 정해진 이름으로 파일을 놓으면 빌드/개발 서버가
// 그것을 그대로 집어 온다. 파일을 지우면 그 모션은 사라지고 fallback 으로 관찰된다.
//
// 포맷은 view/motion/motion-format.ts, 폴더 규약은 motions/README.md 를 보라.

import { createMotionLibrary, type MotionLibrary } from './motion-library';

// Vite glob — 경로는 프로젝트 루트(HktAdvProtoH/) 기준이며 리터럴이어야 한다.
const sources = import.meta.glob('/motions/**/*.{png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const motionLibrary: MotionLibrary = createMotionLibrary(sources);
