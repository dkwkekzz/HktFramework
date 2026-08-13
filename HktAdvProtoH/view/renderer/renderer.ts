// Renderer — Scene State 를 three.js 로 그린다 (범용 엔진).
// entity 배열을 순회하며 Role Registry 특성대로 그릴 뿐, 특정 role 을 알지 못한다.
// 게임 의미 판정은 하지 않는다.

import * as THREE from 'three';
import { createCamera, followPlayer } from '../camera/camera';
import { roleTraits } from '../engine/role-registry';
import type { SceneState } from '../scene/scene-state';
import { createBillboard, type Billboard } from '../sprites/billboard';
import { createTerrain, heightAt } from '../terrain/terrain';

export interface GameRenderer {
  render(state: SceneState): void;
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

  // 이동 자취 — trail 특성을 가진 entity 별로 유지한다
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

  return {
    domElement: renderer.domElement,

    render(state) {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const seen = new Set<string>();
      for (const entity of state.entities) {
        seen.add(entity.id);
        const traits = roleTraits(entity.role);

        let bb = billboards.get(entity.id);
        if (!bb) {
          bb = createBillboard(entity.spriteId, traits.scale);
          bb.object.userData.entityId = entity.id;
          billboards.set(entity.id, bb);
          scene.add(bb.object);
        }
        bb.setSprite(entity.spriteId);
        const y = heightAt(entity.position.x, entity.position.z);
        bb.setPosition(entity.position.x, y, entity.position.z);

        if (traits.trail) {
          const trail = trailFor(entity.id);
          trail.accum += dt;
          if (trail.accum > 0.12) {
            trail.accum = 0;
            const p = new THREE.Vector3(entity.position.x, y + 0.12, entity.position.z);
            const last = trail.points[trail.points.length - 1];
            if (!last || last.distanceTo(p) > 0.25) {
              trail.points.push(p);
              if (trail.points.length > TRAIL_MAX) trail.points.shift();
              trail.geometry.setFromPoints(trail.points);
            }
          }
        }

        if (traits.cameraFollow) {
          followPlayer(camera, entity.position, y);
        }
      }

      // Snapshot 에서 사라진 entity 는 화면에서도 제거한다
      for (const [id, bb] of billboards) {
        if (!seen.has(id)) {
          scene.remove(bb.object);
          billboards.delete(id);
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
