// /lab/r2 — R2 사건이 남기는 흔적.
//
// 화면이 보여야 하는 것은 넷이다.
//
//   ① **앎은 새지 않는다.** 04 가 마비독을 알아낸 일에서 밖으로 나온 것은 그것을 알아내느라
//      닳은 몸뿐이고, 그 자국은 열여섯 중 열둘이 남길 수 있어 거의 아무것도 말해 주지 않는다.
//   ② **통로는 자리가 정한다.** 원자가 아니다 — 같은 자국을 여럿이 남길 수 있다는 것이
//      곧 관찰의 뜻이고, 그것이 애매함이 된다.
//   ③ **어떤 흔적은 사라지지 않는다.** 되돌릴 수 없는 원자가 바꾼 자리의 자국은 영영 남고,
//      그 일을 하느라 닳은 제 몸의 자국은 며칠이면 삭는다.
//   ④ **세계가 기억하는 것과 세계에 남은 것은 다르다.** 원장은 여섯 칸을 다 갖고 있는데
//      한참 뒤에 서 있는 흔적은 둘뿐이고, 그 둘조차 누가 냈는지 말해 주지 않는다.

import {
  BROKEN_PHENOMENA,
  DECAY_WALK,
  LEAK_REPORT,
  NOW,
  SILENT_SEEK,
  UNSEALED_WORLD,
  VEIL_AUDIT,
  VEIL_FIELD,
  VEIL_LOG,
  VEIL_SCENES,
  actorId,
  rivalId,
} from '@hkt/scenarios/suites/r2-veil-phenomena';
import { r2Scenarios } from '@hkt/scenarios/suites/r2';
import { runScenarios } from '@hkt/scenarios';
import { atomLabel } from '@hkt/core/p0';
import { effectLine } from '@hkt/core/r1';
import {
  LEAK_CHANNELS,
  PHENOMENON_CHANNELS,
  SEALED_SLOTS,
  atomsMoving,
  channelLabel,
  fieldVerdict,
  leakVerdict,
  standingAt,
  type WorldPhenomenon,
} from '@hkt/core/r2';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { gaugeView } from '../renderers/gauge.ts';
import { suiteView } from '../renderers/scenario.ts';
import { stepLegend, timelineView } from '../renderers/timeline.ts';
import { h, type VElement } from '../vnode.ts';

const short = (id: string): string => id.slice(0, 14);

/** 흔적이 난 순서대로 — 공용 렌더러 ④ 타임라인의 셋째 소비자다 (수명이 배지로 선다). */
function traceTimeline(): VElement {
  return timelineView(
    VEIL_SCENES.map((scene, index) => ({
      order: index,
      label: scene.label,
      kind:
        scene.phenomena.some((phenomenon) => phenomenon.decaysAtTick === null)
          ? 'sealed'
          : scene.phenomena.length === 0
            ? 'silent'
            : 'fading',
      badge: `틱 ${String(scene.event.tick)} · 흔적 ${String(scene.phenomena.length)}`,
      note:
        scene.phenomena.length === 0
          ? '아무 흔적도 나지 않았다'
          : `${[...new Set(scene.phenomena.map((phenomenon) => channelLabel(phenomenon.channel)))].join('·')}${scene.sealedSlots.length > 0 ? ` · 새지 않은 자리 ${String(scene.sealedSlots.length)}` : ''}`,
      hint: scene.event.id,
      ...(scene.phenomena.some((phenomenon) => phenomenon.decaysAtTick === null)
        ? { emphasis: true }
        : {}),
    })),
    {
      kindColors: { fading: '#60a5fa', sealed: '#f87171', silent: '#94a3b8' },
      emptyText: '아직 아무 흔적도 나지 않았다',
    },
  );
}

/** 통로 표 — 어느 자리가 어느 통로로 새는가 (R2-a). */
function channelTable(): VElement {
  const rows = LEAK_CHANNELS.filter(
    (entry) => (LEAK_REPORT.moversBySlot[`${entry.slot.domain}.${entry.slot.path}`] ?? 0) > 0,
  );
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['자리']),
        h('th', {}, ['통로']),
        h('th', {}, ['움직일 수 있는 원자']),
        h('th', {}, ['애매함']),
        h('th', {}, ['왜 그 통로인가']),
      ]),
    ]),
    h(
      'tbody',
      {},
      rows.map((entry) => {
        const movers = atomsMoving(entry.slot).length;
        return h('tr', {}, [
          h('td', { class: 'path' }, [`${entry.slot.domain}.${entry.slot.path}`]),
          h('td', {}, [entry.channels.map(channelLabel).join(' · ')]),
          h('td', {}, [String(movers)]),
          h('td', {}, [((movers - 1) / 15).toFixed(2)]),
          h('td', {}, [entry.note]),
        ]);
      }),
    ),
  ]);
}

/** 새지 않는 자리 — 선언된 예외. */
function sealedTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['새지 않는 자리']),
        h('th', {}, ['왜']),
        h('th', {}, ['그러면 어떻게 알려지는가']),
      ]),
    ]),
    h(
      'tbody',
      {},
      SEALED_SLOTS.map((entry) =>
        h('tr', {}, [
          h('td', { class: 'path' }, [`${entry.slot.domain}.${entry.slot.path}`]),
          h('td', {}, [entry.reason]),
          h('td', {}, [entry.knownBy]),
        ]),
      ),
    ),
  ]);
}

/** 난 흔적 하나하나. */
function phenomenonTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['틱']),
        h('th', {}, ['사건']),
        h('th', {}, ['통로']),
        h('th', {}, ['자리']),
        h('th', {}, ['세기']),
        h('th', {}, ['애매함']),
        h('th', {}, ['언제까지']),
        h('th', {}, ['어디서']),
      ]),
    ]),
    h(
      'tbody',
      {},
      VEIL_FIELD.phenomena.map((phenomenon) =>
        h('tr', { class: phenomenon.decaysAtTick === null ? 'ok' : '' }, [
          h('td', {}, [String(phenomenon.atTick)]),
          h('td', {}, [
            VEIL_LOG.byId.get(phenomenon.causeEventId)?.name ?? '(로그에 없다)',
          ]),
          h('td', {}, [channelLabel(phenomenon.channel)]),
          h('td', { class: 'path' }, [`${phenomenon.domain}.${phenomenon.path}`]),
          h('td', {}, [phenomenon.intensity.toFixed(2)]),
          h('td', {}, [phenomenon.ambiguity.toFixed(2)]),
          h('td', {}, [
            phenomenon.decaysAtTick === null
              ? '사라지지 않는다'
              : `틱 ${String(phenomenon.decaysAtTick)}`,
          ]),
          h('td', { class: 'path' }, [short(phenomenon.placeId)]),
        ]),
      ),
    ),
  ]);
}

/** 사건별 — 무엇이 새고 무엇이 새지 않았는가. */
function sceneTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['사건']),
        h('th', {}, ['원자']),
        h('th', {}, ['움직인 자리']),
        h('th', {}, ['난 흔적']),
        h('th', {}, ['새지 않은 자리']),
      ]),
    ]),
    h(
      'tbody',
      {},
      VEIL_SCENES.map((scene) =>
        h('tr', { class: scene.phenomena.length > 0 ? 'ok' : '' }, [
          h('td', {}, [scene.label]),
          h('td', {}, [atomLabel(scene.event.atom)]),
          h('td', {}, [
            scene.event.effects
              .filter((effect) => effect.from !== effect.to)
              .map(effectLine)
              .join(' · '),
          ]),
          h('td', {}, [
            scene.phenomena.length === 0
              ? '(없다)'
              : scene.phenomena
                  .map((phenomenon) => `${channelLabel(phenomenon.channel)} ${phenomenon.path}`)
                  .join(' · '),
          ]),
          h('td', { class: 'path' }, [
            scene.sealedSlots.length === 0 ? '—' : scene.sealedSlots.join(' · '),
          ]),
        ]),
      ),
    ),
  ]);
}

/** 시간이 지나면 무엇이 남는가 — 게이지 열로 붕괴를 본다. */
function decayGauge(): VElement {
  const peak = Math.max(...DECAY_WALK.map((entry) => entry.standing.length), 1);
  return gaugeView(
    DECAY_WALK.map((entry) => ({
      label: `틱 ${String(entry.tick)} — ${entry.note}`,
      value: entry.standing.length / peak,
      level: entry.standing.length === 0 ? 'collapsing' : entry.standing.length <= 2 ? 'deficient' : 'met',
      detail: `서 있는 흔적 ${String(entry.standing.length)}${entry.standing.length > 0 ? ` (${[...new Set(entry.standing.map((phenomenon) => channelLabel(phenomenon.channel)))].join('·')})` : ''}`,
    })),
    { caption: '흔적은 삭는다 — 다만 되돌릴 수 없는 원자가 바꾼 자리의 자국은 삭지 않는다' },
  );
}

/** 설 수 없는 흔적들. */
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
      BROKEN_PHENOMENA.map((entry) =>
        h('tr', {}, [
          h('td', {}, [entry.broke]),
          h('td', {}, [entry.at === 'emit' ? '흔적이 나기 전' : '현상장 감사']),
          h('td', { class: 'path' }, [entry.rules.join(', ')]),
          h('td', {}, [entry.messages[0] ?? '']),
        ]),
      ),
    ),
  ]);
}

const lastStanding: readonly WorldPhenomenon[] = DECAY_WALK.at(-1)?.standing ?? [];

export function r2Page(): VElement {
  const suite = runScenarios(r2Scenarios);
  const passed = suite.failed === 0 && LEAK_REPORT.complete && VEIL_AUDIT.complete;

  const spec: PageSpec = {
    id: 'R2',
    title: '사건이 남기는 흔적',
    purpose:
      '사건이 관찰 가능한 현상으로 나타나게 한다 — 주체는 세계의 상태를 직접 읽지 못하고 현상만 감지한다.',
    verdict: {
      passed,
      label: passed
        ? `자리 ${String(LEAK_REPORT.movable)}(봉인 ${String(LEAK_REPORT.sealed.length)}) · 흔적 ${String(VEIL_FIELD.phenomena.length)} · 사라지지 않는 흔적 ${String(VEIL_AUDIT.permanent)} · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : '검증 실패',
    },
    sections: {
      input: [
        h('p', {}, [
          'R1 은 세계를 바꾸는 길을 사건 하나로 좁혔다. 그런데 그 다섯 사건은 세계를 바꿨을 뿐 **아무도 그것을 보지 못했다** — 04 가 상단 11 을 친 일이 어디에도 남지 않으면 R3 은 감지할 것이 없고 R4 는 오해할 것이 없다. R2 가 받는 것은 그 사건들과, 사건이 선 세계다.',
        ]),
        keyValueView([
          ['사건 (R1 WorldEvent)', `다섯 — ${VEIL_LOG.events.map((event) => atomLabel(event.atom)).join(' · ')}`],
          ['사건이 선 세계 (R0)', '효과마다 그때 값(from)이 적혀 있다 — 얼마나 움직였는지가 세기가 된다'],
          ['통로 6종 (O1 PHENOMENON_CHANNELS)', PHENOMENON_CHANNELS.map(channelLabel).join(' · ')],
          ['흔적을 요구하는 공리 (O0)', 'observable-trace — 흔적 없는 것은 아무도 그것이 일어났음을 알 수 없다'],
          ['원인을 요구하는 공리 (O0)', 'caused-persistence — 원인 없는 지속적 결과는 존재할 수 없다'],
          ['되돌릴 수 있는가 (P0-b)', 'reversible — 되돌릴 수 없는 원자가 바꾼 자리의 자국은 삭지 않는다'],
        ]),
      ],

      process: [
        h('p', {}, [
          'R2 가 새로 정하는 것은 없다. 통로가 몇 가지인지는 O1 이, 흔적이 왜 필요한지는 O0 이, 무엇이 움직였는지는 R1 이, 잴 수 있는 자리인지는 P4-a 가 이미 정했다. R2 가 더하는 것은 **표면**이다 — 세계의 변화가 어느 통로로 새는지, 그리고 **무엇이 새지 않는지**.',
        ]),
        stepLegend([
          { kind: 'fading', label: '삭는 흔적 (되돌릴 수 있는 원자)' },
          { kind: 'sealed', label: '사라지지 않는 흔적 (되돌릴 수 없는 원자가 바꾼 자리)' },
          { kind: 'silent', label: '아무 흔적도 나지 않은 사건' },
        ]),
        lines(
          '① 통로는 **자리**가 정한다 — 원자가 아니다. 같은 자국을 여럿이 남길 수 있다는 것이 곧 관찰의 뜻이다',
          '② 세기는 값이 움직인 폭 — 세계가 폭을 적어 둔 자리는 그 폭으로, 상한이 열린 자리는 그 자리 자신이 눈금이 된다',
          '③ 수명은 P0-b reversible — 되돌릴 수 없는 원자가 **바꾼** 자리는 삭지 않고, 치른 대가는 삭는다',
          '④ 자리는 세계에서 읽는다 (physical.region) — 지닌 자가 선 곳이고, 없으면 일으킨 자가 선 곳이다',
          '⑤ 애매함은 그 자국을 남길 수 있는 원자 수 — R3 의 선택 감지와 R4 의 오인이 여기서 선다',
          '⑥ 새지 않는 자리에서는 흔적이 나지 않는다 — 그리고 그것은 위반이 아니다',
        ),
        h('h3', {}, ['통로 표 — 원자가 움직일 수 있는 자리들']),
        channelTable(),
        keyValueView([['표면 판정', leakVerdict(LEAK_REPORT)]]),
      ],

      candidates: [
        h('p', {}, [
          '**앎은 새지 않는다.** 04 가 마비독을 알아낸 일에서 밖으로 나온 것은 그것을 알아내느라 닳은 몸뿐이다 — 그래서 04 가 무엇을 알아냈는지는 아무도 모르고, 누군가 거기서 무언가 했다는 것만 남는다.',
        ]),
        sealedTable(),
        h('p', {}, [
          '여기서 하나라도 새게 하면 R3 의 선택 감지도 R4 의 거짓 믿음도 통째로 무의미해진다 — 남의 앎을 직접 읽을 수 있으면 오해할 것이 없기 때문이다. 아래가 그 대조군이다.',
        ]),
        keyValueView([
          [
            '봉인된 세계에서 "마비독을 알아본다" 가 남기는 것',
            `${String(UNSEALED_WORLD.sealed.phenomena.length)} — ${UNSEALED_WORLD.sealed.phenomena.map((phenomenon) => `${channelLabel(phenomenon.channel)} ${phenomenon.path}`).join(' · ')}`,
          ],
          [
            '봉인을 걷고 통로를 내주면',
            `${String(UNSEALED_WORLD.leaking.phenomena.length)} — ${UNSEALED_WORLD.leaking.phenomena.map((phenomenon) => `${channelLabel(phenomenon.channel)} ${phenomenon.path}`).join(' · ')}`,
          ],
          ['늘어난 하나가 무엇인가', '남의 확신이 그대로 읽히는 세계 — 그것이 막아야 하는 자리다'],
        ]),
      ],

      selection: [
        h('p', {}, [
          '다섯 사건이 남긴 것이다. **같은 사건이 두 갈래로 갈린다** — 삭는 흔적과 삭지 않는 흔적.',
        ]),
        traceTimeline(),
        sceneTable(),
        phenomenonTable(),
        keyValueView([
          ['감사 (auditField)', fieldVerdict(VEIL_AUDIT)],
          ['흔적 없이 지나간 사건', VEIL_AUDIT.silent.length === 0 ? '(없다 — 다섯 다 무언가를 남겼다)' : VEIL_AUDIT.silent.join(' · ')],
        ]),
      ],

      beforeAfter: [
        h('p', {}, [
          '**세계가 기억하는 것과 세계에 남은 것은 다르다.** 원장은 여섯 칸을 전부 갖고 있는데, 한참 뒤 세계에 서 있는 흔적은 둘뿐이다.',
        ]),
        decayGauge(),
        keyValueView([
          ['첫 사건이 나기 전 (틱 ' + String(NOW) + ')', `서 있는 흔적 ${String(standingAt(VEIL_FIELD, NOW).length)}`],
          ['다섯 사건이 남긴 흔적 전부', String(VEIL_FIELD.phenomena.length)],
          [
            '한참 뒤에 남는 것',
            `${String(lastStanding.length)} — 전부 상단 11 의 몸에 난 자국이다 (${short(rivalId)})`,
          ],
          [
            '그 자국이 말해 주는 것',
            `애매함 ${(lastStanding[0]?.ambiguity ?? 0).toFixed(2)} — 열여섯 중 열둘이 남길 수 있는 자국이라 **누가 냈는지는 말해 주지 않는다**`,
          ],
          [
            '04 가 남긴 자국은',
            `전부 삭았다 — 재고도 몸도 되돌릴 수 있는 원자가 움직인 자리다 (${short(actorId)})`,
          ],
        ]),
      ],

      failure: [
        h('p', {}, [
          '설 수 없는 흔적은 던지지 않고 물린다 — **넷은 흔적이 나기 전에, 다섯은 현상장을 감사할 때** 걸린다.',
        ]),
        brokenTable(),
        h('h3', {}, ['그런데 흔적이 없는 것 자체는 실패가 아니다']),
        keyValueView([
          ['앎만 움직이는 사건', SILENT_SEEK.event.name],
          ['난 흔적', String(SILENT_SEEK.emitted.phenomena.length)],
          ['새지 않은 자리', SILENT_SEEK.emitted.sealedSlots.join(' · ')],
          ['사유는', SILENT_SEEK.emitted.violations.length === 0 ? '없다 — 세계는 바뀌었고 아무도 보지 못했다' : '있다'],
          ['감사는 그것을', `위반이 아니라 사실로 센다 — ${SILENT_SEEK.audit.silent.join(' · ')}`],
        ]),
        suiteView(suite),
      ],

      causality: [
        lines(
          'O0 observable-trace · caused-persistence → R2 — 흔적을 요구한 것도 원인을 요구한 것도 공리다',
          'O1 Phenomenon(통로·원인·자리·세기·수명) → WorldPhenomenon — 새 타입을 만들지 않고 그 자리를 채운다',
          'R1 WorldEvent.effects(from → to) → 세기 — 얼마나 움직였는지는 사건이 이미 기억한다',
          'P4-a MEASURABLE_SPAN → 잴 수 있는 자리와 그렇지 않은 자리 — R2 가 그 판단을 다시 하지 않는다',
          'P0-b reversible → 수명 — R1-b 가 봉인한 것과 정확히 같은 자리다 (한 일이지 치른 대가가 아니다)',
          'P0-b writes·pays → 애매함 — 같은 자국을 남길 수 있는 원자가 몇인가',
          '다음 → R3 지각: 누가 그것을 감지하는가 (감각 프로파일 · 거리 · 차폐). R2 는 세계에 무엇이 났는지까지만 안다',
          '남은 자리: 보고 통로는 났을 뿐 아직 퍼지지 않는다 — 누구를 거쳐 어디까지 가는지는 R4 의 몫이다',
          '남은 자리: 능력이 낸 현상의 세기(G6 강도)는 G 계층이 갚는다 — 지금 세기는 값이 움직인 폭에서만 온다',
          '남은 자리: 자연 발생 사건의 흔적은 여전히 유예다 — R1 이 그 사건 자체를 유예했다 (W2)',
        ),
      ],
    },
  };

  return pageView(spec);
}
