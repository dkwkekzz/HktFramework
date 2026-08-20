// Renderer — Scene State 를 three.js 로 그린다 (Render Capability 엔진).
// sprite billboard · terrain · trail · camera follow 능력을 제공할 뿐,
// 어떤 entity 를 어떻게 그릴지는 Scene State(= World 의 표현 지시)가 정한다.

import * as THREE from 'three';
import { createViewCamera } from '../camera/camera';
import { createEffectLayer, type EffectLayer, type EffectLayerOptions } from '../fx/effect-layer';
import type { PlaneDirection } from '../camera/orientation';
import type { SceneState } from '../scene/scene-state';
import { createBillboard, type Billboard } from '../sprites/billboard';
import { createTerrain, heightAt } from '../terrain/terrain';

export interface GameRenderer {
  render(state: SceneState, dt?: number): void;
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
  /** 시점을 지금 방향에서 그만큼 더 돌린다 (C008) */
  turnView(dTurn: number, dTilt: number): void;
  /** 지금 시점이 수평으로 돈 각 — 몸 방향을 좌우로 읽는 기준이 된다 (C008) */
  viewTurn(): number;
  /** 관찰자 기준 입력 방향 → 세계 방향 (C008) */
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

  // 지형 capability — 현재 제공: 'field' (미지원 지시도 field 로 그려 게임을 멈추지 않는다)
  const ground = createTerrain();
  scene.add(ground);

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
  // 관찰 결과는 같은 타격을 TTL 동안 계속 실어 보낸다 (C007 strikeEvents).
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

  // 디버그 도형 capability (C006 / R1) — 캡슐/구체 부피와 화살표를 그릴 뿐,
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

  // 관찰 결과는 세계의 Tick 주기로 띄엄띄엄 도착한다 (C003). 받은 위치로 곧장
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

      // 디버그 도형 — 지시가 있으면 그 프레임의 도형으로 갈아 끼운다 (C006)
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
      const hit = raycaster.intersectObject(ground, false)[0];
      return hit ? { x: hit.point.x, z: hit.point.z } : null;
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
