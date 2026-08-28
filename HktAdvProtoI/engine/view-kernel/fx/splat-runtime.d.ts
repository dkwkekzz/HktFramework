// 스플랫 런타임(engine/view-kernel/fx/splat/*.js)이 window 에 올리는 전역의 형(形).
//
// 그 파일들은 HktSplatLife 에서 **바이트 그대로** 옮겨 온 classic script 다 — 고치지 않는
// 것이 이 자리의 계약이다(랩과 게임이 같은 사본을 읽는다). 그래서 타입은 파일 안이 아니라
// 여기에 둔다. 여기 적힌 것은 effect-layer.ts 가 실제로 부르는 표면뿐이다 —
// 런타임 전체의 명세가 아니다.
//
// WebGPU 형은 프로젝트에 @webgpu/types 가 없으므로 unknown 으로 둔다. 이 층은 WebGPU 값을
// 만들어 런타임에 넘겨줄 뿐 그 안을 들여다보지 않는다.

export {};

/** 이펙트 게놈 — fx.js FX_PRESETS 의 한 줄이 materialize 를 거친 결과 */
export interface SplatGenes {
  [gene: string]: unknown;
  form?: number;
  opacity?: number;
  binding?: number;
  refract?: number;
}

export interface SplatFxEvent {
  origin?: readonly number[];
  dir?: readonly number[];
  time?: number;
  strength?: number;
  scale?: number;
  radius?: number;
  roll?: number;
}

export interface SplatFxSystem {
  names: string[];
  compose(baseGenes: SplatGenes): SplatGenes[];
  trigger(name: string, event: SplatFxEvent): number;
  clear(): void;
  buffer(): Float32Array;
  activeCount(time: number): number;
  setGene(name: string, key: string, value: number): boolean;
}

export interface SplatFrameOptions {
  dt: number;
  time: number;
  genes: SplatGenes;
  entities: SplatGenes[];
  paused: boolean;
  pull: readonly number[];
  bones: null;
  showBones: boolean;
  fxEvents: Float32Array;
  view: Float32Array;
  proj: Float32Array;
  viewport: readonly [number, number];
  focal: readonly [number, number];
  gridCenter?: readonly number[];
  background?: { r: number; g: number; b: number; a: number };
}

export interface SplatEngine {
  count: number;
  setScene(n: number, entities: SplatGenes[]): void;
  frame(options: SplatFrameOptions): void;
}

declare global {
  interface Window {
    HktMat: {
      perspective(fovyRad: number, aspect: number, near: number, far: number): Float32Array;
      lookAt(eye: readonly number[], center: readonly number[], up: readonly number[]): Float32Array;
    };
    HktGenesisGenes: {
      PRESETS: Record<string, Record<string, unknown>>;
      materialize(preset: Record<string, unknown>, emitter?: readonly number[]): SplatGenes;
    };
    HktGenesisFx: {
      FX_PRESETS: Record<string, Record<string, unknown>>;
      FX_SETS: Record<string, string[]>;
      MAX_FX: number;
      FxSystem: new (options?: { names?: string[]; slices?: number; slots?: number }) => SplatFxSystem;
    };
    HktGenesisEngine: {
      new (device: unknown, context: unknown, format: string): SplatEngine;
      MAX_ENTITIES: number;
      MAX_FX: number;
      FX_STRIDE: number;
    };
  }
}
