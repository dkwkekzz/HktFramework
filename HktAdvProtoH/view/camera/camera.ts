// Camera — View 의 책임. 지평선이 보이는 낮은 각도의 팔로우 카메라.

import * as THREE from 'three';

const OFFSET = new THREE.Vector3(0, 7.5, 13);
const LOOK_AHEAD_Y = 2.0; // 시선을 살짝 위로 — 지평선·하늘이 화면에 들어온다

export function createCamera(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 300);
  camera.position.copy(OFFSET);
  camera.lookAt(0, LOOK_AHEAD_Y, 0);
  return camera;
}

/** 관찰 초점(Snapshot 의 focus 존재)을 따라간다 — 그 존재가 무엇인지는 알지 못한다 */
export function followFocus(
  camera: THREE.PerspectiveCamera,
  focus: { x: number; z: number },
  groundY: number,
): void {
  camera.position.set(focus.x + OFFSET.x, groundY + OFFSET.y, focus.z + OFFSET.z);
  camera.lookAt(focus.x, groundY + LOOK_AHEAD_Y, focus.z);
}
