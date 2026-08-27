// 겹침 표면의 표시 지시 — 브라우저 없이 확인할 수 있는 성질들.
//
// 이 검사가 지키는 것은 **capability 가 결정하지 않는다**는 사실이다.
// 무엇이 되고 무엇이 안 되는지도, 무엇을 골랐는지도 전부 실려 온 대로 나온다.
// 그리고 화면이 조용히 지우는 것이 없어야 한다 — 빈 칸도, 안 되는 줄도 남는다.

import { describe, expect, it } from 'vitest';
import { SURFACE_TEXT_CODES, surfaceMarkup } from '../hud/surface';
import type { CodeTextFn } from '../presentation/code-text';
import type { SceneSurface } from '../scene/scene-state';

function surface(partial: Partial<SceneSurface> = {}): SceneSurface {
  return { id: 'bag', open: true, title: '가진 것', sections: [], footer: [], ...partial };
}

/**
 * 이 검사가 **팩 노릇을 한다** — 기반은 말을 짓지 않으므로(문구 반전 ⑤) 말이 화면에
 * 서는지 보려면 누군가 표를 주어야 한다. 여기 있는 것은 이 팩의 말이 아니라
 * "표를 주면 그 말이 선다" 를 보이기 위한 표다.
 */
const TABLE: Record<string, string> = {
  'surface.close': '닫기',
  'surface.empty-cell': '빈 자리',
  'surface.state.available': '가능',
  'surface.state.blocked': '불가',
  'surface.state.pending': '기다리는 중',
};
const TEXT: CodeTextFn = (code) => TABLE[code] ?? code;

describe('surfaceMarkup — 표면 하나의 표시 지시', () => {
  it('제목과 닫는 자리가 언제나 있다 — 열기만 되고 닫히지 않으면 갇힌 것이다', () => {
    const html = surfaceMarkup(surface(), TEXT);
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
      TEXT,
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

  it('줄도 단추다 — 손가락으로 닿고 자판 초점을 받는다', () => {
    const html = surfaceMarkup(
      surface({
        sections: [
          {
            id: 'actions',
            rows: [
              { id: 'use', text: '쓰기', state: 'available' },
              { id: 'discard', text: '덜어내기 — 되돌릴 길이 없다', state: 'blocked' },
            ],
          },
        ],
      }),
    );
    expect(html.match(/<button type="button" class="sf-row"/g)).toHaveLength(2);
    // 안 되는 줄도 단추로 남는다 — 사유를 읽으려면 초점이 닿아야 한다
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('disabled>');
  });

  it('상태를 말로도 둔다 — 표식 글자는 소리로 읽히지 않는다', () => {
    const html = surfaceMarkup(
      surface({
        sections: [
          {
            id: 'actions',
            rows: [
              { id: 'a', text: '쓰기', state: 'available', hint: '1' },
              { id: 'b', text: '덜어내기', state: 'blocked' },
              { id: 'c', text: '걸기', state: 'pending' },
            ],
          },
        ],
      }),
      TEXT,
    );
    expect(html).toContain('aria-label="쓰기, 1, 가능"');
    expect(html).toContain('aria-label="덜어내기, 불가"');
    expect(html).toContain('aria-label="걸기, 기다리는 중"');
  });

  // 문구 반전 ⑤ — 이 능력은 사람이 읽을 말을 하나도 짓지 않는다.
  it('말을 짓지 않는다 — 표를 주지 않으면 코드가 그대로 선다', () => {
    const html = surfaceMarkup(
      surface({
        sections: [
          { id: 'cells', cells: [{ id: 'c1', text: '', empty: true, selected: false }] },
          { id: 'rows', rows: [{ id: 'a', text: '쓰기', state: 'blocked' }] },
        ],
      }),
    );
    // 화면에 코드가 뜰 뿐 게임은 멈추지 않는다 — 그것이 이 길의 규칙이다
    expect(html).toContain('aria-label="surface.close"');
    expect(html).toContain('aria-label="surface.empty-cell"');
    expect(html).toContain('surface.state.blocked');
    // 부르는 코드는 목록에 남는다 — 팩의 검사가 덮이지 않은 것을 잡는 근거다
    for (const code of SURFACE_TEXT_CODES) expect(code.startsWith('surface.')).toBe(true);
  });

  // 곁말 — 고르기 전에 읽는 자리 (UX 문서 §8). 여는 산수는 DOM 쪽이고,
  // 여기서 보는 것은 **그려지는가**와 **읽어 주는 이름에 실리는가** 둘이다.
  it('곁말은 읽어 주는 이름에도 실린다 — 손이 있어야만 아는 것이 되지 않게', () => {
    const html = surfaceMarkup(
      surface({
        sections: [
          {
            id: 'cells',
            cells: [
              {
                id: 'c0',
                text: '곡괭이',
                detail: '×1',
                tip: ['기타', '걸 수 있다'],
                empty: false,
                selected: false,
              },
            ],
          },
        ],
      }),
      TEXT,
    );
    expect(html).toContain('aria-label="곡괭이, ×1, 기타, 걸 수 있다"');
    expect(html).toContain('class="sf-tip" role="tooltip"');
    expect(html).toContain('data-tip="true"');
  });

  it('곁말이 없는 칸에는 곁말 자리 자체가 없다 — 빈 상자가 떠 있지 않게', () => {
    const html = surfaceMarkup(
      surface({
        sections: [
          { id: 'cells', cells: [{ id: 'c0', text: '돌', empty: false, selected: false }] },
        ],
      }),
      TEXT,
    );
    expect(html).not.toContain('sf-tip');
    expect(html).not.toContain('data-tip="true"');
  });

  it('곁말도 글자다 — 들어온 표시가 그대로 뜻이 되지 않는다', () => {
    const html = surfaceMarkup(
      surface({
        sections: [
          {
            id: 'cells',
            cells: [{ id: 'c0', text: '돌', tip: ['<b>&"'], empty: false, selected: false }],
          },
        ],
      }),
      TEXT,
    );
    expect(html).toContain('&lt;b&gt;&amp;&quot;');
    expect(html).not.toContain('<b>&');
  });

  it('안내 줄이 없으면 아래 자리 자체가 없다', () => {
    expect(surfaceMarkup(surface())).not.toContain('sf-foot');
    expect(surfaceMarkup(surface({ footer: ['닫기 Esc'] }))).toContain('닫기 Esc');
  });
});

// ── 글자를 받는 자리 · 칸의 꼴 ───────────────────────────────────────
//
// 두 원소 모두 **무엇을 위한 것인지 알지 못한다.** 실려 온 글자를 비추고, 실려 온
// 꼴대로 그릴 뿐이다.

describe('글자를 받는 자리 (SceneSurfaceField)', () => {
  const withField = (text: string) =>
    surfaceMarkup(
      surface({
        sections: [
          {
            id: 'tools',
            field: { id: 'search', text, placeholder: '이름으로 찾기', label: '이름으로 찾기' },
            cells: [{ id: 'c0', text: '전체', empty: false, selected: true }],
          },
        ],
      }),
    );

  it('실려 온 글자를 그대로 비춘다 — 그리는 쪽이 쥐지 않는다', () => {
    expect(withField('곡')).toContain('value="곡"');
    expect(withField('')).toContain('value=""');
  });

  it('빈 자리의 안내와 읽어 주는 이름을 가진다 — 글자가 없는 자리이기 때문이다', () => {
    const html = withField('');
    expect(html).toContain('placeholder="이름으로 찾기"');
    expect(html).toContain('aria-label="이름으로 찾기"');
  });

  it('되돌아오는 열쇠를 지닌다 — 어느 자리에 쳐 넣었는지 결정 Layer 가 짚는다', () => {
    expect(withField('')).toContain('class="sf-field" data-id="search"');
  });

  it('글자에 든 따옴표가 자리를 깨뜨리지 않는다', () => {
    expect(withField('"곡"')).toContain('value="&quot;곡&quot;"');
  });

  it('그 자리가 없으면 아무것도 그리지 않는다', () => {
    expect(surfaceMarkup(surface())).not.toContain('sf-field');
  });

  it('캐럿을 청했는지가 실려 온다 — 청하지 않으면 캐럿은 그대로 있다', () => {
    const claim = (claimFocus?: boolean) =>
      surfaceMarkup(
        surface({
          sections: [
            {
              id: 'tools',
              field: { id: 'search', text: '', label: '찾기', ...(claimFocus ? { claimFocus } : {}) },
              cells: [],
            },
          ],
        }),
      );
    expect(claim()).toContain('data-claim-focus="false"');
    expect(claim(true)).toContain('data-claim-focus="true"');
  });
});

describe('칸이 스스로 말하는 것 — 명암과 표식', () => {
  const cell = (extra: Record<string, unknown>) =>
    surfaceMarkup(
      surface({
        sections: [
          {
            id: 'items',
            cells: [{ id: 'c0', text: '돌', detail: '×9', empty: false, selected: false, ...extra }],
          },
        ],
      }),
    );

  it('얼마나 찼는지가 칸에 실린다 — 그리는 쪽이 그것을 명암으로 옮긴다', () => {
    expect(cell({ level: 0.5 })).toContain('style="--sf-level:0.500"');
  });

  it('0..1 밖의 값은 그 끝으로 붙는다 — 그리는 쪽의 산수다', () => {
    expect(cell({ level: 2 })).toContain('--sf-level:1.000');
    expect(cell({ level: -1 })).toContain('--sf-level:0.000');
  });

  it('명암은 **곁들이는 표시다** — 같은 값이 언제나 글자로도 선다', () => {
    // 색만으로 구분하지 않는다 (문서 §3). 수량은 명암과 무관하게 곁글자에 있다
    expect(cell({ level: 0.5 })).toContain('class="sf-cell-detail">×9<');
  });

  it('명암은 읽어 주는 말에 끼어들지 않는다 — 같은 것을 두 번 읽지 않는다', () => {
    expect(cell({ level: 0.5 })).toContain('aria-label="돌, ×9"');
  });

  it('표식은 귀퉁이에 서고 **말로도 읽힌다** — 색이나 점이면 없는 것과 같다', () => {
    const html = cell({ badge: 'NEW' });
    expect(html).toContain('class="sf-cell-badge">NEW<');
    expect(html).toContain('aria-label="NEW, 돌, ×9"');
  });

  it('밝히지 않으면 아무것도 그리지 않는다', () => {
    const plain = cell({});
    expect(plain).not.toContain('--sf-level');
    expect(plain).not.toContain('sf-cell-badge');
  });
});

describe('칸의 꼴 (shape)', () => {
  const shaped = (shape?: 'slot' | 'chip') =>
    surfaceMarkup(
      surface({
        sections: [
          {
            id: 'tools',
            ...(shape ? { shape } : {}),
            cells: [{ id: 'c0', text: '전체', empty: false, selected: true }],
          },
        ],
      }),
    );

  it('밝히지 않으면 자리다 — 지금까지 그리던 그대로', () => {
    expect(shaped()).toContain('data-shape="slot"');
  });

  it('띠라고 밝히면 띠로 그린다 — 무엇을 고르는 띠인지는 묻지 않는다', () => {
    expect(shaped('chip')).toContain('data-shape="chip"');
  });
});

describe('surfaceMarkup — 자판이 서는 자리', () => {
  it('닫는 자리와 글자 자리는 언제나 Tab 자리다', () => {
    const html = surfaceMarkup(
      surface({
        sections: [
          {
            id: 'find',
            field: { id: 'q', text: '', label: '찾는 말' },
            rows: [{ id: 'r0', text: '한 줄' }],
          },
        ],
      }),
      TEXT,
    );
    expect(html).toContain('class="sf-close" data-surface="bag" tabindex="0"');
    expect(html).toContain('class="sf-field" data-id="q"');
    expect(html).toContain(' tabindex="0" autocomplete');
  });

  it('실려 온 초점이 있으면 그 무리의 Tab 자리는 하나다 — 나머지는 방향키의 자리다', () => {
    const html = surfaceMarkup(
      surface({
        focusId: 'c2',
        sections: [
          {
            id: 'cells',
            cells: [
              { id: 'c0', text: '돌', empty: false, selected: false },
              { id: 'c1', text: '흙', empty: false, selected: false },
              { id: 'c2', text: '곡괭이', empty: false, selected: false },
            ],
          },
        ],
      }),
      TEXT,
    );
    expect(html.match(/class="sf-cell"[^>]*tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/class="sf-cell"[^>]*tabindex="-1"/g)).toHaveLength(2);
    // 선 자리는 링이 있는 자리다 — 링과 Tab 자리가 갈라지지 않는다
    expect(html).toContain('data-id="c2" data-empty="false" data-selected="false" data-focused="true" tabindex="0"');
  });

  it('초점이 다른 무리에 있어도 이 무리는 첫 자리를 남긴다 — 닿는 길이 사라지지 않는다', () => {
    const html = surfaceMarkup(
      surface({
        focusId: 'r1',
        sections: [
          {
            id: 'cells',
            cells: [
              { id: 'c0', text: '돌', empty: false, selected: false },
              { id: 'c1', text: '흙', empty: false, selected: false },
            ],
          },
          {
            id: 'detail',
            rows: [
              { id: 'r0', text: '버린다' },
              { id: 'r1', text: '건다' },
            ],
          },
        ],
      }),
      TEXT,
    );
    expect(html.match(/class="sf-cell"[^>]*tabindex="0"/g)).toHaveLength(1);
    expect(html).toContain('data-id="c0" data-empty="false" data-selected="false" data-focused="false" tabindex="0"');
    expect(html.match(/class="sf-row"[^>]*tabindex="0"/g)).toHaveLength(1);
    expect(html).toContain('data-id="r1" data-focused="true" tabindex="0"');
  });

  it('실려 온 초점이 없으면 칸도 줄도 전부 Tab 자리다 — 링을 모는 손이 없다는 뜻이다', () => {
    const html = surfaceMarkup(
      surface({
        sections: [
          {
            id: 'cells',
            cells: [
              { id: 'c0', text: '돌', empty: false, selected: false },
              { id: 'c1', text: '', empty: true, selected: false },
            ],
          },
          { id: 'detail', rows: [{ id: 'r0', text: '버린다' }, { id: 'r1', text: '건다' }] },
        ],
      }),
      TEXT,
    );
    expect(html.match(/tabindex="-1"/g)).toBeNull();
    expect(html.match(/class="sf-cell"[^>]*tabindex="0"/g)).toHaveLength(2);
    expect(html.match(/class="sf-row"[^>]*tabindex="0"/g)).toHaveLength(2);
  });
});
