// ============================================================================
// 헤드리스 봇 시뮬레이션 — 서버를 실제 플레이어 부하로 굴린다.
//
// 봇은 특권이 없다: 브라우저 클라이언트와 동일한 프로토콜·동일한 미러
// 원장(ClientState)을 쓰고, 서버는 봇의 비콘·인텐트를 똑같이 검증한다.
// 즉 이 파일은 "AI Agent 도 같은 인터페이스로 세계와 맞물린다" 의 증명이다.
//
// 사용: node tools/bots.js [봇수=8] [ws://host:port]
// ============================================================================

import { ClientState } from '../client/state.js';
import { encode, decode, MSG, INTENT } from '../shared/protocol.js';
import {
  SPAWN_POS, WORLD_SIZE, WORLD_HEIGHT, MAX_SPEED, BEACON_INTERVAL_MS, dist3,
  GATHER_RANGE, ATTACK_RANGE, PICKUP_RANGE, ATTACK_COOLDOWN_MS,
  PLAYER_MAX_ENERGY, CRYSTAL_COST, WEAPON_COST,
} from '../shared/constants.js';

const COUNT = Math.max(1, parseInt(process.argv[2] ?? '8', 10) || 8);
const URL = process.argv[3] ?? process.env.WS_URL ?? 'ws://localhost:8080';
const STEP = (MAX_SPEED * 0.8) * (BEACON_INTERVAL_MS / 1000); // 예산 안의 보폭

const BOT_NAMES = ['도토리', '이끼', '반딧불', '조약돌', '민들레', '소나기', '노을', '달팽이',
                   '억새', '개울', '서리', '메아리', '들불', '안개', '까치', '숲지기'];

class Bot {
  constructor(name) {
    this.name = name;
    this.mode = 'gather';
    this.retries = 0;
    this.#connect();
  }

  #connect() {
    this.state = new ClientState();
    this.x = SPAWN_POS.x;
    this.y = SPAWN_POS.y;
    this.z = SPAWN_POS.z; // 3D 높이
    this.lastAttack = 0;
    this.craftPendingUntil = 0;
    this.iidNo = 0;
    this.bytesInWindow = 0; // A4: 수신 대역폭 계측 (5초 요약에서 B/s 환산)
    this.state.onTeleport = ({ x, y, z }) => { this.x = x; this.y = y; this.z = z ?? this.z; }; // 서버 정정 수용

    this.ws = new WebSocket(URL);
    this.ws.binaryType = 'arraybuffer'; // A4: 바이너리 OPS 프레임 수신
    this.ws.onopen = () => { this.retries = 0; this.send(MSG.HELLO, { name: this.name }); };
    this.ws.onmessage = (ev) => {
      this.bytesInWindow += typeof ev.data === 'string' ? ev.data.length : ev.data.byteLength;
      const m = decode(ev.data); if (m) this.state.handle(m);
    };
    this.ws.onerror = () => {};
    this.ws.onclose = () => {
      clearInterval(this.timer);
      if (++this.retries <= 10) setTimeout(() => this.#connect(), 1000);
      else console.error(`[${this.name}] 재접속 포기`);
    };
    this.timer = setInterval(() => this.#think(), BEACON_INTERVAL_MS);
  }

  send(t, payload = {}) { if (this.ws.readyState === 1) this.ws.send(encode(t, payload)); }
  intent(kind, data = {}) { this.send(MSG.INTENT, { iid: (this.iidNo = this.iidNo % 65000 + 1), kind, ...data }); } // A4: u16 숫자 iid
  energy() { return this.state.ledger.balance(this.state.playerId); }

  #items(type) {
    const out = [];
    for (const [id, item] of this.state.inventory) {
      if (item.itemType === type && this.state.ledger.balance(id) > 0) out.push(id);
    }
    return out;
  }

  #nearest(kinds, maxD = Infinity, pred = () => true) {
    let best = null, bestD = maxD;
    for (const e of this.state.entities.values()) {
      if (!kinds.includes(e.kind) || !pred(e)) continue;
      const d = dist3(this.x, this.y, this.z, e.x, e.y, e.z);
      if (d <= bestD) { best = e; bestD = d; }
    }
    return best;
  }

  #walkToward(gx, gy, gz) {
    const d = dist3(this.x, this.y, this.z, gx, gy, gz);
    if (d > 1) {
      const step = Math.min(STEP, d);
      this.x = Math.max(0, Math.min(WORLD_SIZE, this.x + ((gx - this.x) / d) * step));
      this.y = Math.max(0, Math.min(WORLD_SIZE, this.y + ((gy - this.y) / d) * step));
      this.z = Math.max(0, Math.min(WORLD_HEIGHT, this.z + ((gz - this.z) / d) * step));
    }
  }

  #think() {
    const s = this.state;
    if (!s.playerId || s.dead) return;
    const e = this.energy();
    const now = Date.now();

    // --- 살림살이: 응축·회복·줍기 ---
    if (e > PLAYER_MAX_ENERGY * 0.9 && this.#items('crystal').length < 2) {
      this.intent(INTENT.CONDENSE);
    }
    if (e < 150) {
      const crystal = this.#items('crystal')[0];
      if (crystal) this.intent(INTENT.USE, { itemId: crystal });
    }
    const loot = this.#nearest(['item'], PICKUP_RANGE);
    if (loot) this.intent(INTENT.PICKUP, { itemId: loot.id });

    // --- 모드 전환: 배부르면 사냥, 허기지면 채집 ---
    const hasWeapon = this.#items('weapon').length > 0;
    this.mode = (e > 600 && (hasWeapon || e > WEAPON_COST + 200)) ? 'hunt' : 'gather';

    if (this.mode === 'gather') {
      // 잔고가 남은 시야 내 노드 → 없으면 시드에서 아는 임의 노드로 원정
      const node = this.#nearest(['node'], Infinity, (n) => s.ledger.balance(n.id) > 0)
        ?? this.#randomKnown(s.nodesById);
      if (node) {
        if (dist3(this.x, this.y, this.z, node.x, node.y, node.z) <= GATHER_RANGE * 0.9) {
          this.intent(INTENT.GATHER, { nodeId: node.id });
        } else {
          this.#walkToward(node.x, node.y, node.z);
        }
      }
    } else {
      if (!hasWeapon && now >= this.craftPendingUntil) {
        this.intent(INTENT.CRAFT);
        this.craftPendingUntil = now + 2000;
      }
      // 시야에 살아있는 몬스터 → 없으면 아는 서식지로 이동
      const mob = this.#nearest(['mob']) ?? this.#randomKnown(s.mobsById);
      if (mob) {
        if (dist3(this.x, this.y, this.z, mob.x, mob.y, mob.z) <= ATTACK_RANGE * 0.9) {
          if (now - this.lastAttack >= ATTACK_COOLDOWN_MS + 50) {
            this.lastAttack = now;
            this.intent(INTENT.ATTACK, { targetId: mob.id });
          }
        } else {
          this.#walkToward(mob.x, mob.y, mob.z);
        }
      }
    }

    this.send(MSG.BEACON, { x: Math.round(this.x), y: Math.round(this.y), z: Math.round(this.z) });
  }

  // 시드에서 유도한 전체 배치 중 하나를 목적지로 (시야 밖 원정)
  #randomKnown(map) {
    if (!this.goalCache || Math.random() < 0.01) {
      const list = [...map.values()];
      this.goalCache = list[Math.floor(Math.random() * list.length)];
    }
    return this.goalCache;
  }
}

// --- 기동 ---
const bots = [];
for (let i = 0; i < COUNT; i++) {
  const name = `${BOT_NAMES[i % BOT_NAMES.length]}${i >= BOT_NAMES.length ? i : ''}`;
  setTimeout(() => bots.push(new Bot(name)), i * 150); // 접속 폭주 완화
}

// --- 5초마다 시뮬레이션 요약 (봇 0 의 미러가 관측한 세계) ---
setInterval(() => {
  const lead = bots[0]?.state;
  if (!lead?.playerId) return;
  const line = bots.map(b =>
    `${b.name} ${String(b.energy()).padStart(4)}${b.mode === 'hunt' ? '⚔' : '⛏'}`).join(' | ');
  const totalBytes = bots.reduce((s, b) => s + b.bytesInWindow, 0);
  bots.forEach(b => { b.bytesInWindow = 0; });
  const perBotPerSec = totalBytes / 5 / bots.length;
  console.log(`[시뮬] ${line}`);
  console.log(`[원장] 세계 총 에너지 ${lead.worldTotal.toLocaleString()} · 체크섬 ${lead.checksumStatus}`);
  console.log(`[대역폭] 봇 평균 수신 ${perBotPerSec.toFixed(0)} B/s (A4 바이너리 tx)`);
}, 5000);

console.log(`[HktLedgerWeb] 봇 ${COUNT}기 기동 → ${URL} (같은 프로토콜, 특권 없음)`);
