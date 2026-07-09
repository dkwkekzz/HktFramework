// ============================================================================
// 부트스트랩 — 네트·상태·시뮬·렌더 결선 (최소 원장 코어: 이동·관측만)
// 행동 인텐트(채집·전투·성장…)는 feature 로 여기에 얹는다.
// ============================================================================

import { Net } from './net.js';
import { ClientState } from './state.js';
import { Sim } from './sim.js';
import { Render } from './render.js';
import { MSG } from '../shared/protocol.js';

const canvas = document.getElementById('game');
const net = new Net();
const state = new ClientState();
const sim = new Sim(net, state);
const render = new Render(canvas, state, sim, net);
// 관측/디버그 훅 — 읽기 전용 뷰어의 미러 원장·좌표를 콘솔에서 들여다보게 노출(권위 아님, 표시용).
if (typeof window !== 'undefined') window.__hkt = { state, sim, net };
sim.getYaw = () => render.yaw; // 카메라 상대 이동 — 이동 축을 현재 카메라 방향에 맞춘다

state.onResync = (regions) => net.send(MSG.RESYNC, { regions });

// 제어 (feature-0010) — 내가 제어하는 생명체에 욕망을 부여한다. 1=채집 · 2=사냥 · 0=대기(수동 이동).
//   욕망은 생명체를 표적(에너지원)으로 이동시키고, 대기면 방향키(카메라 방향 이동)로 곁에 데려간다.
const DESIRE_KEY = { Digit1: 'forage', Digit2: 'hunt', Digit0: 'none', Backquote: 'none' };
state.myDesire = 'none';
addEventListener('keydown', (e) => {
  const d = DESIRE_KEY[e.code];
  if (d === undefined) return;
  state.myDesire = d;
  net.send(MSG.DESIRE, { desire: d });
});

const name = new URLSearchParams(location.search).get('name')
  ?? `모험가${Math.floor(Math.random() * 900) + 100}`;
net.connect(name, (msg) => state.handle(msg));

// --- 메인 루프 ---
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  sim.update(dt, now);
  render.draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
