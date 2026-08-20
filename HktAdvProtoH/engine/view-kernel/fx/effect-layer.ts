// Effect Layer — 이펙트를 켤 수 있는 Render Capability (기반).
//
// 하는 일은 둘뿐이다.
//   ① 스플랫 런타임(splat/)을 게임 화면 *위에* 투명한 WebGPU 캔버스로 얹는다
//   ② "이 자리에서 이 이펙트를 켜라" 를 받는다
//
// 무엇이 어떤 이펙트를 켜는지는 **모른다** — 타격인지 채굴인지 회복인지는 컨텐츠 팩의
// 결정이다(content/<pack>/view/effect-presentation.ts). 이 층은 sprite·terrain 능력과
// 같은 자리에 있다: 그릴 줄 알 뿐 게임 의미를 모른다.
//
// ── 왜 캔버스가 둘인가 ────────────────────────────────────────────────
// 세계는 three.js(WebGL2)가 그리고 이펙트는 WebGPU 가 그린다. 둘은 같은 캔버스를 쓸 수
// 없으므로 이펙트 캔버스를 위에 겹치고 premultiplied 알파로 합성한다. 값싼 우회가 아니라
// 이 프로젝트의 조건이다 — 스플랫 시뮬은 WebGPU compute 없이는 성립하지 않는다.
//
// 그 대가로 **깊이가 섞이지 않는다.** 이펙트는 언제나 세계 위에 그려진다(뒤에 있는 몸에
// 가려지지 않는다). 타격·검격처럼 짧고 밝은 것에는 문제가 되지 않지만, 지속되는 오라를
// 몸 뒤에 두려면 그때 깊이 공유를 따로 풀어야 한다.
//
// 또 하나 — F2 굴절 이펙트(refract > 0)는 여기서 **쓰지 않는다.** 굴절은 "제 뒤의 화면을
// 휘게 하는" 것인데, 오버레이의 뒤는 투명(=아무것도 없음)이다. 휠 배경이 없으므로 켜도
// 보이지 않는다. 굴절이 필요해지면 three 의 렌더 타겟을 이 층에 넘겨야 한다.
//
// ── 스케일 ────────────────────────────────────────────────────────────
// 이펙트 게놈은 키 1.7 남짓의 사람 곁에서 맞춰졌다(랩의 히키토). 이 게임의 몸은 그림
// 크기 2.5 로 그려진다. 그래서 게임 좌표를 그대로 넣으면 이펙트가 작아 보인다.
// 게놈을 고치지 않고 *공간*을 줄인다: 이펙트는 게임 세계를 worldScale 로 나눈 공간에서
// 살고, 시점 행렬이 그만큼 다시 키운다. 게놈은 랩에서 맞춘 그대로 남는다.

export interface EffectPoint {
  x: number;
  y: number;
  z: number;
}

/** 이펙트 하나를 켠다 — 게놈이 "무엇인가", 이 값이 "언제·어디서·얼마나" 다 */
export interface EffectEvent {
  /** 이펙트 게놈 이름 (splat/fx.js FX_PRESETS) */
  name: string;
  /** 발생 원점 (게임 세계 좌표) */
  origin: EffectPoint;
  /** 축 — 타격이면 맞은 쪽 법선, 폭발·오라면 보통 위 */
  dir?: EffectPoint;
  /** 사건의 세기 (게놈이 아니다) — 스침 0.4 ↔ 정통 2.5 */
  strength?: number;
  /** 축 둘레 회전(rad) — 부채꼴 이펙트의 기준 각 = 칼날 각도 */
  roll?: number;
  /** 초기 반경 */
  radius?: number;
  /** 크기 배율 */
  scale?: number;
}

/** 이 프레임의 시점 — three 카메라에서 그대로 뽑아 준다 */
export interface EffectViewpoint {
  /** world → view, column-major 16 (three: camera.matrixWorldInverse.elements) */
  view: ArrayLike<number>;
  /** 세로 화각 (rad) */
  fovY: number;
  near: number;
  far: number;
  /** 시뮬 격자의 중심 — 보통 따라가는 몸의 자리. 없으면 원점 */
  focus?: EffectPoint;
}

export interface EffectLayer {
  /** 이 기기에서 이펙트를 그릴 수 있는가 (WebGPU 가 있는가) */
  supported: boolean;
  /** 런타임이 올라와 실제로 그리고 있는가 — 부팅은 비동기다 */
  live(): boolean;
  /** 지금 장면에 올라와 있는 이펙트 이름들 (예산이 정한다) */
  names(): readonly string[];
  /**
   * 지금 살아 있는(수명 안) 이벤트 수 — 진단용. 렌더 경로와 무관하다.
   * "켜지긴 했는데 안 보인다" 와 "켜지지도 않았다" 를 가르는 유일한 값이다.
   */
  activeEffects(): number;
  /**
   * **디버그 전용** — 다음 프레임의 오버레이 픽셀을 그대로 돌려준다 (눈 검증 하니스).
   *
   * 여기 있는 이유는 함정이 이 층의 것이기 때문이다: 복사는 frame() 과 *같은 태스크*에서
   * 인코딩해야 present 전 화면을 잡는다. 밖에서 캔버스를 그려 읽으면(drawImage) 헤드리스
   * 합성기에서는 빈 그림이 나온다. 게임 경로는 이 메서드를 부르지 않는다.
   */
  snapshot(): Promise<EffectSnapshot | null>;
  /** 이펙트를 켠다. 아직 부팅 중이거나 장면에 없는 이름이면 조용히 흘린다 */
  trigger(event: EffectEvent): void;
  /** 한 프레임 — 세계를 그린 뒤에 부른다 */
  render(viewpoint: EffectViewpoint, dt: number): void;
  dispose(): void;
}

/** 디버그 스냅샷 — 캔버스 형식 그대로의 8비트 4채널 픽셀 (알파는 premultiplied) */
export interface EffectSnapshot {
  width: number;
  height: number;
  /** 행 간격(byte) — WebGPU 복사 정렬 때문에 width * 4 보다 클 수 있다 */
  bytesPerRow: number;
  pixels: Uint8Array;
}

export interface EffectLayerOptions {
  /**
   * 장면에 올릴 이펙트 이름들 = **예산**. 슬라이스는 8개뿐이고 기반 개체가 하나를 쓰므로
   * 최대 7개다. 무엇을 같이 올릴지는 컨텐츠의 결정이다 — 기본값은 fx.js 의 첫 세트에서
   * 굴절(오버레이에서 보이지 않는다)을 뺀 것.
   */
  names?: string[];
  /** 스플랫 총수 — 2의 거듭제곱이고 슬라이스(=n/8)가 256 배수여야 한다 */
  splats?: number;
  /** 게임 세계 : 이펙트 공간 배율 (위 "스케일" 참조) */
  worldScale?: number;
  /** 못 띄웠을 때 알려 준다 — 게임은 이펙트 없이 계속 돈다 */
  onUnavailable?: (reason: string) => void;
}

const DEFAULT_SPLATS = 65536; // 8 슬라이스 × 8192 (256 배수)
const DEFAULT_WORLD_SCALE = 1.5; // 그림 크기 2.5 : 랩 기준 키 1.7

export function createEffectLayer(
  container: HTMLElement,
  options: EffectLayerOptions = {},
): EffectLayer {
  const worldScale = options.worldScale ?? DEFAULT_WORLD_SCALE;
  const splats = options.splats ?? DEFAULT_SPLATS;
  const supported = typeof navigator !== 'undefined' && 'gpu' in navigator;

  let canvas: HTMLCanvasElement | null = null;
  let engine: import('./splat-runtime').SplatEngine | null = null;
  let fx: import('./splat-runtime').SplatFxSystem | null = null;
  let entities: import('./splat-runtime').SplatGenes[] = [];
  let context: unknown = null;
  let device: unknown = null;
  let simTime = 0;
  let disposed = false;
  // 디버그 스냅샷 대기 — render() 가 frame() 뒤 같은 태스크에서 복사를 인코딩한다
  let pendingSnapshot: ((snapshot: EffectSnapshot | null) => void) | null = null;

  const layer: EffectLayer = {
    supported,
    live: () => engine !== null && !disposed,
    names: () => fx?.names ?? [],
    activeEffects: () => fx?.activeCount(simTime) ?? 0,
    trigger(event) {
      if (!fx) return; // 아직 부팅 중 — 이 사건은 그림 없이 지나간다
      const s = worldScale;
      fx.trigger(event.name, {
        origin: [event.origin.x / s, event.origin.y / s, event.origin.z / s],
        ...(event.dir ? { dir: [event.dir.x, event.dir.y, event.dir.z] } : {}),
        time: simTime,
        ...(event.strength !== undefined ? { strength: event.strength } : {}),
        ...(event.roll !== undefined ? { roll: event.roll } : {}),
        ...(event.radius !== undefined ? { radius: event.radius / s } : {}),
        ...(event.scale !== undefined ? { scale: event.scale } : {}),
      });
    },
    render(viewpoint, dt) {
      if (!engine || !fx || !canvas || disposed) return;
      // 시뮬 시계와 프레임 시계는 **같은 걸음**이어야 한다.
      // 큰 dt 를 시뮬에만 잘라 넣고 시계는 그대로 흘리면, 한 번 버벅인 프레임에서
      // 시각이 훌쩍 뛰어 이제 막 켠 이펙트가 태어나자마자 수명을 넘긴다
      // (수명 판정은 time - t0 로 이루어진다 — splat/wgsl.js F1 경로).
      const step = Math.min(Math.max(dt, 0), 0.05);
      simTime += step;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(container.clientWidth * pixelRatio));
      const height = Math.max(1, Math.floor(container.clientHeight * pixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const s = worldScale;
      // 시점을 이펙트 공간으로 — 열 0·1·2 (기저 벡터)만 늘린다. 이동(열 3)은 그대로다:
      // 이펙트 좌표가 이미 1/s 로 들어와 있으므로 여기서 다시 나누면 두 번 줄어든다.
      const view = new Float32Array(16);
      for (let i = 0; i < 12; i++) view[i] = viewpoint.view[i]! * s;
      for (let i = 12; i < 16; i++) view[i] = viewpoint.view[i]!;

      // 투영은 WebGPU 규약(z ∈ [0,1])으로 *다시 만든다*. three 의 projectionMatrix 는
      // WebGL 규약(z ∈ [-1,1])이라 그대로 쓰면 가까운 절반이 잘려 나간다.
      const proj = window.HktMat.perspective(
        viewpoint.fovY,
        width / height,
        viewpoint.near / s,
        viewpoint.far / s,
      );
      // focal.x 에도 세로 focal 을 쓰는 것이 맞다 — 가로 화각은 proj[0] 의 aspect 가 이미
      // 담고 있어 두 값이 같아진다 (splat/wgsl.js ewaProject).
      const focalY = 0.5 * height / Math.tan(viewpoint.fovY / 2);
      const focus = viewpoint.focus;

      engine.frame({
        dt: step,
        time: simTime,
        genes: entities[0]!,
        entities,
        paused: false,
        pull: [0, 0, 0, 0],
        bones: null,
        showBones: false,
        fxEvents: fx.buffer(),
        view,
        proj,
        viewport: [width, height],
        focal: [focalY, focalY],
        ...(focus ? { gridCenter: [focus.x / s, focus.y / s, focus.z / s] } : {}),
        // 투명 클리어 — 뒤의 세계(three 캔버스)가 그대로 비친다
        background: { r: 0, g: 0, b: 0, a: 0 },
      });

      if (pendingSnapshot) {
        const resolve = pendingSnapshot;
        pendingSnapshot = null;
        void grabPixels(width, height).then(resolve, () => resolve(null));
      }
    },
    snapshot() {
      if (!engine || disposed) return Promise.resolve(null);
      return new Promise<EffectSnapshot | null>((resolve) => {
        pendingSnapshot = resolve;
      });
    },
    dispose() {
      disposed = true;
      pendingSnapshot?.(null);
      pendingSnapshot = null;
      canvas?.remove();
      canvas = null;
      engine = null;
      fx = null;
    },
  };

  if (!supported) {
    options.onUnavailable?.('WebGPU 없음 — 이펙트 없이 그린다');
    return layer;
  }

  void boot();
  return layer;

  async function boot(): Promise<void> {
    try {
      // 런타임은 여기서 처음 내려받는다 — WebGPU 가 없는 기기는 이 코드에 닿지 않는다.
      // 적재 순서는 splat/index.ts 가 소유한다.
      await import('./splat/index');

      const gpu = (navigator as unknown as { gpu: GpuLike }).gpu;
      const adapter = await gpu.requestAdapter();
      if (!adapter) throw new Error('WebGPU 어댑터를 얻지 못했다');
      const gpuDevice = await adapter.requestDevice();
      device = gpuDevice;
      if (disposed) return;

      canvas = document.createElement('canvas');
      canvas.style.cssText =
        'position:absolute; inset:0; width:100%; height:100%; pointer-events:none;';
      // 세계 캔버스 바로 위, HUD 아래 — HUD 는 뒤에 붙으므로 저절로 위에 온다
      container.appendChild(canvas);

      const format = gpu.getPreferredCanvasFormat();
      context = canvas.getContext('webgpu');
      (context as GpuCanvasLike).configure({
        device: gpuDevice,
        format,
        // COPY_SRC 는 디버그 스냅샷(snapshot)의 전제다. 게임 경로에는 아무 비용이 없다.
        usage: RENDER_ATTACHMENT | COPY_SRC,
        // 오버레이의 전제 — 스플랫 블렌딩이 premultiplied over 이므로 캔버스 합성도 같아야 한다
        alphaMode: 'premultiplied',
      });

      // 기반 개체 = 보이지 않는 더미. 슬라이스 예산의 자리만 차지한다 —
      // 이 층은 캐릭터를 그리지 않는다(그것은 랩의 몫이다).
      const inert = window.HktGenesisGenes.materialize(window.HktGenesisGenes.PRESETS['물']!);
      inert.opacity = 0;
      inert.binding = 0;
      inert.form = 0;

      const names = (options.names ?? defaultNames()).filter(
        (name) => window.HktGenesisFx.FX_PRESETS[name] !== undefined,
      );
      fx = new window.HktGenesisFx.FxSystem({ names, slots: 2 });
      entities = fx.compose(inert);

      engine = new window.HktGenesisEngine(gpuDevice, context, format);
      engine.setScene(splats, entities);
    } catch (error) {
      options.onUnavailable?.(error instanceof Error ? error.message : String(error));
      canvas?.remove();
      canvas = null;
      engine = null;
      fx = null;
    }
  }

  // 기본 예산 — 굴절 이펙트는 뺀다(오버레이에는 휘게 할 배경이 없다).
  function defaultNames(): string[] {
    const sets = window.HktGenesisFx.FX_SETS;
    const first = sets[Object.keys(sets)[0]!] ?? [];
    return first.filter((name) => !((window.HktGenesisFx.FX_PRESETS[name]?.['refract'] as number) > 0));
  }

  // 스왑체인 한 장을 CPU 로 — frame() 과 같은 태스크에서 복사를 인코딩해야 한다.
  async function grabPixels(width: number, height: number): Promise<EffectSnapshot | null> {
    const d = device as GpuDeviceLike | null;
    if (!d || !context) return null;
    const bytesPerRow = Math.ceil((width * 4) / 256) * 256;
    const buffer = d.createBuffer({ size: bytesPerRow * height, usage: COPY_DST | MAP_READ });
    const encoder = d.createCommandEncoder();
    encoder.copyTextureToBuffer(
      { texture: (context as GpuCanvasLike).getCurrentTexture() },
      { buffer, bytesPerRow },
      [width, height, 1],
    );
    d.queue.submit([encoder.finish()]);
    await buffer.mapAsync(MAP_READ);
    const pixels = new Uint8Array(buffer.getMappedRange()).slice();
    buffer.unmap();
    return { width, height, bytesPerRow, pixels };
  }
}

// WebGPU 상수·형은 프로젝트에 없다 (@webgpu/types 미도입) — 이 층이 실제로 쓰는 것만 적는다.
const gpuFlags = globalThis as unknown as {
  GPUTextureUsage: { RENDER_ATTACHMENT: number; COPY_SRC: number };
  GPUBufferUsage: { COPY_DST: number; MAP_READ: number };
  GPUMapMode: { READ: number };
};
const RENDER_ATTACHMENT = gpuFlags.GPUTextureUsage?.RENDER_ATTACHMENT ?? 0x10;
const COPY_SRC = gpuFlags.GPUTextureUsage?.COPY_SRC ?? 0x01;
const COPY_DST = gpuFlags.GPUBufferUsage?.COPY_DST ?? 0x0008;
const MAP_READ = gpuFlags.GPUBufferUsage?.MAP_READ ?? 0x0001;

interface GpuLike {
  requestAdapter(): Promise<{ requestDevice(): Promise<unknown> } | null>;
  getPreferredCanvasFormat(): string;
}

interface GpuCanvasLike {
  configure(config: { device: unknown; format: string; alphaMode: string; usage?: number }): void;
  getCurrentTexture(): unknown;
}

interface GpuBufferLike {
  mapAsync(mode: number): Promise<void>;
  getMappedRange(): ArrayBuffer;
  unmap(): void;
}

interface GpuDeviceLike {
  createBuffer(descriptor: { size: number; usage: number }): GpuBufferLike;
  createCommandEncoder(): {
    copyTextureToBuffer(
      source: { texture: unknown },
      destination: { buffer: GpuBufferLike; bytesPerRow: number },
      size: [number, number, number],
    ): void;
    finish(): unknown;
  };
  queue: { submit(commands: unknown[]): void };
}
