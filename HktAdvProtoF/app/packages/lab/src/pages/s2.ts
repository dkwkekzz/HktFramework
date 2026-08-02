// /lab/s2 — S2 문화·역할 원형.
//
// 화면이 보여야 하는 것은 하나다: **같은 종에서 태어난 둘이 문화로 갈린다.**
// 그래서 가운데에 "같은 빛, 세 문화" 대조표를 놓는다 — 같은 사냥꾼 종의 셋이 같은 붉은 빛을
// 보고 서로 다른 것을 읽고 서로 다른 쪽으로 움직이고 서로 다른 것을 할 수 있게 된다.
// 그 위로는 문화 셋이 각자 무엇을 읽고 무엇을 원하고 어떤 자리를 갖는지를,
// 아래로는 설 수 없는 문화 열다섯이 왜 막히는지를 편다.

import {
  applyRole,
  checkCulture,
  checkCultures,
  cultureVerdict,
  divergences,
  readingSummary,
  readingSentence,
  roleSummary,
  seedWithCulture,
  sensedChannels,
  STANCE_LABELS,
  valueTemplateSummary,
  type CultureArchetype,
  type SubjectSeed,
} from '@hkt/core/s2';
import { seedFromSpecies } from '@hkt/core/s1';
import { subjectIdOf } from '@hkt/core/s0';
import { runScenarios } from '@hkt/scenarios';
import { s2Scenarios } from '@hkt/scenarios/suites/s2';
import {
  hunterArchetype,
  hunterBodyId,
  veilWormArchetype,
  VEIL_SPECIES,
} from '@hkt/scenarios/suites/s1-veil-species';
import {
  beaterRole,
  BROKEN_CULTURES,
  huntCulture,
  porterRole,
  priestRole,
  riteCulture,
  S2_DEFINITIONS,
  tradeCulture,
  VEIL_CULTURES,
} from '@hkt/scenarios/suites/s2-veil-cultures';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

/** 세 문화가 전부 읽는 표식 하나 — 갈림이 일어나는 자리. */
const SHARED_SIGN = '붉은 장막의 빛';

/** 같은 사냥꾼 종의 셋 — 문화와 자리만 다르다. */
const CASTS = [
  { label: '사냥꾼 04', culture: huntCulture, role: beaterRole },
  { label: '사냥꾼 09', culture: riteCulture, role: priestRole },
  { label: '사냥꾼 21', culture: tradeCulture, role: porterRole },
] as const;

function bornInto(cast: (typeof CASTS)[number]): SubjectSeed {
  const subjectId = subjectIdOf(hunterArchetype.id, cast.label);
  return seedWithCulture(
    seedFromSpecies(hunterArchetype, { subjectId, bodyId: hunterBodyId, stage: '성체' }),
    cast.culture,
    cast.role,
    { subjectId, bodyId: hunterBodyId },
  );
}

export function s2Page(): VElement {
  const report = checkCultures(VEIL_CULTURES, VEIL_SPECIES, S2_DEFINITIONS);
  const suite = runScenarios(s2Scenarios);

  const brokenRows = BROKEN_CULTURES.map((entry) => {
    const violations = checkCulture(entry.value, VEIL_SPECIES, S2_DEFINITIONS);
    const first = violations[0];
    return {
      broke: entry.broke,
      expected: entry.expected,
      actual: first === undefined ? '(통과해 버렸다)' : first.rule,
      path: first?.path ?? '',
      where: first?.roleName ?? '',
      message: first?.message ?? '',
    };
  });
  const allRejected = brokenRows.every((row) => row.expected === row.actual);

  /** 같은 종에서 나온 셋 — 같은 눈, 다른 세계. */
  const castRows = CASTS.map((cast) => {
    const seed = bornInto(cast);
    const reading = seed.readings.find(
      (entry) => entry.channel === 'light' && entry.sign === SHARED_SIGN,
    );
    return { cast, seed, reading };
  });

  const shared = castRows[0]?.seed;
  const sameEyes =
    shared !== undefined &&
    castRows.every(
      (row) =>
        JSON.stringify(row.seed.perception) === JSON.stringify(shared.perception),
    );

  const spec: PageSpec = {
    id: 'S2',
    title: '문화·역할 원형',
    purpose:
      '같은 종에서 태어난 둘이 문화·역할에 따라 같은 세계를 다르게 읽고 다른 것을 원하고 다른 것을 할 수 있게 한다.',
    verdict: {
      passed: report.complete && suite.failed === 0 && allRejected && sameEyes,
      label: report.complete
        ? `${cultureVerdict(report)} · 같은 종의 셋이 같은 빛을 셋으로 읽는다 · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : cultureVerdict(report),
    },
    sections: {
      input: keyValueView([
        ['문화 선언', `${String(VEIL_CULTURES.length)}개 — 전부 사냥꾼 종 하나 위에 선다 (붉은 장막 세계)`],
        [
          '문화가 딛는 바닥',
          `S1 사냥꾼 종 — 통로 ${sensedChannels(hunterArchetype.senses).join(' · ')} / 능력 ${String(hunterArchetype.capabilities.length)}개`,
        ],
        ['자리', `${String(VEIL_CULTURES.reduce((sum, culture) => sum + culture.roles.length, 0))}개 — 문화마다 둘`],
        ['정의 집합', `${String(S2_DEFINITIONS.length)}개 — S1 이 세운 것 그대로. 문화는 정의를 더하지 않고 인용만 한다`],
        ['결함 문화', `${String(BROKEN_CULTURES.length)}종`],
      ]),

      process: [
        h('p', {}, [
          '문화는 종을 대신하지 않는다. 종이 준 것(감각·의존)은 그대로 두고 그 위에 셋을 얹는다 — 본 것을 무엇으로 읽는가, 무엇을 원하는가, 무엇을 할 수 있고 무엇을 해서는 안 되는가.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['개체의 자리']),
              h('th', {}, ['어디서 오는가']),
              h('th', {}, ['무엇이 막는가']),
            ]),
          ]),
          h('tbody', {}, [
            h('tr', {}, [
              h('td', {}, ['감각 (perception)']),
              h('td', {}, ['종 (S1)']),
              h('td', {}, ['기관 없는 통로는 열리지 않는다']),
            ]),
            h('tr', {}, [
              h('td', {}, ['의존 (needs)']),
              h('td', {}, ['종 (S1)']),
              h('td', {}, ['종이 열지 않은 자리로 무너질 수 없다']),
            ]),
            h('tr', { class: 'ok' }, [
              h('td', {}, ['읽기 (readings)']),
              h('td', {}, ['문화 + 자리 (S2)']),
              h('td', {}, ['종이 감지하지 못하는 통로는 읽지 못한다']),
            ]),
            h('tr', { class: 'ok' }, [
              h('td', {}, ['원함 (values)']),
              h('td', {}, ['문화 + 자리 (S2)']),
              h('td', {}, ['종이 무너지는 자리를 다시 밀 수 없다']),
            ]),
            h('tr', { class: 'ok' }, [
              h('td', {}, ['능력 (capabilities)']),
              h('td', {}, ['종 + 자리가 연 것 − 금기']),
              h('td', {}, ['공리를 어긴 능력은 입문 의례로도 열리지 않는다']),
            ]),
          ]),
        ]),
        h('h3', {}, ['읽기가 미는 방향 3종']),
        lines(
          ...Object.entries(STANCE_LABELS).map(
            ([stance, label]) => `${stance} — ${label}`,
          ),
        ),
      ],

      candidates: [
        h('p', {}, [
          '붉은 장막 세계의 문화 셋 — 같은 협곡, 같은 종. 무엇을 읽고 무엇을 원하고 어떤 자리를 갖는가.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['문화']),
              h('th', {}, ['읽기']),
              h('th', {}, ['원함']),
              h('th', {}, ['자리']),
            ]),
          ]),
          h(
            'tbody',
            {},
            VEIL_CULTURES.map((culture: CultureArchetype) =>
              h('tr', { class: 'ok' }, [
                h('td', {}, [culture.name]),
                h('td', {}, [readingSummary(culture.readings)]),
                h('td', {}, [valueTemplateSummary(culture.values)]),
                h('td', {}, [culture.roles.map((role) => roleSummary(role)).join(' / ')]),
              ]),
            ),
          ),
        ]),
      ],

      selection: [
        h('p', {}, [
          `같은 사냥꾼 종에서 세 개체를 뽑는다. 눈은 하나인데 세계가 셋이다 — 같은 「${SHARED_SIGN}」 을 앞에 두고 하나는 쫓고 하나는 엎드리고 하나는 값을 센다.`,
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['개체']),
              h('th', {}, ['문화 / 자리']),
              h('th', {}, [`「${SHARED_SIGN}」 을 무엇으로 읽는가`]),
              h('th', {}, ['움직임']),
              h('th', {}, ['원하는 자리']),
              h('th', {}, ['할 수 있는 것']),
            ]),
          ]),
          h(
            'tbody',
            {},
            castRows.map((row) =>
              h('tr', { class: 'ok' }, [
                h('td', {}, [row.cast.label]),
                h('td', {}, [`${row.cast.culture.name} / ${row.cast.role.name}`]),
                h('td', {}, [row.reading?.assertion ?? '(읽지 않는다)']),
                h('td', {}, [
                  row.reading === undefined ? '—' : STANCE_LABELS[row.reading.stance],
                ]),
                h('td', {}, [row.seed.values.map((value) => value.slot.path).join(' · ')]),
                h('td', {}, [String(row.seed.capabilities.length)]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['셋이 공유하는 것 — 종이 준 것은 문화로 바뀌지 않는다']),
        keyValueView([
          [
            '감각',
            sameEyes
              ? `셋이 같다 — ${sensedChannels(hunterArchetype.senses).join(' · ')} (문화는 눈을 바꾸지 않는다)`
              : '갈렸다 — 문화가 종의 감각을 건드렸다',
          ],
          [
            '무너질 조건',
            (shared?.needs ?? [])
              .map((need) => `${need.slot.path} ${String(need.collapseAfterTicks)}틱`)
              .join(' · '),
          ],
          [
            '갈리는 자리',
            `${String(divergences(huntCulture.readings, riteCulture.readings).filter((entry) => entry.differs).length)}개의 표식에서 사냥과 제의가 갈린다`,
          ],
        ]),
      ],

      beforeAfter: [
        h('p', {}, [
          '종 씨앗에 문화가 겹치기 전과 후 — 무엇이 그대로이고 무엇이 갈리는가.',
        ]),
        keyValueView([
          [
            '종 씨앗 (S1)',
            `감각 ${String(hunterArchetype.senses.length)} · 의존 ${String(hunterArchetype.baseNeeds.length)} · 능력 ${String(hunterArchetype.capabilities.length)} — 이 종의 모든 개체가 같다`,
          ],
          ...castRows.map(
            (row): readonly [string, string] => [
              `${row.cast.label} 의 씨앗`,
              `읽기 ${String(row.seed.readings.length)} · 원함 ${String(row.seed.values.length)} · 능력 ${String(row.seed.capabilities.length)} (${row.cast.culture.name} / ${row.cast.role.name})`,
            ],
          ),
          [
            '금기가 하는 일',
            `몰이꾼은 전언 새김을 잃는다 — ${String(hunterArchetype.capabilities.length)} → ${String(applyRole(hunterArchetype.capabilities, beaterRole.grants, beaterRole.taboos).length)}`,
          ],
          [
            '입문 의례가 하는 일',
            `사제는 장막 부름을 얻는다 — ${String(hunterArchetype.capabilities.length)} → ${String(applyRole(hunterArchetype.capabilities, priestRole.grants, priestRole.taboos).length)}`,
          ],
        ]),
        h('h3', {}, ['자리가 문화를 덮는 자리']),
        lines(
          ...riteCulture.roles.map(
            (role) =>
              `${role.name} — ${role.readings.length + role.values.length === 0 ? '문화의 읽기·원함을 그대로 쓴다' : `${role.readings.map((reading) => readingSentence(reading)).join(' · ')}${role.values.length > 0 ? ` / ${valueTemplateSummary(role.values)}` : ''}`}`,
          ),
        ),
      ],

      failure: [
        h('p', {}, [
          `설 수 없는 문화는 무엇을 어겼고 어느 자리에서 막히는가. 전부 O1 Rule 로서는 온전하거나(하나만 예외), 종을 넘어서려다 막힌다. 장막벌레는 ${sensedChannels(veilWormArchetype.senses).join(' · ')} 만 열므로 빛의 문화를 지닐 수 없다.`,
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['어긴 것']),
              h('th', {}, ['걸려야 할 사유']),
              h('th', {}, ['실제']),
              h('th', {}, ['자리']),
              h('th', {}, ['어디서']),
              h('th', {}, ['왜']),
            ]),
          ]),
          h(
            'tbody',
            {},
            brokenRows.map((row) =>
              h('tr', { class: row.expected === row.actual ? 'ok' : 'bad' }, [
                h('td', {}, [row.broke]),
                h('td', {}, [h('code', {}, [row.expected])]),
                h('td', {}, [h('code', {}, [row.actual])]),
                h('td', { class: 'path' }, [row.path]),
                h('td', {}, [row.where === '' ? '문화' : row.where]),
                h('td', {}, [row.message]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['시나리오 3종']),
        suiteView(suite),
      ],

      causality: lines(
        '문화는 본 것에 이름을 붙인다 — 감각이 "무엇이 왔는가" 까지 답하고, 문화가 "그것이 무엇인가" 를 답한다',
        '읽기는 진실이 아니라 O1 Claim 이다 — 확신 0.95 의 제의도 틀릴 수 있고, 세계는 실제를 따로 갖고 있다',
        '문화는 종 위에 얹히지 종을 대신하지 않는다 — 감지하지 못하는 통로는 읽히지 않고, 무너지는 자리는 다시 밀리지 않는다',
        '무엇을 원하는지는 지어내는 것이 아니라 물려받는 것이다 — S0 이 개체에게 맡겼던 마지막 자리가 여기로 왔다',
        '자리(역할)가 행동 가능성을 가른다 — 입문 의례가 종에 없던 능력을 열고, 금기가 종이 준 능력을 막는다',
        '공리는 문화도 예외로 두지 않는다 — 대가 없는 능력은 어느 입문 의례로도 열리지 않는다',
        '금기가 전부를 막으면 그것은 문화가 아니라 소멸이다 — 아무것도 할 수 없는 주체는 S0 이 사물이라 불렀다',
        '개체가 손으로 적을 것은 이제 이름표와 경계뿐이다 — 남은 이력·성격·관계는 S3 이 얹는다',
      ),
    },
  };

  return pageView(spec);
}
