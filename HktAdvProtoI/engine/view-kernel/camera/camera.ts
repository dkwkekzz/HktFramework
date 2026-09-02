// Camera — View 의 책임. 몸을 두고 그 주위를 도는 시점.
//
// 방향은 관찰자의 것이며 세계로 나가지 않는다 (04 viewpoint.worldKnows: false).
// 각 계산은 전부 orientation.ts 에 있고, 여기는 그 결과를 three 카메라에 얹을 뿐이다.

import * as THREE from 'three';
import {
  DEFAULT_ORIENTATION,
  turned,
  viewOffset,
  worldDirection,
  type PlaneDirection,
  type ViewOrientation,
} from './orientation';

const LOOK_AHEAD_Y = 2.0; // 시선을 살짝 위로 — 지평선·하늘이 화면에 들어온다

/** 지형을 뚫지 않도록 시점이 지면 위로 유지하는 최소 높이 (04 viewpoint.constraint) */
export const TERRAIN_CLEARANCE = 1.2;

export interface ViewCamera {
  camera: THREE.PerspectiveCamera;
  /** 지금 방향에서 그만큼 더 돌린다 — 절대 각으로 건너뛰지 않는다 */
  turn(dTurn: number, dTilt: number): void;
  orientation(): ViewOrientation;
  /** 관찰자 기준 입력 → 세계 방향 */
  worldDirection(local: PlaneDirection): PlaneDirection;
  /**
   * 몸을 따라간다. groundHeight 는 그 자리의 지면 높이,
   * terrainHeight 는 임의 지점의 지면 높이를 되돌려 주는 함수다 —
   * 시점이 지형 아래로 내려가지 않게 하는 데 쓴다.
   */
  follow(
    player: { x: number; z: number },
    groundHeight: number,
    terrainHeight: (x: number, z: number) => number,
  ): void;
}

export function createViewCamera(aspect: number): ViewCamera {
  const camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 300);
  let orientation: ViewOrientation = { ...DEFAULT_ORIENTATION };

  const view: ViewCamera = {
    camera,
    turn(dTurn, dTilt) {
      orientation = turned(orientation, dTurn, dTilt);
    },
    orientation() {
      return orientation;
    },
    worldDirection(local) {
      return worldDirection(orientation.turn, local);
    },
    follow(player, groundHeight, terrainHeight) {
      const offset = viewOffset(orientation);
      const x = player.x + offset.x;
      const z = player.z + offset.z;
      // 어느 각으로 돌려도 땅속에서 세계를 보지 않는다 — 지면 위로 밀어 올린다.
      const y = Math.max(groundHeight + offset.y, terrainHeight(x, z) + TERRAIN_CLEARANCE);
      camera.position.set(x, y, z);
      camera.lookAt(player.x, groundHeight + LOOK_AHEAD_Y, player.z);
    },
  };

  // 아직 아무 몸도 받지 못한 첫 프레임의 자리 — 원점을 본다.
  view.follow({ x: 0, z: 0 }, 0, () => 0);
  return view;
}
