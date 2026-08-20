// 이펙트 오버레이 점검 페이지 — engine/view-kernel/fx/effect-layer.ts 하나만 세운다.
//
// 세계도 관찰 결과도 three 도 없다. 여기서 보려는 것은 그 층의 *산수*와 *합성*이다:
//   · 게임 좌표를 넣으면 화면의 그 자리에 나오는가 (worldScale · 뷰 행렬 변환)
//   · 투영을 WebGPU 규약으로 다시 만들었는가 (안 그러면 가까운 절반이 잘린다)
//   · 배경이 투명한가 (뒤의 세계가 비쳐야 한다)
//
// 하니스(test/overlay-shot.js)가 __overlayReady · __fire · __afterFrame 로 구동한다.

import { createEffectLayer } from '../../../engine/view-kernel/fx/effect-layer';

declare global {
  interface Window {
    __overlayReady?: boolean;
    __overlayFailed?: string;
    __fire?: (name: string, params?: FireParams) => void;
    __names?: () => readonly string[];
    __activeEffects?: () => number;
    __shoot?: () => Promise<{ lit: number; cx: number; cy: number; w: number; h: number; dataUrl: string } | null>;
  }
}

const stage = document.getElementById('stage');
if (!stage) throw new Error('#stage 가 없다');

/** 사건이 줄 수 있는 값들 — 컨텐츠의 SKILL_EFFECTS 한 줄이 만들어 내는 것과 같은 모양 */
interface FireParams {
  strength?: number;
  radius?: number;
  roll?: number;
  /** 축을 얼마나 위로 드는가 */
  lift?: number;
}

// 게임과 같은 예산으로 띄운다 — 눈으로 견주려면 장면에 올라온 이펙트도 같아야 한다.
// (팩의 EFFECT_SET 을 그대로 옮겨 적었다. tools 는 content 를 import 하지 않는다.)
const layer = createEffectLayer(stage, {
  names: ['타격', '검격', '전격', '파이어볼 폭발', '물결파', '삼중 파문', '회복 오라'],
  onUnavailable: (reason) => {
    window.__overlayFailed = reason;
  },
});

// 고정 시점 — 원점에서 조금 물러나 살짝 위에서 내려다본다.
// 게임의 카메라와 같은 규약(column-major world→view)이면 되고, 실제 값은 중요하지 않다.
const EYE = { x: 0, y: 2.2, z: 6 };
const TARGET = { x: 0, y: 1.4, z: 0 };
const viewMatrix = lookAt(EYE, TARGET);

window.__fire = (name, params = {}) => {
  layer.trigger({
    name,
    origin: { x: 0, y: 1.4, z: 0 },
    // 카메라 쪽 — 원판이 화면과 나란해진다. lift 는 스킬이 정하는 값이다.
    dir: { x: 0, y: params.lift ?? 0.25, z: 1 },
    ...(params.strength === undefined ? {} : { strength: params.strength }),
    ...(params.radius === undefined ? {} : { radius: params.radius }),
    ...(params.roll === undefined ? {} : { roll: params.roll }),
  });
};

// 촬영 — 층이 제 프레임 안에서 복사를 걸어 준다 (밖에서 캔버스를 그려 읽으면 빈 그림이다).
window.__shoot = async () => {
  const snap = await layer.snapshot();
  if (!snap) return null;
  const { width: w, height: h, bytesPerRow, pixels } = snap;
  // 프로젝트에 WebGPU 형이 없다 (@webgpu/types 미도입) — 이 한 줄만 좁혀 쓴다
  const gpu = (navigator as unknown as { gpu: { getPreferredCanvasFormat(): string } }).gpu;
  const bgra = gpu.getPreferredCanvasFormat().startsWith('bgra');
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  let lit = 0, sx = 0, sy = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * bytesPerRow + x * 4;
      const o = (y * w + x) * 4;
      const a = pixels[i + 3]!;
      if (a > 24) { lit++; sx += x; sy += y; }
      img.data[o] = pixels[i + (bgra ? 2 : 0)]!;
      img.data[o + 1] = pixels[i + 1]!;
      img.data[o + 2] = pixels[i + (bgra ? 0 : 2)]!;
      img.data[o + 3] = a;
    }
  }
  g.putImageData(img, 0, 0);
  return { lit, cx: lit ? sx / lit : 0, cy: lit ? sy / lit : 0, w, h, dataUrl: c.toDataURL('image/png') };
};

window.__names = () => layer.names();
window.__activeEffects = () => layer.activeEffects();

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  layer.render(
    { view: viewMatrix, fovY: (55 * Math.PI) / 180, near: 0.1, far: 300, focus: TARGET },
    dt,
  );
  if (layer.live()) window.__overlayReady = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// three 없이 만드는 world→view (오른손, 카메라는 -Z 를 본다) — column-major 16.
function lookAt(eye: typeof EYE, target: typeof TARGET): Float32Array {
  let zx = eye.x - target.x, zy = eye.y - target.y, zz = eye.z - target.z;
  const zl = Math.hypot(zx, zy, zz) || 1;
  zx /= zl; zy /= zl; zz /= zl;
  // x = up × z, up = (0,1,0) → (z.z, 0, -z.x)
  let xx = zz, xy = 0, xz = -zx;
  const xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  const m = new Float32Array(16);
  m[0] = xx; m[4] = xy; m[8] = xz; m[12] = -(xx * eye.x + xy * eye.y + xz * eye.z);
  m[1] = yx; m[5] = yy; m[9] = yz; m[13] = -(yx * eye.x + yy * eye.y + yz * eye.z);
  m[2] = zx; m[6] = zy; m[10] = zz; m[14] = -(zx * eye.x + zy * eye.y + zz * eye.z);
  m[15] = 1;
  return m;
}
