// ============================================================================
// MonsterController — A5: 몬스터를 "특권 없는 클라이언트"로 구동 (설계 §7 단계 5)
//
// 서버는 시뮬레이션하지 않는다의 마지막 예외(정적 배치 몬스터)를 없앤다.
// 몬스터는 tools/bots.js 와 똑같이 ClientState 미러를 들고 비콘·인텐트로만 움직인다.
// 서버(game.js)에는 몬스터 전용 경로가 없다 — #onBeacon·#processIntent 가 플레이어와
// 동일하게 검증한다(속도 예산·사거리·쿨다운). 즉 몬스터도 특권이 없다.
//
// server/ 파일 — in-process conn 으로 네트워크 없이 원장 권위와 같은 프로세스에서 돈다.
// ============================================================================

import { ClientState } from '../client/state.js';
import { decode, MSG, INTENT } from '../shared/protocol.js';
import { MAX_SPEED, ATTACK_RANGE, BEACON_INTERVAL_MS, WORLD_SIZE } from '../shared/constants.js';

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function clampPos(v) { return Math.max(0, Math.min(WORLD_SIZE, v)); }

export class MonsterController {
  constructor(game) {
    this.game = game;
    this.monsters = [];
  }

  // 몬스터 = 무특권 플레이어 액터. addPlayer 그대로 — 서버는 플레이어와 구분하지 않는다.
  spawn(name, x, y) {
    const mirror = new ClientState();
    const mon = { id: null, mirror, x, y, iid: 0, wanderT: 0 };
    // in-process 수송: 서버→몬스터 메시지를 미러에 그대로 먹인다 (클라와 동일)
    const conn = { send: (s) => { const m = decode(s); if (m) mirror.handle(m); } };
    mirror.onTeleport = ({ x: tx, y: ty }) => { mon.x = tx; mon.y = ty; }; // 서버 정정 수용
    const player = this.game.addPlayer(conn, name);
    mon.id = player.id;
    mon.x = x ?? player.x; mon.y = y ?? player.y;
    this.monsters.push(mon);
    return mon;
  }

  // 한 스텝 = 비콘 주기 1회. 가장 가까운 시야 내 플레이어를 향해 이동, 사거리 들면 공격.
  step() {
    const budget = MAX_SPEED * (BEACON_INTERVAL_MS / 1000) * 0.85; // 속도 예산 안쪽
    for (const mon of this.monsters) {
      if (mon.mirror.dead) continue; // 사망 시 리스폰까지 대기 (서버가 TELEPORT 로 되살림)

      let target = null, best = Infinity;
      for (const e of mon.mirror.entities.values()) {
        if (e.kind !== 'player') continue;
        const d = dist(mon.x, mon.y, e.tx, e.ty);
        if (d < best) { best = d; target = e; }
      }

      if (target && best <= ATTACK_RANGE - 10) {
        this.#attack(mon, target.id);
      } else if (target) {
        this.#moveToward(mon, target.tx, target.ty, budget);
      } else {
        this.#wander(mon, budget); // 사냥감 없으면 배회 (필드 순찰)
      }
    }
  }

  #moveToward(mon, tx, ty, budget) {
    const d = dist(mon.x, mon.y, tx, ty) || 1;
    const s = Math.min(budget, d);
    mon.x = clampPos(mon.x + (tx - mon.x) / d * s);
    mon.y = clampPos(mon.y + (ty - mon.y) / d * s);
    this.game.onMessage(mon.id, { t: MSG.BEACON, x: Math.round(mon.x), y: Math.round(mon.y) });
  }

  #wander(mon, budget) {
    // 결정론 순찰 — id·시간 기반 각도 (RNG·특권 없음)
    mon.wanderT += 1;
    const a = (mon.wanderT * 0.7 + mon.id.length) % (Math.PI * 2);
    this.#moveToward(mon, mon.x + Math.cos(a) * budget * 4, mon.y + Math.sin(a) * budget * 4, budget);
  }

  #attack(mon, targetId) {
    mon.iid = mon.iid % 65000 + 1;
    this.game.onMessage(mon.id, { t: MSG.INTENT, iid: mon.iid, kind: INTENT.ATTACK, targetId });
  }
}
