// /lab/r3 — R3 감각과 위치에 따른 감지.
//
// 화면이 보여야 하는 것은 넷이다.
//
//   ① **같은 자리에 서 있는데도 읽는 것이 하나도 겹치지 않는다.** 사냥꾼은 자국을 읽고
//      장막벌레는 냄새를 맡는다 — 둘은 같은 협곡에서 다른 세계를 산다.
//   ② **몸 없는 자는 보고로만 아는데 이 겨울의 보고는 문턱에 못 미친다.** 상단도 어머니신도
//      무슨 일이 있었는지 끝내 모른다 — 조직이 늘 늦게 아는 자리다.
//   ③ **선 곳 하나가 읽는 것을 0 으로 만든다.** 같은 사냥꾼의 눈이라도 마을에 서 있으면
//      협곡의 가림막이 빛을 죽이고 자국은 도달 거리에서 걸린다.
//   ④ **지각에는 진실이 실리지 않는다.** 읽은 자가 얻는 것은 아홉 자리까지이고, 무엇이
//      일어났는지는 R4 가 짐작할 몫으로 남는다.

import {
  ATTENUATION,
  BROKEN_PERCEPTS,
  CANYON_TO_HAMLET,
  DISTANT_SWEEP,
  LOOK_TICK,
  LOOK_WALK,
  OBSERVERS,
  SILENT_NOTE,
  STANDING,
  UNWITNESSED,
  VEIL_AUDIT,
  VEIL_PERCEPTS,
  VEIL_SWEEPS,
  WITHOUT_DISTANCE,
  WITNESS_TABLE,
} from '@hkt/scenarios/suites/r3-veil-perception';
import { r3Scenarios } from '@hkt/scenarios/suites/r3';
import { runScenarios } from '@hkt/scenarios';
import { channelSpec, perceptionSummary } from '@hkt/core/s0';
import { channelLabel } from '@hkt/core/r2';
import {
  COVER_RESISTANCES,
  attenuationVerdict,
  perceptFieldVerdict,
  perceptLine,
  perceptsFor,
} from '@hkt/core/r3';

import { pageView, lines, type PageSpec } from '../page.ts';
import { diffView, keyValueView } from '../renderers/diff.ts';
import { gaugeView } from '../renderers/gauge.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

const OBSERVER_LABELS = OBSERVERS.map((observer) => observer.label);

/** 종마다 무엇이 열려 있는가 — S1 이 물려준 눈 그대로다. */
function eyeTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['관측자']),
        h('th', {}, ['열린 통로 (문턱 · 거리)']),
        h('th', {}, ['읽은 것']),
      ]),
    ]),
    h(
      'tbody',
      {},
      VEIL_SWEEPS.map((entry) =>
        h('tr', { class: entry.percepts.length > 0 ? 'ok' : '' }, [
          h('td', {}, [entry.observer.label]),
          h('td', { class: 'path' }, [perceptionSummary(entry.observer.perception)]),
          h('td', {}, [
            entry.percepts.length === 0
              ? '(아무것도 읽지 못한다)'
              : entry.percepts.map(perceptLine).join(' · '),
          ]),
        ]),
      ),
    ),
  ]);
}

/** 같은 흔적을 놓고 누가 보고 누가 못 보는가 — 공용 렌더러 diff 의 자리(주체별 감지 비교). */
function witnessGrid(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['흔적']),
        ...OBSERVER_LABELS.map((label) => h('th', {}, [label])),
        h('th', {}, ['본 자']),
      ]),
    ]),
    h(
      'tbody',
      {},
      WITNESS_TABLE.map((row) =>
        h('tr', { class: row.seenBy > 0 ? 'ok' : '' }, [
          h('td', {}, [row.label]),
          ...OBSERVER_LABELS.map((label) =>
            h('td', { class: Number.isNaN(Number(row.byObserver[label])) ? 'path' : '' }, [
              row.byObserver[label] ?? '—',
            ]),
          ),
          h('td', {}, [String(row.seenBy)]),
        ]),
      ),
    ),
  ]);
}

/** 통로별 차폐 감쇠 — S0-b 의 문장을 값으로 옮긴 것이다. */
function attenuationTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['통로']),
        h('th', {}, ['몸을 거치는가']),
        h('th', {}, ['차폐 감쇠']),
        h('th', {}, ['근거 (S0-b)']),
      ]),
    ]),
    h(
      'tbody',
      {},
      COVER_RESISTANCES.map((entry) =>
        h('tr', { class: entry.factor > 0 ? 'ok' : '' }, [
          h('td', {}, [channelLabel(entry.channel)]),
          h('td', {}, [channelSpec(entry.channel)?.route === 'body' ? '몸' : '남을 거쳐']),
          h('td', {}, [entry.factor.toFixed(2)]),
          h('td', {}, [entry.note]),
        ]),
      ),
    ),
  ]);
}

/** 설 수 없는 지각들. */
function brokenTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['무엇을 어겼나']),
        h('th', {}, ['어디서']),
        h('th', {}, ['사유']),
        h('th', {}, ['남은 말']),
      ]),
    ]),
    h(
      'tbody',
      {},
      BROKEN_PERCEPTS.map((entry) =>
        h('tr', {}, [
          h('td', {}, [entry.broke]),
          h('td', {}, [entry.at === 'perceive' ? '감지 자리' : '지각 검사']),
          h('td', { class: 'path' }, [entry.rules.join(', ')]),
          h('td', {}, [entry.messages[0] ?? '']),
        ]),
      ),
    ),
  ]);
}

/** 시간이 지나면 서 있는 흔적도 읽는 것도 준다. */
function walkGauge(): VElement {
  const peak = Math.max(...LOOK_WALK.map((entry) => entry.standing), 1);
  return gaugeView(
    LOOK_WALK.map((entry) => ({
      label: `틱 ${String(entry.tick)} — ${entry.note}`,
      value: entry.standing / peak,
      level: entry.percepts === 0 ? 'collapsing' : entry.percepts < entry.standing ? 'deficient' : 'met',
      detail: `서 있는 흔적 ${String(entry.standing)} · 읽힌 것 ${String(entry.percepts)}`,
    })),
    { caption: '흔적이 삭으면 읽을 것도 준다 — 다만 사라지지 않는 자국은 언제 와도 읽힌다' },
  );
}

export function r3Page(): VElement {
  const suite = runScenarios(r3Scenarios);
  const passed = suite.failed === 0 && ATTENUATION.complete && VEIL_AUDIT.complete;
  const hunter = VEIL_SWEEPS[0];
  const worm = VEIL_SWEEPS[1];

  const spec: PageSpec = {
    id: 'R3',
    title: '감각과 위치에 따른 감지',
    purpose:
      '주체가 감각과 위치에 따라 현상을 감지하게 한다 — 같은 흔적을 놓고 보는 자와 못 보는 자가 갈린다.',
    verdict: {
      passed,
      label: passed
        ? `흔적 ${String(STANDING.length)} · 읽은 주체 ${String(VEIL_AUDIT.seeing)}/${String(OBSERVERS.length)} · 지각 ${String(VEIL_AUDIT.recorded)} · 아무도 못 본 흔적 ${String(VEIL_AUDIT.unwitnessed)} · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : '검증 실패',
    },
    sections: {
      input: [
        h('p', {}, [
          'R2 는 다섯 사건에서 열다섯 흔적을 냈다. 그 흔적은 세계에 **놓였을 뿐 아직 아무의 것도 아니다** — 냄새는 코가 있어야 오고, 빛은 가려지면 죽고, 보고는 말해 주는 자가 있어야 온다. R3 이 잇는 자리가 그것이다.',
        ]),
        keyValueView([
          ['흔적 (R2 WorldPhenomenon)', `틱 ${String(LOOK_TICK)} 에 서 있는 것 ${String(STANDING.length)} 개 — 나머지는 이미 삭았다 (R2-c)`],
          ['통로별 문턱과 거리 (S0-b PerceptionProfile)', '판정(perceives)까지 이미 있다 — R3 은 그 함수에 세계를 먹인다'],
          ['종마다 열린 통로 (S1 SenseSpec)', '사냥꾼은 눈·귀, 장막벌레는 코, 조직·신은 보고와 의념'],
          ['선 곳과 가림막 (O2)', 'physical.region · physical.cover · physical.distance.{entity}'],
          ['협곡과 마을 사이', `${String(CANYON_TO_HAMLET)}m — 세계가 적어 둔 값이다. 적지 않으면 서로에게 없는 곳이 된다`],
        ]),
      ],

      process: [
        h('p', {}, [
          'R3 이 새로 정하는 것은 **거리와 차폐를 세계에서 읽는 규칙** 하나뿐이다. 감쇠 계수조차 지어내지 않는다 — S0-b 가 통로마다 이미 한 줄씩 적어 둔 문장을 값으로 옮긴 것이다.',
        ]),
        lines(
          '① 거리 — 같은 자리면 0, 다른 자리면 세계가 적어 둔 값. **적히지 않은 거리는 없는 거리다**',
          '② 차폐 — 흔적이 난 자리의 cover. 다만 **자리를 건널 때만 든다** (같은 자리는 가림막 안쪽이다)',
          '③ 감쇠 — 통로마다 차폐에 얼마나 약한가 (S0-b CHANNEL_SPECS 의 문장을 값으로)',
          '④ 판정 — S0-b perceives(프로필, 세기, 거리). 못 읽었으면 왜인지가 남는다',
          '⑤ **지각에는 진실이 실리지 않는다** — 어느 자리가 움직였는지·누가 냈는지·무슨 원자였는지는 없다',
          '⑥ 아무도 읽지 못한 흔적은 위반이 아니다 — 세계는 아무도 안 볼 때도 바뀐다',
        ),
        attenuationTable(),
        keyValueView([['감쇠표 판정', attenuationVerdict(ATTENUATION)]]),
      ],

      candidates: [
        h('p', {}, [
          '넷이 같은 겨울을 둘러본다. **종이 다르면 열린 통로가 다르고, 그래서 같은 세계에서 다른 것을 산다.**',
        ]),
        eyeTable(),
        h('p', {}, [
          `**사냥꾼과 장막벌레는 같은 협곡에 서 있는데 읽는 것이 하나도 겹치지 않는다** — 사냥꾼은 ${String(hunter?.percepts.length ?? 0)} 개의 자국을 보고, 벌레는 ${String(worm?.percepts.length ?? 0)} 개의 냄새를 맡는다. 그리고 몸 없는 상단과 어머니신은 보고와 의념뿐이라 이 겨울에 무슨 일이 있었는지 끝내 모른다.`,
        ]),
      ],

      selection: [
        h('p', {}, [
          '흔적마다 누가 보고 누가 못 보는가. **못 읽은 칸에는 왜 못 읽었는지가 선다** — 통로가 없거나, 너무 옅거나, 너무 멀거나.',
        ]),
        witnessGrid(),
        keyValueView([
          ['감사 (auditPercepts)', perceptFieldVerdict(VEIL_AUDIT)],
          [
            '아무도 못 본 흔적',
            UNWITNESSED.length === 0
              ? '(없다)'
              : `${String(UNWITNESSED.length)} — ${UNWITNESSED.map((entry) => `${channelLabel(entry.channel)} ${entry.intensity.toFixed(2)}`).join(' · ')}`,
          ],
          ['그것은 위반인가', SILENT_NOTE],
        ]),
      ],

      beforeAfter: [
        h('p', {}, [
          '**선 곳 하나가 읽는 것을 0 으로 만든다.** 같은 사냥꾼의 눈인데 협곡에 서면 자국을 읽고 마을에 서면 아무것도 읽지 못한다 — 가림막이 빛을 죽이고 자국은 도달 거리에서 걸린다.',
        ]),
        diffView(
          Object.fromEntries(
            perceptsFor(VEIL_PERCEPTS, OBSERVERS[0]?.subjectId ?? '').map((percept) => [
              channelLabel(percept.channel),
              percept.intensity.toFixed(2),
            ]),
          ),
          Object.fromEntries(
            DISTANT_SWEEP.percepts.map((percept) => [
              channelLabel(percept.channel),
              percept.intensity.toFixed(2),
            ]),
          ),
          { leftLabel: '협곡의 사냥꾼', rightLabel: '마을의 사냥꾼 (같은 눈)' },
        ),
        keyValueView([
          [
            '마을에서 본 빛의 세기',
            DISTANT_SWEEP.attempts
              .filter((attempt) => attempt.phenomenon.channel === 'light')
              .map(
                (attempt) =>
                  `${attempt.phenomenon.intensity.toFixed(2)} → ${attempt.reach.intensity.toFixed(3)}`,
              )
              .join(' · ') || '(없다)',
          ],
          ['그래서 문턱을 넘는가', '넘지 못한다 — 가림막 0.4 가 빛을 그대로 깎는다'],
          [
            '자국은 깎이지 않는데',
            `도달 거리가 5m 인데 ${String(CANYON_TO_HAMLET)}m 떨어져 있다 — 자국은 현장에 있는 것이다`,
          ],
          [
            '거리를 아예 적지 않으면',
            `읽는 것 ${String(WITHOUT_DISTANCE.percepts.length)} — 협곡은 그에게 없는 곳이 된다`,
          ],
        ]),
        walkGauge(),
      ],

      failure: [
        h('p', {}, [
          '설 수 없는 지각은 던지지 않고 물린다 — **둘은 감지 자리에서, 일곱은 지각을 검사할 때** 걸린다.',
        ]),
        brokenTable(),
        h('h3', {}, ['지각이 싣는 것과 싣지 않는 것']),
        keyValueView([
          [
            '싣는 것',
            Object.keys(VEIL_PERCEPTS.percepts[0] ?? {}).sort().join(' · '),
          ],
          ['싣지 않는 것', 'domain · holderId · path · actorId · atom · effectKind · causeEventId'],
          [
            '왜',
            '그것은 세계의 장부이지 본 사람의 눈이 아니다 — 그대로 건네면 본 순간 다 알아 버리고 R4 의 오인도 소문도 설 자리가 없다',
          ],
        ]),
        suiteView(suite),
      ],

      causality: [
        lines(
          'S0-b PerceptionProfile·perceives → R3 — 판정은 이미 있었다. R3 은 그 함수에 세계를 먹인다',
          'S0-b CHANNEL_SPECS 의 문장 → 통로별 차폐 감쇠 — 서술로만 있던 것을 값으로 세워 검사 가능하게 했다',
          'S1 SenseSpec → 종마다 열린 통로 — 사냥꾼과 벌레가 다른 세계를 사는 이유다',
          'O2 physical.region·cover·distance → 거리와 가림막 — 적히지 않은 거리는 없는 거리다',
          'R2 WorldPhenomenon → 읽을 것 · R2-c standingAt → 언제 읽을 수 있는가 (R3 이 다시 정하지 않는다)',
          'R2 ambiguity → 지각이 싣는 마지막 자리 — 읽어도 무엇인지는 모른다',
          '다음 → R4 믿음: 읽은 것에서 무엇이 일어났는지를 짐작한다. 애매함이 클수록 갈린다',
          '남은 자리: 보고 통로는 아직 저절로 퍼지지 않는다 — 거치는 주체가 왜곡 지점이라는 것이 R4 다',
          '남은 자리: 의념 간섭(psychic.interference)이 의념을 막는 일은 G 계층의 몫이다',
          '남은 자리: 같은 흔적을 두 번 읽는 일(반복 관측으로 확신이 오르는 것)은 R4 가 갚는다',
        ),
      ],
    },
  };

  return pageView(spec);
}
