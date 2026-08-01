// V3 검증 시나리오 3종 — 화면이 정말 눈으로 확인 가능한 형태로 나오는가.
//
// 렌더러가 순수 함수 `상태 → VNode` 라서 브라우저 없이 화면을 단언할 수 있다.
// 여기서 보는 것은 "무슨 색인가" 가 아니라 "확인에 필요한 것이 화면에 있는가" 다.

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '@hkt/scenarios';

import {
  diffView,
  findByClass,
  LAB_PAGES,
  pageView,
  SECTION_KEYS,
  textOf,
  toHtml,
  type LabPage,
  type VElement,
} from '../src/index.ts';

const BEFORE = { tick: 0, stock: { a: 3, b: 5 } };
// b 만 두 배로 깎인 결함 상태 — 차이는 stock.b 와 tick 두 곳이다.
const AFTER = { tick: 1, stock: { a: 3, b: 3 } };

/** 페이지에 실제로 채워진 섹션 키 목록. */
function filledSections(page: VElement): string[] {
  return findByClass(page, 'section')
    .filter((section) => findByClass(section, 'empty').length === 0)
    .map((section) => section.attrs?.['data-section'] ?? '');
}

/**
 * V3 페이지 자신은 훑지 않는다: V3 페이지가 이 시나리오의 결과를 화면에 싣기 때문에,
 * 여기서 V3 을 렌더하면 페이지 → 시나리오 → 페이지 로 끝없이 되돌아간다.
 * V3 페이지의 7요소는 lab 단위 테스트(test/lab.test.ts)가 전체 페이지를 훑으며 확인한다.
 */
// 지연 계산: V3 페이지가 이 파일을 import 하므로(순환), 최상위에서 LAB_PAGES 를 읽으면
// 아직 초기화되지 않은 값을 건드린다. 호출 시점에 읽는다.
const scannedPages = (): readonly LabPage[] => LAB_PAGES.filter((page) => page.id !== 'V3');

/** 정상 — 모듈 페이지가 화면 7요소를 갖추고 판정 배지를 보인다. */
export const v3PageShowsSeven = defineScenario({
  id: 'v3-page-shows-seven',
  module: 'V3',
  kind: 'normal',
  purpose: '등록된 Lab 페이지가 화면 7요소를 갖추고 판정을 보인다 (V3 자신은 자기 참조라 제외).',
  arrange: (): readonly string[] => scannedPages().map((page) => page.id),
  act: (ids) =>
    ids.map((id) => {
      const page = scannedPages().find((entry) => entry.id === id)?.render();
      if (page === undefined) return { id, sections: [], filled: [], verdictOk: false, empty: 0 };
      return {
        id,
        sections: findByClass(page, 'section').map((section) => section.attrs?.['data-section'] ?? ''),
        filled: filledSections(page),
        verdictOk: findByClass(page, 'verdict').length === 1,
        empty: findByClass(page, 'empty').length,
      };
    }),
  assert: (pages): Assertion[] => [
    expectState('V3 을 뺀 페이지 4개를 훑는다', 4, pages.length),
    expectState(
      '모든 페이지가 7요소를 순서대로 갖는다',
      pages.map((page) => page.id),
      pages.filter((page) => String(page.sections) === String(SECTION_KEYS)).map((page) => page.id),
    ),
    expectState(
      '빈 섹션 없이 전부 채워져 있다',
      [],
      pages.filter((page) => page.empty > 0).map((page) => `${page.id}:${String(page.empty)}`),
    ),
    expectState(
      '모든 페이지에 판정 배지가 하나씩 있다',
      pages.map((page) => page.id),
      pages.filter((page) => page.verdictOk).map((page) => page.id),
    ),
    expectState(
      '통과 판정이 아닌 페이지가 없다',
      [],
      scannedPages().filter((page) =>
        findByClass(page.render(), 'verdict').every(
          (badge) => !(badge.attrs?.['class'] ?? '').includes('ok'),
        ),
      ).map((page) => page.id),
    ),
  ],
});

/** 실패 — 실패한 장면을 그리면 기대·실제·분기 경로가 화면에 강조돼 나온다. */
export const v3FailureHighlight = defineScenario({
  id: 'v3-failure-highlight',
  module: 'V3',
  kind: 'failure',
  purpose: '상태가 갈라지면 diff 뷰가 경로와 기대·실제를 강조해 보인다.',
  arrange: (): { readonly before: unknown; readonly after: unknown } => ({ before: BEFORE, after: AFTER }),
  act: ({ before, after }) => {
    const view = diffView(before, after, { leftLabel: '기대', rightLabel: '실제' });
    const rows = findByClass(view, 'divergent');
    const same = diffView(before, before);
    return {
      changedClass: view.attrs?.['class'] ?? '',
      rowCount: rows.length,
      firstRowClass: rows[0]?.attrs?.['class'] ?? '',
      firstPath: textOf(findByClass(rows[0] ?? view, 'path')[0] ?? ''),
      leftText: textOf(findByClass(rows[0] ?? view, 'left')[0] ?? ''),
      rightText: textOf(findByClass(rows[0] ?? view, 'right')[0] ?? ''),
      noteText: textOf(findByClass(view, 'diff-note')[0] ?? ''),
      sameClass: same.attrs?.['class'] ?? '',
      sameBadge: textOf(findByClass(same, 'badge')[0] ?? ''),
      html: toHtml(view),
    };
  },
  assert: (result): Assertion[] => [
    expectTrue('갈라진 diff 는 diff-changed 로 표시된다', result.changedClass.includes('diff-changed')),
    expectState('차이가 두 곳이다 (tick, stock.b)', 2, result.rowCount),
    expectTrue('첫 행이 최초 분기로 강조된다', result.firstRowClass.includes('divergent-first')),
    expectState('최초 분기 경로가 화면에 있다', '$.stock.b', result.firstPath),
    expectState('기대 값이 보인다', '5', result.leftText),
    expectState('실제 값이 보인다', '3', result.rightText),
    expectTrue('요약 줄이 경로를 다시 말해 준다', result.noteText.includes('$.stock.b'), result.noteText),
    expectTrue('같은 상태는 동일 배지로 표시된다', result.sameClass.includes('diff-same')),
    expectState('동일 배지 문구', '동일', result.sameBadge),
    expectTrue('HTML 로도 뽑을 수 있다', result.html.startsWith('<div class="diff'), result.html.slice(0, 40)),
  ],
});

/** 경계 — 빈 상태·직렬화 불가 상태·섹션 누락에서도 화면이 죽지 않고 사실을 드러낸다. */
export const v3Boundary = defineScenario({
  id: 'v3-boundary',
  module: 'V3',
  kind: 'boundary',
  purpose: '빈 상태·직렬화 불가 상태·섹션 누락에서도 화면이 죽지 않고 사실을 드러낸다.',
  arrange: (): { readonly dirty: string } => ({ dirty: 'function' }),
  act: () => {
    const emptyDiff = diffView({}, {});
    const nullDiff = diffView(null, undefined);
    // 상태 원소 규칙을 어긴 값 — 렌더러는 죽지 않고 "직렬화 불가" 를 화면에 남긴다.
    const dirtyDiff = diffView({ run: () => 1 }, { run: 2 });
    const missing = pageView({
      id: 'TEST',
      title: '섹션이 빠진 페이지',
      purpose: '빠뜨림이 숨지 않는지 본다.',
      verdict: { passed: false, label: '미완' },
      sections: { input: '입력만 있다' },
    });
    return {
      emptyIsSame: (emptyDiff.attrs?.['class'] ?? '').includes('diff-same'),
      nullIsSame: (nullDiff.attrs?.['class'] ?? '').includes('diff-same'),
      dirtyText: textOf(dirtyDiff),
      missingSectionCount: findByClass(missing, 'section').length,
      missingEmptyCount: findByClass(missing, 'empty').length,
      missingVerdict: textOf(findByClass(missing, 'verdict')[0] ?? ''),
      escaped: toHtml(pageView({
        id: 'ESC',
        title: '<script>',
        purpose: 'a & b < c',
        verdict: { passed: true, label: 'ok' },
        sections: { input: '<img onerror=1>' },
      })),
    };
  },
  assert: (result): Assertion[] => [
    expectTrue('빈 객체끼리는 동일로 그려진다', result.emptyIsSame),
    expectTrue('null 과 undefined 는 같은 상태로 본다', result.nullIsSame),
    expectTrue(
      '직렬화 불가능한 값은 그 사실이 화면에 남는다',
      result.dirtyText.includes('직렬화 불가'),
      result.dirtyText,
    ),
    expectState('섹션은 언제나 7개다', 7, result.missingSectionCount),
    expectState('채우지 않은 6개는 빈 섹션으로 드러난다', 6, result.missingEmptyCount),
    expectTrue('미완 판정이 배지에 보인다', result.missingVerdict.includes('미완'), result.missingVerdict),
    expectTrue('본문 문자열은 이스케이프된다', !result.escaped.includes('<img onerror'), result.escaped.slice(0, 80)),
    expectTrue('제목의 꺾쇠도 이스케이프된다', result.escaped.includes('&lt;script&gt;')),
    expectDeterministic('같은 상태면 같은 화면이다', () => diffView(BEFORE, AFTER), 10),
  ],
});

export const v3Scenarios = [v3PageShowsSeven, v3FailureHighlight, v3Boundary] as const;
