// P0.5 — 존 시뮬: 좌표 위의 직접 조작(이동·사냥·채집)이 규칙 권위를 벗어나지 않는다.
// 전리품은 법칙 '전투', 채집 완료는 기존 act(채취/수확) 경로 → 원장·완료·파문 정합.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGraph } from '../src/graph/loader.js';
import { PlayGame } from '../src/play/game.js';
import { startServer } from '../demo/server.js';

const graph = loadGraph();

test('이동 수렴: moveTo 명령이 좌표 위 캐릭터를 목표점으로 데려간다', () => {
  const g = new PlayGame(graph);
  const { id } = g.join('보행자');
  g.cmd(id, { cmd: 'moveTo', x: 900, y: 300 });
  for (let i = 0; i < 90; i++) g.zoneStep(0.2);
  const z = g.state(id).zone;
  assert.ok(Math.abs(z.you.x - 900) < 6 && Math.abs(z.you.y - 300) < 6, `수렴 실패: (${z.you.x},${z.you.y})`);
});

test('채집 완주: 노드에 붙어 채널링하면 기존 act(채취) 경로로 소지품이 는다', () => {
  const g = new PlayGame(graph);
  const { id } = g.join('채집꾼');
  const av = g.zone.avatar(g.player(id));
  av.x = 430; av.y = 300; // S-0045 노드 곁 (표현 좌표)
  const inv0 = g.state(id).you.inventory.length;
  g.cmd(id, { cmd: 'gather', target: 'S-0045#0' });
  for (let i = 0; i < 20; i++) g.zoneStep(0.2); // GATHER_TIME 2.0s = 10 step
  assert.ok(g.state(id).you.inventory.length > inv0, '채집(채취)으로 소지품이 늘어야 한다');
  assert.equal(g.session.audit().ok, true, '원장 보존 불변식 유지');
});

test('사냥→전리품→파문: 몹 처치가 법칙 전투로 재료를 내고 done_when·파문을 민다', () => {
  const realRandom = Math.random;
  Math.random = () => 0.99; // 전리품 롤을 상한으로 — 표본(잔향≥0.6) 판정을 결정적으로
  try {
    const g = new PlayGame(graph);
    const { id } = g.join('사냥꾼');
    const av = g.zone.avatar(g.player(id));
    av.hp = 500; // 이 테스트는 처치·전리품 경로를 검증한다 (생존은 별도 테스트)
    const mob = g.zone.mobs.find((m) => m.archetype === '권속' && m.region === 'R1' && !m.dead);
    assert.ok(mob, 'R1 에 권속이 있다');
    g.cmd(id, { cmd: 'attack', target: mob.id });
    let killed = false;
    for (let i = 0; i < 400 && !killed; i++) { g.zoneStep(0.2); if (mob.dead) killed = true; }
    assert.ok(killed, '권속을 처치했다');
    const s = g.state(id);
    assert.ok(s.you.inventory.some((m) => m.includes('신성잔향보존율')), '전리품(권속심장)이 소지품에 든다');
    assert.equal(s.you.activeGoal.done, true, '표본 확보 done_when 충족 → 완료');
    assert.ok(s.feed.some((f) => f.kind === 'ripple'), '파문이 피드에 오른다');
    assert.equal(g.session.audit().ok, true, '원장 보존 불변식 유지');
  } finally { Math.random = realRandom; }
});

test('채집 창 거부: 창 밖(원천 소멸)의 노드는 채집이 피드백으로 거부된다', () => {
  const g = new PlayGame(graph);
  const { id } = g.join('때늦은자');
  for (let i = 0; i < 30; i++) g.tick(); // 순행 창(25)·소멸타이머(20)를 넘긴다
  assert.throws(() => g.cmd(id, { cmd: 'gather', target: 'S-0045#0' }), /기다려|소멸|소진|채집할 수 없/);
});

test('사망/부활: 권속 무리 한복판에서 쓰러지고, 잠시 후 스폰에서 깨어난다', () => {
  const g = new PlayGame(graph);
  const { id } = g.join('위태한자');
  const av = g.zone.avatar(g.player(id));
  av.x = 1080; av.y = 320; av.hp = 6; // 권속 서식지 중심 + 낮은 체력
  g.cmd(id, { cmd: 'stop' });
  let died = false;
  for (let i = 0; i < 160 && !died; i++) { g.zoneStep(0.2); if (g.state(id).zone.you.dead) died = true; }
  assert.ok(died, '권속에게 쓰러진다');
  assert.ok(g.state(id).zone.you.respawnIn > 0, '부활 카운트다운이 돈다');
  let revived = false;
  for (let i = 0; i < 60 && !revived; i++) {
    g.zoneStep(0.2);
    const y = g.state(id).zone.you;
    if (!y.dead) { revived = true; assert.equal(y.hp, y.maxHp, '전체 체력으로 부활'); }
  }
  assert.ok(revived, '잠시 후 깨어난다');
});

test('HTTP cmd 종단: /api/play/cmd 로 의도를 보내고 상태 payload 에 zone 이 실린다', async () => {
  const { url, close } = await startServer(0);
  try {
    const jr = await fetch(`${url}/api/play/join`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '원격사냥꾼' }),
    }).then((r) => r.json());
    const mv = await fetch(`${url}/api/play/cmd`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: jr.id, cmd: 'moveTo', x: 600, y: 400 }),
    }).then((r) => r.json());
    assert.equal(mv.ok, true, 'moveTo 는 수락된다');
    // 규칙 거부(보이지 않는 사냥감)는 HTTP 오류가 아니라 피드백
    const bad = await fetch(`${url}/api/play/cmd`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: jr.id, cmd: 'attack', target: '없는몹' }),
    }).then((r) => r.json());
    assert.equal(bad.ok, false);
    const sr = await fetch(`${url}/api/play/state?id=${jr.id}`).then((r) => r.json());
    assert.ok(sr.zone && typeof sr.zone.you.x === 'number', '상태에 존 뷰가 실린다');
    assert.ok(Array.isArray(sr.zone.entities) && sr.zone.entities.some((e) => e.kind === 'mob'), '몹이 존에 보인다');
  } finally {
    await close();
  }
});
