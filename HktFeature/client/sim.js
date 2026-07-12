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
    // 생명체·파이어볼 표시 보간 — 스냅샷은 목표(tx,ty,tz)+구간 등속(segSpeed)으로만 받고, 표시
    //   좌표(x,y,z)는 그 등속으로 목표를 쫓는다. segSpeed = 스냅샷 간 이동 거리 / 스냅샷 간격이라
    //   서버의 실제 속도가 얼마든(계속 걷기·먹으며 한 걸음·정지) 화면에선 연속 이동으로 펼쳐진다 —
    //   "빨리 가서 기다리는" 계단이 없다. 카메라가 내 생명체를 타므로(구 feature-0010(현 0018) step3) 화면 전체가
    //   같이 부드러워진다. 순수 표시 계층(권위·원장 무관).
    for (const c of this.state.creatures.values()) this.#chase(c, dt);
    for (const f of this.state.fireballs.values()) this.#chase(f, dt);
    // 국소장 표시 보간 — FIELD 스냅샷(0.5s 계단)을 표시값이 부드럽게 따라간다(볼류메트릭 글로우 맥동 제거).
    for (const [key, target] of this.state.fieldTarget) {
      const cur = this.state.field.get(key) ?? target;
      this.state.field.set(key, Math.abs(target - cur) < 1 ? target : cur + (target - cur) * Math.min(1, dt * 4));
    }
  }

  // 표시 좌표(x,y,z)를 목표(tx,ty,tz)로 구간 등속(segSpeed) 이동. 최소한 남은 거리/0.5s 로는 가서
  //   (max) 지연이 누적되지 않는다. 목표 도달 후엔 다음 스냅샷까지 정지(서버가 실제로 멈춘 것).
  #chase(e, dt) {
    if (e.tx === undefined) return;
    const dx = e.tx - e.x, dy = e.ty - e.y, dz = e.tz - e.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return;
    const step = Math.max(e.segSpeed ?? 0, d * 2) * dt;
    if (d <= step) { e.x = e.tx; e.y = e.ty; e.z = e.tz; return; }
    e.x += (dx / d) * step; e.y += (dy / d) * step; e.z += (dz / d) * step;
  }
}
