// P2-a 단위 테스트 — 유형 × 원자 격자가 S0 의 경계 4종에서 계산되는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { SUBJECT_KINDS } from '../../src/o1/index.ts';
import { ACTION_ATOMS } from '../../src/p0/index.ts';
import {
  ACCESS_RULES,
  accessOf,
  accessVerdict,
  atomsFor,
  carriesMatter,
  checkAccess,
  checkArchetypeFooting,
  footingOf,
  grammarViolationVerdict,
  KIND_FOOTINGS,
  makesLaw,
  needsAgreement,
  needsBody,
  type AccessRule,
} from '../../src/p2/index.ts';

import { beast } from '../d2/fixture.ts';

const report = checkAccess();

describe('유형 × 원자 격자', () => {
  test('5 × 16 = 80칸이 빈 곳 없이 선다', () => {
    assert.equal(ACCESS_RULES.length, SUBJECT_KINDS.length * ACTION_ATOMS.length);
    assert.deepEqual(report.violations, []);
    assert.equal(report.complete, true);
    assert.match(accessVerdict(report), /격자가 다 찼다/);
  });

  test('사람만 열여섯을 제 손으로 낸다 — 그 대신 혼자다', () => {
    assert.equal(atomsFor('person').length, 16);
    assert.equal(report.counts['person']?.['direct'], 16);
    assert.equal(report.counts['person']?.['viaMembers'], 0);
  });

  test('생물은 말이 없어 합의로 서는 셋과 그 그림자 하나를 잃는다', () => {
    const denied = ACTION_ATOMS.filter((atom) => accessOf('creature', atom)?.access === 'denied');
    assert.deepEqual(denied, ['exchange', 'persuade', 'ally', 'betray']);
    assert.match(accessOf('creature', 'exchange')?.basis ?? '', /말이 없다/);
    assert.match(accessOf('creature', 'betray')?.basis ?? '', /맺지 못하므로/);
  });

  test('조직·국가는 몸이 없어 구성원의 손으로 낸다', () => {
    for (const kind of ['organization', 'nation'] as const) {
      assert.equal(report.counts[kind]?.['direct'], 0);
      assert.ok((report.counts[kind]?.['viaMembers'] ?? 0) > 0);
    }
    assert.match(accessOf('nation', 'seize')?.basis ?? '', /구성원의 손/);
  });

  test('신은 물건을 집지 못한다 — 자리를 옮기는 둘만 막히고 나머지는 의념으로 낸다', () => {
    const denied = ACTION_ATOMS.filter((atom) => accessOf('god', atom)?.access === 'denied');
    assert.deepEqual(denied, ['acquire', 'seize']);
    assert.equal(accessOf('god', 'persuade')?.access, 'viaAbility');
    assert.match(accessOf('god', 'acquire')?.basis ?? '', /의례가 생기는 자리/);
  });

  test('누구에게나 열린 원자 열 — 몸도 말도 필요 없는 길들', () => {
    assert.equal(report.universal.length, 10);
    for (const atom of report.universal) {
      for (const kind of SUBJECT_KINDS) {
        assert.notEqual(accessOf(kind, atom)?.access, 'denied', `${kind}/${atom}`);
      }
    }
  });

  test('모든 칸이 근거를 댄다 — 근거 없는 문법은 임의의 게임 규칙이다', () => {
    for (const rule of ACCESS_RULES) assert.notEqual(rule.basis, '', `${rule.subjectKind}/${rule.atom}`);
  });
});

describe('격자를 만드는 세 물음', () => {
  test('몸을 요구하는 원자는 체력을 치르는 원자다 (P0 pays)', () => {
    assert.equal(needsBody('acquire'), true);
    assert.equal(needsBody('exchange'), false); // 재고를 치른다
    assert.equal(needsBody('ally'), false); // 빚을 치른다
  });

  test('합의를 요구하는 원자는 P0 동의 축이 mutual 인 셋이다', () => {
    assert.deepEqual(ACTION_ATOMS.filter(needsAgreement), ['exchange', 'persuade', 'ally']);
  });

  test('자리를 옮기는 원자는 physical.region 을 바꾸는 둘이다', () => {
    assert.deepEqual(ACTION_ATOMS.filter(carriesMatter), ['acquire', 'seize']);
  });

  test('제도를 세우는 것은 정당성 자리를 가진 종뿐이다 — 유형 표가 아니라 그 종의 자리에서 읽는다', () => {
    assert.equal(makesLaw(beast), false);
    assert.equal(
      makesLaw({
        ...beast,
        slots: [...beast.slots, { domain: 'transcendent', path: 'legitimacy' }],
      }),
      true,
    );
  });
});

describe('설 수 없는 격자', () => {
  const sound = ACCESS_RULES;
  const patched = (patch: (rule: AccessRule) => AccessRule) => checkAccess(sound.map(patch));

  test('몸 없는 유형이 제 손으로 낸다고 적으면 거부된다', () => {
    const broken = patched((rule) =>
      rule.subjectKind === 'nation' && rule.atom === 'acquire'
        ? { ...rule, access: 'direct' as const }
        : rule,
    );
    assert.equal(broken.violations[0]?.rule, 'bodiless-direct');
  });

  test('구성원 없는 유형이 시켜서 낸다고 적으면 거부된다', () => {
    const broken = patched((rule) =>
      rule.subjectKind === 'god' && rule.atom === 'destroy'
        ? { ...rule, access: 'viaMembers' as const }
        : rule,
    );
    assert.equal(broken.violations[0]?.rule, 'memberless-delegation');
  });

  test('선언되지 않은 접근·근거 없는 칸이 각각 걸린다', () => {
    assert.equal(
      patched((rule) => (rule.atom === 'seek' ? { ...rule, access: 'somehow' as never } : rule))
        .violations[0]?.rule,
      'unknown-access',
    );
    assert.equal(
      patched((rule) => (rule.atom === 'seek' ? { ...rule, basis: '' } : rule)).violations[0]?.rule,
      'unreasoned-denial',
    );
  });

  test('칸이 비면 그 사실이 남는다 — 못 낸다면 못 낸다고 적어야 한다', () => {
    const broken = checkAccess(sound.filter((rule) => rule.atom !== 'shed'));
    assert.equal(broken.violations[0]?.rule, 'missing-access');
    assert.match(grammarViolationVerdict(broken.violations), /missing-access/);
  });

  test('아무 원자도 못 내는 유형은 세계에 설 수 없다', () => {
    const broken = checkAccess(
      sound.map((rule) =>
        rule.subjectKind === 'god' ? { ...rule, access: 'denied' as const } : rule,
      ),
    );
    assert.ok(broken.violations.some((violation) => violation.rule === 'atomless-kind'));
    assert.deepEqual(broken.muteKinds, ['god']);
  });

  test('같은 칸을 두 번 적으면 걸린다', () => {
    const first = sound[0] as AccessRule;
    assert.equal(checkAccess([...sound, first]).violations[0]?.rule, 'duplicate-access');
  });

  test('종 원형이 유형의 걸림과 어긋나면 걸린다', () => {
    assert.deepEqual(checkArchetypeFooting(beast), []);
    const bodiless = checkArchetypeFooting({ ...beast, body: null });
    assert.equal(bodiless[0]?.rule, 'bodiless-direct');
    const mindless = checkArchetypeFooting({
      ...beast,
      slots: beast.slots.filter((slot) => slot.domain !== 'psychic'),
    });
    assert.equal(mindless[0]?.rule, 'mindless-ability');
  });

  test('유형 다섯의 걸림이 전부 선언돼 있다', () => {
    assert.equal(KIND_FOOTINGS.length, 5);
    for (const kind of SUBJECT_KINDS) assert.notEqual(footingOf(kind), null, kind);
    assert.equal(footingOf('spirit' as never), null);
  });
});
