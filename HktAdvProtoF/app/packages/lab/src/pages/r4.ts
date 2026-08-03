// /lab/r4 — R4 믿는 세계.
//
// 화면이 보여야 하는 것은 넷이다.
//
//   ① **후보는 통로가 정한다.** 소리를 들은 자는 무엇이 있었는지 알고(원자 하나), 자국과 냄새를
//      읽은 자는 열둘 중 하나라는 것만 안다. 이것은 누구에게나 같다 — 세계의 규칙이다.
//   ② **좁힘은 손이 정한다.** 같은 종·같은 눈·같은 자리에 선 셋이 같은 자국을 읽는데 짚는 것이
//      갈린다. 사제의 짐작에는 죽임이 없다 — 낼 손이 없는 일은 떠오르지도 않는다.
//   ③ **더 확신한 자가 틀린다.** 실제와 믿음을 나란히 놓으면 그 자리가 값으로 선다.
//   ④ **틀림도 침묵도 남는 기억도 위반이 아니다.** 그것을 막으면 R4 는 한 틱 늦은 전지가 된다.

import {
  BELIEF_ROWS,
  BLIND_READING,
  BROKEN_BELIEFS,
  GUESS_TABLE,
  GUESSES,
  HANDS,
  HARDENING,
  LOOKS,
  LOOK_TICK,
  READ_COUNTS,
  READING_TABLE,
  REREAD_TRACE,
  SHARED_TRACE,
  SILENT_NOTE,
  STALE_BELIEFS,
  STALE_NOTE,
  STANDING,
  TRUTH_CHECKS,
  UNBELIEVED,
  VEIL_AUDIT,
  VEIL_BELIEFS,
  WRONG_NOTE,
} from '@hkt/scenarios/suites/r4-veil-beliefs';
import { r4Scenarios } from '@hkt/scenarios/suites/r4';
import { runScenarios } from '@hkt/scenarios';
import { atomLabel } from '@hkt/core/p0';
import { channelLabel } from '@hkt/core/r2';
import {
  beliefGraphVerdict,
  confidenceTrace,
  guessLine,
  guessVerdict,
  type Belief,
} from '@hkt/core/r4';

import { pageView, lines, type PageSpec } from '../page.ts';
import { diffView, keyValueView } from '../renderers/diff.ts';
import { gaugeView } from '../renderers/gauge.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

const BELIEVER_LABELS = BELIEF_ROWS.map((row) => row.label);

/** 통로마다 후보가 몇인가 — R4 가 세지 않고 R2-a 표에서 읽어 온 것이다. */
function guessTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['통로']),
        h('th', {}, ['여는 자리']),
        h('th', {}, ['후보 원자']),
        h('th', {}, ['넓이']),
        h('th', {}, ['그래서 무엇을 아는가']),
      ]),
    ]),
    h(
      'tbody',
      {},
      GUESS_TABLE.map((guess) =>
        h('tr', { class: guess.candidates.length === 1 ? 'ok' : '' }, [
          h('td', {}, [channelLabel(guess.channel)]),
          h('td', {}, [String(guess.slots.length)]),
          h('td', {}, [String(guess.candidates.length)]),
          h('td', {}, [guess.spread.toFixed(2)]),
          h('td', {}, [guessLine(guess)]),
        ]),
      ),
    ),
  ]);
}

/** 셋의 손 — P2 가 갈라 놓은 그대로다. */
function handTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['누가']),
        h('th', {}, ['읽은 것']),
        h('th', {}, ['무엇을 하지 않는가 (P2)']),
      ]),
    ]),
    h(
      'tbody',
      {},
      HANDS.map((hand, index) =>
        h('tr', { class: 'ok' }, [
          h('td', {}, [hand.label]),
          h('td', {}, [`${String(READ_COUNTS[index]?.[1] ?? 0)} 개`]),
          h('td', {}, [hand.tells]),
        ]),
      ),
    ),
  ]);
}

/** 같은 자국 앞에 선 셋 — 짚은 수·빠진 것·확신·실제와의 대조. */
function beliefTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['누가']),
        h('th', {}, ['무엇이라고 여기는가']),
        h('th', {}, ['짚은 수']),
        h('th', {}, ['후보에서 빠진 것']),
        h('th', {}, ['확신']),
        h('th', {}, ['실제와 대조']),
      ]),
    ]),
    h(
      'tbody',
      {},
      BELIEF_ROWS.map((row) =>
        // 빗나간 믿음은 **어긋남이 아니다** — 붉은 행이 아니라 노란 행으로 선다.
        h('tr', { class: row.verdict === 'wrong' ? 'warn' : 'ok' }, [
          h('td', {}, [row.label]),
          h('td', {}, [row.assertion]),
          h('td', {}, [String(row.suspected)]),
          h('td', { class: 'path' }, [
            row.missing.length === 0
              ? '(없다)'
              : row.missing.map((atom) => atomLabel(atom)).join('·'),
          ]),
          h('td', {}, [row.confidence.toFixed(3)]),
          h('td', {}, [
            row.verdict === 'exact'
              ? '정확히 짚었다'
              : row.verdict === 'narrowed'
                ? '틀리지는 않았다'
                : '빗나갔다 ✘',
          ]),
        ]),
      ),
    ),
  ]);
}

/** 흔적마다 셋이 무엇으로 읽는가 — 실제가 마지막 열에 선다(감사의 열이다). */
function readingGrid(): VElement {
  const rows = READING_TABLE.filter((row) => row.believedBy > 0);
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['흔적']),
        ...BELIEVER_LABELS.map((label) => h('th', {}, [label])),
        h('th', {}, ['실제 (감사만 본다)']),
      ]),
    ]),
    h(
      'tbody',
      {},
      rows.map((row) =>
        h('tr', { class: 'ok' }, [
          h('td', {}, [row.label]),
          ...BELIEVER_LABELS.map((label) =>
            h('td', { class: (row.byBeliever[label] ?? '').includes('✘') ? 'path' : '' }, [
              row.byBeliever[label] ?? '—',
            ]),
          ),
          h('td', { class: 'path' }, [row.actual]),
        ]),
      ),
    ),
  ]);
}

/** 두 번 읽으면 오르되 좁힘이 허락한 데까지만 — 게이지로 편다. */
function hardeningGauge(): VElement {
  return gaugeView(
    HARDENING.map((row) => ({
      label: `${row.label} — ${row.phenomenon}`,
      value: row.confidence,
      level: row.capped ? 'deficient' : 'met',
      detail: `${String(row.observations)}회 · 한 번일 때 ${row.first.toFixed(3)} → ${row.confidence.toFixed(3)} (상한 ${row.cap.toFixed(3)}${row.capped ? ' 에 닿았다' : ''})`,
    })),
    { caption: '반복은 확신을 올리지만 좁힘이 허락한 데서 멈춘다 — 열둘 중 하나인 것은 두 번 봐도 열둘 중 하나다' },
  );
}

/** 설 수 없는 믿음들. */
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
      BROKEN_BELIEFS.map((entry) =>
        h('tr', {}, [
          h('td', {}, [entry.broke]),
          h('td', {}, [entry.at === 'form' ? '믿음을 세우는 자리' : '믿음 검사']),
          h('td', { class: 'path' }, [entry.rules.join(', ')]),
          h('td', {}, [entry.messages[0] ?? '']),
        ]),
      ),
    ),
  ]);
}

const wrongBelief = VEIL_BELIEFS.beliefs.find(
  (belief) =>
    belief.aboutId === SHARED_TRACE.id &&
    TRUTH_CHECKS.some(
      (check) => check.beliefId === belief.id && check.verdict === 'wrong',
    ),
) as Belief | undefined;

export function r4Page(): VElement {
  const suite = runScenarios(r4Scenarios);
  const passed = suite.failed === 0 && GUESSES.complete && VEIL_AUDIT.complete;

  const spec: PageSpec = {
    id: 'R4',
    title: '믿는 세계',
    purpose:
      '주체가 실제가 아닌 믿는 세계를 형성하게 한다 — 읽은 것에서 무엇이 일어났는지를 짐작한다.',
    verdict: {
      passed,
      label: passed
        ? `믿음 ${String(VEIL_AUDIT.recorded)} · 빗나감 ${String(VEIL_AUDIT.wrong)} · 삭은 자국의 믿음 ${String(VEIL_AUDIT.stale)} · 아무도 믿지 않는 흔적 ${String(VEIL_AUDIT.unbelieved)} · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : '검증 실패',
    },
    sections: {
      input: [
        h('p', {}, [
          'R3 이 넘긴 지각에는 **무엇이 일어났는지가 없다**. 있는 것은 통로 하나, 세기 하나, 자리 하나, 거리 하나, 그리고 애매함 하나다 — 어느 자리가 움직였는지도, 누가 냈는지도, 무슨 원자였는지도 실려 있지 않다(R3-b `truth-leak`). 그 다섯에서 무엇이 있었는지를 짐작하는 것이 R4 다.',
        ]),
        keyValueView([
          ['읽은 것 (R3 Percept)', `${String(READ_COUNTS[0]?.[1] ?? 0)} 개씩 — 셋의 눈과 자리가 같으므로 읽는 것도 같다`],
          ['통로 → 자리 (R2-a LEAK_CHANNELS)', '세계의 규칙이지 세계의 장부가 아니다 — 부서지는 것은 소리가 나고 몸이 깎이면 피 냄새가 난다'],
          ['자리 → 원자 (R2-a atomsMoving)', 'P0-b 걸림에서 이미 계산된 것 — R4 가 다시 세지 않는다'],
          ['무엇을 낼 수 있는가 (P2 PossibilityGrammar)', '유형이 깔고 능력이 얹고 금기가 덜어 낸 목록 — 짐작의 사전이다'],
          ['애매함 (R2-b ambiguity)', '그 자국을 남길 수 있는 원자가 몇인가 — 지각이 실어 온 값이다'],
        ]),
      ],

      process: [
        h('p', {}, [
          'R4 가 새로 정하는 것은 **한 줄**이다: **자기가 낼 수 있는 것으로 읽는다.** 나머지는 전부 앞 계층에서 읽어 온다.',
        ]),
        lines(
          '① 후보 — 통로가 여는 자리들, 그 자리를 움직일 수 있는 원자들 (R2-a 두 걸음)',
          '② 좁힘 — 그중 자기 문법이 여는 것 (P2 allowed). **후보가 하나뿐이면 묻지 않는다** — 고를 것이 없으면 편향도 없다',
          '③ 겹침이 없으면 후보 전체가 남는다 — 내가 낼 수 있는 무엇도 아니라는 것도 하나의 읽기다',
          '④ 확신 = Σ(값×무게) ÷ Σ무게 — 좁힘 3 · 세기 2 · 반복 1 (P4-c 와 같은 식)',
          '⑤ **좁힘이 확신의 상한이다** — 열둘 중 하나인 자국은 아무리 진하게 여러 번 봐도 확신할 수 없다',
          '⑥ 믿음은 O1 Claim 관문을 지난다 — "확신 1 도 틀릴 수 있다" 고 이미 적혀 있는 그 자리다',
          '⑦ **빗나간 믿음은 위반이 아니다** — 막으면 R4 는 짐작이 아니라 한 틱 늦은 전지가 된다',
        ),
        guessTable(),
        keyValueView([
          ['후보표 판정', guessVerdict(GUESSES)],
          [
            '소리를 들은 자는 무엇이 있었는지 안다',
            '소리가 나는 자리는 physical.broken 하나뿐이고 그 자리를 움직이는 원자는 제거 하나뿐이다 — 다만 이 겨울에는 아무것도 부서지지 않아 소리가 나지 않았다',
          ],
          [
            '후보는 진실보다 좁을 수 없다',
            '지각의 애매함은 실제로 움직인 자리 하나에서, 후보의 넓이는 통로가 여는 자리 전부에서 센다 — 뒤집히면 짐작이 실제 자리를 몰래 본 것이다 (guess-narrower-than-trace)',
          ],
        ]),
      ],

      candidates: [
        h('p', {}, [
          '협곡에 셋이 선다. **같은 사냥꾼 종, 같은 감각, 같은 자리** — 다른 것은 손뿐이다. 셋 중 누구도 그 사건을 일으킨 자가 아니다.',
        ]),
        handTable(),
        h('p', {}, [
          `셋은 겨울을 세 번 둘러보고 **똑같이 ${String(READ_COUNTS[0]?.[1] ?? 0)} 개씩** 읽는다 — 눈이 같으니 당연하다. 그런데 그 다음이 갈린다.`,
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['언제']),
              h('th', {}, ['서 있는 흔적']),
              h('th', {}, ['셋이 읽은 것']),
            ]),
          ]),
          h(
            'tbody',
            {},
            LOOKS.map((look) =>
              h('tr', { class: look.read > 0 ? 'ok' : '' }, [
                h('td', {}, [`틱 ${String(look.tick)} — ${look.note}`]),
                h('td', {}, [String(look.standing)]),
                h('td', {}, [String(look.read)]),
              ]),
            ),
          ),
        ]),
      ],

      selection: [
        h('p', {}, [
          '**같은 자국을 놓고 셋의 짐작이 갈린다.** 후보 열둘은 통로가 정하므로 셋에게 같고, 거기서 무엇을 덜어 내는지는 P2 금기가 정한다 — 사제에게서 죽임이, 상단에게서 빼앗기가 빠진다.',
        ]),
        beliefTable(),
        h('p', {}, [
          '**그 자국을 낸 것은 제거다.** 좁게 짚은 둘이 더 확신하는데, 그중 사제가 빗나간다 — 낼 손이 없는 일은 떠오르지도 않기 때문이다. 확신은 옳음과 무관하다.',
        ]),
        keyValueView([
          ['그 자국의 실제', `${atomLabel(SHARED_TRACE.atom)} (${channelLabel(SHARED_TRACE.channel)} 세기 ${SHARED_TRACE.intensity.toFixed(2)})`],
          [
            '사제의 확신이 어디서 왔는가',
            wrongBelief === undefined ? '(없다)' : confidenceTrace(wrongBelief).join(' · '),
          ],
          ['빗나감은 위반인가', WRONG_NOTE],
          ['감사 (auditBeliefs)', beliefGraphVerdict(VEIL_AUDIT)],
        ]),
        readingGrid(),
      ],

      beforeAfter: [
        h('p', {}, [
          '**실제 세계와 믿는 세계를 나란히 놓는다.** 세계는 무슨 일이 있었는지 알고 있고, 믿는 자는 그것을 모른다 — 둘 사이의 거리가 이 계층이 만든 것이다.',
        ]),
        diffView(
          Object.fromEntries(
            READING_TABLE.filter((row) => row.believedBy > 0).map((row) => [row.label, row.actual]),
          ),
          Object.fromEntries(
            READING_TABLE.filter((row) => row.believedBy > 0).map((row) => [
              row.label,
              row.byBeliever[BELIEVER_LABELS[1] ?? ''] ?? '',
            ]),
          ),
          { leftLabel: '실제 (세계의 장부)', rightLabel: '사제가 믿는 것' },
        ),
        h('p', {}, [
          '**두 번 읽으면 확신이 오른다 — 다만 좁힘이 허락한 데까지만.** 빛 0.29 는 두 걸음 뒤와 세 걸음 뒤에 두 번 읽혔고, 사라지지 않는 자국 0.60 은 한 번 읽혔다.',
        ]),
        hardeningGauge(),
        keyValueView([
          [
            '두 번 읽힌 흔적',
            `${channelLabel(REREAD_TRACE.channel)} 세기 ${REREAD_TRACE.intensity.toFixed(2)} — 틱 ${String(REREAD_TRACE.atTick)} 에 나서 ${String(REREAD_TRACE.decaysAtTick ?? 0)} 에 삭는다`,
          ],
          [
            '그 자국은 지금 세계에 없는데',
            `틱 ${String(LOOK_TICK)} 에는 이미 삭았다 — 그런데 믿음은 ${String(STALE_BELIEFS.length)} 개가 그대로 남아 있다`,
          ],
          ['그것은 위반인가', STALE_NOTE],
        ]),
      ],

      failure: [
        h('p', {}, [
          '설 수 없는 믿음은 던지지 않고 물린다 — **둘은 믿음을 세우는 자리에서, 아홉은 검사할 때** 걸린다.',
        ]),
        brokenTable(),
        h('h3', {}, ['믿음이 싣는 것과 싣지 않는 것']),
        keyValueView([
          ['싣는 것', Object.keys(VEIL_BELIEFS.beliefs[0] ?? {}).sort().join(' · ')],
          ['싣지 않는 것', 'domain · path · actorId · atom · effectKind · causeEventId'],
          [
            '왜',
            '짐작하는 자는 무엇이 일어났는지 모르기 때문에 짐작한다 — 이것이 새면 R4 는 짐작이 아니라 한 틱 늦은 전지(全知)다',
          ],
          [
            '아무도 믿지 않는 흔적',
            UNBELIEVED.length === 0
              ? '(없다)'
              : `${String(UNBELIEVED.length)} / 서 있는 ${String(STANDING.length)} — ${UNBELIEVED.map((entry) => `${channelLabel(entry.channel)} ${entry.intensity.toFixed(2)}`).join(' · ')}`,
          ],
          ['그것은 위반인가', SILENT_NOTE],
          [
            '아무것도 읽지 못한 자',
            `믿음 ${String(BLIND_READING.beliefs.length)} · 어긋남 ${String(BLIND_READING.violations.length)} — 보지 않은 자는 짐작도 하지 않는다`,
          ],
        ]),
        suiteView(suite),
      ],

      causality: [
        lines(
          'R2-a LEAK_CHANNELS·atomsMoving → 후보 — R4 는 통로 → 자리 → 원자 두 걸음을 읽어 올 뿐이다',
          'R2-b ambiguity → 후보가 진실보다 좁지 않은지의 하한 — 뒤집히면 짐작이 실제를 몰래 본 것이다',
          'R3 Percept → 짐작의 재료 · truth-leak → 그 재료에 진실이 없다는 보장',
          'P2 PossibilityGrammar.allowed → 좁힘 — 낼 손이 없는 일은 떠오르지도 않는다',
          'P0 ACTION_ATOMS → 애매함의 눈금(열여섯) — R2-b 와 같은 자다',
          'P4-c 점수 재계산 → 확신 재계산 — 손으로 적는 값이 아니다',
          'O1 Claim → 믿음의 모양 — "확신 1 도 틀릴 수 있다" 가 이미 적혀 있었다',
          '다음 → R5 기억과 관계: 남의 말이 근거가 되는 것(소문)과 거치는 주체의 왜곡이 그 자리다',
          '다음 → R6 행동 의도: 주체가 실제가 아니라 믿음으로 행동하면 오해가 사건이 된다 (원문 §19)',
          '다음 → E3 능력 충돌: 상대의 BeliefGraph 절편이 판정 입력이 되면 정보 상태만으로 승패가 뒤집힌다',
          '남은 자리: 누가 냈는지는 짐작하지 않는다 — 자리를 지목할 근거는 D5·E0 가 세운다',
          '남은 자리: 가치관이 확신을 흔드는 일(믿고 싶은 것을 믿는 것)은 R5 기억·관계의 몫이다',
        ),
      ],
    },
  };

  return pageView(spec);
}
