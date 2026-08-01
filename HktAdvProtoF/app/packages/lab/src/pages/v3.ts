// /lab/v3 — V3 Lab 자신. 렌더러가 스스로를 그려 보인다.

import { stateHash } from '@hkt/core/v1';
import { runScenarios } from '@hkt/scenarios';
import { v3Scenarios } from '../../suites/v3.ts';

import { lines, pageView, SECTION_KEYS, type PageSpec } from '../page.ts';
import { diffView, keyValueView, valueView } from '../renderers/diff.ts';
import { suiteView } from '../renderers/scenario.ts';
import { findByClass, h, toHtml, type VElement } from '../vnode.ts';

const BEFORE = { tick: 0, stock: { a: 3, b: 5 } };
// b 만 두 배로 깎인 결함 상태 — 차이는 stock.b 와 tick 두 곳이다.
const AFTER = { tick: 1, stock: { a: 3, b: 3 } };

export function v3Page(): VElement {
  const suite = runScenarios(v3Scenarios);
  const sample = diffView(BEFORE, AFTER);
  const divergentRows = findByClass(sample, 'divergent');

  const spec: PageSpec = {
    id: 'V3',
    title: '브라우저 검증 Lab',
    purpose: '코드를 읽지 않아도 모듈 작동을 브라우저에서 눈으로 확인하게 한다.',
    verdict: {
      passed: suite.failed === 0,
      label: `페이지 5개 · 화면 7요소 고정 · 시나리오 ${String(suite.passed)}/${String(suite.total)}`,
    },
    sections: {
      input: [
        h('p', {}, ['렌더러의 입력은 임의의 상태 값이다. 아래 두 상태를 diff 뷰에 넣어 본다.']),
        keyValueView([
          ['왼쪽 (전)', BEFORE],
          ['오른쪽 (후)', AFTER],
        ]),
      ],
      process: [
        h('p', {}, [
          '렌더러는 순수 함수 `상태 → VNode` 다. 출력이 DOM 이 아니라 직렬화 가능한 트리이므로 ' +
            '브라우저 없이도 화면을 단언할 수 있고, 화면 자체를 해시로 비교할 수 있다.',
        ]),
        keyValueView([
          ['화면 트리 해시', stateHash(sample)],
          ['강조된 분기 행', divergentRows.length],
        ]),
      ],
      candidates: [
        h('p', {}, ['화면 7요소 — 모든 모듈 페이지가 같은 골격을 갖는다. 빠뜨리면 빈 섹션으로 드러난다.']),
        valueView(SECTION_KEYS),
      ],
      selection: [
        h('p', {}, ['공용 렌더러 — 지금은 diff 뷰가 기본이고, 그래프·게이지는 최소판이 V0·V4 페이지에 있다.']),
        h('table', { class: 'kv-table' }, [
          h('tbody', {}, [
            h('tr', {}, [h('th', {}, ['diff 뷰']), h('td', {}, ['구현됨 — 상태 전후·기대/실제·분기 경로 강조'])]),
            h('tr', {}, [h('th', {}, ['그래프 뷰']), h('td', {}, ['최소판 — V0 의존 DAG (노드 색 = status)'])]),
            h('tr', {}, [h('th', {}, ['게이지·수치판']), h('td', {}, ['최소판 — V4 검증 항목 표식'])]),
            h('tr', {}, [h('th', {}, ['타임라인']), h('td', {}, ['미구현 — R1·E2 착수 시 작업 카드로'])]),
            h('tr', {}, [h('th', {}, ['3D 씬']), h('td', {}, ['미구현 — X 계층 착수 시 작업 카드로'])]),
          ]),
        ]),
      ],
      beforeAfter: [
        h('h3', {}, ['diff 뷰 자신의 출력']),
        sample,
        h('h3', {}, ['같은 렌더러의 HTML']),
        h('pre', { class: 'value-block' }, [h('code', {}, [toHtml(sample).slice(0, 400)])]),
      ],
      failure: suiteView(suite),
      causality: lines(
        '렌더러가 순수 함수라서, 화면도 다른 상태 원소와 똑같이 검증된다 (원칙 ③)',
        '브라우저는 VNode 를 DOM 으로 옮기기만 한다 — 판단 로직이 화면에 숨지 않는다',
        'Lab 은 core·scenarios·contracts 를 그대로 실행한다 — 서버와 같은 코드, 같은 해시',
        '계약·증거는 스냅샷(src/data.generated.ts)으로 들어온다 — 낡으면 테스트가 잡는다',
      ),
    },
  };

  return pageView(spec);
}
