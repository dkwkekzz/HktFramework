// ============================================================================
// Sim — 로컬 세부 시뮬레이터 (설계 문서 §3)
//
// 이동은 서버가 시뮬레이션하지 않는다. 클라이언트가 프레임레이트로 적분하고,
// 저빈도 양자화 비콘만 올린다. 서버는 비콘 간 거리를 에너지 예산으로 검증할 뿐.
// ============================================================================

import { MSG } from '../shared/protocol.js';
import { WORLD_SIZE, WORLD_HEIGHT, SPAWN_POS, MAX_SPEED, BEACON_INTERVAL_MS } from '../shared/constants.js';

// 검증 예산(MAX_SPEED) 아래에서 달린다 — 지터로 인한 오탐 방지 여유
const RUN_SPEED = MAX_SPEED * 0.85;

export class Sim {
  constructor(net, state) {
    this.net = net;
    this.state = state;
    this.x = WORLD_SIZE / 2;
    this.y = WORLD_SIZE / 2;
    this.z = SPAWN_POS.z; // 3D — 높이 (R/F 로 상승·하강)
    this.keys = new Set();
    this.lastBeacon = 0;
    // 카메라 yaw 제공자 — main.js 가 render 와 결선(카메라 상대 이동). 기본은 render 초기 yaw.
    this.getYaw = () => -Math.PI * 0.75;

    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    state.onTeleport = ({ x, y, z }) => { this.x = x; this.y = y; this.z = z ?? this.z; }; // 서버 정정 즉시 수용
  }

  update(dt, nowMs) {
    // 카메라 상대 이동: W=화면 안쪽(카메라가 보는 방향)·S=앞으로 당김·D=오른쪽·A=왼쪽.
    // 카메라를 회전(드래그)해도 늘 "보는 대로" 움직인다. 이동 축은 카메라 yaw 를 따른다.
    const fwd = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0)
              - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const strafe = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0)
                 - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const yaw = this.getYaw();
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    // 지면 기저: 전방(카메라가 보는 쪽)=(cos,sin), 우측(화면 오른쪽)=(sin,-cos) — render 카메라와 정합
    let dx = fwd * cy + strafe * sy;
    let dy = fwd * sy + strafe * -cy;
    let dz = (this.keys.has('KeyR') ? 1 : 0) - (this.keys.has('KeyF') ? 1 : 0); // 상승/하강(월드 수직)
    if (dx || dy || dz) {
      const len = Math.hypot(dx, dy, dz);
      this.x = Math.max(0, Math.min(WORLD_SIZE, this.x + (dx / len) * RUN_SPEED * dt));
      this.y = Math.max(0, Math.min(WORLD_SIZE, this.y + (dy / len) * RUN_SPEED * dt));
      this.z = Math.max(0, Math.min(WORLD_HEIGHT, this.z + (dz / len) * RUN_SPEED * dt));
    }
    if (nowMs - this.lastBeacon >= BEACON_INTERVAL_MS && this.net.connected) {
      this.lastBeacon = nowMs;
      this.net.send(MSG.BEACON, { x: Math.round(this.x), y: Math.round(this.y), z: Math.round(this.z) });
    }
    // 원격 엔티티 표시 보간 (비콘 5Hz → 화면 60fps)
    for (const e of this.state.entities.values()) {
      if (e.kind === 'player') {
        const k = Math.min(1, dt * 8);
        e.x += (e.tx - e.x) * k;
        e.y += (e.ty - e.y) * k;
        e.z += (e.tz - e.z) * k;
      }
    }
  }
}
