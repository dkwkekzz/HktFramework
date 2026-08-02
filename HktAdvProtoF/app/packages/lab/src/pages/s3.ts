// /lab/s3 — S3 개별 주체 생성.
//
// 화면이 보여야 하는 것은 둘이다.
//   ① **같은 문화·같은 자리의 셋이 이력과 성격으로 갈린다** — 가운데 대조표.
//   ② **그 갈림의 하나하나가 유래를 댄다** — 개체 카드의 값마다 붙는 유래 배지.
//
// ②가 S3 의 본론이다. 다섯 층이 쌓인 뒤에도 "이 숫자는 어디서 왔는가" 에 답할 수 있어야
// 개체 카드가 숫자 더미가 되지 않는다.

import {
  capabilityKey,
  checkInstance,
  checkInstances,
  historySummary,
  instanceVerdict,
  needKey,
  ORIGIN_LABELS,
  originCounts,
  originOf,
  readingKey,
  residueSummary,
  traitSummary,
  TUNE_LABELS,
  VALUE_ORIGINS,
  valueKey,
  type Provenance,
  type SubjectInstance,
  type ValueOrigin,
} from '@hkt/core/s3';
import { readingLabel } from '@hkt/core/s2';
import { runScenarios } from '@hkt/scenarios';
import { s3Scenarios } from '@hkt/scenarios/suites/s3';
import { hunterArchetype } from '@hkt/scenarios/suites/s1-veil-species';
import {
  bareInstance,
  BROKEN_INSTANCES,
  greedyInstance,
  NOW,
  priestInstance,
  S3_DEFINITIONS,
  trackerInstance,
  VEIL_CULTURES,
  VEIL_INSTANCES,
} from '@hkt/scenarios/suites/s3-veil-instances';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement, type VNode } from '../vnode.ts';

/** 세 몰이꾼이 전부 읽는 표식 하나 — 갈림이 눈에 보이는 자리. */
const SHARED_SIGN = '붉은 장막의 빛';

const BEATERS: readonly SubjectInstance[] = [trackerInstance, greedyInstance, bareInstance];

function confidenceOf(instance: SubjectInstance): number | null {
  return instance.readings.find((reading) => reading.sign === SHARED_SIGN)?.confidence ?? null;
}

function trustWeightOf(instance: SubjectInstance): number | null {
  return instance.values.find((value) => value.slot.path.startsWith('trust.'))?.weight ?? null;
}

/** 유래 배지 한 칸 — 어디서 왔는지 + 흔들었으면 배수까지. */
function originCell(entry: Provenance | null): VNode {
  if (entry === null) return h('td', { class: 'bad' }, ['(유래를 못 댄다)']);
  const scale = entry.scale === undefined ? '' : ` ×${String(entry.scale)}`;
  return h('td', { class: entry.origin === 'trait' ? 'ok' : '' }, [
    h('code', {}, [ORIGIN_LABELS[entry.origin]]),
    ` ${entry.from}${scale}`,
  ]);
}

/** 개체 하나의 값 전부를 유래와 함께 편다. */
function instanceCard(instance: SubjectInstance): VNode {
  const rows: readonly { readonly what: string; readonly value: string; readonly key: string }[] = [
    ...instance.needs.map((need) => ({
      what: `의존 ${need.slot.path}`,
      value: `급함 ${String(Math.round(need.urgency * 100) / 100)} · ${String(need.collapseAfterTicks)}틱`,
      key: needKey(need),
    })),
    ...instance.values.map((value) => ({
      what: `원함 ${value.slot.path}`,
      value: `힘 ${String(Math.round(value.weight * 100) / 100)}`,
      key: valueKey(value),
    })),
    ...instance.readings.map((reading) => ({
      what: `읽기 ${readingLabel(reading)}`,
      value: `"${reading.assertion}" 확신 ${String(Math.round(reading.confidence * 100) / 100)}`,
      key: readingKey(reading),
    })),
    ...instance.capabilities.map((id) => ({
      what: '능력',
      value: id,
      key: capabilityKey(id),
    })),
    ...instance.residue.map((entry) => ({
      what: `지금 남은 것 ${entry.slot.path}`,
      value: JSON.stringify(entry.value),
      key: `residue:${entry.slot.domain}.${entry.slot.path}`,
    })),
  ];

  return h('div', {}, [
    h('h3', {}, [`${instance.name} — ${historySummary(instance.history)} / ${traitSummary(instance.traits)}`]),
    h('table', { class: 'kv-table' }, [
      h('thead', {}, [
        h('tr', {}, [h('th', {}, ['무엇']), h('th', {}, ['값']), h('th', {}, ['어디서 왔는가'])]),
      ]),
      h(
        'tbody',
        {},
        rows.map((row) =>
          h('tr', {}, [
            h('td', {}, [row.what]),
            h('td', {}, [row.value]),
            originCell(originOf(instance, row.key)),
          ]),
        ),
      ),
    ]),
  ]);
}

export function s3Page(): VElement {
  const report = checkInstances(VEIL_INSTANCES, VEIL_CULTURES, S3_DEFINITIONS);
  const suite = runScenarios(s3Scenarios);

  const brokenRows = BROKEN_INSTANCES.map((entry) => {
    const culture = VEIL_CULTURES.find((one) => one.id === entry.value.cultureId) ?? null;
    const first = checkInstance(entry.value, culture, S3_DEFINITIONS)[0];
    return {
      broke: entry.broke,
      expected: entry.expected,
      actual: first === undefined ? '(통과해 버렸다)' : first.rule,
      path: first?.path ?? '',
      message: first?.message ?? '',
    };
  });
  const allRejected = brokenRows.every((row) => row.expected === row.actual);

  // 유래를 못 대는 값이 하나라도 있으면 이 화면의 판정이 무너진다.
  const orphans = VEIL_INSTANCES.flatMap((instance) =>
    [
      ...instance.needs.map((need) => needKey(need)),
      ...instance.values.map((value) => valueKey(value)),
      ...instance.readings.map((reading) => readingKey(reading)),
      ...instance.capabilities.map((id) => capabilityKey(id)),
    ].filter((key) => originOf(instance, key) === null),
  );

  const spec: PageSpec = {
    id: 'S3',
    title: '개별 주체 생성',
    purpose:
      '종·문화·역할 위에 이력과 성격을 얹어 개별 주체를 낳고, 그 주체의 모든 값이 어디서 왔는지를 댈 수 있게 한다.',
    verdict: {
      passed: report.complete && suite.failed === 0 && allRejected && orphans.length === 0,
      label: report.complete
        ? `${instanceVerdict(report)} · 값 ${String(VEIL_INSTANCES.reduce((sum, instance) => sum + instance.provenance.length, 0))}개가 전부 유래를 댄다 · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : instanceVerdict(report),
    },
    sections: {
      input: keyValueView([
        ['개체 선언', `${String(VEIL_INSTANCES.length)}명 — 몰이꾼 셋 + 사제 하나 (전부 사냥꾼 종)`],
        ['종 (S1)', `${hunterArchetype.name} — 의존 ${String(hunterArchetype.baseNeeds.length)} · 능력 ${String(hunterArchetype.capabilities.length)}`],
        ['문화 (S2)', VEIL_CULTURES.map((culture) => culture.name).join(' · ')],
        ['지금', `${String(NOW)}틱 — 개체는 이 시각에 세계에 선다. 이력은 그보다 앞이어야 한다`],
        ['결함 개체', `${String(BROKEN_INSTANCES.length)}종`],
      ]),

      process: [
        h('p', {}, [
          '개체가 손으로 적는 것은 넷뿐이다 — 이름표·경계·지고 온 것·타고난 기울기. 나머지는 전부 물려받는다. 그리고 지고 온 것과 타고난 기울기조차 세계에 없는 것을 만들지 못한다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [h('th', {}, ['층']), h('th', {}, ['주는 것']), h('th', {}, ['막는 것'])]),
          ]),
          h('tbody', {}, [
            h('tr', {}, [
              h('td', {}, ['종 (S1)']),
              h('td', {}, ['감각 · 의존 · 능력']),
              h('td', {}, ['기관 없는 통로는 열리지 않는다']),
            ]),
            h('tr', {}, [
              h('td', {}, ['문화·자리 (S2)']),
              h('td', {}, ['읽기 · 원함 · 연 능력 · 금기']),
              h('td', {}, ['감지 못 하는 통로는 읽지 못한다']),
            ]),
            h('tr', { class: 'ok' }, [
              h('td', {}, ['이력 (S3-a)']),
              h('td', {}, ['지금 남은 값 — 빚 · 원한 · 상처 · 신념']),
              h('td', {}, ['흔적 없는 과거는 과거가 아니다']),
            ]),
            h('tr', { class: 'ok' }, [
              h('td', {}, ['성격 (S3-b)']),
              h('td', {}, ['이미 있는 값의 배수']),
              h('td', {}, ['새 자리를 만들지 못하고 상한도 넘기지 못한다']),
            ]),
            h('tr', { class: 'ok' }, [
              h('td', {}, ['개체 (S3-c)']),
              h('td', {}, ['이름표 · 경계']),
              h('td', {}, ['유래를 못 대는 값이 있으면 서지 못한다']),
            ]),
          ]),
        ]),
        h('h3', {}, ['성격이 흔들 수 있는 자리 셋']),
        lines(
          ...Object.entries(TUNE_LABELS).map(([target, label]) => `${target} — ${label}`),
        ),
      ],

      candidates: [
        h('p', {}, [
          `같은 골짜기의 몰이꾼 셋과 다른 문화의 사제 하나. 지고 온 것과 타고난 기울기가 각자 다르다.`,
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['개체']),
              h('th', {}, ['문화 / 자리']),
              h('th', {}, ['지고 온 것']),
              h('th', {}, ['지금 남은 것']),
              h('th', {}, ['타고난 기울기']),
            ]),
          ]),
          h(
            'tbody',
            {},
            VEIL_INSTANCES.map((instance) =>
              h('tr', { class: 'ok' }, [
                h('td', {}, [instance.name]),
                h('td', {}, [
                  `${VEIL_CULTURES.find((culture) => culture.id === instance.cultureId)?.name ?? '?'} / ${
                    VEIL_CULTURES.flatMap((culture) => culture.roles).find(
                      (role) => role.id === instance.roleId,
                    )?.name ?? '자리 없음'
                  }`,
                ]),
                h('td', {}, [historySummary(instance.history)]),
                h('td', {}, [residueSummary(instance.residue)]),
                h('td', {}, [traitSummary(instance.traits)]),
              ]),
            ),
          ),
        ]),
      ],

      selection: [
        h('p', {}, [
          `몰이꾼 셋은 같은 종·같은 문화·같은 자리다. 눈도 하나고 무너질 자리도 하나다. 그런데 「${SHARED_SIGN}」 앞에서 셋이 갈린다 — 그 갈림을 만든 것은 지고 온 것과 타고난 기울기뿐이다.`,
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['개체']),
              h('th', {}, ['허기의 급함']),
              h('th', {}, [`「${SHARED_SIGN}」 확신`]),
              h('th', {}, ['마을을 미는 힘']),
              h('th', {}, ['무엇이 흔들었나']),
            ]),
          ]),
          h(
            'tbody',
            {},
            BEATERS.map((instance) =>
              h('tr', { class: instance.traits.length === 0 ? '' : 'ok' }, [
                h('td', {}, [instance.name]),
                h('td', {}, [String(Math.round((instance.needs[0]?.urgency ?? 0) * 100) / 100)]),
                h('td', {}, [String(Math.round((confidenceOf(instance) ?? 0) * 100) / 100)]),
                h('td', {}, [String(Math.round((trustWeightOf(instance) ?? 0) * 100) / 100)]),
                h('td', {}, [
                  instance.traits.length === 0
                    ? '아무것도 — 종과 문화가 준 값 그대로다'
                    : traitSummary(instance.traits),
                ]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['셋이 공유하는 것 — 이력도 성격도 이것은 바꾸지 못한다']),
        keyValueView([
          [
            '감각',
            `셋이 같다 — ${hunterArchetype.senses.map((sense) => sense.channel).join(' · ')}`,
          ],
          [
            '무너질 자리',
            (bareInstance.needs ?? [])
              .map((need) => `${need.slot.path} ${String(need.collapseAfterTicks)}틱`)
              .join(' · '),
          ],
          [
            '할 수 있는 것',
            `${String(bareInstance.capabilities.length)}개 — 자리(몰이꾼)가 금기로 하나를 막은 결과까지 셋이 같다`,
          ],
        ]),
      ],

      beforeAfter: [
        h('p', {}, [
          '개체 카드 — 값 하나하나가 어디서 왔는지를 댄다. 성격이 흔든 자리는 배수까지 함께 나온다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['개체']),
              ...VALUE_ORIGINS.map((origin: ValueOrigin) => h('th', {}, [ORIGIN_LABELS[origin]])),
            ]),
          ]),
          h(
            'tbody',
            {},
            VEIL_INSTANCES.map((instance) => {
              const counts = originCounts(instance);
              return h('tr', {}, [
                h('td', {}, [instance.name]),
                ...VALUE_ORIGINS.map((origin: ValueOrigin) =>
                  h('td', { class: counts[origin] > 0 ? 'ok' : '' }, [String(counts[origin])]),
                ),
              ]);
            }),
          ),
        ]),
        instanceCard(trackerInstance),
        instanceCard(bareInstance),
      ],

      failure: [
        h('p', {}, [
          '설 수 없는 개체는 무엇을 어겼고 어느 자리에서 막히는가. 마지막 하나가 S3 의 본론이다 — 세계에 실재하고 공리도 지난 능력이지만, 유래를 못 대므로 개체의 것이 아니다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['어긴 것']),
              h('th', {}, ['걸려야 할 사유']),
              h('th', {}, ['실제']),
              h('th', {}, ['자리']),
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
                h('td', {}, [row.message]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['시나리오 3종']),
        suiteView(suite),
      ],

      causality: lines(
        '과거는 이야기가 아니라 지금의 값이다 — 흔적 없는 과거는 어떤 규칙도 건드리지 못하고 어떤 주체도 감지하지 못한다',
        '그래서 원문 조립식의 "+ 관계" 도 따로 있지 않다 — 빚도 원한도 신뢰도 과거가 지금의 relational 자리에 남긴 값이다',
        '성격에 자리를 주면 성격의 수만큼 세계가 늘어난다 — 그래서 성격은 이미 있는 값의 배수일 뿐이다',
        '배수는 상한을 넘기지 못한다 — 넘길 수 있으면 그것은 성격이 아니라 능력이고, 능력은 O0 를 지나야 한다',
        '다섯 층이 쌓여도 값은 지어지지 않는다 — 모든 값이 종·문화·자리·이력·성격 중 하나를 유래로 댄다',
        '개체가 자기 것이라 말할 수 있는 것은 이름표와 경계뿐이다',
        '유래 관문은 A 계층(AI 생성)의 검사대가 된다 — 생성기가 만든 개체도 같은 질문에 답해야 한다',
        '이 개체들이 단계 2(P 계층)의 입력이다 — 급함과 미는 힘이 갈렸으므로 같은 세계에서 다른 목적이 자란다',
      ),
    },
  };

  return pageView(spec);
}
