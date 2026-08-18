// 이 파일은 생성물이다 — 직접 고치지 마라.
//
//   생성   tools/motion-atlas (npm run motions:scan · scan-motions.bat/sh)
//   원본   motions/**/*.png
//
// 개발 서버와 빌드가 시작할 때 motions/ 가 바뀌었으면 자동으로 다시 만든다.
// 값의 의미는 view/motion/motion-geometry.ts 를 보라.

import type { MotionAtlas } from '../../../engine/view-kernel/motion/motion-geometry';

/** 분석에 쓰인 motions/ 내용 지문 — 값이 다르면 다시 만들어야 한다 */
export const MOTION_ATLAS_INPUT_HASH = "e3b0c44298fc1c14";

export const MOTION_ATLAS: MotionAtlas = {

};
