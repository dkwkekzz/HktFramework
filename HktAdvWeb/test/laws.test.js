// A5 — 사건 기록 + 공통 상호작용 법칙 v0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../src/substrate/lexicon.js';
import { World } from '../src/substrate/substance.js';
import { Ledger } from '../src/substrate/ledger.js';
import { EventLog } from '../src/substrate/events.js';
import { defaultLawTable } from '../src/substrate/laws.js';
import { evalPred } from '../src/substrate/predicate.js';

function setup() {
  const lex = loadLexicon();
  const world = new World(lex);
  world.add({ id: '조직조각', archetype: '조직조각', kind: '물질', tags: ['신.조직'], properties: { 신성잔향보존율: 0.8, 오염도: 0.1 } });
  const ledger = new Ledger();
  ledger.open('bot', 20);
  const events = new EventLog();
  const laws = defaultLawTable(lex);
  const actor = { id: 'bot', inventory: [] };
  return { lex, world, ledger, events, laws, actor, source: world.get('조직조각') };
}

test('법칙 밖 전이 시도는 거부된다 (apply 가 유일한 경로)', () => {
  const { laws, actor, source } = setup();
  assert.throws(() => laws.apply(actor, '텔레포트', source, {}, {}), /법칙 없음/);
});

test('apply(채취) 후 사건·에너지·속성 변화가 모두 정합한다 (감사)', () => {
  const { laws, actor, source, ledger, events, world } = setup();
  const before = ledger.balance('bot');
  laws.apply(actor, '채취', source, { 정밀도: 0.9, stage: 'S-0045' }, { ledger, events, world });

  // 인벤토리에 산출물이 들어왔다
  assert.equal(actor.inventory.length, 1);
  // 에너지 비용이 지불되었다 (원장 감사 성립)
  assert.equal(ledger.balance('bot'), before - 1);
  assert.equal(ledger.audit().ok, true);
  // 사건이 에너지 수지와 함께 기록되었다
  assert.equal(events.all().length, 1);
  const ev = events.all()[0];
  assert.equal(ev.verb, '채취');
  assert.equal(ev.energy, 1);
  assert.deepEqual(ev.tags, ['신.조직']);
});

test('채취 정밀도에 따라 순도(신성잔향보존율)가 다르다', () => {
  const { laws, actor, source, ledger, events, world } = setup();
  laws.apply(actor, '채취', source, { 정밀도: 0.9 }, { ledger, events, world });
  laws.apply(actor, '채취', source, { 정밀도: 0.3 }, { ledger, events, world });
  const [정밀, 거침] = actor.inventory;
  assert.ok(정밀.properties.신성잔향보존율 > 거침.properties.신성잔향보존율, '정밀 채취가 잔향 보존이 높다');
  assert.ok(거침.properties.오염도 > 정밀.properties.오염도, '거친 채취가 오염이 높다');
  // 정밀 채취(0.8×0.9=0.72)는 잔향보존_최소(0.6)를 넘어 표본 자격을 얻는다
  assert.ok(정밀.properties.신성잔향보존율 >= 0.6);
});

test('법칙 대상 조건 위반은 거부된다 (잔향 없는 대상 채취)', () => {
  const { laws, actor, world, ledger, events, lex } = setup();
  world.add({ id: '돌', archetype: '광물', kind: '물질', properties: {} }); // 신성잔향보존율 없음
  const stone = world.get('돌');
  assert.throws(() => laws.apply(actor, '채취', stone, { 정밀도: 0.5 }, { ledger, events, world }), /조건/);
});

test('apply(관찰) 은 대상을 바꾸지 않고 정보 재료를 생성한다', () => {
  const { laws, actor, source, ledger, events } = setup();
  const before = { ...source.properties };
  laws.apply(actor, '관찰', source, { 주제: '신.에너지순환' }, { ledger, events });
  assert.deepEqual(source.properties, before); // 대상 불변
  const info = actor.inventory.find((s) => s.kind === '정보');
  assert.equal(info.properties.주제, '신.에너지순환');
});

test('event 술어가 사건 로그를 실판정한다 (A4 스텁 해제)', () => {
  const { laws, actor, source, ledger, events, world } = setup();
  // 채취 전: event 술어 미충족
  const ctx = { events, actor };
  assert.equal(evalPred({ event: { verb: '채취', target_tag: '신.조직', min_count: 1 } }, ctx).value, false);
  laws.apply(actor, '채취', source, { 정밀도: 0.9 }, { ledger, events, world });
  // 채취 후: 충족
  const r = evalPred({ event: { verb: '채취', target_tag: '신.조직', min_count: 1 } }, ctx);
  assert.equal(r.value, true);
  assert.equal(r.trace.count, 1);
});

test('에너지 부족 시 채취는 아무것도 바꾸지 않는다 (원자성)', () => {
  const { laws, actor, source, events, world, lex } = setup();
  const poor = new Ledger();
  poor.open('bot', 0); // 비용 1 조차 없음
  assert.throws(() => laws.apply(actor, '채취', source, { 정밀도: 0.9 }, { ledger: poor, events, world }), /에너지 부족/);
  assert.equal(actor.inventory.length, 0); // 산출물 없음
  assert.equal(events.all().length, 0); // 사건 없음
});
