// 늘 떠 있는 판 capability 단독 테스트 — 브라우저 없이, 게임의 명사 없이.
//
// 여기서 확인하는 것은 **능력 쪽 성질**뿐이다. 무엇에 대한 판인지도, 그 값이 무슨 뜻인지도
// 이 파일은 알지 못한다 — 지시를 받아 그리는 규칙만 검사한다 (슬롯 띠 검사와 같은 자리).

import { describe, expect, it } from 'vitest';
import { targetFrameMarkup } from '../hud/target-frame';
import type { SceneTargetFrame } from '../scene/scene-state';

const frame = (rows: SceneTargetFrame['rows'], title = '제목'): SceneTargetFrame => ({
  title,
  rows,
});

describe('늘 떠 있는 판 — 지시를 글자로 옮긴다', () => {
  it('제목과 곁제목이 각각 다른 자리에 실린다', () => {
    const html = targetFrameMarkup({ title: '어딘가', subtitle: '깊이 2', rows: [] });
    expect(html).toContain('class="tf-title">어딘가<');
    expect(html).toContain('class="tf-subtitle">깊이 2<');
  });

  it('곁제목이 없으면 그 자리가 아예 없다 — 빈 자리를 지어내지 않는다', () => {
    expect(targetFrameMarkup(frame([]))).not.toContain('tf-subtitle');
  });

  it('줄마다 이름과 값이 각각 다른 자리에 실린다', () => {
    const html = targetFrameMarkup(frame([{ id: 'a', label: '이름', value: '값' }]));
    expect(html).toContain('class="tf-label">이름<');
    expect(html).toContain('class="tf-value">값<');
  });

  it('값이 비어도 줄은 남는다 — 없는 줄과 비어 있는 줄은 다르다', () => {
    const html = targetFrameMarkup(frame([{ id: 'a', label: '이름', value: '' }]));
    expect(html).toContain('data-row="a"');
    expect(html).toContain('class="tf-value"></span>');
  });

  it('막대가 있어도 값 글자가 함께 선다 — 막대만으로 읽히는 화면은 만들지 않는다', () => {
    const html = targetFrameMarkup(frame([{ id: 'a', label: '압력', value: '3 / 5', progress: 0.6 }]));
    expect(html).toContain('class="tf-value">3 / 5<');
    expect(html).toContain('width:60.0%');
    // 막대는 곁들이는 표시다 — 읽어 주는 장치에서는 감춘다
    expect(html).toContain('class="tf-bar" aria-hidden="true"');
  });

  it('막대 없는 줄에는 막대가 없다', () => {
    expect(targetFrameMarkup(frame([{ id: 'a', label: '이름', value: '값' }]))).not.toContain(
      'tf-bar',
    );
  });

  it('막대 값은 0..1 밖으로 나가지 않는다', () => {
    expect(targetFrameMarkup(frame([{ id: 'a', label: 'l', value: 'v', progress: 4 }]))).toContain(
      'width:100.0%',
    );
    expect(targetFrameMarkup(frame([{ id: 'a', label: 'l', value: 'v', progress: -1 }]))).toContain(
      'width:0.0%',
    );
  });

  it('옅은 줄은 사라지지 않는다 — 표시만 달라진다', () => {
    const html = targetFrameMarkup(frame([{ id: 'a', label: '이름', value: '', muted: true }]));
    expect(html).toContain('data-row="a"');
    expect(html).toContain('data-muted="true"');
  });

  it('결정 Layer 가 준 순서를 그대로 지킨다 — 판이 순서를 만들지 않는다', () => {
    const html = targetFrameMarkup(
      frame([
        { id: 'z', label: '뒤', value: '' },
        { id: 'a', label: '앞', value: '' },
      ]),
    );
    expect(html.indexOf('data-row="z"')).toBeLessThan(html.indexOf('data-row="a"'));
  });

  it('줄이 하나도 없어도 제목은 선다 — 줄 자리는 만들지 않는다', () => {
    const html = targetFrameMarkup(frame([]));
    expect(html).toContain('class="tf-title">제목<');
    expect(html).not.toContain('tf-rows');
  });

  it('읽어 주는 장치가 이 판을 제목으로 부른다', () => {
    expect(targetFrameMarkup(frame([], '어딘가'))).toContain('aria-label="어딘가"');
  });

  it('글자에 들어온 표시는 그대로 뜻이 되지 않는다 — 새어 나가지 않게 바꾼다', () => {
    const html = targetFrameMarkup(frame([{ id: 'a', label: '<b>&"', value: '<i>' }], '<s>'));
    expect(html).toContain('&lt;b&gt;&amp;&quot;');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<i>');
    expect(html).not.toContain('<s>');
  });

  it('말을 짓지 않는다 — 실려 온 글자만 나온다', () => {
    const html = targetFrameMarkup(frame([{ id: 'a', label: 'blocked-by-slope', value: '' }]));
    expect(html).toContain('>blocked-by-slope<');
  });
});
