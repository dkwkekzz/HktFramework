// 두 걸음의 **첫 걸음이 화면에 남는다** (V-020 · C-COMBAT-001 08 HUMAN PLAY 보조 ①).
//
// 이 팩의 지름길 다섯(B · N · M · , · U)은 두 걸음이다 — 먼저 무엇을 할지 열고, 다음
// 숫자 키가 그 대상을 가리킨다. 그런데 **첫 걸음이 화면에 아무 자국도 남기지 않았다.**
// 누른 사람은 자기가 무엇을 열어 두었는지, 열려 있기는 한지 알 길이 없었고, 그 상태로
// 누른 숫자는 짐작한 것과 다른 일을 했다.
//
// 소지품 쪽은 `I` 표면이 그 구멍을 메웠다 (C026). 배분에는 그런 표면이 없다.
// **표면을 하나 더 여는 것이 답은 아니다** — 지름길은 지름길로 남고, 걸린 상태만 보이면
// 된다 (백로그 항목의 주).
//
// 여기 있는 것은 **화면의 조작 상태**이지 세계의 상태가 아니다. 여는 동안 세계로
// 아무것도 나가지 않으므로, 잘못 열어도 세계는 흔들리지 않는다 (bindings.ts 의 `armed`).

import type { SceneHudItem } from '../../../engine/view-kernel/scene/scene-state';
import { armedAction, armedExchangeKind } from './bindings';
import { itemName } from './inventory-view';
import { keyLabel, type PackKeyId } from './key-registry';

/** 걸린 상태가 서는 자리의 id — 위 패널의 맨 앞이다 */
export const ARMED_HUD_ID = 'armed';

interface ArmedPrompt {
  /** 무엇을 여는 손짓인가 */
  readonly what: string;
  /** 다음 숫자가 무엇의 번호인가 */
  readonly waits: string;
  /** 물러나는 자리 — **다시 누르면 닫힌다** (같은 키가 열고 닫는다) */
  readonly key: PackKeyId;
}

/**
 * 걸릴 수 있는 다섯. 표에 없는 것이 걸리면 **아무것도 보이지 않는다** —
 * 지어낸 말로 채우면 화면이 세계에 없는 것을 말하게 된다.
 */
const ARMED: Record<string, ArmedPrompt> = {
  'discard-item': { what: '덜어내기', waits: '소지품 번호', key: 'discard' },
  'equip-item': { what: '걸기', waits: '소지품 번호', key: 'equip' },
  'unequip-item': { what: '풀기', waits: '자리 번호', key: 'unequip' },
  'exchange-item': { what: '바꿔 걸기', waits: '소지품 번호', key: 'exchange' },
  'set-allocation': { what: '배분', waits: '배분 번호', key: 'allocation' },
};

/**
 * 지금 걸려 있는 것 — 걸린 것이 없으면 **빈 배열**이다.
 *
 * 없을 때 자리를 비워 두지 않고 아예 싣지 않는 이유: 늘 서 있는 줄은 배경이 되고,
 * 배경이 된 줄은 걸렸을 때에도 눈에 걸리지 않는다. 이 줄의 값어치는 **평소에 없다는
 * 것**에 있다.
 */
export function armedHudItems(text: (code: string) => string): SceneHudItem[] {
  const role = armedAction();
  if (role === null) return [];
  const prompt = ARMED[role];
  if (!prompt) return [];

  // 바꿔 걸기는 걸음이 셋이다 — 물건을 고른 뒤에는 **자리** 번호를 기다린다 (C024)
  const kind = role === 'exchange-item' ? armedExchangeKind() : null;
  const waits = kind === null ? prompt.waits : '자리 번호';
  const chosen = kind === null ? '' : ` — ${itemName(kind, text)}`;

  return [
    {
      id: ARMED_HUD_ID,
      widget: 'label',
      label: '기다리는 중',
      // 안내에 뜨는 키는 **실제로 듣는 그 키다** (V-003) — 표기와 코드가 한 자리에서 온다
      value: `${prompt.what}${chosen} · ${waits}를 누른다 · 물러나기 ${keyLabel(prompt.key)}`,
    },
  ];
}
