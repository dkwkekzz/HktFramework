// Sprite Billboard — Entity 를 카메라를 향하는 스프라이트로 표현한다 (Render Capability).
//
// 두 가지 그림 원천을 다룬다.
//   1. 주입된 모션 시트 (C002) — 지시받은 프레임을 잘라 재생한다
//   2. 절차 생성 픽셀아트 (C001) — 모션 데이터가 없을 때의 그림
// 어느 쪽을 쓸지는 결정 Layer 가 Render Plan 에서 이미 정했다. 여기는 그대로 그린다.

import * as THREE from 'three';
import { spriteCanvas } from '../assets/registry';
import { motionFrameIndex, motionFrameUv } from '../motion/motion-frame';
import type { SceneMotion } from '../scene/scene-state';

const canvasTextureCache = new Map<string, THREE.CanvasTexture>();

function proceduralTexture(spriteId: string): THREE.CanvasTexture {
  let tex = canvasTextureCache.get(spriteId);
  if (!tex) {
    tex = new THREE.CanvasTexture(spriteCanvas(spriteId));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter; // 픽셀아트 유지
    tex.minFilter = THREE.NearestFilter;
    canvasTextureCache.set(spriteId, tex);
  }
  return tex;
}

// 시트 이미지는 url 당 한 번만 읽는다. 텍스처는 billboard 마다 따로 만든다 —
// 프레임 오프셋이 독립이어야 하기 때문이다.
interface SheetImage {
  image: HTMLImageElement;
  loaded: boolean;
  listeners: Array<() => void>;
}
const sheetImages = new Map<string, SheetImage>();

function sheetImage(url: string): SheetImage {
  let entry = sheetImages.get(url);
  if (!entry) {
    const image = new Image();
    entry = { image, loaded: false, listeners: [] };
    sheetImages.set(url, entry);
    image.onload = () => {
      entry!.loaded = true;
      for (const notify of entry!.listeners) notify();
      entry!.listeners.length = 0;
    };
    image.src = url;
  }
  return entry;
}

export interface BillboardAppearance {
  spriteId: string;
  motion?: SceneMotion;
}

export interface Billboard {
  object: THREE.Sprite;
  /** 이번 프레임의 그림을 지시대로 반영한다 */
  setAppearance(appearance: BillboardAppearance, timeSeconds: number): void;
  setPosition(x: number, y: number, z: number): void;
  /** 폭 보정 계수 — 시트 프레임의 가로세로비 (모션이 없으면 1) */
  aspect(): number;
}

export function createBillboard(appearance: BillboardAppearance, scale: number): Billboard {
  const material = new THREE.SpriteMaterial({ transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale, scale, 1);
  sprite.center.set(0.5, 0.06); // 발 기준점 — 지면 위에 선다

  let currentSpriteId = '';
  let currentMotionUrl = '';
  let currentFrame = -1;
  let motionTexture: THREE.Texture | null = null;
  let frameAspect = 1;

  function useMotion(motion: SceneMotion, timeSeconds: number): void {
    if (motion.url !== currentMotionUrl) {
      currentMotionUrl = motion.url;
      currentSpriteId = '';
      currentFrame = -1;

      const entry = sheetImage(motion.url);
      const texture = new THREE.Texture(entry.image);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;

      const applyLoaded = (): void => {
        texture.needsUpdate = true;
        frameAspect =
          entry.image.height > 0
            ? entry.image.width / motion.cols / (entry.image.height / motion.rows)
            : 1;
      };
      if (entry.loaded) applyLoaded();
      else entry.listeners.push(applyLoaded);

      motionTexture = texture;
      material.map = texture;
      material.needsUpdate = true;
    }

    const frame = motionFrameIndex(motion, timeSeconds);
    if (frame !== currentFrame && motionTexture) {
      currentFrame = frame;
      const uv = motionFrameUv(motion, frame);
      motionTexture.repeat.set(uv.repeatX, uv.repeatY);
      motionTexture.offset.set(uv.offsetX, uv.offsetY);
    }
  }

  function useProcedural(spriteId: string): void {
    if (spriteId === currentSpriteId) return;
    currentSpriteId = spriteId;
    currentMotionUrl = '';
    currentFrame = -1;
    motionTexture = null;
    frameAspect = 1;
    material.map = proceduralTexture(spriteId);
    material.needsUpdate = true;
  }

  const billboard: Billboard = {
    object: sprite,
    setAppearance(next, timeSeconds) {
      if (next.motion) useMotion(next.motion, timeSeconds);
      else useProcedural(next.spriteId);
    },
    setPosition(x, y, z) {
      sprite.position.set(x, y, z);
    },
    aspect: () => frameAspect,
  };

  billboard.setAppearance(appearance, 0);
  return billboard;
}
