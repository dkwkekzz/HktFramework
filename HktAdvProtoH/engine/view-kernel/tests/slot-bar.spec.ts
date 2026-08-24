// 슬롯 띠 capability 단독 테스트 — 브라우저 없이, 게임의 명사 없이.
//
// 여기서 확인하는 것은 **능력 쪽 성질**뿐이다. 무엇이 기술인지도, 왜 안 되는지도
// 이 파일은 알지 못한다 — 지시를 받아 그리는 규칙만 검사한다.

import { describe, expect, it } from 'vitest';
import { slotBarMarkup } from '../hud/slot-bar';
import type { SceneSlotBar } from '../scene/scene-state';

const bar = (cells: SceneSlotBar['cells']): SceneSlotBar => ({ id: 'bar', cells });

describe('슬롯 띠 — 지시를 글자로 옮긴다', () => {
  it('칸마다 이름과 상태가 각각 다른 자리에 실린다', () => {
    const html = slotBarMarkup(
      bar([{ id: 'a', key: 'F', title: '첫째', detail: '값', status: '됨', state: 'available' }]),
    );
    expect(html).toContain('class="sb-key">F<');
    expect(html).toContain('class="sb-title">첫째<');
    expect(html).toContain('class="sb-detail">값<');
    expect(html).toContain('class="sb-status">됨<');
  });

  it('안 되는 칸도 사라지지 않는다 — 상태만 달라진다', () => {
    const html = slotBarMarkup(
      bar([
        { id: 'a', title: '첫째', state: 'available' },
        { id: 'b', title: '둘째', status: '막힘', state: 'blocked' },
      ]),
    );
    expect(html).toContain('data-cell="b"');
    expect(html).toContain('data-state="blocked"');
  });

  it('부를 자리가 없는 칸도 그려진다 — 부르지 못할 뿐 있다는 것은 관찰이다', () => {
    const html = slotBarMarkup(bar([{ id: 'a', title: '이름뿐', state: 'available' }]));
    expect(html).toContain('data-cell="a"');
    expect(html).toContain('class="sb-key"></span>');
  });

  it('접근성 이름에 이름·부르는 자리·상태가 함께 들어간다', () => {
    const html = slotBarMarkup(
      bar([{ id: 'a', key: 'G', title: '둘째', status: '기다림', state: 'pending' }]),
    );
    expect(html).toContain('aria-label="둘째, G 키, 기다림"');
  });

  it('부를 수 없는 칸의 접근성 이름은 그 사실을 말한다', () => {
    const html = slotBarMarkup(bar([{ id: 'a', title: '이름뿐', state: 'available' }]));
    expect(html).toContain('aria-label="이름뿐, 부를 수 없음"');
  });

  it('결정 Layer 가 준 순서를 그대로 지킨다 — 띠가 순서를 만들지 않는다', () => {
    const html = slotBarMarkup(
      bar([
        { id: 'z', title: '뒤', state: 'available' },
        { id: 'a', title: '앞', state: 'available' },
      ]),
    );
    expect(html.indexOf('data-cell="z"')).toBeLessThan(html.indexOf('data-cell="a"'));
  });

  it('글자에 들어온 표시는 그대로 뜻이 되지 않는다 — 새어 나가지 않게 바꾼다', () => {
    const html = slotBarMarkup(bar([{ id: 'a', title: '<b>&"', state: 'available' }]));
    expect(html).toContain('&lt;b&gt;&amp;&quot;');
    expect(html).not.toContain('<b>');
  });

  it('칸이 없으면 아무것도 나오지 않는다 — 빈 띠를 그리지 않는다', () => {
    expect(slotBarMarkup(bar([]))).toBe('');
  });

  it('대소문자를 건드리지 않는다 — 모르는 코드가 그대로 보여야 한다', () => {
    const html = slotBarMarkup(bar([{ id: 'a', title: 'moonshard', state: 'available' }]));
    expect(html).toContain('>moonshard<');
  });
});
