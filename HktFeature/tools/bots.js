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

// 봇의 "브레인" — 욕망 선택 정책(feature-0010). 봇은 특권 없이 **자기 미러**(사람과 같은 관측 채널)로
//   제 생명체 상태를 보고 스스로 욕망을 고른다. 성장 사다리에 따른 결정론적 규칙:
//     · 아직 못 봄 / 작음(size<2) → **식사**: 밥(결정)을 먹되 날것이면 요리해 먹는다(feature-0011). 먼저 커야 사냥한다.
//     · 충분히 자람(size≥2)     → **사냥**: 포식자가 되어 더 작은 생명체를 뜯는다(더 큰 수입).
//   이 규칙이 곧 확장 지점이다 — 더 똑똑한 정책(가까운 표적 유무·위험 회피·LLM 의도)을 여기 얹으면 된다.
function chooseDesire(mine) {
  if (!mine) return 'eat';                     // 아직 제 생명체를 관측 못 함 → 안전하게 식사(성장)
  return (mine.size ?? 1) >= 2 ? 'hunt' : 'eat'; // 작으면 밥을 먹어(날것이면 요리) 크고, 크면 사냥한다
}

class Bot {
  constructor(name) {
    this.name = name;
    this.desire = 'none';   // 현재 서버에 부여한 욕망(중복 전송 방지용)
    this.retries = 0;
    this.#connect();
  }

  #connect() {
    this.state = new ClientState();
    this.x = SPAWN_POS.x;
    this.y = SPAWN_POS.y;
    this.z = SPAWN_POS.z; // 3D 높이
    this.bytesInWindow = 0; // 수신 대역폭 계측 (5초 요약에서 B/s 환산)
    this.state.onTeleport = ({ x, y, z }) => { this.x = x; this.y = y; this.z = z ?? this.z; }; // 서버 정정 수용
    this.state.onResync = (regions) => this.send(MSG.RESYNC, { regions }); // 체크섬 불일치 → 스냅샷 요청(자가치유)

    this.ws = new WebSocket(URL);
    this.ws.onopen = () => {
      this.retries = 0;
      this.desire = 'none';
      this.send(MSG.HELLO, { name: this.name }); // 서버가 HELLO 처리 시 내 생명체를 스폰(possess) — 욕망은 #think 가 고른다
    };
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

  // 내가 제어하는 생명체를 미러에서 찾는다(관측되면) — 사람과 같은 CREATURE 스냅샷 채널, 특권 없음.
  #myCreature() {
    for (const c of this.state.creatures.values()) if (c.owner && c.owner === this.state.playerId) return c;
    return null;
  }

  #think() {
    const s = this.state;
    if (!s.playerId) return;
    const mine = this.#myCreature();

    // ① 욕망 선택(브레인) — 관측한 제 생명체 상태로 스스로 고른다. 바뀔 때만 서버에 부여(중복 방지).
    const want = chooseDesire(mine);
    if (want !== this.desire) { this.desire = want; this.send(MSG.DESIRE, { desire: want }); }

    // ② 마커 이동 — 제 생명체 곁에 머문다(관측·relevancy 유지 = 계속 지켜보며 결정한다). 못 보면 스폰으로 복귀.
    //   봇은 헤드리스(표시 보간 루프 없음) → 표시 좌표(x)가 아니라 최신 스냅샷 목표(tx)를 읽는다.
    const goal = mine ? { x: mine.tx ?? mine.x, y: mine.ty ?? mine.y, z: mine.tz ?? mine.z } : SPAWN_POS;
    const d = dist3(this.x, this.y, this.z, goal.x, goal.y, goal.z);
    if (d > STEP) {
      const step = Math.min(STEP, d);
      this.x = Math.max(0, Math.min(WORLD_SIZE, this.x + ((goal.x - this.x) / d) * step));
      this.y = Math.max(0, Math.min(WORLD_SIZE, this.y + ((goal.y - this.y) / d) * step));
      this.z = Math.max(0, Math.min(WORLD_HEIGHT, this.z + ((goal.z - this.z) / d) * step));
    }
    this.send(MSG.BEACON, { x: Math.round(this.x), y: Math.round(this.y), z: Math.round(this.z) });
  }
}

// --- 기동 ---
const bots = [];
for (let i = 0; i < COUNT; i++) {
  const name = `${BOT_NAMES[i % BOT_NAMES.length]}${i >= BOT_NAMES.length ? i : ''}`;
  setTimeout(() => bots.push(new Bot(name)), i * 150); // 접속 폭주 완화 — 욕망은 각 봇이 스스로 고른다
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
