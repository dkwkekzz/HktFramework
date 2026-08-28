// 기반이 부르는 문구 코드 **전부** — 팩이 덮어야 하는 목록의 단일 출처.
//
// 기반은 사람이 읽을 말을 짓지 않는다. 무엇을 말해야 하는지를 코드로 부르고,
// 그 코드가 무슨 말이 되는지는 팩의 문구 표가 정한다
// (design/Design-System-Content-Separation.md — 반전 ⑤ 문구).
//
// **목록은 각 자리가 소유한다.** 여기는 모으기만 한다 — 새 코드를 부르는 자리는
// 자기 파일에서 자기 목록에 한 줄을 더하고, 그 순간 이 합집합이 함께 자란다.
// 그래서 목록을 갱신하는 것을 잊을 자리가 없다.
//
// 팩이 덮지 않아도 게임은 멈추지 않는다 — 코드가 그대로 보인다. 하지만 그것은
// 화면에 코드가 뜨는 일이며, 조용히 그렇게 되는 것과 검사가 말해 주는 것은 다르다.

import { SLOT_BAR_TEXT_CODES } from '../hud/slot-bar';
import { SURFACE_TEXT_CODES } from '../hud/surface';
import { ENGINE_KEY_TEXT_CODES } from '../input/engine-keys';
import { COMMAND_TEXT_CODES } from './command-presentation';
import { LINK_TEXT_CODES } from './link-presentation';
import { SESSION_TEXT_CODES } from './session-presentation';

export const ENGINE_TEXT_CODES: readonly string[] = [
  ...COMMAND_TEXT_CODES,
  ...SURFACE_TEXT_CODES,
  ...SLOT_BAR_TEXT_CODES,
  ...ENGINE_KEY_TEXT_CODES,
  ...SESSION_TEXT_CODES,
  ...LINK_TEXT_CODES,
];
