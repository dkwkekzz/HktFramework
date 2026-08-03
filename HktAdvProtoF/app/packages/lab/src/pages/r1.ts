// /lab/r1 — R1 사건으로만 바뀌는 세계.
//
// 화면이 보여야 하는 것은 셋이다.
//
//   ① **모든 칸이 사건을 가리킨다.** R0 의 원장은 근거가 사람이 적은 문자열 한 줄이었다.
//      같은 겨울을 사건 다섯으로 다시 세우면 genesis 를 뺀 다섯 칸이 각각 사건 id 를 대고,
//      감사가 "사건 없이 담긴 칸 0" 을 값으로 낸다.
//   ② **세계는 요청한 만큼만 바뀐다.** 04 가 가져오고 주고받고 먹는 동안 사제의 재고는
//      10 그대로다 — 04 의 요청서에 그 자리가 없기 때문이다.
//   ③ **어떤 자리는 돌아오지 않는다.** 제거(P0-b `reversible: false`)가 한 일은 되돌리는
//      사건으로 복구되지 않는다. 대가로 깎인 몸은 다시 채울 수 있다.

import {
  actorId,
  bystanderId,
  BROKEN_EVENTS,
  EMPTY_LARDER,
  meatId,
  rivalId,
  SILENT_STORE,
  VEIL_APPLIED,
  VEIL_GENESIS,
  VEIL_LOG,
  VEIL_STORE,
  villagersId,
} from '@hkt/scenarios/suites/r1-veil-events';
import { r1Scenarios } from '@hkt/scenarios/suites/r1';
import { runScenarios } from '@hkt/scenarios';
import { readSlot } from '@hkt/core/o2';
import { atomLabel } from '@hkt/core/p0';
import { latest, type WorldStateSnapshot } from '@hkt/core/r0';
import {
  effectLine,
  logVerdict,
  witnessViolations,
  type WorldEvent,
} from '@hkt/core/r1';

import { pageView, lines, type PageSpec } from '../page.ts';
import { diffView, keyValueView } from '../renderers/diff.ts';
import { suiteView } from '../renderers/scenario.ts';
import { stepLegend, timelineView } from '../renderers/timeline.ts';
import { h, type VElement } from '../vnode.ts';

const genesis = latest(VEIL_GENESIS) as WorldStateSnapshot;
const now = latest(VEIL_STORE) as WorldStateSnapshot;
const audit = witnessViolations(VEIL_STORE, VEIL_LOG);
const silentAudit = witnessViolations(SILENT_STORE, VEIL_LOG);

const short = (hash: string | null): string => (hash === null ? '(없음)' : hash.slice(0, 8));

/** 사건 다섯을 순서대로 — 공용 렌더러 ④ 타임라인의 둘째 소비자다. */
function eventTimeline(): VElement {
  return timelineView(
    VEIL_LOG.events.map((event, index) => ({
      order: index,
      label: event.name,
      kind: event.atom === 'destroy' ? 'sealed' : event.atom === 'seek' ? 'knowing' : 'moving',
      badge: `틱 ${String(event.tick)} · ${atomLabel(event.atom)}`,
      note: `${String(event.effects.length)} 자리 — ${event.effects.map(effectLine).join(' · ')}`,
      hint: event.id,
      ...(event.atom === 'destroy' ? { emphasis: true } : {}),
    })),
    {
      kindColors: { knowing: '#60a5fa', moving: '#4ade80', sealed: '#f87171' },
      emptyText: '아직 아무 사건도 일어나지 않았다',
    },
  );
}

/** 낸 사건 하나하나 — 무엇을 요청했고 무엇이 달라졌는가. */
function eventTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['틱']),
        h('th', {}, ['원자']),
        h('th', {}, ['사건']),
        h('th', {}, ['바꾼 자리']),
        h('th', {}, ['치른 자리']),
        h('th', {}, ['얹혔는가']),
      ]),
    ]),
    h(
      'tbody',
      {},
      VEIL_APPLIED.map((entry) => {
        const event = entry.event as WorldEvent | null;
        const changes = (event?.effects ?? []).filter((effect) => effect.kind === 'change');
        const payments = (event?.effects ?? []).filter((effect) => effect.kind === 'payment');
        return h('tr', { class: entry.result?.applied === true ? 'ok' : '' }, [
          h('td', {}, [String(entry.scene.tick)]),
          h('td', {}, [event === null ? '—' : atomLabel(event.atom)]),
          h('td', {}, [entry.scene.label]),
          h('td', {}, [changes.map(effectLine).join(' · ') || '—']),
          h('td', {}, [payments.map(effectLine).join(' · ') || '—']),
          h('td', {}, [entry.result?.applied === true ? '얹혔다' : '물렸다']),
        ]);
      }),
    ),
  ]);
}

/** 원장 — 칸마다 어느 사건을 대는가. */
function ledgerTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['#']),
        h('th', {}, ['틱']),
        h('th', {}, ['까닭']),
        h('th', {}, ['대는 사건']),
        h('th', {}, ['바뀐 자리']),
        h('th', {}, ['해시']),
      ]),
    ]),
    h(
      'tbody',
      {},
      VEIL_STORE.snapshots.map((snapshot) =>
        h('tr', { class: snapshot.cause.eventIds.length > 0 ? 'ok' : '' }, [
          h('td', {}, [String(snapshot.seq)]),
          h('td', {}, [String(snapshot.tick)]),
          h('td', {}, [snapshot.cause.label]),
          h('td', { class: 'path' }, [
            snapshot.cause.kind === 'genesis'
              ? '(세계가 처음 선다)'
              : short(snapshot.cause.eventIds[0] ?? null),
          ]),
          h('td', {}, [String(snapshot.changes.length)]),
          h('td', { class: 'path' }, [short(snapshot.hash)]),
        ]),
      ),
    ),
  ]);
}

/** 설 수 없는 사건들 — 어느 단계에서 걸리는가. */
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
      BROKEN_EVENTS.map((entry) =>
        h('tr', {}, [
          h('td', {}, [entry.broke]),
          h('td', {}, [entry.at === 'mint' ? '사건이 서기 전' : '세계에 얹는 자리']),
          h('td', { class: 'path' }, [entry.rules.join(', ')]),
          h('td', {}, [entry.messages[0] ?? '']),
        ]),
      ),
    ),
  ]);
}

export function r1Page(): VElement {
  const suite = runScenarios(r1Scenarios);
  const passed = suite.failed === 0 && audit.length === 0;
  const witnessed = VEIL_STORE.snapshots.filter(
    (snapshot) => snapshot.cause.eventIds.length > 0,
  ).length;

  const spec: PageSpec = {
    id: 'R1',
    title: '사건으로만 바뀌는 세계',
    purpose:
      '세계의 모든 상태 변화를 사건으로만 허용한다 — 사건 없이 담긴 칸은 원장 감사에서 걸린다.',
    verdict: {
      passed,
      label: passed
        ? `사건 ${String(VEIL_LOG.events.length)} · 변화한 칸 ${String(VEIL_STORE.snapshots.length - 1)} 중 사건이 대는 칸 ${String(witnessed)} · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : '검증 실패',
    },
    sections: {
      input: [
        h('p', {}, [
          'R0 은 세계에 주인을 주었다. 그런데 그 원장의 근거는 **사람이 적은 문자열 한 줄**이었다 — "사흘치를 먹었다". 세계는 재고가 왜 줄었는지 몰랐고, 무엇이 그것을 줄일 수 있는지도 몰랐다. R1 이 받는 것은 그 원장과, P0-c 가 만들어 둔 요청서다.',
        ]),
        keyServing(),
      ],

      process: [
        h('p', {}, [
          'R1 은 새 문법을 만들지 않는다. 요청이 설 수 있는지는 P0-c `fitAction` 이, 사건이 무엇으로 서는지는 O1 `Event` 가, 담기는 규칙은 R0 이 이미 정했다. R1 이 더하는 것은 **통로**다 — 세계를 바꾸는 길이 사건 하나뿐이 되게 하는 것.',
        ]),
        stepLegend([
          { kind: 'knowing', label: '앎을 세우는 사건 (찾다)' },
          { kind: 'moving', label: '자리를 옮기는 사건 (획득·교환)' },
          { kind: 'sealed', label: '되돌릴 수 없는 사건 (제거)' },
        ]),
        lines(
          '① 요청이 서는가 — P0-c 가 이미 묻는 넷(대상·비용·자리·관측)을 다시 묻지 않는다',
          '② 요청서 밖의 자리를 바꾸지 않는가 — unrequested-effect (없으면 P0-c 관문이 무의미해진다)',
          '③ 사건은 자기가 선 세계를 기억하는가 — effect.from 은 손으로 적지 않고 세계에서 읽는다',
          '④ 낡은 전제 위에 쓰지 않는가 — stale-effect (사건이 선 뒤 세계가 움직였다)',
          '⑤ 되돌릴 수 없는 것을 되돌리지 않는가 — irreversible-undo (P0-b reversible)',
          '⑥ 담기는 것은 R0 커밋 그대로 — 세계가 값을 거부하면 world-refused 로 옮겨 적는다',
          '유예: 일으킨 자 없는 사건(자연 발생)은 규칙이 실체화(W2)돼야 근거를 댈 수 있다',
        ),
      ],

      candidates: [
        h('p', {}, [
          '몰이꾼 04 가 겨울에 낸 다섯 걸음이다. 알아보고, 가져오고, 주고받고, 먹고, 친다.',
        ]),
        eventTimeline(),
        eventTable(),
      ],

      selection: [
        h('p', {}, [
          '**칸마다 사건을 댄다.** genesis 를 뺀 다섯 칸이 각각 사건 id 하나를 가리키고, 칸의 이름표가 무엇이 일어났는지 말한다.',
        ]),
        ledgerTable(),
        keyValueView([
          ['감사 (witnessViolations)', `사건 없이 담긴 칸 ${String(audit.length)} 개`],
          ['판정', logVerdict(VEIL_STORE, VEIL_LOG)],
          ['같은 창고를 사건 없이 채우면', silentAudit[0]?.message ?? '(없음)'],
        ]),
        h('p', {}, [
          '이것이 "사건 없는 변경 금지" 를 **주장이 아니라 검사**로 만드는 자리다 — 같은 원장에 사건 없이 칸을 하나 더 담으면 감사가 곧바로 그 칸을 짚는다.',
        ]),
      ],

      beforeAfter: [
        h('p', {}, [
          '겨울이 시작될 때와 다섯 걸음 뒤. **04 의 자리만 움직인다** — 세계는 요청한 만큼만 바뀐다.',
        ]),
        keyValueView([
          [
            '04 의 재고',
            `${String(readSlot(genesis.world, 'economic', actorId, `stock.${meatId}`))} → ${String(readSlot(now.world, 'economic', actorId, `stock.${meatId}`))}`,
          ],
          [
            '사제의 재고 (아무도 손대지 않은 자리)',
            `${String(readSlot(genesis.world, 'economic', bystanderId, `stock.${meatId}`))} → ${String(readSlot(now.world, 'economic', bystanderId, `stock.${meatId}`))}`,
          ],
          [
            '04 → 마을 신뢰',
            `${String(readSlot(genesis.world, 'relational', actorId, `trust.${villagersId}`))} → ${String(readSlot(now.world, 'relational', actorId, `trust.${villagersId}`))}`,
          ],
          [
            '상단 11 의 몸 (되돌릴 수 없는 자리)',
            `${String(readSlot(genesis.world, 'biological', rivalId, 'vitality'))} → ${String(readSlot(now.world, 'biological', rivalId, 'vitality'))}`,
          ],
          ['원장의 지문', `${short(VEIL_GENESIS.ledgerHash)} → ${short(VEIL_STORE.ledgerHash)}`],
        ]),
        diffView(genesis.world.economic, now.world.economic, {
          leftLabel: '겨울의 시작 (경제 영역)',
          rightLabel: '다섯 걸음 뒤',
        }),
      ],

      failure: [
        h('p', {}, [
          '설 수 없는 사건은 던지지 않고 물린다 — **다섯은 사건이 서기 전에, 셋은 세계에 얹는 자리에서** 걸린다.',
        ]),
        brokenTable(),
        h('h3', {}, ['바닥난 창고에서 또 먹으면']),
        keyValueView([
          ['사건은 서는가', EMPTY_LARDER.event === null ? '서지 않는다' : '**선다** — R1 은 값의 범위를 판정하지 않는다'],
          ['세계가 받는가', EMPTY_LARDER.apply?.applied === true ? '받는다' : '받지 않는다'],
          ['사유', EMPTY_LARDER.apply?.violations[0]?.message ?? '(없음)'],
          [
            '원장은',
            `칸 ${String(EMPTY_LARDER.apply?.store.snapshots.length ?? 0)} 그대로 — 물린 사건은 세계를 늘리지 않는다`,
          ],
        ]),
        suiteView(suite),
      ],

      causality: [
        lines(
          'P0-b 걸림(writes·pays) → P0-c fitAction → R1 사건 — 무엇을 바꿀 수 있는지는 여기서 다시 정하지 않는다',
          'O1 Event(틱·일으킨 자·바뀐 상태·까닭) → WorldEvent — 새 타입을 만들지 않고 그 자리를 채운다',
          'R1 사건 → R0 커밋(근거=사건 id) → 원장 — R0 이 비워 둔 자리가 여기서 처음 찬다',
          'O2 스키마 → 세계가 받지 않는 값은 사건이라도 담기지 않는다 (재고는 0 아래로 내려가지 않는다)',
          'P0-b reversible → 되돌릴 수 없는 원자가 한 일은 봉인된다 (대가로 깎인 것은 다시 채울 수 있다)',
          '다음 → R2 현상: 사건이 세계에 남기는 관찰 가능한 흔적(빛·소리·흔적·냄새·의념 잔향·보고서)',
          '남은 자리: 자연 발생 사건은 규칙이 실체화(W2)돼야 근거를 댈 수 있다 — 지금은 유예다',
          '남은 자리: 같은 틱에 같은 자리를 다투는 사건 둘의 판정은 D5·E0 의 몫이다',
        ),
      ],
    },
  };

  return pageView(spec);
}

/** 입력 표 — 무엇을 받아 사건을 세우는가. */
function keyServing(): VElement {
  return keyValueView([
    ['담긴 세계 (R0)', `틱 ${String(genesis.tick)} · 자리 ${String(genesis.slotCount)} — D4 장면의 첫 틱 그대로다`],
    ['요청서 (P0-c ActionProposal)', '무엇을 바꾸고 무엇을 치르겠다는 제안. 상태를 고치지 않는다'],
    ['원자 걸림 (P0-b)', '그 원자가 여는 자리(writes)와 치르는 자리(pays), 그리고 되돌릴 수 있는가'],
    ['사건의 모양 (O1 Event)', '틱 · 일으킨 자 · 바뀐 상태 · 까닭 — R1 이 그 자리를 채운다'],
    ['담기는 규칙 (R0)', '앞으로만 · 변화만 · 사슬 · 근거 — 여기서 근거가 처음으로 사건 id 로 찬다'],
  ]);
}
