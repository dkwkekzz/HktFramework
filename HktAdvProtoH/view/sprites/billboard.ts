// Sprite Billboard — Entity 를 카메라를 향하는 픽셀아트 스프라이트로 표현한다.

import * as THREE from 'three';
import { spriteCanvas } from '../assets/registry';

const textureCache = new Map<string, THREE.CanvasTexture>();

function spriteTexture(spriteId: string): THREE.CanvasTexture {
  let tex = textureCache.get(spriteId);
  if (!tex) {
    tex = new THREE.CanvasTexture(spriteCanvas(spriteId));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter; // 픽셀아트 유지
    tex.minFilter = THREE.NearestFilter;
    textureCache.set(spriteId, tex);
  }
  return tex;
}

export interface Billboard {
  object: THREE.Sprite;
  setSprite(spriteId: string): void;
  setPosition(x: number, y: number, z: number): void;
}

export function createBillboard(spriteId: string, scale: number): Billboard {
  const material = new THREE.SpriteMaterial({ map: spriteTexture(spriteId), transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale, scale, 1);
  sprite.center.set(0.5, 0.06); // 발 기준점 — 지면 위에 선다
  let current = spriteId;

  return {
    object: sprite,
    setSprite(id) {
      if (id === current) return;
      current = id;
      material.map = spriteTexture(id);
      material.needsUpdate = true;
    },
    setPosition(x, y, z) {
      sprite.position.set(x, y, z);
    },
  };
}
