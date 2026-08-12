// Integration — World Capability 와 GameView 를 Contract 로만 결합하는 로컬 런타임 (§21·§30).
//
//   Client Input → World Command(CMD-*) → Authoritative Rule → World Transition
//   → Observer Projection(OBS-MINING-V1) → GameView Binding → Rendering
//
// GameView 는 여기서 주입되는 PlayerObservable 만 본다. World 내부 접근 없음.

import {
  AuthoritativeWorld,
  projectDesigner,
  projectPlayer,
  type Command,
  type WorldConfig,
} from './world';
import { bindObservable } from './gameview/binding';
import { GameViewRenderer } from './gameview/renderer';
import { InputReader } from './gameview/input';
import type { PlayerObservable } from './gameview/observable';

const PLAYER_ID = 'player-1';
const TICK_MS = 1000 / 60;

// World Configuration — 작은 채굴 무대 (Integration 입력, §35)
const worldConfig: WorldConfig = {
  actors: [
    {
      id: PLAYER_ID,
      position: { x: -3, z: 2 },
      inventory: { resources: {}, tools: [{ kind: 'Pickaxe', capability: 'Mining' }] },
      knowledge: ['deposit-1'],
      currentAction: 'Idle',
      actionTicksRemaining: 0,
    },
  ],
  deposits: [
    { id: 'deposit-1', position: { x: 4, z: -2 }, resourceType: 'Stone', resourceAmount: 5 },
  ],
};

const world = new AuthoritativeWorld(worldConfig);

const app = document.getElementById('app')!;
const renderer = new GameViewRenderer(app, {
  stone: document.getElementById('hud-stone')!,
  hint: document.getElementById('hud-hint')!,
  feedback: document.getElementById('hud-feedback')!,
});
const input = new InputReader(window);

let lastObservable: PlayerObservable = projectPlayer(world, PLAYER_ID);

// 고정 timestep 세계 tick + 입력 → Command
let acc = 0;
let prev = performance.now();

function frame(now: number): void {
  acc += now - prev;
  prev = now;

  while (acc >= TICK_MS) {
    acc -= TICK_MS;
    const intent = input.poll();
    const commands: Command[] = [];
    if (intent.direction) {
      commands.push({ id: 'CMD-MOVE-V1', actorId: PLAYER_ID, direction: intent.direction });
    }
    if (intent.minePressed) {
      // 채굴 의도의 대상은 Observable 이 알려준 availability target — GameView/입력은 World 내부를 모른다
      const target = lastObservable.mineAvailability.target;
      if (target) commands.push({ id: 'CMD-MINE-V1', actorId: PLAYER_ID, depositId: target });
    }
    for (const cmd of commands) world.applyCommand(cmd);
    world.tick();
  }

  // Observer Projection → Binding → Rendering (매 프레임)
  lastObservable = projectPlayer(world, PLAYER_ID) as unknown as PlayerObservable;
  renderer.render(bindObservable(lastObservable), now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ── 검증 훅 (Playable Verification 전용, 읽기 전용) ─────────────────────────
declare global {
  interface Window {
    __hkt: {
      observable: () => PlayerObservable;
      designer: () => unknown;
    };
  }
}
window.__hkt = {
  observable: () => structuredClone(lastObservable),
  designer: () => projectDesigner(world),
};
