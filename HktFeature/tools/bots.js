// ============================================================================
// 헤드리스 봇 시뮬레이션 — 서버를 실제 플레이어 부하로 굴린다 (최소 원장 코어).
//
// 봇은 특권이 없다: 브라우저 클라이언트와 동일한 프로토콜·동일한 미러
// 원장(ClientState)을 쓰고, 서버는 봇의 비콘을 똑같이 검증한다.
// 최소 코어에는 게임플레이가 없다 — 봇은 세계를 "돌아다니기만" 한다(접속·이동).
// 이동은 에너지를 SOURCE 로 되돌리고(수입원은 아직 없음·feature), 총합은 불변이다.
//
// 사용: node tools/bots.js [봇수=8] [ws://host:port]
// ============================================================================

import { ClientState } from '../client/state.js';
import { encode, decode, MSG } from '../shared/protocol.js';
import {
  SPAWN_POS, WORLD_SIZE, WORLD_HEIGHT, MAX_SPEED, BEACON_INTERVAL_MS, dist3,
} from '../shared/constants.js';

const COUNT = Math.max(1, parseInt(process.argv[2] ?? '8', 10) || 8);
const URL = process.argv[3] ?? process.env.WS_URL ?? 'ws://localhost:8080';
const STEP = (MAX_SPEED * 0.8) * (BEACON_INTERVAL_MS / 1000); // 예산 안의 보폭

const BOT_NAMES = ['도토리', '이끼', '반딧불', '조약돌', '민들레', '소나기', '노을', '달팽이',
                   '억새', '개울', '서리', '메아리', '들불', '안개', '까치', '숲지기'];

class Bot {
  constructor(name) {
    this.name = name;
    this.retries = 0;
    this.#connect();
  }

  #connect() {
    this.state = new ClientState();
    this.x = SPAWN_POS.x;
    this.y = SPAWN_POS.y;
    this.z = SPAWN_POS.z; // 3D 높이
    this.goal = this.#randomGoal();
    this.bytesInWindow = 0; // 수신 대역폭 계측 (5초 요약에서 B/s 환산)
    this.state.onTeleport = ({ x, y, z }) => { this.x = x; this.y = y; this.z = z ?? this.z; }; // 서버 정정 수용
    this.state.onResync = (regions) => this.send(MSG.RESYNC, { regions }); // 체크섬 불일치 → 스냅샷 요청(자가치유)

    this.ws = new WebSocket(URL);
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
  energy() { return this.state.ledger.balance(this.state.playerId); }

  #randomGoal() {
    return {
      x: Math.random() * WORLD_SIZE,
      y: Math.random() * WORLD_SIZE,
      z: Math.random() * WORLD_HEIGHT,
    };
  }

  #think() {
    const s = this.state;
    if (!s.playerId) return;
    // 목적지에 닿으면 새 목적지 — 세계를 계속 배회한다(이동 검증·relevancy 부하)
    const d = dist3(this.x, this.y, this.z, this.goal.x, this.goal.y, this.goal.z);
    if (d < STEP) this.goal = this.#randomGoal();
    else {
      const step = Math.min(STEP, d);
      this.x = Math.max(0, Math.min(WORLD_SIZE, this.x + ((this.goal.x - this.x) / d) * step));
      this.y = Math.max(0, Math.min(WORLD_SIZE, this.y + ((this.goal.y - this.y) / d) * step));
      this.z = Math.max(0, Math.min(WORLD_HEIGHT, this.z + ((this.goal.z - this.z) / d) * step));
    }
    this.send(MSG.BEACON, { x: Math.round(this.x), y: Math.round(this.y), z: Math.round(this.z) });
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
  const line = bots.map(b => `${b.name} E${String(b.energy()).padStart(4)}`).join(' | ');
  const totalBytes = bots.reduce((s, b) => s + b.bytesInWindow, 0);
  bots.forEach(b => { b.bytesInWindow = 0; });
  const perBotPerSec = totalBytes / 5 / bots.length;
  console.log(`[시뮬] ${line}`);   // E=자유 에너지(이동으로 국소장으로 소산 → 확산 → 심우주로 복사)
  console.log(`[원장] 세계 총 ${lead.worldTotal.toLocaleString()} · 태양 ${lead.worldSrc.toLocaleString()} · 국소장 ${lead.worldMaterial.toLocaleString()} · 심우주 ${lead.worldSink.toLocaleString()}(↑) · 체크섬 ${lead.checksumStatus}`);
  console.log(`[대역폭] 봇 평균 수신 ${perBotPerSec.toFixed(0)} B/s`);
}, 5000);

console.log(`[HktFeature] 봇 ${COUNT}기 기동 → ${URL} (같은 프로토콜, 특권 없음·이동만)`);
