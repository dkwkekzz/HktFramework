// /lab/r0 — R0 세계 상태 저장소.
//
// 화면이 보여야 하는 것은 셋이다.
//
//   ① **원장은 시간이 아니라 변화를 센다.** D4 가 만든 열 틱을 그대로 담으면 여섯만 남는다 —
//      창고가 바닥난 뒤의 넷은 세계가 한 자리도 다르지 않기 때문이다.
//   ② **묻는 틱과 답하는 틱은 다르다.** 틱 430 에는 칸이 없지만 세계는 있다 — 틱 415 의 세계가
//      아직 서 있고, 답이 어느 틱에서 왔는지가 함께 온다.
//   ③ **과거는 지워지지 않는다.** 칸마다 앞 칸의 해시를 품으므로, 지나간 한 칸을 손대면 그
//      뒤가 전부 어긋난다 — 소급 수정이 조용히 지나가지 못한다.

import {
  ASKED_TICKS,
  BROKEN_RESULTS,
  COMMIT_LINES,
  EMPTY_GENESIS,
  REGION_SLOT,
  STOCK_SLOT,
  TAMPERED_LEDGER,
  TREND_ATTEMPTS,
  VEIL_LEDGER,
} from '@hkt/scenarios/suites/r0-veil-ledger';
import { r0Scenarios } from '@hkt/scenarios/suites/r0';
import { runScenarios } from '@hkt/scenarios';
import {
  chainViolations,
  currentSnapshot,
  diffBetween,
  historyLine,
  historyOf,
  readAt,
  replayStore,
  snapshotAt,
  storeVerdict,
  worldSlotText,
  type WorldStateSnapshot,
} from '@hkt/core/r0';

import { pageView, lines, type PageSpec } from '../page.ts';
import { diffView, keyValueView } from '../renderers/diff.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

const first = VEIL_LEDGER.snapshots[0] as WorldStateSnapshot;
const last = currentSnapshot(VEIL_LEDGER) as WorldStateSnapshot;
const span = diffBetween(VEIL_LEDGER, first.tick, last.tick);

/** 해시를 화면에서 짧게 — 앞 여섯 자리면 눈으로 구분된다. */
const short = (hash: string | null): string => (hash === null ? '(없음)' : hash.slice(0, 8));

/** 담아 달라고 낸 열 틱 — 받은 것과 물린 것이 함께 선다. */
function attemptTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['틱']),
        h('th', {}, ['재고']),
        h('th', {}, ['담겼는가']),
        h('th', {}, ['달라진 자리']),
        h('th', {}, ['사유']),
      ]),
    ]),
    h(
      'tbody',
      {},
      COMMIT_LINES.map((line) =>
        h('tr', { class: line.accepted ? 'ok' : '' }, [
          h('td', {}, [String(line.tick)]),
          h('td', {}, [String(line.stock)]),
          h('td', {}, [line.accepted ? '담겼다' : '물렸다']),
          h('td', {}, [line.accepted ? String(line.changed) : '0']),
          h('td', {}, [line.rules.length === 0 ? line.note : `${line.rules[0]} — ${line.note}`]),
        ]),
      ),
    ),
  ]);
}

/** 원장 그 자체 — 칸마다 앞 칸을 가리킨다. */
function ledgerTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['#']),
        h('th', {}, ['틱']),
        h('th', {}, ['자리']),
        h('th', {}, ['바뀐 자리']),
        h('th', {}, ['까닭']),
        h('th', {}, ['앞 해시']),
        h('th', {}, ['해시']),
      ]),
    ]),
    h(
      'tbody',
      {},
      VEIL_LEDGER.snapshots.map((snapshot) =>
        h('tr', { class: 'ok' }, [
          h('td', {}, [String(snapshot.seq)]),
          h('td', {}, [String(snapshot.tick)]),
          h('td', {}, [String(snapshot.slotCount)]),
          h('td', {}, [String(snapshot.changes.length)]),
          h('td', {}, [snapshot.cause.label]),
          h('td', { class: 'path' }, [short(snapshot.prevHash)]),
          h('td', { class: 'path' }, [short(snapshot.hash)]),
        ]),
      ),
    ),
  ]);
}

/** 시간을 가로질러 묻는다 — 묻는 틱과 답하는 틱이 갈리는 자리. */
function askTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['물은 틱']),
        h('th', {}, ['답한 칸']),
        h('th', {}, ['그때의 재고']),
        h('th', {}, ['무슨 뜻인가']),
      ]),
    ]),
    h(
      'tbody',
      {},
      ASKED_TICKS.map((tick) => {
        const query = snapshotAt(VEIL_LEDGER, tick);
        const reading = readAt(VEIL_LEDGER, tick, STOCK_SLOT);
        const shifted = query.snapshot !== null && query.snapshot.tick !== tick;
        return h('tr', { class: shifted ? 'ok' : '' }, [
          h('td', {}, [String(tick)]),
          h('td', {}, [query.snapshot === null ? '(없다)' : `틱 ${String(query.snapshot.tick)}`]),
          h('td', {}, [reading.value === null ? '(없다)' : String(reading.value)]),
          h('td', {}, [query.note]),
        ]);
      }),
    ),
  ]);
}

/** 자리 하나의 역사 — 값이 바뀐 칸만 남는다. */
function historyTable(): VElement {
  const stock = historyOf(VEIL_LEDGER, STOCK_SLOT);
  const region = historyOf(VEIL_LEDGER, REGION_SLOT);
  const rows = [
    ...stock.map((entry) => ['재고', entry] as const),
    ...region.map((entry) => ['선 곳', entry] as const),
  ];
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['자리']),
        h('th', {}, ['틱']),
        h('th', {}, ['어떻게']),
        h('th', {}, ['전 → 후']),
        h('th', {}, ['까닭']),
      ]),
    ]),
    h(
      'tbody',
      {},
      rows.map(([label, entry]) =>
        h('tr', { class: entry.change === 'changed' ? 'ok' : '' }, [
          h('td', {}, [label]),
          h('td', {}, [String(entry.tick)]),
          h('td', {}, [entry.change === 'added' ? '처음 섰다' : '바뀌었다']),
          h('td', {}, [historyLine(entry).replace(/^틱 \d+ · /, '')]),
          h('td', {}, [entry.cause]),
        ]),
      ),
    ),
  ]);
}

/** 담을 수 없는 커밋들. */
function brokenTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['무엇을 어겼나']),
        h('th', {}, ['사유']),
        h('th', {}, ['원장은']),
        h('th', {}, ['남은 말']),
      ]),
    ]),
    h(
      'tbody',
      {},
      BROKEN_RESULTS.map((entry) =>
        h('tr', {}, [
          h('td', {}, [entry.broke]),
          h('td', { class: 'path' }, [
            [...new Set(entry.result.violations.map((violation) => violation.rule))].join(', '),
          ]),
          h('td', {}, [`칸 ${String(entry.result.store.snapshots.length)} 그대로`]),
          h('td', {}, [entry.result.violations[0]?.message ?? '']),
        ]),
      ),
    ),
  ]);
}

/** 손댄 원장 — 한 칸을 고치면 그 뒤가 전부 어긋난다. */
function tamperTable(): VElement {
  const found = chainViolations(TAMPERED_LEDGER);
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [h('th', {}, ['어긋난 자리']), h('th', {}, ['사유']), h('th', {}, ['무엇이']),])
    ]),
    h(
      'tbody',
      {},
      found.map((violation) =>
        h('tr', {}, [
          h('td', { class: 'path' }, [violation.path]),
          h('td', {}, [violation.rule]),
          h('td', {}, [violation.message]),
        ]),
      ),
    ),
  ]);
}

export function r0Page(): VElement {
  const suite = runScenarios(r0Scenarios);
  const replayed = replayStore(VEIL_LEDGER).ledgerHash === VEIL_LEDGER.ledgerHash;
  const passed = suite.failed === 0 && chainViolations(VEIL_LEDGER).length === 0 && replayed;

  const spec: PageSpec = {
    id: 'R0',
    title: '세계 상태 저장소',
    purpose:
      '정식화된 세계의 실제 상태를 원장 하나에 담고 시간을 가로질러 조회한다 — 지금까지 세계는 값으로만 있었고 주인이 없었다.',
    verdict: {
      passed,
      label: passed
        ? `요청 ${String(TREND_ATTEMPTS.length)} → 칸 ${String(VEIL_LEDGER.snapshots.length)} · 자리 ${String(last.slotCount)} · 지문 ${short(VEIL_LEDGER.ledgerHash)} · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : '검증 실패',
    },
    sections: {
      input: [
        h('p', {}, [
          'D4 는 이미 창고가 비어 가는 열 틱을 갖고 있었다. 그런데 그 스냅샷은 **매번 새로 조립되는 한 컷**이었다 — 누가 갖고 있는 것이 아니었고, 지나간 값은 아무 데도 남지 않았다. R0 이 받는 것은 그 같은 열 틱이다.',
        ]),
        keyValueView([
          ['담을 세계 (D4 TREND_SNAPSHOTS)', `${String(TREND_ATTEMPTS.length)} 틱 — 틱 400~442, 재고 10 → 0`],
          ['담기는 모양', '세계를 통째로 베끼지 않고 State 원소로 분해해(O2 disassembleWorld) 조립 관문을 다시 지나게 한다'],
          ['자리 규칙', 'O2 STATE_SCHEMA — R0 은 어떤 값이 놓일 수 있는지 다시 판정하지 않는다'],
          ['시간', 'V1 틱 — 앞으로만 가고, 한 틱에 세계가 둘일 수 없다'],
          ['근거', '`CommitCause` — 사건 id 자리는 **비운 채로 연다**(R1 이 채운다). 지금은 사람이 읽는 이름만 요구한다'],
        ]),
      ],

      process: [
        h('p', {}, [
          '커밋은 관문 일곱을 지난다. 순서에 뜻이 있다 — 먼저 **원장 자신이 온전한지** 묻고(손댄 원장 위에 쌓지 않는다), 그다음 근거와 시간을 묻고, 마지막에 세계를 조립한다.',
        ]),
        lines(
          'broken-chain — 지나간 칸을 손댔다 (그 위에는 새 칸을 쌓지 못한다)',
          'genesis-required — 세계는 두 번 처음 서지 않는다',
          'causeless-commit — 무엇 때문에 달라졌는지 없이 세계가 달라진다',
          'backward-tick · duplicate-tick — 시간은 앞으로만 가고, 한 틱에 세계는 하나다',
          'rejected-state — O2 가 막은 값이 섞였다 (하나라도 있으면 커밋 전체가 물린다 — 세계는 반쪽으로 담기지 않는다)',
          'empty-commit — 한 자리도 다르지 않다 (원장은 시간이 아니라 변화를 센다)',
        ),
        h('p', {}, [
          '해시는 앞 칸의 해시를 재료에 넣는다. 그래서 지나간 칸의 값 하나만 고쳐도 그 칸의 해시가 달라지고 **그 뒤 칸들이 품은 앞 해시와 전부 어긋난다** — 소급 수정이 조용히 지나가지 못한다.',
        ]),
      ],

      candidates: [
        h('p', {}, [
          '열 틱을 전부 담아 달라고 낸다. 물릴 것도 함께 낸다 — 숨기지 않는다.',
        ]),
        attemptTable(),
        h('p', {}, [
          '**여섯이 남고 넷이 물린다.** 물린 넷은 전부 창고가 바닥난 뒤(틱 421·427·433·442)다 — 시간은 흘렀지만 세계는 한 자리도 다르지 않기 때문이다. 원장은 시간이 아니라 변화를 센다.',
        ]),
      ],

      selection: [
        h('p', {}, ['남은 여섯 칸이 세계의 지나온 열이다. 칸마다 앞 칸을 가리킨다.']),
        ledgerTable(),
        h('p', {}, [
          `세계에는 늘 ${String(last.slotCount)} 자리가 서 있는데 첫 칸에서 그 전부가 새로 생기고, 그 뒤로 달라지는 것은 사냥꾼 넷의 재고뿐이다 — 원장이 담는 것은 세계 전체이되 세는 것은 차이다.`,
        ]),
        h('h3', {}, ['시간을 가로질러 묻는다']),
        askTable(),
        h('p', {}, [
          '**틱 430 에는 칸이 없지만 세계는 있다.** 다음 변화가 올 때까지 틱 415 의 세계가 서 있기 때문이고, 그래서 답이 어느 칸에서 왔는지가 값과 함께 온다. 마지막 칸보다 뒤를 물어도 마찬가지다 — 그것이 "지금" 이다.',
        ]),
      ],

      beforeAfter: [
        h('p', {}, [
          `첫 칸(틱 ${String(first.tick)})과 마지막 칸(틱 ${String(last.tick)}) 사이. 차이는 O2 worldDiff 가 세고 R0 은 어느 칸과 어느 칸인지만 고른다.`,
        ]),
        keyValueView([
          ['지나온 칸', `${String(span.steps)} 개`],
          ['달라진 자리', `${String(span.entries.length)} 곳 — ${span.note}`],
          ['원장의 지문', VEIL_LEDGER.ledgerHash ?? '(없음)'],
          ['다시 세우면', replayed ? '같은 지문이다 — 분해했다 조립해도 원장은 그대로다' : '갈라진다'],
          ['판정', storeVerdict(VEIL_LEDGER)],
        ]),
        diffView(first.world.economic, last.world.economic, {
          leftLabel: `틱 ${String(first.tick)} (경제 영역)`,
          rightLabel: `틱 ${String(last.tick)}`,
        }),
        h('h3', {}, ['자리 하나가 지나온 것']),
        historyTable(),
        h('p', {}, [
          `**${worldSlotText(STOCK_SLOT).slice(0, 24)}… 는 여섯 줄인데 선 곳은 한 줄뿐이다.** 역사에는 값이 실제로 바뀐 칸만 남기 때문이다 — 새 재료를 만들지 않고 각 칸이 이미 품은 차이를 자리로 거른 것이다.`,
        ]),
      ],

      failure: [
        h('p', {}, ['담을 수 없는 커밋은 던지지 않고 물린다 — 원장은 그대로이고 사유가 값으로 남는다.']),
        brokenTable(),
        h('h3', {}, ['지나간 칸을 손대면']),
        h('p', {}, [
          '틱 406 의 재고 하나를 99 로 고쳐 봤다. 그 칸만 걸리는 것이 아니다 — 다시 센 해시가 다음 칸의 기대값이 되므로 **그 뒤가 전부 어긋나고 원장의 지문까지 어긋난다.**',
        ]),
        tamperTable(),
        suiteView(suite),
      ],

      causality: [
        lines(
          'O2 조립 관문 → R0 커밋 — 어떤 값이 세계에 놓일 수 있는지는 여기서 다시 정하지 않는다',
          'O2 worldDiff → 칸의 changes → 자리의 역사 · 두 틱 사이의 차이 (재료를 새로 만들지 않는다)',
          'D4 WorldSnapshot(한 컷) → R0 WorldStateSnapshot(열의 한 칸) — 더한 것은 주인·근거·앞 해시다',
          'V1 틱 → 시간은 앞으로만 · V1 stateHash → 앞 해시를 품는 사슬',
          `자리 0 짜리 세계도 genesis 로 선다 — 빈 것과 없는 것은 다르다 (경계: ${EMPTY_GENESIS.accepted ? '담겼다' : '물렸다'})`,
          '다음 → R1 사건: `CommitCause.eventIds` 가 비어 있다. 세계가 사건 없이 바뀌지 않게 하는 것은 R1 이고 R0 은 그 자리만 열었다',
          '남은 자리: R0 은 세계를 바꾸지 않는다 — 변화를 만드는 문법은 R1·R2 의 몫이다',
          '남은 자리: 원장은 아직 통째로 메모리에 선다 — 구간 압축·보존 창은 서버(N 계층)가 볼 일이다',
        ),
      ],
    },
  };

  return pageView(spec);
}
