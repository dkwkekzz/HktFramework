// P0 — 플레이어블 게임: 사람의 입력이 봇과 같은 사슬(법칙→done_when→파문)을 민다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadGraph } from '../src/graph/loader.js';
import { PlayGame } from '../src/play/game.js';
import { startServer } from '../demo/server.js';

const here = dirname(fileURLToPath(import.meta.url));
const graph = loadGraph();

test('접속: 두 플레이어가 같은 세계에 서고, 상태 payload 가 완전하다', () => {
  const g = new PlayGame(graph);
  const a = g.join('가람');
  const b = g.join('나루');
  assert.notEqual(a.id, b.id);
  const s = g.state(a.id);
  assert.equal(s.you.region, 'R1');
  assert.equal(s.you.energy, g.fixture.player_energy ?? 20);
  assert.ok(s.you.activeGoal.conditions.length >= 1, '목적 카드에 조건 서술이 실린다');
  assert.ok(s.cycles.length >= 3 && s.map.length === 7);
  assert.ok(s.region.stages.length >= 2, 'R1 에 무대가 보인다');
});

test('C1 루프를 사람 입력으로 완주: 채취→관찰→수확이 완료·파문을 만든다', () => {
  const g = new PlayGame(graph);
  const { id } = g.join('가람');

  const r1 = g.act(id, { verb: '채취', stage: 'S-0045', params: { 정밀도: 0.9 } });
  assert.ok(r1.completed.includes('G-0.1.1.2.1'), '표본 확보 완료');
  assert.ok(r1.ripples >= 1, '파문이 오른다');

  const r2 = g.act(id, { verb: '관찰', stage: 'S-0045', params: { 주제: '신.에너지순환' } });
  assert.ok(r2.completed.includes('G-0.1.1.2.2'), '관찰 완료');

  const e0 = g.state(id).you.energy;
  const r3 = g.act(id, { verb: '수확', stage: 'S-0103' });
  assert.ok(g.state(id).you.energy > e0, '수확으로 잔고가 는다');
  assert.ok(r3.completed.includes('G-0.3.1.1'), '수확 목적 완료');

  assert.equal(g.session.audit().ok, true, '원장 보존 불변식 유지');
});

test('시간 창이 가격이다: 창을 놓치면 채취·수확이 거부된다', () => {
  const g = new PlayGame(graph);
  const { id } = g.join('늦은자');
  // 순행 창(25) + 소멸타이머(20)를 넘길 때까지 시간을 보낸다
  for (let i = 0; i < 30; i++) g.tick();
  assert.throws(() => g.act(id, { verb: '채취', stage: 'S-0045', params: { 정밀도: 0.9 } }), /소멸|소진|창/);
  assert.throws(() => g.act(id, { verb: '수확', stage: 'S-0103' }), /풍화/);
});

test('이동은 액터별이고 비용(틱)이 든다 — 도착하면 무대가 발견된다', () => {
  const g = new PlayGame(graph);
  const { id } = g.join('길잃은자');
  const r = g.move(id, 'R2');
  assert.equal(r.cost, 3);
  assert.throws(() => g.act(id, { verb: '채취', stage: 'S-0045' }), /이동 중/);
  g.tick(); g.tick(); g.tick();
  const s = g.state(id);
  assert.equal(s.you.region, 'R2');
  const st = s.region.stages.find((x) => x.id === 'S-0201');
  assert.notEqual(st.source, '?', '도착으로 S-0201 이 발견됐다');
  // 심부 채굴 → 무기급 재료
  g.act(id, { verb: '채취', stage: 'S-0201', target: '수정-심부-R2', params: { 정밀도: 0.9 } });
  assert.ok(g.state(id).you.inventory.some((m) => m.includes('공명전달률')), '공명 재료 확보');
});

test('R0 은 월식 창 밖에서 잠긴다', () => {
  const g = new PlayGame(graph);
  const { id } = g.join('성급한자');
  // 월식 창(35)이 닫힐 때까지 진행
  for (let i = 0; i < 40; i++) g.tick();
  assert.throws(() => g.move(id, 'R0'), /월식/);
});

test('소진 무대는 선착 경쟁이다: 권속 심장은 한 명만 가져간다', () => {
  const g = new PlayGame(graph);
  const a = g.join('빠른자');
  const b = g.join('느린자');
  // 무리분산 창은 t0 에 열려 있다 (period 45, window 15)
  const r = g.act(a.id, { verb: '채취', stage: 'S-0102', params: { 정밀도: 0.85 } });
  assert.ok(r.ok);
  assert.throws(() => g.act(b.id, { verb: '채취', stage: 'S-0102' }), /소진|없다/);
  // DAG 이중 파문: 심장은 촉매(0.2.3.2 경로)이자 표본(0.1.1.2 경로)
  assert.ok(r.completed.includes('G-0.2.3.2.1'), '심장 말단 완료');
  assert.ok(r.ripples >= 2, '두 계보 파문');
});

test('두 플레이어의 진행은 독립이다 (믿음·완료 스냅샷 분리)', () => {
  const g = new PlayGame(graph);
  const a = g.join('갑');
  const b = g.join('을');
  g.act(a.id, { verb: '채취', stage: 'S-0045', params: { 정밀도: 0.9 } });
  const sa = g.state(a.id);
  const sb = g.state(b.id);
  assert.equal(sa.you.activeGoal.done, true);
  assert.equal(sb.you.activeGoal.done, false, '을의 카드는 여전히 미완');
});

test('플레이 API 종단: join→act→state 가 HTTP 로 돈다', async () => {
  const { url, close } = await startServer(0);
  try {
    const jr = await fetch(`${url}/api/play/join`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '원격자' }),
    }).then((r) => r.json());
    assert.ok(jr.id && jr.state.you.region === 'R1');
    const ar = await fetch(`${url}/api/play/act`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: jr.id, verb: '채취', stage: 'S-0045', params: { 정밀도: 0.9 } }),
    }).then((r) => r.json());
    assert.equal(ar.ok, true);
    assert.ok(ar.completed.includes('G-0.1.1.2.1'));
    const sr = await fetch(`${url}/api/play/state?id=${jr.id}`).then((r) => r.json());
    assert.ok(sr.you.inventory.length >= 1);
    // 규칙 거부는 HTTP 오류가 아니라 피드백이다
    const bad = await fetch(`${url}/api/play/move`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: jr.id, to: 'R9' }),
    }).then((r) => r.json());
    assert.equal(bad.ok, false);
    const page = await fetch(`${url}/play.html`);
    assert.equal(page.status, 200, '플레이 페이지가 서빙된다');
  } finally {
    await close();
  }
});

test('플레이 클라이언트는 src/ 를 import 하지 않는다 (불변 원칙 ⑥)', () => {
  const src = readFileSync(join(here, '..', 'demo', 'play.js'), 'utf8');
  assert.ok(!/from\s+['"][^'"]*\/src\//.test(src));
  assert.ok(!/^\s*import[\s(]/m.test(src), '플레이 클라이언트는 모듈 import 자체가 없다 — 상태 payload 만 그린다');
});
