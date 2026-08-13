// Renderer — Scene State 를 three.js 로 그린다 (Render Capability 엔진).
// sprite billboard · terrain · trail · camera follow 능력을 제공할 뿐,
// 어떤 entity 를 어떻게 그릴지는 Scene State(= World 의 표현 지시)가 정한다.

import * as THREE from 'three';
import { createCamera, followPlayer } from '../camera/camera';
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
  domElement: HTMLCanvasElement;
}

export function createRenderer(container: HTMLElement): GameRenderer {
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

  const camera = createCamera(container.clientWidth / container.clientHeight);
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

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

    render(state, frameDt) {
      const now = performance.now();
      const dt = frameDt ?? (now - lastTime) / 1000;
      lastTime = now;

      const seen = new Set<string>();
      for (const entity of state.entities) {
        seen.add(entity.id);

        let bb = billboards.get(entity.id);
        if (!bb) {
          bb = createBillboard(entity, entity.size);
          bb.object.userData.entityId = entity.id;
          billboards.set(entity.id, bb);
          scene.add(bb.object);
        }
        bb.setAppearance(entity, now / 1000);
        bb.object.scale.set(entity.size * bb.aspect(), entity.size, 1);
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
          followPlayer(camera, at, y);
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

      renderer.render(scene, camera);
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

    worldToScreen(x, z, yOffset) {
      const v = new THREE.Vector3(x, heightAt(x, z) + yOffset, z).project(camera);
      if (v.z > 1) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      return { x: ((v.x + 1) / 2) * rect.width, y: ((1 - v.y) / 2) * rect.height };
    },
  };
}
