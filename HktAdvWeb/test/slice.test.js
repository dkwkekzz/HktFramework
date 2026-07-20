// B4 — 최소 수직 절편 (Slice-1, M2)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGraph } from '../src/graph/loader.js';
import { runSlice, loadSliceFixture } from '../src/actors/bot.js';

const graph = loadGraph();

test('사슬 완주(성공): 이동 → 채취 → done_when 충족 → 상향 파문', () => {
  const r = runSlice(graph, loadSliceFixture(), { 소멸타이머: 3 });
  assert.equal(r.result, 'success');
  assert.equal(r.done, true);
  // 채취물이 표본 자격(잔향보존_최소)을 넘는다
  const 표본 = r.inventory.find((s) => s.properties['신성잔향보존율'] >= graph.constants['잔향보존_최소']);
  assert.ok(표본, '표본 자격 물질이 인벤토리에 있다');
  // 파문이 절편 계보를 타고 뿌리까지 오른다
  const anc = r.ripples[0].ancestors.map((a) => a.id);
  assert.ok(anc.includes('G-0.1.1.2') && anc.includes('G-0.1.1') && anc.includes('G-0'));
});

test('시간 압박(실패): 소멸타이머가 이동보다 짧으면 무대가 소멸해 실패', () => {
  const r = runSlice(graph, loadSliceFixture(), { 소멸타이머: 1, move_cost: 1 });
  assert.equal(r.result, 'timeout');
  assert.equal(r.done, false);
  // 소멸 사건이 기록된다
  assert.ok(r.events.some((e) => e.verb === '소멸'), '무대 소멸 사건 기록');
});

test('완주 후 원장 audit() + 사건 로그 감사가 성립한다', () => {
  const r = runSlice(graph, loadSliceFixture(), { 소멸타이머: 3 });
  assert.equal(r.audit.ok, true, '에너지 보존 불변식 성립');
  // 모든 사건이 에너지 수지와 함께 기록된다 (energy 필드 존재)
  assert.ok(r.events.every((e) => typeof e.energy === 'number'));
  // 채취 사건이 에너지 비용을 실었다
  const 채취 = r.events.find((e) => e.verb === '채취');
  assert.ok(채취 && 채취.energy > 0, '채취 사건에 에너지 비용이 기록됨');
  // 지불된 에너지 = 초기 - 잔고 = burn 총량
  const paid = 20 - r.ledger.balances['bot-1'];
  assert.equal(paid, r.ledger.burned);
});

test('정밀도가 낮으면 순도 부족으로 done_when 미충족(경로가 결과를 좌우)', () => {
  // 정밀도 0.5 → 0.8×0.5=0.4 < 잔향보존_최소(0.6) → 완료 실패
  const r = runSlice(graph, loadSliceFixture(), { 소멸타이머: 3, 정밀도: 0.5 });
  assert.equal(r.done, false);
  assert.equal(r.result, 'timeout');
});
