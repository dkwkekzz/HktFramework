// 겹침 표면의 표시 지시 — 브라우저 없이 확인할 수 있는 성질들.
//
// 이 검사가 지키는 것은 **capability 가 결정하지 않는다**는 사실이다.
// 무엇이 되고 무엇이 안 되는지도, 무엇을 골랐는지도 전부 실려 온 대로 나온다.
// 그리고 화면이 조용히 지우는 것이 없어야 한다 — 빈 칸도, 안 되는 줄도 남는다.

import { describe, expect, it } from 'vitest';
import { surfaceMarkup } from '../hud/surface';
import type { SceneSurface } from '../scene/scene-state';

function surface(partial: Partial<SceneSurface> = {}): SceneSurface {
  return { id: 'bag', open: true, title: '가진 것', sections: [], footer: [], ...partial };
}

describe('surfaceMarkup — 표면 하나의 표시 지시', () => {
  it('제목과 닫는 자리가 언제나 있다 — 열기만 되고 닫히지 않으면 갇힌 것이다', () => {
    const html = surfaceMarkup(surface());
    expect(html).toContain('가진 것');
    expect(html).toContain('class="sf-close" data-surface="bag"');
    expect(html).toContain('aria-label="닫기"');
  });

  it('빈 칸도 그린다 — 남은 자리가 자리로 읽혀야 한다', () => {
    const html = surfaceMarkup(
      surface({
        sections: [
          {
            id: 'cells',
            columns: 4,
            cells: [
              { id: 'c0', text: '돌', detail: '×3', empty: false, selected: false },
              { id: 'c1', text: '', empty: true, selected: false },
              { id: 'c2', text: '', empty: true, selected: false },
            ],
          },
        ],
      }),
    );
    expect(html.match(/class="sf-cell"/g)).toHaveLength(3);
    expect(html.match(/data-empty="true"/g)).toHaveLength(2);
    expect(html).toContain('--sf-columns:4');
  });

  it('빈 자리도 이름을 가진다 — 자판만 쓰는 사람에게 빈칸은 침묵이면 안 된다', () => {
    const html = surfaceMarkup(
      surface({
        sections: [{ id: 'cells', cells: [{ id: 'c1', text: '', empty: true, selected: false }] }],
      }),
    );
    expect(html).toContain('aria-label="빈 자리"');
  });

  it('초점과 고른 것은 다른 자리에 표시된다 — 둘은 다른 것이다', () => {
    const html = surfaceMarkup(
      surface({
        focusId: 'c1',
        sections: [
          {
            id: 'cells',
            cells: [
              { id: 'c0', text: '돌', empty: false, selected: true },
              { id: 'c1', text: '곡괭이', empty: false, selected: false },
            ],
          },
        ],
      }),
    );
    // 고른 것은 c0, 초점은 c1 — 한쪽이 다른 쪽을 따라가지 않는다
    expect(html).toContain('data-id="c0" data-empty="false" data-selected="true" data-focused="false"');
    expect(html).toContain('data-id="c1" data-empty="false" data-selected="false" data-focused="true"');
  });

  it('안 되는 줄이 사라지지 않는다 — 사유를 읽는 것이 그 자리의 값어치다', () => {
    const html = surfaceMarkup(
      surface({
        sections: [
          {
            id: 'actions',
            rows: [
              { id: 'use', text: '쓰기', state: 'available', hint: '1' },
              { id: 'discard', text: '덜어내기 — 되돌릴 길이 없다', state: 'blocked' },
              { id: 'equip', text: '걸기', state: 'pending' },
            ],
          },
        ],
      }),
    );
    expect(html).toContain('덜어내기 — 되돌릴 길이 없다');
    expect(html.match(/class="sf-row"/g)).toHaveLength(3);
  });

  it('상태를 색 하나로 전하지 않는다 — 표식 글자가 함께 온다', () => {
    const html = surfaceMarkup(
      surface({
        sections: [
          {
            id: 'actions',
            rows: [
              { id: 'a', text: '되는 것', state: 'available' },
              { id: 'b', text: '안 되는 것', state: 'blocked' },
              { id: 'c', text: '기다리는 것', state: 'pending' },
            ],
          },
        ],
      }),
    );
    expect(html).toContain('>✓<');
    expect(html).toContain('>✗<');
    expect(html).toContain('>…<');
  });

  it('상태가 없는 줄에는 표식이 붙지 않는다 — 판정이 없는 것도 판정이다', () => {
    const html = surfaceMarkup(
      surface({ sections: [{ id: 'lines', rows: [{ id: 'a', text: '자리 2 / 4' }] }] }),
    );
    expect(html).not.toContain('sf-row-badge');
  });

  it('담을 것이 없으면 그 자리에 남길 글자가 나온다 — 비어 있음과 안 그림은 다르다', () => {
    const html = surfaceMarkup(
      surface({ sections: [{ id: 'cells', cells: [], emptyText: '소지품 없음' }] }),
    );
    expect(html).toContain('소지품 없음');
  });

  it('글자에 든 표시는 그대로 글자로 나온다 — 세계가 보낸 것이 화면 구조가 되지 않는다', () => {
    const html = surfaceMarkup(
      surface({
        title: '<script>',
        sections: [{ id: 'r', rows: [{ id: 'a', text: 'a & b <c>' }] }],
      }),
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a &amp; b &lt;c&gt;');
  });

  it('안내 줄이 없으면 아래 자리 자체가 없다', () => {
    expect(surfaceMarkup(surface())).not.toContain('sf-foot');
    expect(surfaceMarkup(surface({ footer: ['닫기 Esc'] }))).toContain('닫기 Esc');
  });
});
