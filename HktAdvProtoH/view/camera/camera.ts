// Camera — View 의 책임. 플레이어를 따라가는 쿼터뷰 고정 오프셋.

import * as THREE from 'three';

const OFFSET = new THREE.Vector3(0, 14, 12);

export function createCamera(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
  camera.position.copy(OFFSET);
  camera.lookAt(0, 0, 0);
  return camera;
}

export function followPlayer(camera: THREE.PerspectiveCamera, player: { x: number; z: number }): void {
  camera.position.set(player.x + OFFSET.x, OFFSET.y, player.z + OFFSET.z);
  camera.lookAt(player.x, 0, player.z);
}
