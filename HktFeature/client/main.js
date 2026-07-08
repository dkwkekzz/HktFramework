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
