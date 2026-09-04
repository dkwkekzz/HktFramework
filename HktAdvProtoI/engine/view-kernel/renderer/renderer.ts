// Renderer — Scene State 를 three.js 로 그린다 (Render Capability 엔진).
// sprite billboard · terrain · trail · camera follow 능력을 제공할 뿐,
// 어떤 entity 를 어떻게 그릴지는 Scene State(= World 의 표현 지시)가 정한다.

import * as THREE from 'three';
import { createViewCamera } from '../camera/camera';
import { createEffectLayer, type EffectLayer, type EffectLayerOptions } from '../fx/effect-layer';
import type { PlaneDirection } from '../camera/orientation';
import type { SceneGroundZone, SceneState } from '../scene/scene-state';
import { createBillboard, type Billboard } from '../sprites/billboard';
import { createGroundFill, type GroundFillShape } from '../terrain/ground-fill';
import { createTerrain, terrainHeightSampler, type TerrainPalette } from '../terrain/terrain';
import type { CompiledViewTerrain, CompiledWorldTerrain } from '../../world-authoring/compiled';

export interface GameRenderer {
  render(state: SceneState, dt?: number): void;
  /**
   * 그릴 지형을 갈아 끼운다 — 그리는 격자(view)와 높이를 재는 격자(world)는 같은 컴파일 결과다.
   * 태그를 색으로 옮기는 palette 는 컨텐츠의 결정이므로 밖에서 온다 (설계 반전 ⑤).
   *
   * 아직 한 번도 주지 않았으면 지형 없이 — 높이 0 인 평면으로 — 돈다.
   */
  setTerrain(
    terrain: { world: CompiledWorldTerrain; view: CompiledViewTerrain },
    palette: TerrainPalette,
  ): void;
  /** 화면 좌표 → 지형 위 지점 (없으면 null) */
  pickGround(clientX: number, clientY: number): { x: number; z: number } | null;
  /** 화면 좌표에 있는 entity id (없으면 null) */
  pickEntity(clientX: number, clientY: number): string | null;
  /** 월드 지면 위 지점(+높이 오프셋) → 화면 좌표 (카메라 뒤면 null) */
  worldToScreen(x: number, z: number, yOffset: number): { x: number; y: number } | null;
  /**
   * 그 몸이 **지금 그려지고 있는** 자리 (아직 그린 적이 없으면 null).
   *
   * 관찰 결과의 위치가 아니다 — 그것은 세계의 Tick 마다 띄엄띄엄 도착하므로,
   * 몸 위에 붙는 표시를 그 값으로 투영하면 몸은 매끄럽게 흐르는데 표시만
   * Tick 간격으로 튄다. 몸에 붙는 것은 몸이 있는 자리에서 투영해야 한다.
   */
  drawnPosition(entityId: string): { x: number; z: number } | null;
  /** 시점을 지금 방향에서 그만큼 더 돌린다 */
  turnView(dTurn: number, dTilt: number): void;
  /** 지금 시점이 수평으로 돈 각 — 몸 방향을 좌우로 읽는 기준이 된다 */
  viewTurn(): number;
  /** 관찰자 기준 입력 방향 → 세계 방향 */
  viewWorldDirection(local: PlaneDirection): PlaneDirection;
  domElement: HTMLCanvasElement;
}

export interface RendererOptions {
  /**
   * 이펙트 층 (F1). 없으면 이펙트 없이 그린다 — 세계는 그대로 돈다.
   * 어떤 이펙트를 올릴지(예산)는 컨텐츠의 결정이므로 조립 루트가 넣어 준다.
   */
  effects?: EffectLayerOptions;
}

export function createRenderer(
  container: HTMLElement,
  options: RendererOptions = {},
): GameRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc4e0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.95));
  const sun = new THREE.DirectionalLight(0xfff4d6, 1.1);
  sun.position.set(10, 20, 5);
  scene.add(sun);

  // 지형 capability — 지형은 밖에서 컴파일되어 들어온다 (setTerrain).
  // 아직 받지 못했으면 그리지 않고, 높이는 어디서나 0 이다 — 화면은 그대로 돈다.
  let ground: THREE.Object3D | null = null;
  let heightAt: (x: number, z: number) => number = () => 0;
  // 지형이 없을 때 화면 좌표를 받아 줄 지면 — 높이 0 인 무한 평면 (크기 상수를 두지 않는다)
  const flatGround = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  function disposeGround(): void {
    if (!ground) return;
    scene.remove(ground);
    ground.traverse((child) => {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) for (const m of material) m.dispose();
      else material?.dispose?.();
    });
    ground = null;
  }

  const view = createViewCamera(container.clientWidth / container.clientHeight);
  const camera = view.camera;
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  // 이펙트 층 — 세계 캔버스 *위에* 겹치는 투명한 WebGPU 캔버스 (engine/view-kernel/fx).
  // 세계 캔버스를 먼저 붙였으므로 그 위에 오고, HUD 는 뒤에 붙으므로 이 위에 온다.
  const effectLayer: EffectLayer = createEffectLayer(container, options.effects ?? {});
  // 이미 켠 사건들 — 이펙트는 상태가 아니라 사건이라 한 번만 켠다.
  // 관찰 결과는 같은 타격을 TTL 동안 계속 실어 보낸다 (strikeEvents).
  const firedEffects = new Set<string>();
  // 디버그 창구 — 콘솔·눈검증 하니스가 이펙트 층을 찾는 유일한 길이다.
  // (HktSplatLife 의 window.__hktFire / __lifeReady 와 같은 규약. 게임 경로는 쓰지 않는다.)
  // 헤드리스 합성기는 WebGPU 캔버스를 스크린샷에 담지 못하므로, 촬영은 이 층의
  // snapshot() 으로만 가능하다 — 그래서 창구가 필요하다.
  (window as unknown as { __hktEffectLayer?: EffectLayer }).__hktEffectLayer = effectLayer;
  const FIRED_MEMORY = 512; // 이 이상 쌓이면 오래된 것부터 버린다 (Set 은 삽입 순서를 지킨다)

  const billboards = new Map<string, Billboard>(); // entityId → billboard
  const raycaster = new THREE.Raycaster();

  // 이동 자취 capability — trail 지시를 받은 entity 별로 유지
  const TRAIL_MAX = 48;
  interface Trail {
    points: THREE.Vector3[];
    geometry: THREE.BufferGeometry;
    accum: number;
  }
  const trails = new Map<string, Trail>();

  function trailFor(entityId: string): Trail {
    let t = trails.get(entityId);
    if (!t) {
      const geometry = new THREE.BufferGeometry();
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: 0xe8c93e, transparent: true, opacity: 0.85 }),
      );
      scene.add(line);
      t = { points: [], geometry, accum: 0 };
      trails.set(entityId, t);
    }
    return t;
  }

  function toNdc(clientX: number, clientY: number): THREE.Vector2 {
    const rect = renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  // 디버그 도형 capability — 캡슐/구체 부피와 화살표를 그릴 뿐,
  // 그것이 무엇인지 모른다. 지시가 프레임마다 통째로 오므로 그룹을 비우고 다시 만든다.
  const debugGroup = new THREE.Group();
  scene.add(debugGroup);
  const DEBUG_Y = 0.05; // 지면에 묻히지 않도록 살짝 띄운다

  function clearDebugGroup(): void {
    for (const child of debugGroup.children) {
      const mesh = child as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    debugGroup.clear();
  }

  function debugMaterial(color: number, opacity: number): THREE.Material {
    return new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity,
      depthWrite: false,
    });
  }

  // 지면 구역 capability — 지형을 따라가는 반투명 면으로 그린다.
  // **이 층은 그것이 무엇의 구역인지 모른다** (설계 반전 ⑤). 디버그 도형과 같은 방식으로
  // 프레임마다 통째로 갈아 끼운다 — 구역이 생기고 사라지는 세계에서도 그대로 선다.
  const zoneGroup = new THREE.Group();
  zoneGroup.renderOrder = 1; // 지형 위에 얹는다
  scene.add(zoneGroup);
  const ZONE_LIFT = 0.06; // 지면에 묻히지 않도록 띄운다 (스프라이트·트레일과 같은 관용구)
  const ZONE_SEGMENTS = 64;
  const ZONE_EDGE_STEP = 1; // 폴리곤 변을 지형에 드리울 때의 분할 간격 (세계 단위)

  // 채움 기하는 모양과 지형이 그대로면 다시 만들지 않는다 — 지면을 따라가도록 잘게 나눈 면을
  // 프레임마다 새로 접으면 비싸다 (방 하나 4천 vertex 기준 수 ms). 맥동은 재질만 바꾸므로
  // 기하를 다시 만들 이유가 없다.
  interface ZoneFill {
    signature: string;
    geometry: THREE.BufferGeometry;
  }
  const zoneFills = new Map<string, ZoneFill>();
  let terrainVersion = 0; // 지형이 바뀌면 채움도 다시 접어야 한다

  function zoneFillGeometry(zoneId: string, shape: GroundFillShape): THREE.BufferGeometry {
    const signature = `${terrainVersion}|${JSON.stringify(shape)}`;
    const found = zoneFills.get(zoneId);
    if (found && found.signature === signature) return found.geometry;
    found?.geometry.dispose();
    const geometry = createGroundFill(shape, {
      step: ZONE_EDGE_STEP,
      lift: ZONE_LIFT,
      heightAt,
    });
    geometry.userData.zoneFill = true; // 프레임 끝의 정리에서 살려 둔다
    zoneFills.set(zoneId, { signature, geometry });
    return geometry;
  }

  /** 이 프레임에 오지 않은 구역의 채움은 버린다 */
  function dropUnseenZoneFills(seen: ReadonlySet<string>): void {
    for (const [id, fill] of zoneFills) {
      if (seen.has(id)) continue;
      fill.geometry.dispose();
      zoneFills.delete(id);
    }
  }

  function clearZoneGroup(): void {
    for (const child of zoneGroup.children) {
      const mesh = child as THREE.Mesh | THREE.Sprite;
      // 다시 쓰는 채움 기하는 버리지 않는다
      if (!mesh.geometry?.userData?.zoneFill) mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material & { map?: THREE.Texture };
      material.map?.dispose();
      material.dispose();
    }
    zoneGroup.clear();
  }

  /**
   * 지형을 따라가도록 각 꼭짓점의 높이를 지면에서 읽어 올린다.
   * **이미 있는 vertex 만 올린다** — 그 사이가 평평한 판으로 남지 않으려면 면이
   * 미리 잘게 나뉘어 있어야 한다 (테두리는 ZONE_EDGE_STEP 으로 나눈다. 채움은
   * terrain/ground-fill 이 같은 눈금으로 나눈 것을 받아 온다).
   */
  function drapeOnTerrain(geometry: THREE.BufferGeometry, cx: number, cz: number): void {
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = cx + pos.getX(i);
      const z = cz + pos.getZ(i);
      pos.setY(i, heightAt(x, z) + ZONE_LIFT);
    }
    pos.needsUpdate = true;
  }

  /** 구역 이름표 — 글자를 캔버스에 그려 지면 위에 띄운다. 엔진은 이 글자의 뜻을 모른다 */
  /** 이름표 글자의 크기 (캔버스 픽셀) · 획 두께 · 좌우 여백 */
  const LABEL_FONT = 56;
  const LABEL_STROKE = 10;
  const LABEL_PAD = 24;
  /** 글자 높이가 세계에서 차지하는 크기 — 캔버스가 넓어져도 이 값은 그대로다 */
  const LABEL_WORLD_HEIGHT = 1.5;
  /** 캔버스 최소 너비 — 짧은 이름표가 지나치게 좁아지지 않게 */
  const LABEL_MIN_WIDTH = 256;

  /**
   * 지면 구역의 이름표 하나.
   *
   * **캔버스를 글자에 맞춘다.** 예전에는 512×128 로 고정해 두고 가운데에 그렸는데, 한글은
   * 글자 하나가 거의 글자 크기만큼 넓어서 아홉 자만 넘어도 캔버스를 넘쳤다 — 넘친 부분은
   * 잘려 나갔고, 그래서 "거목이 포식자를 물린다" 가 화면에서는 "포식자를 물린다" 로 읽혔다.
   * 글자가 잘리는 것은 보기 나쁜 정도가 아니라 **세계가 한 말이 다른 말로 바뀌는 것**이다.
   *
   * 이제 재서(measureText) 그만큼 넓은 캔버스를 잡고, 스프라이트의 가로 크기를 캔버스 비율로
   * 맞춘다 — 글자의 세계 높이는 언제나 같고 긴 이름표는 잘리는 대신 넓어진다.
   */
  function zoneLabelSprite(text: string, color: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const font = `bold ${LABEL_FONT}px sans-serif`;
    // 재기 위해 한 번 만들어 본다 — 크기를 정하려면 재야 하고, 재려면 ctx 가 있어야 한다
    canvas.width = LABEL_MIN_WIDTH;
    canvas.height = LABEL_FONT * 2;
    const measuring = canvas.getContext('2d');
    let width = LABEL_MIN_WIDTH;
    if (measuring) {
      measuring.font = font;
      width = Math.max(LABEL_MIN_WIDTH, Math.ceil(measuring.measureText(text).width) + LABEL_PAD * 2);
    }
    // 캔버스 크기를 바꾸면 내용도 설정도 지워지므로 여기서 다시 잡는다
    canvas.width = width;
    canvas.height = LABEL_FONT * 2;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = LABEL_STROKE;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
      ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
    );
    // 세로는 고정, 가로는 캔버스 비율 — 글자가 늘어나거나 눌리지 않는다
    sprite.scale.set((LABEL_WORLD_HEIGHT * canvas.width) / canvas.height, LABEL_WORLD_HEIGHT, 1);
    return sprite;
  }

  /** 반투명 지면 재질 — 채움·테두리가 같은 관용구를 쓴다 */
  function zoneMaterial(color: number, opacity: number): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: Math.min(1, opacity),
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  /**
   * 이름표가 겹치지 않게 쌓는 자리 — 한 프레임 동안만 산다.
   *
   * 구역은 겹칠 수 있고(겹치는 것이 뜻인 경우도 있다) 그러면 이름표도 같은 자리에 겹쳐
   * 서로를 못 읽게 만든다. 가까운 자리에 이미 이름표가 있으면 그 위로 한 칸 올린다 —
   * 순서는 zones 배열 그대로이므로 같은 세계는 언제나 같게 쌓인다.
   */
  const placedLabels: { x: number; z: number; y: number }[] = [];
  /** 이보다 가까우면 겹친 것으로 친다 (세계 단위 · 평면 거리) */
  const LABEL_MIN_GAP = 6;
  /** 겹쳤을 때 올리는 높이 — 글자 높이보다 조금 크게 잡아 획이 닿지 않게 */
  const LABEL_STACK_STEP = 1.8;

  /** 그 자리에 이름표를 놓을 높이 — 이미 가까이 있는 것들 위로 비켜 준다 */
  function labelHeightAt(x: number, z: number, ground: number): number {
    let y = ground;
    // 이미 놓인 것 중 가까운 것이 없을 때까지 올린다 (놓인 수만큼만 도므로 끝난다)
    for (let guard = 0; guard <= placedLabels.length; guard++) {
      const collides = placedLabels.some(
        (placed) =>
          Math.hypot(placed.x - x, placed.z - z) < LABEL_MIN_GAP &&
          Math.abs(placed.y - y) < LABEL_STACK_STEP,
      );
      if (!collides) break;
      y += LABEL_STACK_STEP;
    }
    placedLabels.push({ x, z, y });
    return y;
  }

  function drawZones(zones: readonly SceneGroundZone[], worldTime: number): void {
    const seen = new Set<string>();
    placedLabels.length = 0; // 이름표 자리는 프레임마다 새로 잡는다
    for (const zone of zones) {
      seen.add(zone.id);
      // 맥동 — 세계 시각으로 위상을 잡으므로 같은 세계는 언제나 같게 보인다.
      // intensity 가 없으면 맥동하지 않는다 (배율 1).
      const pulse =
        zone.intensity === undefined
          ? 1
          : 1 + 0.25 * zone.intensity * Math.sin(worldTime * 3);
      if (zone.shape.kind === 'polygon') drawPolygonZone(zone, zone.shape.points, pulse);
      else drawCircleZone(zone, zone.shape.center, zone.shape.radius, pulse);
    }
    dropUnseenZoneFills(seen);
  }

  /**
   * 폴리곤 바닥 (C001 ADDED) — 절대 좌표의 닫힌 점열. 채움은 Shape 삼각분할, 테두리는
   * 변마다 세계 단위 두께의 얇은 띠, 이름표는 점들의 평균 자리. 원 경로는 손대지 않는다.
   */
  function drawPolygonZone(
    zone: SceneGroundZone,
    points: readonly { x: number; z: number }[],
    pulse: number,
  ): void {
    if (points.length < 3) return;

    if (zone.fill) {
      // 채움은 테두리와 같은 눈금으로 나뉘어 지면에 붙는다 — 점이 이미 절대 좌표다.
      const geometry = zoneFillGeometry(zone.id, { kind: 'polygon', points });
      const mesh = new THREE.Mesh(geometry, zoneMaterial(zone.fill.color, zone.fill.opacity * pulse));
      mesh.renderOrder = 1;
      zoneGroup.add(mesh);
    }

    if (zone.edge) {
      // width 는 세계 단위 두께 — WebGL 선 굵기는 1px 이 한계라 변마다 얇은 띠 메시를 깐다.
      // 긴 변은 잘게 나누어 지형을 따라가게 한다 (원의 64 분할과 같은 뜻).
      const half = Math.max(0.05, zone.edge.width * 0.08);
      const positions: number[] = [];
      const indices: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i]!;
        const b = points[(i + 1) % points.length]!;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        if (len < 1e-6) continue;
        const nx = (-dz / len) * half;
        const nz = (dx / len) * half;
        const steps = Math.max(1, Math.ceil(len / ZONE_EDGE_STEP));
        const base = positions.length / 3;
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          const x = a.x + dx * t;
          const z = a.z + dz * t;
          positions.push(x - nx, 0, z - nz, x + nx, 0, z + nz);
        }
        for (let k = 0; k < steps; k++) {
          const o = base + k * 2;
          indices.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      drapeOnTerrain(geometry, 0, 0);
      const mesh = new THREE.Mesh(geometry, zoneMaterial(zone.edge.color, zone.edge.opacity * pulse));
      mesh.renderOrder = 2;
      zoneGroup.add(mesh);
    }

    if (zone.label) {
      let sx = 0;
      let sz = 0;
      for (const p of points) {
        sx += p.x;
        sz += p.z;
      }
      const cx = sx / points.length;
      const cz = sz / points.length;
      const sprite = zoneLabelSprite(zone.label, zone.edge?.color ?? zone.fill?.color ?? 0xffffff);
      sprite.position.set(cx, labelHeightAt(cx, cz, heightAt(cx, cz) + 1.2), cz);
      sprite.renderOrder = 3;
      zoneGroup.add(sprite);
    }
  }

  function drawCircleZone(
    zone: SceneGroundZone,
    center: { x: number; z: number },
    radius: number,
    pulse: number,
  ): void {
    {
      if (zone.fill) {
        // 폴리곤과 같은 길로 — 원판도 안쪽까지 나뉘어야 지면에 붙는다 (세계 좌표 기하다)
        const disc = zoneFillGeometry(zone.id, { kind: 'circle', center, radius });
        const mesh = new THREE.Mesh(
          disc,
          new THREE.MeshBasicMaterial({
            color: zone.fill.color,
            transparent: true,
            opacity: Math.min(1, zone.fill.opacity * pulse),
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        mesh.renderOrder = 1;
        zoneGroup.add(mesh);
      }

      if (zone.edge) {
        // width 는 세계 단위 두께로 읽는다 — 화면 픽셀이 아니라 땅 위의 띠다.
        const thickness = Math.max(0.1, zone.edge.width * 0.16);
        const ring = new THREE.RingGeometry(
          Math.max(0.01, radius - thickness),
          radius,
          ZONE_SEGMENTS,
        );
        ring.rotateX(-Math.PI / 2);
        drapeOnTerrain(ring, center.x, center.z);
        const mesh = new THREE.Mesh(
          ring,
          new THREE.MeshBasicMaterial({
            color: zone.edge.color,
            transparent: true,
            opacity: Math.min(1, zone.edge.opacity * pulse),
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        mesh.position.set(center.x, 0, center.z);
        mesh.renderOrder = 2;
        zoneGroup.add(mesh);
      }

      if (zone.label) {
        const sprite = zoneLabelSprite(zone.label, zone.edge?.color ?? zone.fill?.color ?? 0xffffff);
        sprite.position.set(
          center.x,
          labelHeightAt(center.x, center.z, heightAt(center.x, center.z) + 1.2),
          center.z,
        );
        sprite.renderOrder = 3;
        zoneGroup.add(sprite);
      }
    }
  }

  function drawDebug(debug: NonNullable<SceneState['colliderDebug']>): void {
    for (const capsule of debug.capsules) {
      // CapsuleGeometry 의 length 는 원통 구간 — 전체 높이 = length + 2×radius
      const length = Math.max(0.01, capsule.height - 2 * capsule.radius);
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(capsule.radius, length, 4, 10),
        debugMaterial(capsule.color, capsule.opacity),
      );
      const y = heightAt(capsule.center.x, capsule.center.z);
      mesh.position.set(capsule.center.x, y + DEBUG_Y + capsule.height / 2, capsule.center.z);
      debugGroup.add(mesh);
    }

    for (const sphere of debug.spheres) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(sphere.radius, 12, 8),
        debugMaterial(sphere.color, sphere.opacity),
      );
      const y = heightAt(sphere.center.x, sphere.center.z);
      mesh.position.set(sphere.center.x, y + sphere.elevation, sphere.center.z);
      debugGroup.add(mesh);
    }

    for (const vector of debug.vectors) {
      const from = new THREE.Vector3(
        vector.from.x,
        heightAt(vector.from.x, vector.from.z) + DEBUG_Y,
        vector.from.z,
      );
      const to = new THREE.Vector3(
        vector.to.x,
        heightAt(vector.to.x, vector.to.z) + DEBUG_Y,
        vector.to.z,
      );
      // 화살촉 — 끝점에서 양옆으로 꺾인 짧은 두 선
      const dir = to.clone().sub(from);
      const len = dir.length();
      const headLen = Math.min(0.3, len * 0.4);
      const points = [from, to];
      if (len > 1e-6 && headLen > 1e-6) {
        dir.normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(headLen * 0.5);
        const back = to.clone().sub(dir.clone().multiplyScalar(headLen));
        points.push(back.clone().add(side), to.clone(), back.clone().sub(side));
      }
      debugGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({ color: vector.color }),
        ),
      );
    }
  }

  let lastTime = performance.now();

  // 관찰 결과는 세계의 Tick 주기로 띄엄띄엄 도착한다. 받은 위치로 곧장
  // 튀지 않고 부드럽게 따라간다 — 순수 표현 능력이며 세계 상태를 바꾸지 않는다.
  const SMOOTHING = 18;
  const drawn = new Map<string, { x: number; z: number }>();

  function smoothed(id: string, target: { x: number; z: number }, dt: number) {
    const current = drawn.get(id);
    if (!current) {
      const fresh = { x: target.x, z: target.z };
      drawn.set(id, fresh);
      return fresh;
    }
    const k = 1 - Math.exp(-SMOOTHING * Math.max(dt, 0));
    current.x += (target.x - current.x) * k;
    current.z += (target.z - current.z) * k;
    return current;
  }

  return {
    domElement: renderer.domElement,

    setTerrain(terrain, palette) {
      disposeGround();
      terrainVersion++; // 이미 접어 둔 채움은 다른 지면의 것이다
      ground = createTerrain(terrain.view, palette);
      scene.add(ground);
      heightAt = terrainHeightSampler(terrain.world);
    },

    turnView(dTurn, dTilt) {
      view.turn(dTurn, dTilt);
    },
    viewTurn() {
      return view.orientation().turn;
    },
    viewWorldDirection(local) {
      return view.worldDirection(local);
    },

    render(state, frameDt) {
      const now = performance.now();
      const dt = frameDt ?? (now - lastTime) / 1000;
      lastTime = now;

      const seen = new Set<string>();
      for (const entity of state.entities) {
        seen.add(entity.id);

        let bb = billboards.get(entity.id);
        if (!bb) {
          bb = createBillboard(entity, now / 1000);
          bb.object.userData.entityId = entity.id;
          billboards.set(entity.id, bb);
          scene.add(bb.object);
        }
        // 크기와 발 기준점은 billboard 가 프레임 기하에서 스스로 정한다 —
        // 시트마다 캐릭터가 칸을 채우는 비율이 달라서 바깥에서 한 값으로 줄 수 없다.
        bb.setAppearance(entity, now / 1000);
        const at = smoothed(entity.id, entity.position, dt);
        const y = heightAt(at.x, at.z);
        bb.setPosition(at.x, y, at.z);

        if (entity.trail) {
          const trail = trailFor(entity.id);
          trail.accum += dt;
          if (trail.accum > 0.12) {
            trail.accum = 0;
            const p = new THREE.Vector3(at.x, y + 0.12, at.z);
            const last = trail.points[trail.points.length - 1];
            if (!last || last.distanceTo(p) > 0.25) {
              trail.points.push(p);
              if (trail.points.length > TRAIL_MAX) trail.points.shift();
              trail.geometry.setFromPoints(trail.points);
            }
          }
        }

        if (entity.cameraFollow) {
          view.follow(at, y, heightAt);
        }
      }

      // 지시에서 사라진 entity 는 화면에서도 제거
      for (const [id, bb] of billboards) {
        if (!seen.has(id)) {
          scene.remove(bb.object);
          billboards.delete(id);
          drawn.delete(id);
        }
      }

      // 지면 구역 — 지시가 오는 그대로 갈아 끼운다. 비면 아무것도 그리지 않는다.
      clearZoneGroup();
      if (state.zones?.length) drawZones(state.zones, state.worldTime);

      // 디버그 도형 — 지시가 있으면 그 프레임의 도형으로 갈아 끼운다
      clearDebugGroup();
      if (state.colliderDebug) drawDebug(state.colliderDebug);

      renderer.render(scene, camera);

      // 이펙트 (F1) — 세계를 그린 위에 겹친다.
      // 이 층은 이것이 타격인지 채굴인지 모른다. 지시가 온 자리에서 게놈을 켤 뿐이다.
      if (effectLayer.live()) {
        for (const effect of state.effects) {
          if (firedEffects.has(effect.id)) continue;
          firedEffects.add(effect.id);
          effectLayer.trigger({
            name: effect.effect,
            origin: {
              x: effect.position.x,
              y: heightAt(effect.position.x, effect.position.z) + effect.elevation,
              z: effect.position.z,
            },
            ...(effect.direction ? { dir: effect.direction } : {}),
            strength: effect.strength,
            ...(effect.roll === undefined ? {} : { roll: effect.roll }),
            ...(effect.radius === undefined ? {} : { radius: effect.radius }),
            ...(effect.scale === undefined ? {} : { scale: effect.scale }),
          });
        }
        if (firedEffects.size > FIRED_MEMORY) {
          const drop = firedEffects.size - FIRED_MEMORY / 2;
          let n = 0;
          for (const id of firedEffects) {
            if (n++ >= drop) break;
            firedEffects.delete(id);
          }
        }
        // 시뮬 격자는 따라가는 몸 둘레에 둔다 — 이펙트가 늘 그 근처에서 태어난다
        const followed = state.entities.find((e) => e.cameraFollow);
        const at = followed ? (drawn.get(followed.id) ?? followed.position) : undefined;
        effectLayer.render(
          {
            view: camera.matrixWorldInverse.elements,
            fovY: (camera.fov * Math.PI) / 180,
            near: camera.near,
            far: camera.far,
            ...(at ? { focus: { x: at.x, y: heightAt(at.x, at.z) + 1, z: at.z } } : {}),
          },
          dt,
        );
      }
    },

    pickGround(clientX, clientY) {
      raycaster.setFromCamera(toNdc(clientX, clientY), camera);
      if (ground) {
        const hit = raycaster.intersectObject(ground, true)[0];
        return hit ? { x: hit.point.x, z: hit.point.z } : null;
      }
      const at = raycaster.ray.intersectPlane(flatGround, new THREE.Vector3());
      return at ? { x: at.x, z: at.z } : null;
    },

    pickEntity(clientX, clientY) {
      raycaster.setFromCamera(toNdc(clientX, clientY), camera);
      const objects = [...billboards.values()].map((b) => b.object);
      const hit = raycaster.intersectObjects(objects, false)[0];
      return hit ? ((hit.object.userData.entityId as string) ?? null) : null;
    },

    drawnPosition(entityId) {
      const at = drawn.get(entityId);
      return at ? { x: at.x, z: at.z } : null;
    },

    worldToScreen(x, z, yOffset) {
      const v = new THREE.Vector3(x, heightAt(x, z) + yOffset, z).project(camera);
      if (v.z > 1) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      return { x: ((v.x + 1) / 2) * rect.width, y: ((1 - v.y) / 2) * rect.height };
    },
  };
}
