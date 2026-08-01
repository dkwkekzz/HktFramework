// O2-a 단위 테스트 — 원문 두 목록의 상태 영역 대조.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { STATE_DOMAINS } from '../../src/o1/index.ts';
import {
  DOMAIN_RECONCILIATION,
  DOMAIN_SPECS,
  domainSpec,
  isStateDomain,
  MASTERPLAN_DOMAINS,
  MODULEPLAN_ONLY,
  reconcileDomains,
  reconciliationVerdict,
  type DomainResolution,
  type DomainSpec,
} from '../../src/o2/index.ts';

describe('확정 9영역', () => {
  test('O1 이 이름표로 고정한 9영역에 정의가 하나씩 붙는다', () => {
    assert.equal(DOMAIN_SPECS.length, 9);
    assert.deepEqual(
      DOMAIN_SPECS.map((spec) => spec.domain),
      [...STATE_DOMAINS],
    );
  });

  test('모든 영역이 이름·담는 것·원문 근거를 갖는다', () => {
    for (const spec of DOMAIN_SPECS) {
      assert.notEqual(spec.label, '', spec.domain);
      assert.notEqual(spec.holds, '', spec.domain);
      assert.match(spec.source, /MasterPlan|ModulePlan/, spec.domain);
    }
  });

  test('영역 정의를 이름으로 찾는다', () => {
    assert.equal(domainSpec('psychic')?.label, '의념');
    assert.equal(domainSpec('nowhere' as never), null);
  });

  test('9영역 밖의 이름은 영역이 아니다', () => {
    assert.ok(isStateDomain('physical'));
    assert.ok(!isStateDomain('spatial'));
    assert.ok(!isStateDomain(3));
  });
});

describe('원문 대조', () => {
  const report = reconcileDomains();

  test('MasterPlan §12.1 의 이름 9개가 하나도 빠짐없이 해소된다', () => {
    assert.equal(MASTERPLAN_DOMAINS.length, 9);
    assert.deepEqual([...report.unresolved], []);
    assert.deepEqual([...report.danglingTargets], []);
    assert.ok(report.complete, reconciliationVerdict(report));
  });

  test('두 목록이 겹치는 이름은 6개뿐이다 — 나머지 3개가 대조의 이유다', () => {
    assert.deepEqual(
      [...report.sharedNames],
      ['biological', 'economic', 'informational', 'institutional', 'physical'].sort(),
    );
    // MasterPlan 만의 이름: ability · social · spatial · historical
    const notShared = MASTERPLAN_DOMAINS.filter((name) => !report.sharedNames.includes(name));
    assert.deepEqual([...notShared], ['ability', 'social', 'spatial', 'historical']);
  });

  test('해소 방식 넷이 각각 쓰인다 — 같음·개명·흡수·영역 아님', () => {
    const kinds = new Set(DOMAIN_RECONCILIATION.map((entry) => entry.resolution));
    assert.deepEqual([...kinds].sort(), ['absorbed', 'not-a-domain', 'renamed', 'same']);
  });

  test('ability 는 의념으로, spatial 은 물리로 흡수된다', () => {
    const find = (name: string): DomainResolution | undefined =>
      DOMAIN_RECONCILIATION.find((entry) => entry.original === name);
    assert.equal(find('ability')?.domain, 'psychic');
    assert.equal(find('spatial')?.domain, 'physical');
    assert.equal(find('social')?.domain, 'relational');
  });

  test('historical 만 영역이 아니다 — 사건 로그는 R1 이 담는다', () => {
    const notDomain = DOMAIN_RECONCILIATION.filter((entry) => entry.resolution === 'not-a-domain');
    assert.deepEqual(
      notDomain.map((entry) => entry.original),
      ['historical'],
    );
    assert.equal(notDomain[0]?.domain, null);
    assert.match(notDomain[0]?.reason ?? '', /R1/);
  });

  test('모든 해소에 근거가 적힌다', () => {
    for (const entry of DOMAIN_RECONCILIATION) {
      assert.notEqual(entry.reason, '', entry.original);
    }
  });

  test('ModulePlan 만의 영역 둘은 확정 영역에 실재한다', () => {
    assert.deepEqual([...MODULEPLAN_ONLY], ['ecological', 'transcendent']);
    for (const domain of MODULEPLAN_ONLY) {
      assert.notEqual(domainSpec(domain), null, domain);
    }
  });
});

describe('대조의 검출력', () => {
  test('원문 이름 하나를 해소하지 않으면 미해소로 걸린다', () => {
    const report = reconcileDomains(
      DOMAIN_SPECS,
      MASTERPLAN_DOMAINS,
      DOMAIN_RECONCILIATION.filter((entry) => entry.original !== 'spatial'),
    );
    assert.deepEqual([...report.unresolved], ['spatial']);
    assert.ok(!report.complete);
    assert.match(reconciliationVerdict(report), /spatial/);
  });

  test('없는 영역으로 보낸 해소는 지목된다', () => {
    const report = reconcileDomains(DOMAIN_SPECS, MASTERPLAN_DOMAINS, [
      ...DOMAIN_RECONCILIATION,
      { original: 'mythic', resolution: 'absorbed', domain: 'nowhere' as never, reason: '?' },
    ]);
    assert.deepEqual([...report.danglingTargets], ['mythic→nowhere']);
    assert.ok(!report.complete);
  });

  test('영역 하나를 빼면 이름표만 남은 영역으로 걸린다', () => {
    const report = reconcileDomains(DOMAIN_SPECS.filter((spec) => spec.domain !== 'psychic'));
    assert.deepEqual([...report.undefinedDomains], ['psychic']);
    // ability 가 갈 곳이 사라졌다는 사실도 함께 드러난다.
    assert.deepEqual([...report.danglingTargets], ['ability→psychic']);
    assert.match(reconciliationVerdict(report), /이름표만 있는 영역 psychic/);
  });

  test('같은 영역을 두 번 적으면 중복으로 걸린다', () => {
    const report = reconcileDomains([...DOMAIN_SPECS, DOMAIN_SPECS[0] as DomainSpec]);
    assert.deepEqual([...report.duplicateDomains], ['physical']);
    assert.ok(!report.complete);
  });

  test('근거 없는 영역은 완결을 막는다', () => {
    const report = reconcileDomains(
      DOMAIN_SPECS.map((spec) => (spec.domain === 'ecological' ? { ...spec, source: '' } : spec)),
    );
    assert.deepEqual([...report.unsourced], ['ecological']);
    assert.match(reconciliationVerdict(report), /근거 없는 영역/);
  });

  test('빈 목록은 완결이 아니다 — 아무것도 대조하지 않은 것이다', () => {
    const report = reconcileDomains([], [], []);
    assert.ok(!report.complete);
    assert.match(reconciliationVerdict(report), /확정 영역이 없다/);
  });
});
