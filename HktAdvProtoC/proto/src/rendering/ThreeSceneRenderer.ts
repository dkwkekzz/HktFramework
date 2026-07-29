// three.js 3D 장면 렌더러 (기획서 §13, §37 / Phase-8 §8.0)
//
// Canvas 2D·텍스트 렌더러와 **완전히 같은 SceneViewModel 을 소비하는** 세 번째 표현이다.
// 공간 데이터는 처음부터 3D 였고(§13 — 규칙·거리·관찰은 전부 3D 계산), 빌더가 실어 준
// elevation/elevationShade 를 이 렌더러는 높이로 되살린다 — 빌더·코어에는 diff 가 없다(§8.0 격리 증명).
//
// 이 파일의 프로젝트 내부 import 는 SceneViewModel 뿐이다. three 는 외부 표현 라이브러리로,
// 시뮬레이션 타입을 실어 나를 수 없으므로 격리를 깨지 않는다(phase8Checks.checkRendererImports).
import * as THREE from "three";
import type { SceneMap, SceneMapMarker, SceneViewModel } from "../viewmodel/SceneViewModel";
import { channelStyleOf, colorOf } from "./palette";

/** 월드 좌표 크기 — 정규화 0~1 을 이 폭으로 편다 (2D 캔버스 960×540 과 같은 종횡비) */
const WORLD_X = 96;
const WORLD_Z = 54;
/** 고도 스케일 — elevationShade 1 이 이 높이만큼 떠오른다 */
const HEIGHT = 10;
/** 지역 판 두께 */
const PLATE_H = 0.7;
/** 마커 기본 크기(월드 단위) — marker.size(0~1)에 곱한다 */
const MARKER_SCALE = 130;

function toWorld(point: { x: number; y: number }): { x: number; z: number } {
  return { x: point.x * WORLD_X, z: point.y * WORLD_Z };
}

/** 라벨 스프라이트 텍스처 — 같은 문구는 캐시로 재사용한다 */
class LabelSprites {
  private readonly cache = new Map<string, THREE.SpriteMaterial>();

  make(text: string, color: string, px: number): THREE.Sprite {
    const key = `${text}|${color}|${px}`;
    let material = this.cache.get(key);
    if (material === undefined) {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      const font = `${px * 2}px ui-monospace, monospace`;
      if (context !== null) {
        context.font = font;
        canvas.width = Math.ceil(context.measureText(text).width) + 10;
        canvas.height = px * 2 + 10;
        // 반투명 배경판 — 겹치는 장면 위에서도 글자가 읽힌다
        context.fillStyle = "rgba(11, 15, 22, 0.72)";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.font = font;
        context.fillStyle = color;
        context.textBaseline = "middle";
        context.fillText(text, 5, canvas.height / 2);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
      this.cache.set(key, material);
    }
    const sprite = new THREE.Sprite(material);
    const image = material.map?.image as { width: number; height: number } | undefined;
    const aspect = image === undefined ? 4 : image.width / image.height;
    const h = px * 0.19;
    sprite.scale.set(h * aspect, h, 1);
    return sprite;
  }
}

/** shapeKey → 메시 생성. 항목 추가가 곧 새 외형 추가다 — 2D 의 SHAPES 표와 같은 자리(§8.3) */
function meshOf(marker: SceneMapMarker, size: number, material: THREE.Material): THREE.Object3D {
  switch (marker.shapeKey) {
    case "shape-crystal": {
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(size), material);
      mesh.scale.y = 1.5;
      return mesh;
    }
    case "shape-pyramid":
      return new THREE.Mesh(new THREE.ConeGeometry(size, size * 2, 4), material);
    case "shape-cube":
      return new THREE.Mesh(new THREE.BoxGeometry(size * 1.4, size * 1.1, size * 1.4), material);
    case "shape-banner": {
      const group = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.08, size * 0.08, size * 2.6), material);
      pole.position.y = size * 0.3;
      const flag = new THREE.Mesh(new THREE.ConeGeometry(size * 0.55, size * 1.1, 3), material);
      flag.rotation.z = -Math.PI / 2;
      flag.position.set(size * 0.55, size * 1.2, 0);
      group.add(pole, flag);
      return group;
    }
    default:
      return new THREE.Mesh(new THREE.SphereGeometry(size, 20, 14), material);
  }
}

export class ThreeSceneRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  /** 장면마다 갈아 끼우는 층 — 지역·개체·사건 전부 여기 아래에 산다 */
  private readonly worldGroup = new THREE.Group();
  private readonly labels = new LabelSprites();
  private readonly materials = new Map<string, THREE.MeshLambertMaterial>();
  private readonly disposables: { dispose(): void }[] = [];
  // 궤도 카메라 — 드래그 회전·휠 줌 (표현의 조작이므로 여기 산다)
  private azimuth = -0.4;
  private polar = 0.78;
  private distance = 82;
  private running = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(canvas.width, canvas.height, false);
    this.camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 500);
    this.scene.background = new THREE.Color(colorOf("map-bg"));
    this.scene.add(this.worldGroup);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(40, 70, 20);
    this.scene.add(ambient, sun);

    this.bindControls();
    this.updateCamera();
  }

  /** RAF 루프 시작/중지 — 탭이 3D 일 때만 돈다 */
  start(): void {
    if (this.running) return;
    this.running = true;
    const tick = (): void => {
      if (!this.running) return;
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
  }

  /** SceneViewModel 하나로 장면 전체를 다시 짓는다 — 시뮬 진행(버튼 단위)마다 한 번 */
  render(scene: SceneViewModel): void {
    this.clearWorld();
    this.buildRegions(scene.map);
    this.buildConnections(scene.map);
    this.buildMarkers(scene.map);
    this.buildOverlays(scene.map);
    this.buildSignals(scene.map);
    this.renderer.render(this.scene, this.camera);
  }

  // --- 장면 구축 -----------------------------------------------------------------------

  private materialOf(colorKey: string, opacity = 1): THREE.MeshLambertMaterial {
    const key = `${colorKey}|${opacity}`;
    let material = this.materials.get(key);
    if (material === undefined) {
      material = new THREE.MeshLambertMaterial({ color: colorOf(colorKey) });
      if (opacity < 1) {
        material.transparent = true;
        material.opacity = opacity;
      }
      this.materials.set(key, material);
    }
    return material;
  }

  private clearWorld(): void {
    for (const entry of this.disposables) entry.dispose();
    this.disposables.length = 0;
    this.worldGroup.clear();
  }

  private track<T extends { dispose(): void }>(resource: T): T {
    this.disposables.push(resource);
    return resource;
  }

  private buildRegions(map: SceneMap): void {
    for (const region of map.regions) {
      const w = region.rect.w * WORLD_X;
      const d = region.rect.h * WORLD_Z;
      const h = PLATE_H + region.elevationShade * 1.6;
      const geometry = this.track(new THREE.BoxGeometry(w, h, d));
      const plate = new THREE.Mesh(geometry, this.materialOf(region.climateKey));
      const center = toWorld({ x: region.rect.x + region.rect.w / 2, y: region.rect.y + region.rect.h / 2 });
      plate.position.set(center.x, h / 2, center.z);
      this.worldGroup.add(plate);

      // 위험도는 판의 테두리 선 — 2D 와 같은 시각 언어(§36.2)
      const edges = this.track(new THREE.EdgesGeometry(geometry));
      const line = new THREE.LineSegments(
        edges,
        this.track(new THREE.LineBasicMaterial({ color: colorOf(region.dangerKey) })),
      );
      line.position.copy(plate.position);
      this.worldGroup.add(line);

      const label = this.labels.make(region.label, colorOf("label"), 13);
      label.position.set(center.x - w / 2 + 4, h + 2.4, center.z - d / 2 + 2);
      this.worldGroup.add(label);
    }
  }

  private regionTop(map: SceneMap, regionId: string): number {
    const region = map.regions.find((entry) => entry.id === regionId);
    return region === undefined ? PLATE_H : PLATE_H + region.elevationShade * 1.6;
  }

  private buildConnections(map: SceneMap): void {
    for (const connection of map.connections) {
      const from = toWorld(connection.fromPoint);
      const to = toWorld(connection.toPoint);
      const geometry = this.track(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(from.x, PLATE_H + 0.2, from.z),
          new THREE.Vector3(to.x, PLATE_H + 0.2, to.z),
        ]),
      );
      const line = new THREE.Line(
        geometry,
        this.track(
          new THREE.LineDashedMaterial({ color: colorOf(connection.dangerKey), dashSize: 1.2, gapSize: 0.8 }),
        ),
      );
      line.computeLineDistances();
      this.worldGroup.add(line);
    }
  }

  private buildMarkers(map: SceneMap): void {
    const groups: { markers: SceneMapMarker[]; opacity: number }[] = [
      { markers: map.factions, opacity: 0.8 },
      { markers: map.places, opacity: 0.85 },
      { markers: map.resources, opacity: 0.95 },
      { markers: map.markers, opacity: 1 },
    ];
    // 같은 자리에 몰린 개체의 라벨은 계단식으로 — 3D 판의 라벨 충돌 회피 (주체가 먼저 낮은 층을 차지한다)
    const labelStacks = new Map<string, number>();
    for (const group of groups) {
      for (const marker of group.markers) this.buildMarker(map, marker, group.opacity, labelStacks);
    }
  }

  private buildMarker(
    map: SceneMap,
    marker: SceneMapMarker,
    opacity: number,
    labelStacks: Map<string, number>,
  ): void {
    const at = toWorld(marker.point);
    const size = marker.size * MARKER_SCALE * 0.55;
    // 고도 — 빌더가 실어 준 z 의 정규화 값이 실제 높이로 되살아난다 (§13)
    const y = this.regionTop(map, marker.regionId) + marker.elevationShade * HEIGHT + size;

    const body = meshOf(marker, size, this.materialOf(marker.colorKey, opacity));
    body.position.set(at.x, y, at.z);
    this.worldGroup.add(body);

    // 접지 그림자 — 발밑 어두운 원반. 높이 감을 읽게 한다
    const shadow = new THREE.Mesh(
      this.track(new THREE.CircleGeometry(size * 0.9, 16)),
      this.track(
        new THREE.MeshBasicMaterial({ color: colorOf("marker-shadow"), transparent: true, opacity: 0.4 }),
      ),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(at.x, this.regionTop(map, marker.regionId) + 0.05, at.z);
    this.worldGroup.add(shadow);
    // 그림자~몸통 연결 기둥 — 공중에 뜬 개체가 어느 발밑에 속하는지 보여준다
    if (marker.elevationShade > 0.02) {
      const stem = new THREE.Line(
        this.track(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(at.x, shadow.position.y, at.z),
            new THREE.Vector3(at.x, y - size, at.z),
          ]),
        ),
        this.track(new THREE.LineBasicMaterial({ color: colorOf("label-dim"), transparent: true, opacity: 0.5 })),
      );
      this.worldGroup.add(stem);
    }

    // 강조 링 — 조작 중인 주체 (§31)
    if (marker.emphasized === true) {
      const ring = new THREE.Mesh(
        this.track(new THREE.TorusGeometry(size * 1.6, size * 0.08, 8, 32)),
        this.materialOf("marker-highlight"),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(at.x, y, at.z);
      this.worldGroup.add(ring);
    }

    // 상태 게이지 — 머리 위 바 (수치 해석은 빌더가 끝냈다)
    if (marker.gauge !== undefined) {
      const barW = size * 2.4;
      const back = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(barW, 0.25, 0.25)),
        this.materialOf("gauge-back"),
      );
      back.position.set(at.x, y + size * 1.9, at.z);
      const fill = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(Math.max(0.01, barW * marker.gauge.value), 0.3, 0.3)),
        this.materialOf(marker.gauge.colorKey),
      );
      fill.position.set(at.x - (barW - barW * marker.gauge.value) / 2, y + size * 1.9, at.z);
      this.worldGroup.add(back, fill);
    }

    const stackKey = `${Math.round(at.x / 6)}|${Math.round(at.z / 6)}`;
    const stack = labelStacks.get(stackKey) ?? 0;
    labelStacks.set(stackKey, stack + 1);
    const label = this.labels.make(marker.label, colorOf("label"), 11);
    label.position.set(at.x, y + size * 2.6 + stack * 2.3, at.z);
    this.worldGroup.add(label);
  }

  private buildOverlays(map: SceneMap): void {
    // 같은 자리에 몰린 사건 라벨은 계단식으로 쌓는다 — 3D 판에서의 라벨 충돌 회피
    let stack = 0;
    for (const overlay of map.overlays) {
      const at = toWorld(overlay.point);
      const radius = overlay.radius * Math.min(WORLD_X, WORLD_Z);
      const y = PLATE_H + 0.15;
      const disc = new THREE.Mesh(
        this.track(new THREE.CircleGeometry(radius, 40)),
        this.track(
          new THREE.MeshBasicMaterial({
            color: colorOf(overlay.colorKey),
            transparent: true,
            opacity: 0.08 + overlay.intensity * 0.14,
          }),
        ),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(at.x, y, at.z);
      const rim = new THREE.Mesh(
        this.track(new THREE.RingGeometry(radius * 0.94, radius, 40)),
        this.track(
          new THREE.MeshBasicMaterial({
            color: colorOf(overlay.colorKey),
            transparent: true,
            opacity: overlay.ongoing ? 0.5 + overlay.urgency * 0.5 : 0.3,
          }),
        ),
      );
      rim.rotation.x = -Math.PI / 2;
      rim.position.set(at.x, y + 0.02, at.z);
      this.worldGroup.add(disc, rim);

      const label = this.labels.make(overlay.label, "#f2d38c", 11);
      label.position.set(at.x, y + 14 + stack * 2.6, at.z);
      this.worldGroup.add(label);
      stack += 1;
    }
  }

  private buildSignals(map: SceneMap): void {
    for (const signal of map.signals) {
      const style = channelStyleOf(signal.channelKey);
      const at = toWorld(signal.point);
      const intensity = Math.min(1, Math.max(0, signal.intensity));
      if (intensity <= 0) continue;
      const y = this.regionTop(map, signal.regionId) + 0.12;
      if (style.shape === "ripple") {
        for (let ring = 1; ring <= 3; ring++) {
          const r = (4.5 * intensity * ring) / 3;
          const mesh = new THREE.Mesh(
            this.track(new THREE.RingGeometry(Math.max(0.05, r - 0.12), r, 32)),
            this.track(
              new THREE.MeshBasicMaterial({
                color: style.color,
                transparent: true,
                opacity: intensity * (1 - (ring - 1) / 4),
              }),
            ),
          );
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.set(at.x, y, at.z);
          this.worldGroup.add(mesh);
        }
        continue;
      }
      // 잔광·아이콘 — 반투명 구 하나로 존재를 알린다
      const glow = new THREE.Mesh(
        this.track(new THREE.SphereGeometry(2.4 * intensity, 12, 8)),
        this.track(new THREE.MeshBasicMaterial({ color: style.color, transparent: true, opacity: 0.35 * intensity })),
      );
      glow.position.set(at.x, y + 1, at.z);
      this.worldGroup.add(glow);
    }
  }

  // --- 카메라 --------------------------------------------------------------------------

  private updateCamera(): void {
    const target = new THREE.Vector3(WORLD_X / 2, 0, WORLD_Z / 2);
    const x = target.x + this.distance * Math.sin(this.polar) * Math.sin(this.azimuth);
    const y = this.distance * Math.cos(this.polar);
    const z = target.z + this.distance * Math.sin(this.polar) * Math.cos(this.azimuth);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(target);
  }

  /** 드래그 궤도 회전 + 휠 줌 — 별도 컨트롤 라이브러리 없이 최소한만 */
  private bindControls(): void {
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    this.canvas.addEventListener("pointerdown", (event) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      this.azimuth -= (event.clientX - lastX) * 0.008;
      this.polar = Math.min(1.45, Math.max(0.25, this.polar - (event.clientY - lastY) * 0.006));
      lastX = event.clientX;
      lastY = event.clientY;
      this.updateCamera();
    });
    this.canvas.addEventListener("pointerup", () => {
      dragging = false;
    });
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.distance = Math.min(160, Math.max(25, this.distance + event.deltaY * 0.08));
      this.updateCamera();
    });
  }
}
