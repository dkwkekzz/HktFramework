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
  PLAYER_MAX_ENERGY, CRYSTAL_COST, WEAPON_COST, POOL, ORGANS, GIVE_RANGE,
} from '../shared/constants.js';

const COUNT = Math.max(1, parseInt(process.argv[2] ?? '8', 10) || 8);
const URL = process.argv[3] ?? process.env.WS_URL ?? 'ws://localhost:8080';
const STEP = (MAX_SPEED * 0.8) * (BEACON_INTERVAL_MS / 1000); // 예산 안의 보폭

const BOT_NAMES = ['도토리', '이끼', '반딧불', '조약돌', '민들레', '소나기', '노을', '달팽이',
                   '억새', '개울', '서리', '메아리', '들불', '안개', '까치', '숲지기'];

class Bot {
  constructor(name, bias = 0.5) {
    this.name = name;
    this.bias = bias;   // A6 성장 편향 (0=거의 안 키움 ~ 1=공격적으로 키움) → 빌드 분화
    // A7-1: 키울 조직 선택 = 빌드. 편향 큰 개체는 발산(공격), 작은 개체는 대사(획득) 특화.
    this.organ = bias >= 0.55 ? 'atk' : 'meta';
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
    this.lastSkill = 0;
    this.lastGrow = 0;
    this.lastGive = 0;
    this.gaveCount = 0; // A7-3: 증여 횟수 (협력 관측)
    this.craftPendingUntil = 0;
    this.iidNo = 0;
    this.bytesInWindow = 0; // A4: 수신 대역폭 계측 (5초 요약에서 B/s 환산)
    this.state.onTeleport = ({ x, y, z }) => { this.x = x; this.y = y; this.z = z ?? this.z; }; // 서버 정정 수용
    this.state.onResync = (regions) => this.send(MSG.RESYNC, { regions }); // 체크섬 불일치 → 스냅샷 요청(자가치유, main.js 와 동일)

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
  // A7-1: 총 구조 = 모든 조직 합 (조직 풀 id = `S:<playerId>#<organ>`)
  struct() {
    let s = 0;
    for (const o of ORGANS) s += this.state.ledger.balance(`${POOL.STRUCT}${this.state.playerId}#${o}`);
    return s;
  }

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

    // --- 생명 간 이체(A7-3): 여유 있고 근처(사거리 안)에 나보다 궁한 동료가 있으면 나눈다 (협력).
    //     봇은 인기 노드에서 종종 모이므로 그때 부유→빈곤으로 에너지가 흐른다. ---
    if (e > 400 && now - this.lastGive >= 1200) {
      const ally = this.#nearest(['player'], GIVE_RANGE, (q) => s.ledger.balance(q.id) < e - 120);
      if (ally) {
        this.lastGive = now;
        this.gaveCount++;
        this.intent(INTENT.GIVE, { targetId: ally.id, amount: 60 });
      }
    }

    // --- 성장(A6): 잘 먹었으면 잉여 에너지를 구조로 예치(질서화). bias 큰 개체가 더
    //     공격적으로(더 낮은 배부름에, 더 큰 덩어리로) 성장 → 라이브에서 빌드가 분화한다.
    //     대사 비용은 구조에 비례해 오르므로(A6-3) 과성장은 스스로 대가를 치른다.
    const struct = this.struct();
    const surplus = e - 450; // 운영 여유분만 성장에 쓴다 — 자유 잔고를 450 아래로 떨구지 않는다
    if (surplus > 30 && struct < 4000 && now - this.lastGrow >= 1000) {
      this.lastGrow = now;
      // A7-1: 자기 특화 조직에 예치 → 빌드가 구조적으로 분화한다
      this.intent(INTENT.GROW, { organ: this.organ, amount: Math.round(Math.min(surplus, 15 + 60 * this.bias)) });
    }

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
          // A6-4: 성장한 개체는 스킬을 쓴다 — 여유 있으면 강타(소각 버스트), 허기지면 흡정(흡수).
          if (struct > 300 && now - this.lastSkill >= 2600) {
            this.lastSkill = now;
            this.intent(INTENT.SKILL, { skillId: e > 400 ? 'smash' : 'drain', targetId: mob.id });
          } else if (now - this.lastAttack >= ATTACK_COOLDOWN_MS + 50) {
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
  const bias = 0.2 + 0.75 * (i / Math.max(1, COUNT - 1)); // 0.2~0.95 로 성장 편향 분산 → 빌드 분화
  setTimeout(() => bots.push(new Bot(name, bias)), i * 150); // 접속 폭주 완화
}

// --- 5초마다 시뮬레이션 요약 (봇 0 의 미러가 관측한 세계) ---
setInterval(() => {
  const lead = bots[0]?.state;
  if (!lead?.playerId) return;
  const line = bots.map(b =>
    `${b.name} E${String(b.energy()).padStart(4)} S${String(b.struct()).padStart(4)}${b.organ === 'atk' ? '🗡' : '🌿'}${b.mode === 'hunt' ? '⚔' : '⛏'}`).join(' | ');
  const totalBytes = bots.reduce((s, b) => s + b.bytesInWindow, 0);
  bots.forEach(b => { b.bytesInWindow = 0; });
  const perBotPerSec = totalBytes / 5 / bots.length;
  const structs = bots.map(b => b.struct());
  const grown = structs.reduce((s, v) => s + v, 0);
  const atkBuilds = bots.filter(b => b.organ === 'atk').length;
  const gives = bots.reduce((s, b) => s + b.gaveCount, 0);
  console.log(`[시뮬] ${line}`);   // E=자유, S=구조, 🗡발산빌드/🌿대사빌드, ⚔사냥/⛏채집
  console.log(`[성장] 구조 총 ${grown} · 최소 ${Math.min(...structs)} ~ 최대 ${Math.max(...structs)} · 빌드 분화 발산 ${atkBuilds}/${bots.length} · 증여 누적 ${gives}회(협력)`);
  console.log(`[원장] 세계 총 에너지 ${lead.worldTotal.toLocaleString()} · 체크섬 ${lead.checksumStatus}`);
  console.log(`[대역폭] 봇 평균 수신 ${perBotPerSec.toFixed(0)} B/s (A4 바이너리 tx)`);
}, 5000);

console.log(`[HktLedgerWeb] 봇 ${COUNT}기 기동 → ${URL} (같은 프로토콜, 특권 없음)`);
