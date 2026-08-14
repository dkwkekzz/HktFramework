// Sprite Billboard — Entity 를 카메라를 향하는 스프라이트로 표현한다 (Render Capability).
//
// 두 가지 그림 원천을 다룬다.
//   1. 주입된 모션 시트 (C002) — 지시받은 프레임을 잘라 재생한다
//   2. 절차 생성 픽셀아트 (C001) — 모션 데이터가 없을 때의 그림
// 어느 쪽을 쓸지는 결정 Layer 가 Render Plan 에서 이미 정했다. 여기는 그대로 그린다.
//
// 시트를 어디서 자를지(프레임 사각형·기준점·대표 높이)도 여기서 재지 않는다 —
// 정적 분석이 미리 구해 둔 값이 Render Plan 에 실려 온다 (view/motion/motion-geometry.ts).
//
// 텍스처 정책
//   시트 1장 = GPU 텍스처 1장. billboard 마다 clone() 을 쓰는데, clone 은 Source 를
//   공유하므로(three Texture.copy: this.source = source.source) 업로드가 한 번뿐이다.
//   프레임 오프셋은 Texture 단위 값이라 clone 마다 독립이다.
//
//   필터는 Linear. 시트는 픽셀아트가 아니라 고해상도 그림이고, 화면에서는 축소되어
//   그려지므로 Nearest 로는 이동할 때마다 지글거린다. 밉맵 대신 시트를 화면 크기에
//   맞춰 한 번 줄여서 축소율 자체를 없앤다 — 카메라가 고정 오프셋이라 화면상 크기가
//   거의 일정하기 때문에 이 방법이 통한다 (camera/camera.ts 의 OFFSET).

import * as THREE from 'three';
import { spriteCanvas } from '../assets/registry';
import { motionFrameIndex } from '../motion/motion-frame';
import {
  frameUv,
  frameWorldSize,
  uniformGeometry,
  type MotionGeometry,
} from '../motion/motion-geometry';
import type { SceneMotion } from '../scene/scene-state';

/** 캐릭터가 차지하는 화면 높이 비율 — 고정 오프셋 카메라(거리 15, fov 55)에서의 실측값 */
const CHARACTER_SCREEN_FRACTION = 0.22;
/** 축소 여유 — 플레이어보다 가까운 entity 나 화면 가장자리 왜곡을 감안한다 */
const OVERSAMPLE = 1.4;
/** 아무리 작은 화면이라도 이보다 더 줄이지 않는다 */
const MIN_TARGET_PX = 192;

/** 발 기준점 기본값 — 절차 생성 그림과 기하를 모르는 시트에 쓴다 */
const DEFAULT_ANCHOR: readonly [number, number] = [0.5, 0.06];

interface Sheet {
  /**
   * clone 의 원본. **로드가 끝난 뒤에만** 만든다.
   *
   * 자리표시 그림을 먼저 올려 두면 안 된다 — three 는 첫 업로드 때 texStorage2D 로
   * 불변 스토리지를 잡으므로, 1×1 로 잡힌 뒤에는 실제 시트를 texSubImage2D 로 넣을 수 없고
   * (GL_INVALID_VALUE) 스프라이트가 통째로 사라진다.
   */
  texture: THREE.Texture | null;
  loaded: boolean;
  /**
   * 그림이 바뀔 때마다 오르는 세대 번호.
   * clone 들은 이 값이 자기가 반영한 값과 다를 때만 자신의 texture.version 을 올린다
   * (아래 bumpTextureVersion 의 설명 참고).
   */
  version: number;
  /** 원본 시트 픽셀 → 텍스처 텍셀 배율. 줄이지 않았으면 1 */
  scale: number;
  /** 정적 분석 결과가 없을 때 이미지 크기로 만들어 두는 균등 분할 기하 */
  measured?: MotionGeometry;
}

/**
 * clone 이 GPU 텍스처를 받도록 자기 버전만 올린다.
 *
 * three 의 WebGLTextures.setTexture2D 는 `texture.version > 0` 일 때만 업로드 경로를 타고,
 * 그 경로에서 비로소 __webglTexture 가 배정된다. 갓 만든 clone 은 version 이 0 이라
 * 아무것도 배정받지 못한 채 바인딩되어 화면에서 사라진다.
 *
 * 그렇다고 `needsUpdate = true` 를 쓰면 안 된다 — 그 setter 는 Source 의 버전까지 올려서
 * clone 마다 시트 전체를 다시 업로드하게 만든다(공유의 의미가 사라진다).
 * 픽셀 업로드는 `source.version !== sourceProperties.__version` 으로만 걸리므로,
 * 텍스처 자신의 버전만 올리면 첫 clone 한 번만 올리고 나머지는 같은 GL 텍스처를 물려받는다.
 */
function bumpTextureVersion(texture: THREE.Texture): void {
  texture.version++;
}

const sheets = new Map<string, Sheet>();
const canvasTextureCache = new Map<string, THREE.CanvasTexture>();

function proceduralTexture(spriteId: string): THREE.CanvasTexture {
  let tex = canvasTextureCache.get(spriteId);
  if (!tex) {
    tex = new THREE.CanvasTexture(spriteCanvas(spriteId));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter; // 이쪽은 진짜 픽셀아트다 — 또렷하게 둔다
    tex.minFilter = THREE.NearestFilter;
    canvasTextureCache.set(spriteId, tex);
  }
  return tex;
}

/** 이 화면에서 캐릭터 그림이 몇 픽셀로 그려지는지 — 시트를 얼마나 줄일지의 기준 */
function targetCharacterPixels(): number {
  if (typeof window === 'undefined') return Number.POSITIVE_INFINITY;
  const devicePixels = window.innerHeight * (window.devicePixelRatio || 1);
  return Math.max(MIN_TARGET_PX, devicePixels * CHARACTER_SCREEN_FRACTION * OVERSAMPLE);
}

/** 시트를 화면 크기에 맞춰 줄인다. 줄일 필요가 없으면 원본을 그대로 쓴다. */
function fitToScreen(
  image: HTMLImageElement,
  refHeightPx: number,
): { source: CanvasImageSource; scale: number } {
  const target = targetCharacterPixels();
  const scale = refHeightPx > 0 ? Math.min(1, target / refHeightPx) : 1;
  if (scale >= 1) return { source: image, scale: 1 };

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return { source: image, scale: 1 };
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { source: canvas, scale: canvas.height / image.height };
}

function sheetFor(motion: SceneMotion): Sheet {
  let sheet = sheets.get(motion.url);
  if (sheet) return sheet;

  const entry: Sheet = { texture: null, loaded: false, version: 0, scale: 1 };
  sheets.set(motion.url, entry);

  const image = new Image();
  image.onload = () => {
    const refHeightPx = motion.geometry?.refHeightPx ?? image.height / Math.max(1, motion.rows);
    const fitted = fitToScreen(image, refHeightPx);

    const texture = new THREE.Texture(fitted.source as HTMLImageElement);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter; // 밉맵 대신 시트를 미리 줄여 축소율을 없앤다
    texture.generateMipmaps = false; // 아틀라스라 밉맵은 이웃 프레임을 섞는다
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;

    entry.texture = texture;
    entry.scale = fitted.scale;
    entry.loaded = true;
    entry.measured =
      motion.geometry ?? uniformGeometry(image.width, image.height, motion.cols, motion.rows);
    entry.version++;
  };
  image.src = motion.url;

  return entry;
}

export interface BillboardAppearance {
  spriteId: string;
  /** 세로 기준 크기(월드 단위) — 캐릭터 그림의 높이가 이 값이 된다 */
  size: number;
  motion?: SceneMotion;
  tint?: number;
}

export interface Billboard {
  object: THREE.Sprite;
  /** 이번 프레임의 그림을 지시대로 반영한다 (크기·기준점 포함) */
  setAppearance(appearance: BillboardAppearance, timeSeconds: number): void;
  setPosition(x: number, y: number, z: number): void;
}

export function createBillboard(appearance: BillboardAppearance, timeSeconds = 0): Billboard {
  const material = new THREE.SpriteMaterial({ transparent: true });
  const sprite = new THREE.Sprite(material);

  let currentSpriteId = '';
  let currentTint = 0xffffff;
  let currentMotionUrl = '';
  let currentFrame = -1;
  let currentSize = -1;
  let appliedSheetVersion = -1;
  let motionTexture: THREE.Texture | null = null;
  let sheet: Sheet | null = null;

  function applyFrame(motion: SceneMotion, size: number, frame: number): void {
    if (!motionTexture || !sheet) return;

    // 정적 분석 결과 → 로드 후 측정한 균등 분할 → 파일명이 선언한 격자, 순으로 물러난다.
    const geometry =
      motion.geometry ?? sheet.measured ?? uniformGeometry(motion.cols, motion.rows, motion.cols, motion.rows);

    // 반 텍셀 안쪽으로 — 선형 보간이 프레임 밖을 집지 않게 한다. 시트 픽셀 단위로 환산한다.
    const insetSheetPx = sheet.scale > 0 ? 0.5 / sheet.scale : 0.5;
    const uv = frameUv(geometry, frame, insetSheetPx);
    motionTexture.repeat.set(uv.repeatX, uv.repeatY);
    motionTexture.offset.set(uv.offsetX, uv.offsetY);

    const world = frameWorldSize(geometry, frame, size);
    sprite.scale.set(world.width, world.height, 1);

    const anchor = geometry.frames[Math.min(frame, geometry.frames.length - 1)]?.anchor;
    sprite.center.set(anchor?.[0] ?? DEFAULT_ANCHOR[0], anchor?.[1] ?? DEFAULT_ANCHOR[1]);
  }

  function useMotion(
    motion: SceneMotion,
    spriteId: string,
    size: number,
    timeSeconds: number,
  ): void {
    const loading = sheetFor(motion);
    if (!loading.loaded || !loading.texture) {
      // 시트가 아직 도착하지 않았다 — 절차 생성 그림으로 그린다.
      // spec 의 fallback 마지막 단계와 같은 그림이므로 캐릭터가 사라지지 않는다.
      useProcedural(spriteId, size);
      return;
    }

    if (motion.url !== currentMotionUrl || !motionTexture) {
      currentMotionUrl = motion.url;
      currentSpriteId = '';
      currentFrame = -1;
      appliedSheetVersion = -1;

      sheet = loading;
      // clone 은 Source(=그림)를 공유한다 — GPU 업로드는 시트당 한 번뿐이고,
      // repeat/offset 만 이 billboard 의 것이 된다.
      motionTexture = loading.texture.clone();
      material.map = motionTexture;
      material.needsUpdate = true;
    }

    // 시트가 로드되었거나 갈아 끼워졌으면 이 clone 도 새 그림을 받아야 한다.
    if (sheet && motionTexture && sheet.version !== appliedSheetVersion) {
      appliedSheetVersion = sheet.version;
      bumpTextureVersion(motionTexture);
      currentFrame = -1; // 기하가 바뀌었을 수 있으니 프레임을 다시 적용한다
    }

    const frame = motionFrameIndex(motion, timeSeconds);
    if (frame !== currentFrame || size !== currentSize) {
      currentFrame = frame;
      currentSize = size;
      applyFrame(motion, size, frame);
    }
  }

  function useProcedural(spriteId: string, size: number): void {
    if (spriteId !== currentSpriteId) {
      currentSpriteId = spriteId;
      currentMotionUrl = '';
      currentFrame = -1;
      motionTexture = null;
      sheet = null;
      material.map = proceduralTexture(spriteId);
      material.needsUpdate = true;
      sprite.center.set(DEFAULT_ANCHOR[0], DEFAULT_ANCHOR[1]);
    }
    if (size !== currentSize) {
      currentSize = size;
      sprite.scale.set(size, size, 1);
    }
  }

  const billboard: Billboard = {
    object: sprite,
    setAppearance(next, time) {
      if (next.motion) useMotion(next.motion, next.spriteId, next.size, time);
      else useProcedural(next.spriteId, next.size);

      const tint = next.tint ?? 0xffffff;
      if (tint !== currentTint) {
        currentTint = tint;
        material.color.setHex(tint);
      }
    },
    setPosition(x, y, z) {
      sprite.position.set(x, y, z);
    },
  };

  billboard.setAppearance(appearance, timeSeconds);
  return billboard;
}
