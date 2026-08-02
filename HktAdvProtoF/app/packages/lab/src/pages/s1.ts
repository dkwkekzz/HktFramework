// /lab/s1 — S1 종 원형.
//
// 화면이 보여야 하는 것은 하나다: **개체의 값이 종에서 나온다.**
// 그래서 가운데에 "같은 종, 세 단계" 대조표를 놓는다 — 같은 사냥꾼 종에서 태어난 유체·성체·노체가
// 서로 다른 거리를 보고 서로 다른 시간에 무너지고 서로 다른 능력을 연다. 그 위로는 종 다섯이
// 각자 어떤 몸·감각·생애를 갖는지를, 아래로는 설 수 없는 종 열넷이 왜 막히는지를 편다.

import {
  ages,
  bodySummary,
  capabilitiesAt,
  checkArchetype,
  checkArchetypes,
  collapseTicksAt,
  growthStages,
  lifecycleSummary,
  lifespanTicks,
  needTemplateSummary,
  ORGAN_SPECS,
  seedFromSpecies,
  senseSummary,
  archetypeVerdict,
  type LifeStage,
  type SpeciesArchetype,
} from '@hkt/core/s1';
import { checkSubjects } from '@hkt/core/s0';
import { runScenarios } from '@hkt/scenarios';
import { s1Scenarios } from '@hkt/scenarios/suites/s1';
import {
  BROKEN_SPECIES,
  hunterArchetype,
  hunterBodyId,
  S1_DEFINITIONS,
  VEIL_SPECIES,
} from '@hkt/scenarios/suites/s1-veil-species';
import { hunterId, VEIL_SUBJECTS } from '@hkt/scenarios/suites/s0-veil-subjects';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

/** 사냥꾼이 지고 다니는 허기 — 이 자리 하나가 단계마다 다른 시간을 갖는다. */
const HUNGER_BASE_TICKS = 30;

export function s1Page(): VElement {
  const report = checkArchetypes(VEIL_SPECIES, S1_DEFINITIONS);
  const subjects = checkSubjects(VEIL_SUBJECTS, S1_DEFINITIONS);
  const suite = runScenarios(s1Scenarios);

  const brokenRows = BROKEN_SPECIES.map((entry) => {
    const violations = checkArchetype(entry.value, S1_DEFINITIONS);
    const first = violations[0];
    return {
      broke: entry.broke,
      expected: entry.expected,
      actual: first === undefined ? '(통과해 버렸다)' : first.rule,
      path: first?.path ?? '',
      message: first?.message ?? '',
    };
  });
  const allRejected = brokenRows.every((row) => row.expected === row.actual);

  /** 사냥꾼 한 종에서 세 단계의 개체를 뽑는다 — 같은 선언, 다른 세계. */
  const stageRows = hunterArchetype.lifecycle.stages.map((stage: LifeStage) => {
    const seed = seedFromSpecies(hunterArchetype, {
      subjectId: hunterId,
      bodyId: hunterBodyId,
      stage: stage.stage,
    });
    return {
      stage,
      seed,
      collapse: collapseTicksAt(HUNGER_BASE_TICKS, stage),
      light: seed.perception.channels[0],
    };
  });

  const spec: PageSpec = {
    id: 'S1',
    title: '종 원형',
    purpose:
      '종의 신체·감각·생애·기본 의존을 한 원형으로 세우고, 개체의 감각과 붕괴 시한이 그 원형에서 나오게 한다.',
    verdict: {
      passed: report.complete && subjects.complete && suite.failed === 0 && allRejected,
      label: report.complete
        ? `${archetypeVerdict(report)} · 그 종에서 태어난 개체 ${String(subjects.accepted.length)}명이 S0 을 지난다 · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : archetypeVerdict(report),
    },
    sections: {
      input: keyValueView([
        ['종 선언', `${String(VEIL_SPECIES.length)}개 — 사람·생물·조직·국가·신 하나씩 (붉은 장막 세계)`],
        ['정의 집합', `${String(S1_DEFINITIONS.length)}개 — O0 를 지난 능력 셋 + 종 여섯`],
        ['세계 자리', 'O2 상태 스키마 — 생애 단계는 biological.growthStage, 대사는 biological.metabolism'],
        ['성장 단계 선택지', growthStages().join(' → ')],
        ['결함 종', `${String(BROKEN_SPECIES.length)}종 (전부 O0 로서는 온전한 종 정의다)`],
      ]),

      process: [
        h('p', {}, [
          '신체는 지어내지 않는다. 세계에 이미 걸려 있는 두 가지로만 적는다 — 기관과 O2 생물 영역 자리. 기관이 감각 통로를 열고, 열리지 않은 통로는 그 종에게 없는 것이다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [h('th', {}, ['기관']), h('th', {}, ['여는 통로']), h('th', {}, ['무엇인가'])]),
          ]),
          h(
            'tbody',
            {},
            ORGAN_SPECS.map((organ) =>
              h('tr', { class: organ.opens.length > 0 ? 'ok' : '' }, [
                h('td', {}, [organ.label]),
                h('td', {}, [organ.opens.length === 0 ? '— (감각은 열지 않는다)' : organ.opens.join(' · ')]),
                h('td', {}, [organ.note]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['몸이 있는가 — 이 하나가 종을 가른다']),
        lines(
          '몸이 있는 종(사람·생물)만 생물 영역 자리를 열고, 몸을 거치는 감각을 갖고, 늙는다',
          '몸 없는 종(조직·국가·신)은 굶지 않는다 — 창고가 비거나 정당성이 마르거나 숭배가 끊겨서 무너진다',
          '성장 단계는 생물 영역의 자리(biological.growthStage)이므로, 나라는 늙을 자리 자체가 없다',
        ),
      ],

      candidates: [
        h('p', {}, [
          '붉은 장막 세계의 종 다섯 — 각자 어떤 몸으로, 무엇을 감지하고, 어떻게 늙고, 무엇으로 무너지는가.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['종']),
              h('th', {}, ['종류']),
              h('th', {}, ['몸']),
              h('th', {}, ['감각']),
              h('th', {}, ['생애']),
              h('th', {}, ['기본 의존']),
            ]),
          ]),
          h(
            'tbody',
            {},
            VEIL_SPECIES.map((archetype: SpeciesArchetype) =>
              h('tr', { class: 'ok' }, [
                h('td', {}, [archetype.name]),
                h('td', {}, [h('code', {}, [archetype.subjectKind])]),
                h('td', {}, [bodySummary(archetype.body)]),
                h('td', {}, [senseSummary(archetype.senses)]),
                h('td', {}, [lifecycleSummary(archetype.lifecycle)]),
                h('td', {}, [needTemplateSummary(archetype.baseNeeds)]),
              ]),
            ),
          ),
        ]),
      ],

      selection: [
        h('p', {}, [
          `같은 사냥꾼 종에서 세 단계의 개체를 뽑는다. 선언은 하나인데 나오는 개체는 셋이다 — 대사가 시간을 흔들고 감각 배수가 세계의 크기를 흔든다 (허기 기준 시한 ${String(HUNGER_BASE_TICKS)}틱).`,
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['단계']),
              h('th', {}, ['대사']),
              h('th', {}, ['굶어 무너지기까지']),
              h('th', {}, ['빛이 닿는 거리']),
              h('th', {}, ['열린 능력']),
            ]),
          ]),
          h(
            'tbody',
            {},
            stageRows.map((row) =>
              h('tr', { class: row.stage.stage === '성체' ? 'ok' : '' }, [
                h('td', {}, [row.stage.stage]),
                h('td', {}, [`×${String(row.stage.metabolism)}`]),
                h('td', {}, [`${String(row.collapse)}틱`]),
                h('td', {}, [`${String(row.light?.range ?? 0)}m`]),
                h('td', {}, [String(row.seed.capabilities.length)]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['종이 개체에게 물려주는 것']),
        h('p', {}, [
          '개체가 스스로 적는 것은 둘뿐이다 — 어디까지가 자기인가(경계)와 무엇을 밀고 가는가(유지). 무너지는 조건은 종이 주고, 원하는 것은 개체가 고른다.',
        ]),
        keyValueView([
          ['감각', '종의 통로 × 단계의 감각 배수 → 개체의 PerceptionProfile'],
          ['의존', '종의 자리 + 개체의 몸/자기 → 개체의 Need (붕괴 시한 = 기준 ÷ 대사)'],
          ['능력', '그 단계까지 열린 것의 누적 — 유체 사냥꾼은 아직 전언을 새기지 못한다'],
        ]),
      ],

      beforeAfter: [
        h('p', {}, [
          '종이 서기 전과 후 — 어긴 종은 세계에 들어가지 않고, 들어가지 못한 종은 개체도 낳지 못한다.',
        ]),
        keyValueView([
          ['들이려는 종', `${String(VEIL_SPECIES.length)}개`],
          ['세계에 선 종', `${String(report.accepted.length)}개 — ${archetypeVerdict(report)}`],
          ['막힌 종', `${String(report.rejected.length)}개`],
          [
            '그 종에서 태어난 개체',
            `${String(subjects.accepted.length)}명이 S0 다섯 질문을 그대로 지난다 (감각·의존·능력은 손으로 적지 않았다)`,
          ],
          [
            '수명',
            VEIL_SPECIES.map(
              (archetype) =>
                `${archetype.name} ${ages(archetype.lifecycle) ? `${String(lifespanTicks(archetype.lifecycle))}틱` : '늙지 않는다'}`,
            ).join(' · '),
          ],
        ]),
      ],

      failure: [
        h('p', {}, [
          '결함 종은 무엇을 어겼고 어느 자리에서 막히는가. 전부 O0 로서는 온전한 종 정의다 — S1 이 없으면 그대로 세계에 들어갔을 종들이다.',
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
        '기관이 감각을 열고, 감각이 세계를 연다 — 눈 없는 종에게 빛은 일어나지 않는다',
        '대사가 시간을 정한다 — 같은 허기라도 빨리 태우는 유체가 먼저 무너지고, 느려진 노체가 더 오래 버틴다',
        '생애는 세계에 적히는 값이다 — 단계 이름은 O2 growthStage 의 선택지에서만 나오고 순서도 그 순서를 따른다',
        '몸의 유무가 종을 가른다 — 몸 없는 종은 굶지도 늙지도 않고, 대신 창고·정당성·숭배로 무너진다',
        '능력은 인용이고 단계와 함께 열린다 — 공리를 어긴 능력은 어느 종도 열지 못하고, 열리지 않는 능력은 그 종의 것이 아니다',
        '개체는 종에서 태어난다 — S0 의 감각·의존·능력이 이제 손이 아니라 종에서 온다. S2·S3 이 그 위에 문화·역할·이력을 얹는다',
        `기본 의존은 D2(종 기본 의존 그래프)의 씨앗이다 — 무엇이 그 자리를 채워 주는가는 D1~D3 이 잇는다`,
      ),
    },
  };

  return pageView(spec);
}
