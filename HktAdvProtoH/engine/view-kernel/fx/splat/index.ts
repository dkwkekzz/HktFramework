// 스플랫 런타임 적재 — **순서가 계약이다.**
//
// 이 파일들은 HktSplatLife 에서 바이트 그대로 옮겨 온 classic script 다(고치지 않는다).
// 각자 IIFE 로 window 에 전역을 올릴 뿐 서로를 import 하지 않으므로, 의존 순서를 지키는
// 자리가 필요하다 — 그 자리가 여기다. 랩 페이지(tools/fx-lab/index.html)의 <script> 순서와
// 같은 순서여야 한다.
//
//   fx.js 는 적재 시점에 engine.js 의 MAX_FX 를 읽는다 → engine 이 먼저 온다.
//   presets.js 는 genome.js 의 값을 쓴다               → genome 이 먼저 온다.
//
// 이 모듈은 부수효과가 전부다 — 내보내는 것은 "다 올라왔다" 는 사실 하나뿐이다.
// 형은 ../splat-runtime.d.ts 가 window 쪽에서 준다.

import './math.js';
import './heightfield.js';
import './genome.js';
import './skeleton.js';
import './anim.js';
import './presets.js';
import './wgsl.js';
import './engine.js';
import './fx.js';

export const SPLAT_RUNTIME_LOADED = true;
