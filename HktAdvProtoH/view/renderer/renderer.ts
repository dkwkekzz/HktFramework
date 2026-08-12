// Renderer — Scene State 를 three.js 로 그린다. 게임 의미 판정은 하지 않는다.

import * as THREE from 'three';
import { createCamera, followPlayer } from '../camera/camera';
import type { SceneState } from '../scene/scene-state';
import { createBillboard, type Billboard } from '../sprites/billboard';
import { createTerrain, heightAt } from '../terrain/terrain';

export interface GameRenderer {
  render(state: SceneState): void;
  /** 화면 좌표 → 지형 위 지점 (없으면 null) */
  pickGround(clientX: number, clientY: number): { x: number; z: number } | null;
  /** 화면 좌표가 deposit 스프라이트 위인가 */
  pickDeposit(clientX: number, clientY: number): boolean;
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

  // 플레이어 이동 트레일 — 최근 지나간 자취를 노란 선으로 표현
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

      for (const entity of state.entities) {
        const scale = entity.key === 'player' ? 2.6 : 3.4;
        const bb = billboardFor(entity.key, entity.spriteId, scale);
        bb.setSprite(entity.spriteId);
        const y = heightAt(entity.position.x, entity.position.z);
        bb.setPosition(entity.position.x, y, entity.position.z);
      }

      const player = state.entities.find((e) => e.key === 'player');
      if (player) {
        const py = heightAt(player.position.x, player.position.z);

        trailAccum += dt;
        if (trailAccum > 0.12) {
          trailAccum = 0;
          const p = new THREE.Vector3(player.position.x, py + 0.12, player.position.z);
          const lastP = trailPoints[trailPoints.length - 1];
          if (!lastP || lastP.distanceTo(p) > 0.25) {
            trailPoints.push(p);
            if (trailPoints.length > TRAIL_MAX) trailPoints.shift();
            trailGeometry.setFromPoints(trailPoints);
          }
        }

        followPlayer(camera, player.position, py);
      }
      renderer.render(scene, camera);
    },

    pickGround(clientX, clientY) {
      raycaster.setFromCamera(toNdc(clientX, clientY), camera);
      const hit = raycaster.intersectObject(ground, false)[0];
      return hit ? { x: hit.point.x, z: hit.point.z } : null;
    },

    pickDeposit(clientX, clientY) {
      const deposit = billboards.get('deposit');
      if (!deposit) return false;
      raycaster.setFromCamera(toNdc(clientX, clientY), camera);
      return raycaster.intersectObject(deposit.object, false).length > 0;
    },

    worldToScreen(x, z, yOffset) {
      const v = new THREE.Vector3(x, heightAt(x, z) + yOffset, z).project(camera);
      if (v.z > 1) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      return { x: ((v.x + 1) / 2) * rect.width, y: ((1 - v.y) / 2) * rect.height };
    },
  };
}
