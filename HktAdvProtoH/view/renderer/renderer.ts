// Renderer — Scene State 를 three.js 로 그린다. 게임 의미 판정은 하지 않는다.

import * as THREE from 'three';
import { createCamera, followPlayer } from '../camera/camera';
import type { SceneState } from '../scene/scene-state';
import { createBillboard, type Billboard } from '../sprites/billboard';
import { createTerrain } from '../terrain/terrain';

export interface GameRenderer {
  render(state: SceneState): void;
  /** 화면 좌표 → 지형 위 지점 (없으면 null) */
  pickGround(clientX: number, clientY: number): { x: number; z: number } | null;
  /** 화면 좌표가 deposit 스프라이트 위인가 */
  pickDeposit(clientX: number, clientY: number): boolean;
  domElement: HTMLCanvasElement;
}

export function createRenderer(container: HTMLElement): GameRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc4e0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const sun = new THREE.DirectionalLight(0xfff4d6, 1.2);
  sun.position.set(10, 20, 5);
  scene.add(sun);

  const terrain = createTerrain();
  scene.add(terrain);
  const ground = terrain.getObjectByName('terrain-ground') as THREE.Mesh;

  const camera = createCamera(container.clientWidth / container.clientHeight);
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  const billboards = new Map<string, Billboard>();
  const raycaster = new THREE.Raycaster();

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

  return {
    domElement: renderer.domElement,

    render(state) {
      for (const entity of state.entities) {
        const scale = entity.key === 'player' ? 2.2 : 3.0;
        const bb = billboardFor(entity.key, entity.spriteId, scale);
        bb.setSprite(entity.spriteId);
        bb.setPosition(entity.position.x, entity.position.z);
      }
      const player = state.entities.find((e) => e.key === 'player');
      if (player) followPlayer(camera, player.position);
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
  };
}
