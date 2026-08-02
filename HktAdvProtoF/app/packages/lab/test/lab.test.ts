// V3 Lab 단위 테스트 — 화면 트리·렌더러·데이터 스냅샷.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildRegistry } from '@hkt/contracts';
import { loadContractSources, loadEvidence } from '@hkt/contracts/load';
import { stateHash } from '@hkt/core/v1';
import { formatResult, runScenarios } from '@hkt/scenarios';

import { CONTRACT_SOURCES, EVIDENCE } from '../src/data.ts';
import {
  diffView,
  findByClass,
  h,
  LAB_PAGES,
  pageFor,
  pageView,
  SECTION_KEYS,
  shellView,
  textOf,
  toHtml,
} from '../src/index.ts';
import { allScenarios } from '../suites/index.ts';

const contractsDir = new URL('../../contracts/', import.meta.url);
const evidenceDir = new URL('../../contracts/evidence/', import.meta.url);

describe('VNode', () => {
  test('h 는 빈 속성·자식을 남기지 않는다', () => {
    assert.deepEqual(h('br'), { tag: 'br' });
    assert.deepEqual(h('p', { class: 'x' }, ['hi']), { tag: 'p', attrs: { class: 'x' }, children: ['hi'] });
  });

  test('화면 트리는 직렬화 가능하다 — 해시로 비교된다', () => {
    const view = diffView({ a: 1 }, { a: 2 });
    assert.deepEqual(JSON.parse(JSON.stringify(view)) as unknown, view);
    assert.equal(stateHash(view), stateHash(diffView({ a: 1 }, { a: 2 })));
  });

  test('toHtml 은 텍스트와 속성을 이스케이프한다', () => {
    assert.equal(toHtml(h('p', { title: 'a"b' }, ['<x>&'])), '<p title="a&quot;b">&lt;x&gt;&amp;</p>');
    assert.equal(toHtml(h('br')), '<br>');
  });

  test('textOf 는 트리의 모든 글자를 모은다', () => {
    assert.equal(textOf(h('p', {}, ['a', h('b', {}, ['c'])])), 'ac');
  });
});

describe('diff 뷰', () => {
  test('같으면 동일 배지', () => {
    const view = diffView({ a: 1 }, { a: 1 });
    assert.ok((view.attrs?.['class'] ?? '').includes('diff-same'));
  });

  test('다르면 경로별 행과 최초 분기 강조', () => {
    const view = diffView({ a: 1, b: 2 }, { a: 1, b: 9 });
    const rows = findByClass(view, 'divergent');
    assert.equal(rows.length, 1);
    assert.ok((rows[0]?.attrs?.['class'] ?? '').includes('divergent-first'));
    assert.equal(textOf(findByClass(rows[0] ?? view, 'path')[0] ?? ''), '$.b');
  });

  test('직렬화 불가능한 값도 표기는 남긴다', () => {
    assert.ok(textOf(diffView({ fn: () => 1 }, { fn: 2 })).includes('직렬화 불가'));
  });
});

describe('페이지', () => {
  test('모든 페이지가 7요소를 순서대로 갖는다', () => {
    for (const page of LAB_PAGES) {
      const sections = findByClass(page.render(), 'section').map(
        (section) => section.attrs?.['data-section'],
      );
      assert.deepEqual(sections, [...SECTION_KEYS], page.id);
    }
  });

  test('빠뜨린 섹션은 빈 섹션으로 드러난다', () => {
    const page = pageView({
      id: 'T',
      title: 't',
      purpose: 'p',
      verdict: { passed: true, label: 'ok' },
      sections: { input: 'only' },
    });
    assert.equal(findByClass(page, 'empty').length, 6);
  });

  test('라우팅은 없는 경로에서 첫 페이지로 떨어진다', () => {
    assert.equal(pageFor('/v2').id, 'V2');
    assert.equal(pageFor('/없음').id, LAB_PAGES[0]?.id);
  });

  test('셸이 활성 링크를 표시한다', () => {
    const shell = shellView(pageFor('/v2'));
    const active = findByClass(shell, 'active');
    assert.equal(active.length, 1);
    assert.equal(active[0]?.attrs?.['href'], '#/v2');
  });

  test('페이지 렌더는 결정적이다', () => {
    for (const page of LAB_PAGES) {
      assert.equal(stateHash(page.render()), stateHash(page.render()), page.id);
    }
  });
});

describe('데이터 스냅샷', () => {
  test('계약 스냅샷이 실제 파일과 같다', () => {
    assert.deepEqual(
      CONTRACT_SOURCES,
      loadContractSources(contractsDir),
      '스냅샷이 낡았다 — node packages/lab/scripts/generate-data.ts 로 다시 만들 것',
    );
  });

  test('증거 스냅샷이 실제 파일과 같다', () => {
    assert.deepEqual(
      EVIDENCE,
      Object.fromEntries(loadEvidence(evidenceDir)),
      '스냅샷이 낡았다 — node packages/lab/scripts/generate-data.ts 로 다시 만들 것',
    );
  });

  test('스냅샷 텍스트는 줄 끝이 LF 다 — 체크아웃이 CRLF 여도 대조가 갈리지 않는다', () => {
    for (const source of CONTRACT_SOURCES) {
      assert.ok(!source.text.includes('\r'), `${source.name}: 스냅샷에 CR 이 남았다`);
    }
  });

  test('스냅샷만으로 레지스트리를 세울 수 있다 (브라우저에도 파일이 필요 없다)', () => {
    const registry = buildRegistry(CONTRACT_SOURCES);
    assert.ok(registry.modules.length > 0);
    assert.deepEqual(registry.rejected, []);
  });
});

describe('V3 시나리오 3종 + 하위 계층 전체', () => {
  const suite = runScenarios(allScenarios);

  for (const result of suite.results) {
    test(`${result.module} · ${result.scenarioId} (${result.kind})`, () => {
      assert.equal(result.passed, true, `\n${formatResult(result)}`);
    });
  }

  test('등록된 모든 모듈이 3종 커버리지를 채운다', () => {
    assert.deepEqual(
      suite.coverage.filter((entry) => !entry.complete).map((entry) => entry.module),
      [],
    );
  });
});
