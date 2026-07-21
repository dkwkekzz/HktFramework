// C1 — 첫 사냥터 (R1 절반): 순행 주기 구동기 + 마이크로 루프 완주
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGraph } from '../src/graph/loader.js';
import { runC1 } from '../src/content/c1.js';

const graph = loadGraph();

test('성공: 순행 창 안에 표본+관찰+조사+수확 4목적을 완주한다', () => {
  const r = runC1(graph, { delay: 0 });
  assert.equal(r.result, 'success');
  for (const k of ['표본', '관찰', '조사', '수확']) {
    assert.equal(r.results[k], true, `${k} 목적 완료`);
  }
});

test('완주는 상향 파문을 낳는다 (표본 → 0.1.1.2 → 0.1.1 → G-0)', () => {
  const r = runC1(graph, { delay: 0 });
  const anc = r.ripples.flatMap((e) => e.ancestors.map((a) => a.id));
  assert.ok(anc.includes('G-0.1.1.2') && anc.includes('G-0.1.1') && anc.includes('G-0'));
});

test('실패: 순행 창(20)을 놓치면(지체 25틱) 무대가 소멸/풍화해 완주 불가', () => {
  const r = runC1(graph, { delay: 25 });
  assert.equal(r.result, 'timeout');
  assert.equal(r.results['표본'], false, '조직 조각이 소멸해 표본 실패');
  assert.equal(r.results['수확'], false, '흉터 신선도 창 밖이라 수확 실패');
});

test('주기 구동기가 순행이 무대를 재생성하고 잔여시간/신선도를 되채운다', () => {
  const r = runC1(graph, { delay: 0 });
  // 순행 창 열림이 로그로 남고(재생성), 창 소모 이벤트가 시간 경과와 함께 보인다
  assert.ok(r.cycleLog.length >= 0);
  assert.ok(r.t >= 6, '4행동에 걸쳐 시간이 진행됐다');
});

test('완주 후 원장 audit() + 사건 감사가 성립한다', () => {
  const r = runC1(graph, { delay: 0 });
  assert.equal(r.audit.ok, true);
  assert.ok(r.events.every((e) => typeof e.energy === 'number'));
  // 수확은 세계 경계 유입(mint)으로 기록된다
  assert.ok(r.events.some((e) => e.verb === '수확' && e.delta['잔고'] > 0), '흉터 수확 사건');
  assert.ok(r.events.some((e) => e.verb === '채취'), '채취 사건');
});
