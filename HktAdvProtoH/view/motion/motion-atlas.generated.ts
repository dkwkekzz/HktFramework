// 이 파일은 생성물이다 — 직접 고치지 마라.
//
//   생성   tools/motion-atlas (npm run motions:scan · scan-motions.bat/sh)
//   원본   motions/**/*.png
//
// 개발 서버와 빌드가 시작할 때 motions/ 가 바뀌었으면 자동으로 다시 만든다.
// 값의 의미는 view/motion/motion-geometry.ts 를 보라.

import type { MotionAtlas } from './motion-geometry';

/** 분석에 쓰인 motions/ 내용 지문 — 값이 다르면 다시 만들어야 한다 */
export const MOTION_ATLAS_INPUT_HASH = "cf2a0d7d57b926b4";

export const MOTION_ATLAS: MotionAtlas = {
  "/motions/rabbit-swordsman/attack.3x3.9f.12fps.png": {
    sheet: [1254, 1254],
    cols: 3,
    rows: 3,
    refHeightPx: 391,
    frames: [
      { rect: [14, 30, 377, 418], content: [14, 30, 367, 391], anchor: [0.42617, 0] },
      { rect: [391, 30, 386, 418], content: [401, 72, 324, 335], anchor: [0.52245, 0] },
      { rect: [777, 30, 447, 418], content: [793, 99, 338, 301], anchor: [0.52274, 0] },
      { rect: [14, 448, 377, 350], content: [111, 475, 257, 299], anchor: [0.42617, 0] },
      { rect: [391, 448, 386, 350], content: [460, 492, 295, 275], anchor: [0.52245, 0] },
      { rect: [777, 448, 447, 350], content: [849, 488, 375, 290], anchor: [0.52274, 0] },
      { rect: [14, 798, 377, 389], content: [19, 841, 303, 329], anchor: [0.42617, 0] },
      { rect: [391, 798, 386, 389], content: [404, 819, 358, 368], anchor: [0.52245, 0] },
      { rect: [777, 798, 447, 389], content: [796, 820, 357, 367], anchor: [0.52274, 0] },
    ],
    warnings: [],
  },
  "/motions/rabbit-swordsman/hit.3x3.9f.12fps.png": {
    sheet: [1285, 1224],
    cols: 3,
    rows: 3,
    refHeightPx: 393,
    frames: [
      { rect: [12, 12, 418, 397], content: [12, 12, 408, 391], anchor: [0.50372, 0] },
      { rect: [430, 12, 430, 397], content: [441, 71, 389, 334], anchor: [0.5137, 0] },
      { rect: [860, 12, 419, 397], content: [871, 12, 408, 391], anchor: [0.5232, 0] },
      { rect: [12, 409, 418, 401], content: [113, 414, 306, 391], anchor: [0.50372, 0] },
      { rect: [430, 409, 430, 401], content: [451, 474, 399, 295], anchor: [0.5137, 0] },
      { rect: [860, 409, 419, 401], content: [871, 413, 408, 393], anchor: [0.5232, 0] },
      { rect: [12, 810, 418, 394], content: [37, 814, 382, 389], anchor: [0.50372, 0] },
      { rect: [430, 810, 430, 394], content: [443, 854, 388, 332], anchor: [0.5137, 0] },
      { rect: [860, 810, 419, 394], content: [871, 814, 408, 390], anchor: [0.5232, 0] },
    ],
    warnings: [],
  },
  "/motions/rabbit-swordsman/idle.3x3.9f.8fps.png": {
    sheet: [1518, 1452],
    cols: 3,
    rows: 3,
    refHeightPx: 477,
    frames: [
      { rect: [4, 3, 501, 480], content: [6, 5, 494, 475], anchor: [0.49712, 0] },
      { rect: [505, 3, 505, 480], content: [515, 7, 491, 472], anchor: [0.50308, 0] },
      { rect: [1010, 3, 504, 480], content: [1017, 3, 494, 475], anchor: [0.50606, 0] },
      { rect: [4, 483, 501, 485], content: [4, 486, 496, 476], anchor: [0.49712, 0] },
      { rect: [505, 483, 505, 485], content: [508, 486, 499, 476], anchor: [0.50308, 0] },
      { rect: [1010, 483, 504, 485], content: [1014, 486, 500, 477], anchor: [0.50606, 0] },
      { rect: [4, 968, 501, 480], content: [7, 973, 495, 475], anchor: [0.49712, 0] },
      { rect: [505, 968, 505, 480], content: [515, 975, 492, 473], anchor: [0.50308, 0] },
      { rect: [1010, 968, 504, 480], content: [1018, 973, 494, 474], anchor: [0.50606, 0] },
    ],
    warnings: [],
  },
  "/motions/rabbit-swordsman/move.3x3.9f.8fps.png": {
    sheet: [1282, 1227],
    cols: 3,
    rows: 3,
    refHeightPx: 385,
    frames: [
      { rect: [11, 10, 381, 393], content: [30, 10, 323, 385], anchor: [0.44765, 0] },
      { rect: [392, 10, 422, 393], content: [442, 10, 336, 383], anchor: [0.51395, 0] },
      { rect: [814, 10, 392, 393], content: [861, 10, 341, 385], anchor: [0.56689, 0] },
      { rect: [11, 403, 381, 398], content: [11, 412, 339, 378], anchor: [0.44765, 0] },
      { rect: [392, 403, 422, 398], content: [445, 414, 327, 376], anchor: [0.51395, 0] },
      { rect: [814, 403, 392, 398], content: [851, 415, 350, 368], anchor: [0.56689, 0] },
      { rect: [11, 801, 381, 393], content: [16, 812, 332, 377], anchor: [0.44765, 0] },
      { rect: [392, 801, 422, 393], content: [432, 816, 346, 363], anchor: [0.51395, 0] },
      { rect: [814, 801, 392, 393], content: [884, 813, 322, 381], anchor: [0.56689, 0] },
    ],
    warnings: [],
  },
  "/motions/wanderer/attack.3x3.9f.12fps.png": {
    sheet: [1254, 1254],
    cols: 3,
    rows: 3,
    refHeightPx: 391,
    frames: [
      { rect: [14, 30, 377, 418], content: [14, 30, 367, 391], anchor: [0.42617, 0] },
      { rect: [391, 30, 386, 418], content: [401, 72, 324, 335], anchor: [0.52245, 0] },
      { rect: [777, 30, 447, 418], content: [793, 99, 338, 301], anchor: [0.52274, 0] },
      { rect: [14, 448, 377, 350], content: [111, 475, 257, 299], anchor: [0.42617, 0] },
      { rect: [391, 448, 386, 350], content: [460, 492, 295, 275], anchor: [0.52245, 0] },
      { rect: [777, 448, 447, 350], content: [849, 488, 375, 290], anchor: [0.52274, 0] },
      { rect: [14, 798, 377, 389], content: [19, 841, 303, 329], anchor: [0.42617, 0] },
      { rect: [391, 798, 386, 389], content: [404, 819, 358, 368], anchor: [0.52245, 0] },
      { rect: [777, 798, 447, 389], content: [796, 820, 357, 367], anchor: [0.52274, 0] },
    ],
    warnings: [],
  },
  "/motions/wanderer/hit.3x3.9f.12fps.png": {
    sheet: [1285, 1224],
    cols: 3,
    rows: 3,
    refHeightPx: 393,
    frames: [
      { rect: [12, 12, 418, 397], content: [12, 12, 408, 391], anchor: [0.50372, 0] },
      { rect: [430, 12, 430, 397], content: [441, 71, 389, 334], anchor: [0.5137, 0] },
      { rect: [860, 12, 419, 397], content: [871, 12, 408, 391], anchor: [0.5232, 0] },
      { rect: [12, 409, 418, 401], content: [113, 414, 306, 391], anchor: [0.50372, 0] },
      { rect: [430, 409, 430, 401], content: [451, 474, 399, 295], anchor: [0.5137, 0] },
      { rect: [860, 409, 419, 401], content: [871, 413, 408, 393], anchor: [0.5232, 0] },
      { rect: [12, 810, 418, 394], content: [37, 814, 382, 389], anchor: [0.50372, 0] },
      { rect: [430, 810, 430, 394], content: [443, 854, 388, 332], anchor: [0.5137, 0] },
      { rect: [860, 810, 419, 394], content: [871, 814, 408, 390], anchor: [0.5232, 0] },
    ],
    warnings: [],
  },
  "/motions/wanderer/idle.3x3.9f.8fps.png": {
    sheet: [1518, 1452],
    cols: 3,
    rows: 3,
    refHeightPx: 477,
    frames: [
      { rect: [4, 3, 501, 480], content: [6, 5, 494, 475], anchor: [0.49712, 0] },
      { rect: [505, 3, 505, 480], content: [515, 7, 491, 472], anchor: [0.50308, 0] },
      { rect: [1010, 3, 504, 480], content: [1017, 3, 494, 475], anchor: [0.50606, 0] },
      { rect: [4, 483, 501, 485], content: [4, 486, 496, 476], anchor: [0.49712, 0] },
      { rect: [505, 483, 505, 485], content: [508, 486, 499, 476], anchor: [0.50308, 0] },
      { rect: [1010, 483, 504, 485], content: [1014, 486, 500, 477], anchor: [0.50606, 0] },
      { rect: [4, 968, 501, 480], content: [7, 973, 495, 475], anchor: [0.49712, 0] },
      { rect: [505, 968, 505, 480], content: [515, 975, 492, 473], anchor: [0.50308, 0] },
      { rect: [1010, 968, 504, 480], content: [1018, 973, 494, 474], anchor: [0.50606, 0] },
    ],
    warnings: [],
  },
  "/motions/wanderer/move.3x3.9f.8fps.png": {
    sheet: [1282, 1227],
    cols: 3,
    rows: 3,
    refHeightPx: 385,
    frames: [
      { rect: [11, 10, 381, 393], content: [30, 10, 323, 385], anchor: [0.44765, 0] },
      { rect: [392, 10, 422, 393], content: [442, 10, 336, 383], anchor: [0.51395, 0] },
      { rect: [814, 10, 392, 393], content: [861, 10, 341, 385], anchor: [0.56689, 0] },
      { rect: [11, 403, 381, 398], content: [11, 412, 339, 378], anchor: [0.44765, 0] },
      { rect: [392, 403, 422, 398], content: [445, 414, 327, 376], anchor: [0.51395, 0] },
      { rect: [814, 403, 392, 398], content: [851, 415, 350, 368], anchor: [0.56689, 0] },
      { rect: [11, 801, 381, 393], content: [16, 812, 332, 377], anchor: [0.44765, 0] },
      { rect: [392, 801, 422, 393], content: [432, 816, 346, 363], anchor: [0.51395, 0] },
      { rect: [814, 801, 392, 393], content: [884, 813, 322, 381], anchor: [0.56689, 0] },
    ],
    warnings: [],
  },
};
