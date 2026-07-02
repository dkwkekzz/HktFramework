// ============================================================================
// Sim — 로컬 세부 시뮬레이터 (설계 문서 §3)
//
// 이동은 서버가 시뮬레이션하지 않는다. 클라이언트가 프레임레이트로 적분하고,
// 저빈도 양자화 비콘만 올린다. 서버는 비콘 간 거리를 에너지 예산으로 검증할 뿐.
// ============================================================================

import { MSG } from '../shared/protocol.js';
import { WORLD_SIZE, MAX_SPEED, BEACON_INTERVAL_MS } from '../shared/constants.js';

// 검증 예산(MAX_SPEED) 아래에서 달린다 — 지터로 인한 오탐 방지 여유
const RUN_SPEED = MAX_SPEED * 0.85;

export class Sim {
  constructor(net, state) {
    this.net = net;
    this.state = state;
    this.x = WORLD_SIZE / 2;
    this.y = WORLD_SIZE / 2;
    this.keys = new Set();
    this.lastBeacon = 0;

    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    state.onTeleport = ({ x, y }) => { this.x = x; this.y = y; }; // 서버 정정은 즉시 수용
  }

  update(dt, nowMs) {
    if (!this.state.dead) {
      let dx = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0)
             - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
      let dy = (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0)
             - (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0);
      if (dx || dy) {
        const len = Math.hypot(dx, dy);
        this.x = Math.max(0, Math.min(WORLD_SIZE, this.x + (dx / len) * RUN_SPEED * dt));
        this.y = Math.max(0, Math.min(WORLD_SIZE, this.y + (dy / len) * RUN_SPEED * dt));
      }
    }
    if (nowMs - this.lastBeacon >= BEACON_INTERVAL_MS && this.net.connected) {
      this.lastBeacon = nowMs;
      this.net.send(MSG.BEACON, { x: Math.round(this.x), y: Math.round(this.y) });
    }
    // 원격 엔티티 표시 보간 (비콘 5Hz → 화면 60fps)
    for (const e of this.state.entities.values()) {
      if (e.kind === 'player') {
        const k = Math.min(1, dt * 8);
        e.x += (e.tx - e.x) * k;
        e.y += (e.ty - e.y) * k;
      }
    }
  }
}
