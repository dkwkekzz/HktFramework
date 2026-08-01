// /lab/v1 — V1 결정적 실행 환경.
// 브라우저가 core 를 그대로 실행한다. 서버·Lab 이 같은 core 를 돌리므로
// "같은 시드 → 같은 해시" 가 두 환경에서 동일하게 성립해야 한다 (WORKFLOW §1).

import { createRandom, nextInt, pick, split, stateHash } from '@hkt/core/v1';
import { runScenarios } from '@hkt/scenarios';
import { firstDivergence, runToyWorld } from '@hkt/scenarios/suites/v1-toy-world';
import { v1Scenarios } from '@hkt/scenarios/suites/v1';

import { pageView, lines, type PageSpec } from '../page.ts';
import { diffView, keyValueView, valueView } from '../renderers/diff.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

const SEED_A = '배고픈 인간 1 + 음식 1';
const SEED_B = '배고픈 인간 1 + 음식 2';
const RUNS = 100;
const ACTIONS = ['forage', 'rest', 'trade', 'flee'] as const;

export function v1Page(): VElement {
  const runA = runToyWorld(SEED_A);
  const runB = runToyWorld(SEED_B);

  // 같은 시드 100회 — 해시가 몇 종류 나오는가.
  const stateHashes = new Map<string, number>();
  const eventHashes = new Map<string, number>();
  for (let run = 0; run < RUNS; run += 1) {
    const current = runToyWorld(SEED_A);
    stateHashes.set(current.stateHash, (stateHashes.get(current.stateHash) ?? 0) + 1);
    eventHashes.set(current.eventHash, (eventHashes.get(current.eventHash) ?? 0) + 1);
  }
  const deterministic = stateHashes.size === 1 && eventHashes.size === 1;

  // 후보 → 선택: split 으로 나눈 스트림이 무엇을 골랐는가.
  const root = createRandom(SEED_A);
  const picks = [0, 1, 2].map((index) => {
    const label = `sample-${String(index)}`;
    const [afterAction, action] = pick(split(root, label), ACTIONS);
    const [, amount] = nextInt(afterAction, -3, 4);
    return { label, action, amount };
  });

  const divergence = firstDivergence(runA, runB);
  const suite = runScenarios(v1Scenarios);
  const initialStock = Object.fromEntries(Object.keys(runA.world.stock).map((id) => [id, 10]));

  const spec: PageSpec = {
    id: 'V1',
    title: '결정적 실행 환경',
    purpose: '같은 시드와 입력이면 항상 같은 사건 순서와 상태 해시가 나온다.',
    verdict: {
      passed: deterministic && suite.failed === 0,
      label: deterministic
        ? `같은 시드 ${String(RUNS)}회 → 해시 1종 · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : `해시가 ${String(stateHashes.size)}종으로 갈라졌다`,
    },
    sections: {
      input: keyValueView([
        ['시드 A', SEED_A],
        ['시드 B (한 글자 차이)', SEED_B],
        ['틱 × 주체', '20 tick × 3 subject = 60 event'],
        ['반복 실행', RUNS],
      ]),
      process: [
        h('p', {}, ['사건 로그 — (tick, subjectId, action) 안정 정렬로 순서가 고정된다.']),
        h('table', { class: 'event-table' }, [
          h('thead', {}, [
            h('tr', {}, [h('th', {}, ['tick']), h('th', {}, ['주체']), h('th', {}, ['행동']), h('th', {}, ['수량'])]),
          ]),
          h(
            'tbody',
            {},
            runA.events.slice(0, 9).map((event) =>
              h('tr', {}, [
                h('td', {}, [String(event.tick)]),
                h('td', { class: 'id' }, [event.subjectId]),
                h('td', {}, [event.action]),
                h('td', { class: 'num' }, [event.amount >= 0 ? `+${String(event.amount)}` : String(event.amount)]),
              ]),
            ),
          ),
        ]),
      ],
      candidates: [
        h('p', {}, [`행동 후보 16원자 이전의 장난감 후보 집합: ${ACTIONS.join(' · ')}`]),
        valueView(ACTIONS),
      ],
      selection: h('table', { class: 'kv-table' }, [
        h(
          'tbody',
          {},
          picks.map((entry) =>
            h('tr', {}, [
              h('th', {}, [entry.label]),
              h('td', {}, [
                h('code', {}, [`${entry.action} · amount ${String(entry.amount)}`]),
                ' — 같은 라벨을 다시 split 하면 항상 같은 선택',
              ]),
            ]),
          ),
        ),
      ]),
      beforeAfter: [
        h('h3', {}, ['재고 전 → 후']),
        diffView(initialStock, runA.world.stock, { leftLabel: '초기 재고', rightLabel: '최종 재고' }),
        h('h3', {}, [`같은 시드 ${String(RUNS)}회 해시 비교표`]),
        h('table', { class: 'hash-table' }, [
          h('thead', {}, [
            h('tr', {}, [h('th', {}, ['대상']), h('th', {}, ['해시']), h('th', {}, ['실행 수']), h('th', {}, ['판정'])]),
          ]),
          h('tbody', {}, [
            ...[...stateHashes].map(([hash, count]) =>
              h('tr', { class: count === RUNS ? 'ok' : 'bad' }, [
                h('td', {}, ['최종 상태']),
                h('td', {}, [h('code', {}, [hash])]),
                h('td', { class: 'num' }, [String(count)]),
                h('td', {}, [count === RUNS ? '동일 ✔' : '갈라짐 ✘']),
              ]),
            ),
            ...[...eventHashes].map(([hash, count]) =>
              h('tr', { class: count === RUNS ? 'ok' : 'bad' }, [
                h('td', {}, ['사건 순서']),
                h('td', {}, [h('code', {}, [hash])]),
                h('td', { class: 'num' }, [String(count)]),
                h('td', {}, [count === RUNS ? '동일 ✔' : '갈라짐 ✘']),
              ]),
            ),
          ]),
        ]),
      ],
      failure: [
        h('p', {}, ['시드를 한 글자 바꾸면 어디서부터 갈라지는가 — 검출력이 없으면 결정성은 의미가 없다.']),
        diffView(divergence?.left ?? null, divergence?.right ?? null, {
          leftLabel: `A (${SEED_A})`,
          rightLabel: `B (${SEED_B})`,
        }),
        h('p', {}, [`최초 분기 사건 #${divergence === null ? '(없음)' : String(divergence.index)}`]),
        h('h3', {}, ['시나리오 3종']),
        suiteView(suite),
      ],
      causality: lines(
        '시드 → createRandom → 주체·틱 라벨로 split → 행동·수량 선택 → 재고 변화',
        '사건 순서는 (tick, subjectId, action) 안정 정렬로 고정 — 처리 순서와 무관하다',
        '상태 해시는 키 순서를 정규화한 뒤 계산 — 같은 상태면 같은 문자열',
        `해시 함수의 고정점: stateHash({tick:1}) = ${stateHash({ tick: 1 })}`,
        '이 페이지는 브라우저에서 core 를 그대로 실행한다 — 서버와 같은 해시가 나와야 한다',
      ),
    },
  };

  return pageView(spec);
}
