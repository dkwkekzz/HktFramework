// ============================================================================
// 부트스트랩 — 네트·상태·시뮬·렌더 결선 (최소 원장 코어: 이동·관측만)
// 행동 인텐트(채집·전투·성장…)는 feature 로 여기에 얹는다.
// ============================================================================

import { Net } from './net.js';
import { ClientState } from './state.js';
import { Sim } from './sim.js';
import { ViewModel } from './viewmodel.js';
import { Render } from './render.js';
import { MSG } from '../shared/protocol.js';

const canvas = document.getElementById('game');
const net = new Net();
const state = new ClientState();
const sim = new Sim(net, state);
// 불변 원칙 ③: 세계 속성 → ViewModel(Scene) → 렌더(속성 그대로). 렌더러는 Scene 만 소비한다.
const viewmodel = new ViewModel(state, sim, net);
const render = new Render(canvas);
// 관측/디버그 훅 — 읽기 전용 뷰어의 미러 원장·좌표를 콘솔에서 들여다보게 노출(권위 아님, 표시용).
if (typeof window !== 'undefined') window.__hkt = { state, sim, net, viewmodel, render };
sim.getYaw = () => render.yaw; // 카메라 상대 이동 — 이동 축을 현재 카메라 방향에 맞춘다

state.onResync = (regions) => net.send(MSG.RESYNC, { regions });

// 제어 (구 feature-0010(현 0018)·feature-0018 step3) — 내가 제어하는 생명체에 **전략을 명령**한다(채집·사냥·식사·제조·대기).
//   명령은 자율 동기(허기·안전·질서)를 **우회**한다(명령>자율): 버튼을 누르면 그 전략을 수행하고, 표적이 소진되면
//   스스로 자율 동기로 복귀한다. 대기(none)는 명령을 거둬 자율로 돌려보낸다(동기 없으면 주인 추종=방향키 수동 이동).
//   부여 수단이 둘: 화면 버튼(#desirebar)과 단축키(1·2·3·4·0). 둘 다 같은 command 를 부른다(MSG.COMMAND).
const buttons = [...document.querySelectorAll('#desirebar button')];
function command(d) {
  state.myDesire = d;
  net.send(MSG.COMMAND, { strategy: d });
  for (const b of buttons) b.classList.toggle('active', b.dataset.desire === d); // 선택된 명령 강조
}
for (const b of buttons) b.addEventListener('click', () => command(b.dataset.desire));
const DESIRE_KEY = { Digit1: 'forage', Digit2: 'hunt', Digit3: 'eat', Digit4: 'craft', Digit0: 'none', Backquote: 'none' };
addEventListener('keydown', (e) => { const d = DESIRE_KEY[e.code]; if (d !== undefined) command(d); });
command('none'); // 기본 = 명령 없음(자율 동기가 있으면 자율, 없으면 대기=수동 이동)

// 클릭/터치 지목 (구 feature-0010(현 0018) step4) — 뷰어에서 표적(결정·생명체)을 클릭하면 그 특정 대상으로 가서 상호작용한다.
//   render 가 화면투영으로 대상을 골라(#pickAt) 이 콜백을 부르고, 서버가 표적 종류로 욕구를 추론한다(결정=식사·작은
//   생명체=사냥). 빈 곳 클릭 = 지정 해제(대기 → 방향키 수동 이동). "표적이 곧 의도"라 버튼 없이 직접 지목한다.
render.onSelectTarget = (sel) => { net.send(MSG.TARGET, sel); if (sel?.kind === 'none') state.myDesire = 'none'; };

// 버튼 강조를 서버 진실(내 생명체의 실제 desire)에 맞춘다 — 매 프레임 동기화(관측되면 그 값, 아니면 내 선택).
function reflectDesireButtons() {
  let actual = state.myDesire;
  for (const c of state.creatures.values()) if (c.owner && c.owner === state.playerId) { actual = c.desire; break; }
  for (const b of buttons) b.classList.toggle('active', b.dataset.desire === actual);
}

const name = new URLSearchParams(location.search).get('name')
  ?? `모험가${Math.floor(Math.random() * 900) + 100}`;
net.connect(name, (msg) => state.handle(msg));

// --- 메인 루프 ---
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  sim.update(dt, now);
  // 제어 중(욕구/지정 표적 수행)엔 플레이어 점(조향 목적지)을 내 생명체에 붙인다 — 수행을 마치고 대기로
  //   돌아와도 생명체가 스폰(점)으로 되돌아가지 않고 **그 자리에 서서** WASD 를 그 위치부터 받게 한다(구 feature-0010(현 0018) step4).
  let mine = null;
  for (const c of state.creatures.values()) if (c.owner && c.owner === state.playerId) { mine = c; break; }
  if (mine && mine.desire && mine.desire !== 'none') { sim.x = mine.x; sim.y = mine.y; sim.z = mine.z; }
  const scene = viewmodel.build(now / 1000); // 세계 속성 → Scene(순수 데이터). t = 애니메이션 위상(초)
  render.draw(scene);
  reflectDesireButtons();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
