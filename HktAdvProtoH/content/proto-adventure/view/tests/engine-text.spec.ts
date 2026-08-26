// 문구 반전 ⑤ — **기반은 사람이 읽을 말을 하나도 짓지 않는다.**
//
// 기반은 무엇을 말해야 하는지를 코드로 부르고(`ENGINE_TEXT_CODES`), 그 코드가 무슨
// 말이 되는지는 이 팩의 문구 표가 정한다. 덮지 못해도 게임은 멈추지 않는다 —
// 코드가 그대로 뜰 뿐이다. 그래서 검사가 말해 준다: 화면에 `surface.close` 가 뜨는
// 것과 그것을 아는 것은 다르다.
//
// 이 검사는 **기반이 자리를 늘리는 순간 함께 자란다.** 새 코드를 부르는 자리가
// 자기 파일의 목록에 한 줄을 더하면 합집합이 그것을 물고 오고, 팩이 말을 주지 않은
// 채로는 이 검사가 통과하지 않는다.

import { describe, expect, it } from 'vitest';
import { ENGINE_TEXT_CODES } from '../../../../engine/view-kernel/presentation/text-codes';
import { ENGINE_KEY_TEXT_CODES } from '../../../../engine/view-kernel/input/engine-keys';
import { SLOT_BAR_TEXT_CODES } from '../../../../engine/view-kernel/hud/slot-bar';
import { SURFACE_TEXT_CODES } from '../../../../engine/view-kernel/hud/surface';
import { codeText } from '../code-text';
import { engineKeyHints } from '../key-registry';

describe('기반이 부르는 말은 전부 팩의 표에서 온다', () => {
  it('덮이지 않은 코드가 하나도 없다', () => {
    const naked = ENGINE_TEXT_CODES.filter((code) => codeText(code) === code);
    expect(naked).toEqual([]);
  });

  it('목록이 여섯 자리에서 모인다 — 한 자리라도 빠지면 그 자리의 말이 검사 밖이 된다', () => {
    for (const code of [...SURFACE_TEXT_CODES, ...SLOT_BAR_TEXT_CODES, ...ENGINE_KEY_TEXT_CODES]) {
      expect(ENGINE_TEXT_CODES).toContain(code);
    }
    // 명령 표면이 먼저 간 길도 같은 합집합에 있다
    expect(ENGINE_TEXT_CODES).toContain('command.close');
    expect(ENGINE_TEXT_CODES).toContain('link.state.connected');
  });

  it('값이 끼는 문구는 `{}` 자리에 값을 받는다 — 값은 기반이, 문장은 팩이', () => {
    expect(codeText('slot.key', '3')).toBe('3 키');
    expect(codeText('link.since-last.value', '120')).toBe('120ms 전');
  });

  it('등록되지 않은 코드는 코드 그대로다 — 표현 누락이 게임을 멈추지 않는다', () => {
    expect(codeText('surface.nowhere')).toBe('surface.nowhere');
    expect(codeText('surface.nowhere', 'x')).toBe('surface.nowhere: x');
  });
});

describe('한 자리의 이름은 하나다 — 안내 줄과 손가락 버튼이 갈라지지 않는다', () => {
  it('조작 안내 줄의 이름이 문구 표에서 온다', () => {
    const hints = engineKeyHints();
    expect(hints).toContain(`${codeText('engine.key.command')}: /`);
    expect(hints).toContain(`${codeText('engine.key.colliderObserve')}: C`);
  });

  it('손가락 버튼이 읽는 것도 같은 코드다 — 표를 고치면 둘이 함께 바뀐다', () => {
    // 버튼은 `engineKeyTextCode(id)` 를 부른다 (hud/touch-pad.ts). 그 코드가
    // 안내 줄이 부르는 것과 같은지를 여기서 못 박는다
    expect(ENGINE_KEY_TEXT_CODES).toContain('engine.key.colliderObserve');
    expect(codeText('engine.key.colliderObserve')).not.toBe('engine.key.colliderObserve');
  });
});
