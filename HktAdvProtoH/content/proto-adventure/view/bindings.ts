// 이 팩의 특수 키 규칙 (P3 CHANGED — 구 app/main.ts 하드코딩의 이주).
//
// interaction 키 매칭(E·F·G·R 등)은 interaction-presentation 의 데이터가 이미 나른다.
// 여기 있는 것은 장면을 읽어 요청을 골라야 하는 둘뿐이다.

import type { KeyBinding } from '../../../engine/view-kernel/input/bindings';
import type { ActionRequest } from '../protocol/actions';
import { LET_GO_HUD_PREFIX } from './carried-presentation';

// 막기 (C011) — 세계에는 걸기와 놓기가 따로 있다. 화면에서는 한 키로 오간다.
// 세계가 지금 무엇이라고 알려 주었는지를 보고 반대를 요청한다.
// 무너진 동안에는 걸기가 가용하지 않으므로 세계가 사유와 함께 거절한다 (View 가 판정하지 않는다).
const guardToggle: KeyBinding = {
  code: 'KeyQ',
  invoke: (scene, send) => {
    const guarding = scene.self?.guard.guarding ?? false;
    const wanted = guarding ? 'guard-release' : 'guard-begin';
    const guard = scene.interactions.find((i) => i.id === wanted);
    if (guard) send({ interactionId: guard.id });
  },
};

// 이동 모드 (C007) — 요청은 토글이 아니라 명시값이므로(walk | run),
// 지금 무엇인지를 보고 반대값을 보낸다. 정하는 것은 세계다.
function moveModeToggle(code: string): KeyBinding {
  return {
    code,
    invoke: (scene, send) => {
      const moveMode = scene.interactions.find((i) => i.id === 'move-mode');
      if (!moveMode) return;
      const current = scene.self?.moveModeCode ?? 'walk';
      const action: ActionRequest = {
        interactionId: moveMode.id,
        mode: current === 'run' ? 'walk' : 'run',
      };
      send(action);
    },
  };
}

// 덜어내기 (C020) — 어느 자리를 덜어낼지는 요청에 실어야 하므로(carriedSlot) 키
// 하나로는 표현할 수 없다. 그래서 여기서 장면을 읽는다.
//
// 겨눌 자리를 고르는 일은 carried-presentation 이 이미 했고(세계가 된다고 말한 첫
// 자리), 그 결과가 HUD 항목 id 에 실려 있다. 이 바인딩은 그것을 읽어 보낼 뿐
// **아무 판정도 하지 않는다** — 세계가 막아 둔 자리는 애초에 id 에 오지 않는다.
const letGo: KeyBinding = {
  // B — 버리기. 엔진이 이미 쓰는 키를 피한다: 이동(WASD·화살표) · 시점(Z·X·R·T) ·
  // 관찰 토글(C·V) · 명령(/) · 그리고 팩의 상호작용 키(E·F·G·R·Q·T·Shift).
  // 그 목록의 원본은 engine/view-kernel/input/keyboard.ts 와
  // view/interaction-presentation.ts 다 — bindings.spec.ts 가 그 충돌을 막는다.
  code: 'KeyB',
  invoke: (scene, send) => {
    const line = scene.hud.find((h) => h.id.startsWith(LET_GO_HUD_PREFIX));
    if (!line) return;
    const slot = Number(line.id.slice(LET_GO_HUD_PREFIX.length));
    if (!Number.isInteger(slot)) return; // 'none' — 덜어낼 수 있는 자리가 없다
    const action: ActionRequest = { interactionId: 'let-go', carriedSlot: slot };
    send(action);
  },
};

export const KEY_BINDINGS: readonly KeyBinding[] = [
  guardToggle,
  letGo,
  moveModeToggle('ShiftLeft'),
  moveModeToggle('ShiftRight'),
];
