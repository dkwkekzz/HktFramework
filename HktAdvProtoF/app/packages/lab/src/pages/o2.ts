// /lab/o2 — O2 상태 스키마.
// 코드를 읽지 않아도 세 가지를 눈으로 셀 수 있어야 한다:
//   ① 원문이 두 번 다르게 적은 영역이 어떻게 9영역으로 좁혀졌는가
//   ② 9영역이 실제로 어떤 자리를 갖는가 (그리고 원문 필드가 다 자리를 얻었는가)
//   ③ 한 컷의 세계가 그 자리들 위에 어떻게 서는가, 세 틱 뒤에 무엇이 달라졌는가

import {
  assembleWorld,
  checkAgainstSchema,
  countSlots,
  describeDiff,
  describeValue,
  DOMAIN_RECONCILIATION,
  DOMAIN_SPECS,
  fieldsOf,
  MASTERPLAN_DOMAINS,
  ORIGINAL_FIELDS,
  reconcileDomains,
  reconciliationVerdict,
  schemaReport,
  schemaVerdict,
  STATE_DOMAINS,
  STATE_SCHEMA,
  worldDiff,
  worldSlots,
  type StateDomain,
} from '@hkt/core';
import { runScenarios } from '@hkt/scenarios';
import { o2Scenarios } from '@hkt/scenarios/suites/o2';
import {
  HUNTER_WORLD,
  HUNTER_WORLD_LATER,
  OFF_SCHEMA_STATES,
} from '@hkt/scenarios/suites/o2-hunter-world';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement, type VNode } from '../vnode.ts';

/** 해소 방식을 한글 한 마디로. */
const RESOLUTION_LABEL: Readonly<Record<string, string>> = {
  same: '같음',
  renamed: '개명',
  absorbed: '흡수',
  'not-a-domain': '영역 아님',
};

/** 개수를 막대로 — 게이지 렌더러가 서기 전의 최소판. */
function bar(count: number): string {
  return count === 0 ? '·' : '█'.repeat(Math.min(count, 20));
}

/** 긴 ID 를 화면에서 읽을 수 있게 줄인다 (접두사는 남긴다 — 종류가 보여야 한다). */
function shortId(id: string): string {
  const cut = id.indexOf(':');
  return cut < 0 ? id : `${id.slice(0, cut)}:${id.slice(cut + 1, cut + 5)}…`;
}

/** 경로 안의 매개 ID 도 줄인다. */
function shortPath(path: string): string {
  return path
    .split('.')
    .map((segment) => (segment.includes(':') ? shortId(segment) : segment))
    .join('.');
}

/** 한 영역의 자리 표. */
function domainFieldsTable(domain: StateDomain): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['경로']),
        h('th', {}, ['이름']),
        h('th', {}, ['보유자']),
        h('th', {}, ['값']),
        h('th', {}, ['근거']),
      ]),
    ]),
    h(
      'tbody',
      {},
      fieldsOf(STATE_SCHEMA, domain).map((field) =>
        h('tr', { class: 'ok' }, [
          h('td', {}, [h('code', {}, [field.path])]),
          h('td', {}, [field.label]),
          h('td', {}, [field.holder]),
          h('td', {}, [describeValue(field.value)]),
          h('td', {}, [field.note]),
        ]),
      ),
    ),
  ]);
}

export function o2Page(): VElement {
  const reconciliation = reconcileDomains();
  const schema = schemaReport();
  const suite = runScenarios(o2Scenarios);

  const assembled = assembleWorld(HUNTER_WORLD);
  const later = assembleWorld(HUNTER_WORLD_LATER);
  const diff = worldDiff(assembled.world, later.world);

  const brokenRows = OFF_SCHEMA_STATES.map((entry) => {
    const violation = checkAgainstSchema(STATE_SCHEMA, entry.value)[0];
    return {
      broke: entry.broke,
      expected: entry.expected,
      actual: violation?.rule ?? '(통과해 버렸다)',
      where: violation === undefined ? '' : shortPath(violation.where),
      message: violation?.message ?? '',
    };
  });
  const allRejected = brokenRows.every((row) => row.expected === row.actual);
  const passed =
    reconciliation.complete &&
    schema.complete &&
    assembled.violations.length === 0 &&
    allRejected &&
    suite.failed === 0;

  const spec: PageSpec = {
    id: 'O2',
    title: '상태 스키마',
    purpose: '세계의 모든 상태 값을 9영역 필드 트리 하나로 표현하고, 그 트리에 없는 값을 거부한다.',
    verdict: {
      passed,
      label: passed
        ? `${schemaVerdict(schema)} · 장면 ${String(countSlots(assembled.world))}자리 · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : [reconciliationVerdict(reconciliation), schemaVerdict(schema)].join(' · '),
    },
    sections: {
      input: keyValueView([
        ['원문 목록 ①', `MasterPlan §12.1 — ${MASTERPLAN_DOMAINS.join(' ')}`],
        ['원문 목록 ②', `ModulePlan O2 — ${DOMAIN_SPECS.map((d) => d.label).join(' ')}`],
        ['원문 필드', `${String(ORIGINAL_FIELDS.length)}개 (§12.1 본문이 영역별로 나열한 말)`],
        ['검증 장면', `붉은 장막 사냥꾼의 지금 — 상태 ${String(HUNTER_WORLD.length)}개`],
        ['결함 상태', `${String(OFF_SCHEMA_STATES.length)}종 (각자 다른 조항을 어긴다)`],
      ]),

      process: [
        h('p', {}, [
          '원문은 상태 영역을 두 번 나열했고 목록이 다르다. 둘 다 "9영역" 이라 부르지만 겹치는 것은 여섯뿐이다 — ' +
            'MasterPlan 이 쓴 이름 아홉이 어디로 갔는지 하나씩 적는다. 해소되지 않은 이름이 남으면 판정이 무너진다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['MasterPlan §12.1']),
              h('th', {}, ['해소']),
              h('th', {}, ['확정 영역']),
              h('th', {}, ['근거']),
            ]),
          ]),
          h(
            'tbody',
            {},
            DOMAIN_RECONCILIATION.map((entry) =>
              h('tr', { class: 'ok' }, [
                h('td', {}, [h('code', {}, [entry.original])]),
                h('td', {}, [RESOLUTION_LABEL[entry.resolution] ?? entry.resolution]),
                h('td', {}, [
                  entry.domain === null
                    ? h('span', { class: 'none' }, ['(없음 — R1 사건 로그)'])
                    : h('code', {}, [entry.domain]),
                ]),
                h('td', {}, [entry.reason]),
              ]),
            ),
          ),
        ]),
        h('p', { class: 'diff-note' }, [reconciliationVerdict(reconciliation)]),
      ],

      candidates: [
        h('p', {}, [
          '확정 9영역과 그 안의 자리들. 여기 없는 자리에는 값을 놓을 수 없다 — 이 표가 곧 "세계에 놓일 수 있는 값" 의 전부다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['영역']),
              h('th', {}, ['이름']),
              h('th', {}, ['자리 수']),
              h('th', {}, ['담는 것']),
              h('th', {}, ['원문 근거']),
            ]),
          ]),
          h(
            'tbody',
            {},
            DOMAIN_SPECS.map((domain) =>
              h('tr', { class: schema.byDomain[domain.domain] > 0 ? 'ok' : 'bad' }, [
                h('td', {}, [h('code', {}, [domain.domain])]),
                h('td', {}, [domain.label]),
                h('td', {}, [`${bar(schema.byDomain[domain.domain])} ${String(schema.byDomain[domain.domain])}`]),
                h('td', {}, [domain.holds]),
                h('td', { class: 'id' }, [domain.source]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['원문 필드 ↔ 스키마 자리']),
        h('p', {}, [
          '원문 §12.1 이 말로 나열한 필드가 어느 경로로 적히는가. 자리를 얻지 못한 말이 남으면 세계에 없는 값이다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['원문이 쓴 말']),
              h('th', {}, ['확정 영역']),
              h('th', {}, ['스키마 자리']),
              h('th', {}, ['원문 위치']),
            ]),
          ]),
          h(
            'tbody',
            {},
            ORIGINAL_FIELDS.map((original) =>
              h('tr', { class: original.paths.length > 0 ? 'ok' : 'bad' }, [
                h('td', {}, [original.name]),
                h('td', {}, [h('code', {}, [original.domain])]),
                h('td', {}, [
                  original.paths.length === 0
                    ? h('span', { class: 'none' }, ['(자리 없음)'])
                    : h('code', {}, [original.paths.join(' + ')]),
                ]),
                h('td', { class: 'id' }, [original.source]),
              ]),
            ),
          ),
        ]),
        h('p', { class: 'diff-note' }, [
          `원문 밖에서 늘어난 자리 ${String(schema.extraPaths.length)}개 — 생태·경제·초월 영역과 흡수분(거리·신념 압력). 근거는 각 자리의 note 에 적혀 있다.`,
        ]),
        ...STATE_DOMAINS.flatMap((domain): readonly VNode[] => [
          h('h3', {}, [`${domain} — ${DOMAIN_SPECS.find((d) => d.domain === domain)?.label ?? ''}`]),
          domainFieldsTable(domain),
        ]),
      ],

      selection: [
        h('p', {}, [
          '붉은 장막 사냥꾼의 지금이 그 자리들 위에 선다. 영역 → 보유자 → 경로 = 값 — 이것이 세계 트리다. ' +
            '상태 원소 목록과 이 트리는 같은 사실의 두 모양이며, 조립·분해를 왕복해도 같아야 한다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['영역']),
              h('th', {}, ['보유자']),
              h('th', {}, ['경로']),
              h('th', {}, ['값']),
            ]),
          ]),
          h(
            'tbody',
            {},
            worldSlots(assembled.world).map((slot) =>
              h('tr', { class: 'ok' }, [
                h('td', {}, [h('code', {}, [slot.domain])]),
                h('td', { class: 'id' }, [shortId(slot.ofId)]),
                h('td', {}, [h('code', {}, [shortPath(slot.path)])]),
                h('td', { class: 'num' }, [String(slot.value)]),
              ]),
            ),
          ),
        ]),
        h('p', { class: 'diff-note' }, [
          `상태 ${String(HUNTER_WORLD.length)}개 → 자리 ${String(countSlots(assembled.world))}개 · 거부 ${String(assembled.violations.length)}개 · 세계에 이름이 오른 존재 ${String(new Set(worldSlots(assembled.world).map((s) => s.ofId)).size)}`,
        ]),
      ],

      beforeAfter: [
        h('h3', {}, ['지금 → 세 틱 뒤']),
        h('p', {}, [
          '굶주림이 가라앉고 체력이 깎였고 약초를 하나 썼다. 행상에게 진 빚은 사라졌고, 둥지에 온도가 적히기 시작했다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [h('th', {}, ['변화']), h('th', {}, ['자리']), h('th', {}, ['전']), h('th', {}, ['후'])]),
          ]),
          h(
            'tbody',
            {},
            diff.map((entry) =>
              h('tr', { class: entry.change === 'removed' ? 'bad' : 'ok' }, [
                h('td', {}, [entry.change]),
                h('td', {}, [h('code', { class: 'path' }, [shortPath(entry.where)])]),
                h('td', {}, [entry.before === null ? h('span', { class: 'none' }, ['(없음)']) : String(entry.before)]),
                h('td', {}, [entry.after === null ? h('span', { class: 'none' }, ['(없음)']) : String(entry.after)]),
              ]),
            ),
          ),
        ]),
        // 자리 이름만 줄인다 — 문장 전체에 shortPath 를 걸면 값까지 잘려 나간다.
        h('p', { class: 'diff-note' }, [
          diff.map((entry) => describeDiff({ ...entry, where: shortPath(entry.where) })).join(' · '),
        ]),
      ],

      failure: [
        h('p', {}, [
          '결함 상태는 무엇을 어겼고 어디서 걸리는가. 아홉 중 여덟은 ',
          h('strong', {}, ['O1 로서는 온전한 State']),
          ' 다 — O2 가 없으면 그대로 세계에 들어갔을 값들이다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['어긴 것']),
              h('th', { class: 'nowrap' }, ['걸려야 할 사유']),
              h('th', { class: 'nowrap' }, ['실제']),
              h('th', {}, ['자리']),
              h('th', {}, ['메시지']),
            ]),
          ]),
          h(
            'tbody',
            {},
            brokenRows.map((row) =>
              h('tr', { class: row.expected === row.actual ? 'ok' : 'bad' }, [
                h('td', {}, [row.broke]),
                h('td', { class: 'nowrap' }, [h('code', {}, [row.expected])]),
                h('td', { class: 'nowrap' }, [h('code', { class: 'path' }, [row.actual])]),
                h('td', { class: 'id' }, [row.where]),
                h('td', {}, [row.message]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['시나리오 3종']),
        suiteView(suite),
      ],

      causality: lines(
        '원문 두 목록 → 이름별 해소(같음·개명·흡수·영역 아님) → 확정 9영역 → 영역별 자리 카탈로그',
        '해소되지 않은 원문 이름이 남거나 자리를 못 얻은 원문 필드가 남으면 미완결이다 — 어느 쪽도 조용히 지나가지 않는다',
        'O1 은 "State 로서 온전한가" 만 본다. "세계에 그런 자리가 있는가" 는 O2 가 본다 — 두 관문은 겹치지 않는다',
        '조립은 관문이다. 어긴 상태는 트리에 들어가지 않고 사유로 남는다 — 세계는 조용히 넓어지지 않는다',
        '상태 목록과 세계 트리는 왕복한다. ID 는 유래(보유자 + 영역.경로)에서 다시 만들어지므로 리플레이가 성립한다',
        '같은 자리에 값이 둘이면 뒤가 막힌다 — 상태는 사건(R1)으로만 바뀐다',
      ),
    },
  };

  return pageView(spec);
}
