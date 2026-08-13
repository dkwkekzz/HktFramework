// Renderer — Scene State 를 three.js 로 그린다. 게임 의미 판정은 하지 않는다.

import * as THREE from 'three';
import { createCamera, followFocus } from '../camera/camera';
import type { SceneState } from '../scene/scene-state';
import { spriteScale } from '../assets/registry';
import { createBillboard, type Billboard } from '../sprites/billboard';
import { createTerrain, heightAt } from '../terrain/terrain';

export interface GameRenderer {
  render(state: SceneState): void;
  /** 화면 좌표 → 지형 위 지점 (없으면 null) */
  pickGround(clientX: number, clientY: number): { x: number; z: number } | null;
  /** 화면 좌표 아래에 있는 Entity 식별자 (없으면 null) — 어떤 존재든 같은 방식으로 집는다 */
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

  const billboards = new Map<string, Billboard>();
  const raycaster = new THREE.Raycaster();

  // 초점 존재의 자취 — 최근 지나간 경로를 노란 선으로 표현
  const TRAIL_MAX = 48;
  const trailPoints: THREE.Vector3[] = [];
  const trailGeometry = new THREE.BufferGeometry();
  const trailLine = new THREE.Line(
    trailGeometry,
    new THREE.LineBasicMaterial({ color: 0xe8c93e, transparent: true, opacity: 0.85 }),
  );
  scene.add(trailLine);
  let trailAccum = 0;

  function billboardFor(key: string, spriteId: string, scale: number): Billboard {
    let bb = billboards.get(key);
    if (!bb) {
      bb = createBillboard(spriteId, scale);
      billboards.set(key, bb);
      scene.add(bb.object);
    }
    return bb;
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

      const alive = new Set<string>();
      for (const entity of state.entities) {
        alive.add(entity.id);
        const bb = billboardFor(entity.id, entity.spriteId, spriteScale(entity.spriteId));
        bb.setSprite(entity.spriteId);
        const y = heightAt(entity.position.x, entity.position.z);
        bb.setPosition(entity.position.x, y, entity.position.z);
      }
      // Snapshot 에서 사라진 존재는 화면에서도 사라진다
      for (const [id, bb] of billboards) {
        if (alive.has(id)) continue;
        scene.remove(bb.object);
        billboards.delete(id);
      }

      const focus = state.entities.find((e) => e.focus);
      if (focus) {
        const py = heightAt(focus.position.x, focus.position.z);

        trailAccum += dt;
        if (trailAccum > 0.12) {
          trailAccum = 0;
          const p = new THREE.Vector3(focus.position.x, py + 0.12, focus.position.z);
          const lastP = trailPoints[trailPoints.length - 1];
          if (!lastP || lastP.distanceTo(p) > 0.25) {
            trailPoints.push(p);
            if (trailPoints.length > TRAIL_MAX) trailPoints.shift();
            trailGeometry.setFromPoints(trailPoints);
          }
        }

        followFocus(camera, focus.position, py);
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
      for (const [id, bb] of billboards) {
        if (raycaster.intersectObject(bb.object, false).length > 0) return id;
      }
      return null;
    },

    worldToScreen(x, z, yOffset) {
      const v = new THREE.Vector3(x, heightAt(x, z) + yOffset, z).project(camera);
      if (v.z > 1) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      return { x: ((v.x + 1) / 2) * rect.width, y: ((1 - v.y) / 2) * rect.height };
    },
  };
}
