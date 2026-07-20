// C5 — 타인의 세계: 강탈/거래가 같은 목적을 충족하되 세계 상태를 다르게 남긴다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGraph } from '../src/graph/loader.js';
import { runC5 } from '../src/content/c5.js';

const graph = loadGraph();

test('거래 봇과 강탈 봇이 같은 표본 done_when 을 다른 경로로 충족한다 (원칙 ①)', () => {
  const r = runC5(graph);
  assert.equal(r.trade.sampleDone, true, '거래: 시장 매입으로 표본 충족');
  assert.equal(r.raid.sampleDone, true, '강탈: 습격 유물로 표본 충족');
  assert.equal(r.sameGoal, true);
});

test('경로가 세계 상태(적대도)를 다르게 남긴다 — aftermath 차이의 실증', () => {
  const r = runC5(graph);
  assert.equal(r.trade.적대, false, '거래는 숭배단 적대를 만들지 않는다');
  assert.equal(r.raid.적대, true, '강탈은 숭배단 적대를 확정한다');
  assert.equal(r.differentState, true);
});

test('강탈은 수송을 끊어 세력을 약화시킨다 (0.1.1.6.2 → 0.1.4 이중 파문)', () => {
  const r = runC5(graph);
  assert.equal(r.raid.cutDone, true, '수송로 차단(0.1.1.6.2) 완료');
  assert.equal(r.raid.factionDone, true, '세력 약화(0.1.4) 완료 — 신의 힘 공급 약화의 간접 경로');
  assert.ok(r.raid.ripples.includes('G-0.1.1.6') && r.raid.ripples.includes('G-0.1.4'), '규합·세력 두 갈래 파문');
});

test('거래 봇은 자유민 신뢰를 얻는다 (제3의 해법 층, 거래 신뢰 0.1.1.6.1)', () => {
  const r = runC5(graph);
  assert.equal(r.trade.trustDone, true);
  assert.ok(r.trade.자유민신뢰 >= 1);
});

test('세력도 목적 사슬을 굴린다 — 신앙형 분해가 하위 목적을 연다 (E3)', () => {
  const r = runC5(graph);
  assert.ok(r.decompose.length >= 1);
});

test('audit + 협상/전투 사건 감사 성립', () => {
  const r = runC5(graph);
  assert.equal(r.audit.ok, true);
  assert.ok(r.events.some((e) => e.verb === '협상'));
  assert.ok(r.events.some((e) => e.verb === '전투' && e.tags.includes('숭배단.수송대')));
});
