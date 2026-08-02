// D2-c 설계도 조립 — 종 하나에서 그래프 하나가 나오고, 그 그래프가 종을 살게 하는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { checkGraph, graphHash } from '../../src/d1/index.ts';
import {
  blueprintVerdict,
  buildSpeciesGraph,
  checkBlueprint,
  checkBlueprints,
  graphShapeHash,
  specimenOf,
  speciesNeeds,
} from '../../src/d2/index.ts';

import {
  beast,
  beastBlueprint,
  berrySupply,
  denSupply,
  fertility,
  guild,
  guildBlueprint,
  hunger,
} from './fixture.ts';

describe('D2-c 그래프 조립', () => {
  test('종에서 찍어 낸 그래프는 D1 관문을 그대로 지난다', () => {
    const graph = buildSpeciesGraph(beast, beastBlueprint, specimenOf(beast));
    const report = checkGraph(graph);
    assert.deepEqual(report.violations, []);
    assert.equal(report.complete, true);
    assert.deepEqual(report.unreachable, []);
    assert.equal(graph.nodes.length, 4);
    assert.equal(graph.edges.length, 2);
    assert.equal(graph.rootIds.length, 2);
  });

  test('같은 종·같은 자리·같은 단계면 언제나 같은 그래프다', () => {
    const once = buildSpeciesGraph(beast, beastBlueprint, specimenOf(beast));
    const twice = buildSpeciesGraph(beast, beastBlueprint, specimenOf(beast));
    assert.equal(graphHash(once), graphHash(twice));
  });

  test('종은 모양을 물려준다 — 개체가 달라도 모양 해시는 같다', () => {
    const first = buildSpeciesGraph(beast, beastBlueprint, {
      subjectId: deterministicId('subject', 'creature', '굴짐승 01'),
      bodyId: deterministicId('entity', 'body', '굴짐승 01 의 몸'),
    });
    const second = buildSpeciesGraph(beast, beastBlueprint, {
      subjectId: deterministicId('subject', 'creature', '굴짐승 02'),
      bodyId: deterministicId('entity', 'body', '굴짐승 02 의 몸'),
    });
    assert.equal(graphShapeHash(first), graphShapeHash(second));
    assert.notEqual(graphHash(first), graphHash(second));
  });

  test('뿌리에 걸린 시한은 단계의 대사가 나눈 종의 시한이다', () => {
    const young = buildSpeciesGraph(beast, beastBlueprint, {
      ...specimenOf(beast),
      stage: '유체',
    });
    const adult = buildSpeciesGraph(beast, beastBlueprint, {
      ...specimenOf(beast),
      stage: '성체',
    });
    const delayOf = (graph: typeof young, label: string): number =>
      graph.edges.find(
        (edge) => graph.nodes.find((node) => node.id === edge.from)?.label === label,
      )?.failureDelayTicks ?? 0;

    assert.equal(delayOf(young, '주린 몸'), 15); // 30 ÷ 대사 2
    assert.equal(delayOf(adult, '주린 몸'), 30);
    assert.equal(delayOf(young, '대 이을 몸'), 200); // 400 ÷ 대사 2
  });

  test('대 잇는 자리가 무너지는 자리와 같으면 뿌리 하나가 둘을 떠받친다', () => {
    const merged = speciesNeeds(beast, { ...beastBlueprint, lineage: hunger });
    assert.deepEqual(
      merged.map((need) => need.serves),
      ['both'],
    );
    const split = speciesNeeds(beast, beastBlueprint);
    assert.deepEqual(
      split.map((need) => need.serves),
      ['survival', 'lineage'],
    );
  });
});

describe('D2-c 생존·번식 무단절', () => {
  test('뿌리마다 채움이 있으면 종은 살 수 있다', () => {
    const report = checkBlueprint(beast, beastBlueprint);
    assert.equal(report.complete, true);
    assert.deepEqual(
      report.paths.map((path) => [path.label, path.unbroken, path.depth]),
      [
        ['주린 몸', true, 1],
        ['대 이을 몸', true, 1],
      ],
    );
    assert.equal(report.lineage?.label, '대 이을 몸');
    assert.match(blueprintVerdict(report), /뿌리 2개가 전부 채워지고/);
  });

  test('채울 것 없는 무너짐은 몇 틱 뒤에 무너지는지와 함께 지목된다', () => {
    const report = checkBlueprint(beast, { ...beastBlueprint, supplies: [denSupply] });
    assert.deepEqual(
      report.violations.map((violation) => violation.rule),
      ['unsupplied-need'],
    );
    assert.match(report.violations[0]?.message ?? '', /15틱 뒤에 무너지는데/);
    assert.equal(report.complete, false);
  });

  test('늙는 종이 대를 밝히지 않으면 한 세대로 끝난다', () => {
    const report = checkBlueprint(beast, {
      ...beastBlueprint,
      lineage: null,
      roots: beastBlueprint.roots.filter((root) => root.slot.path !== 'fertility'),
      supplies: [berrySupply],
    });
    assert.deepEqual(
      report.violations.map((violation) => violation.rule),
      ['lineage-missing'],
    );
  });

  test('늙지 않는 종은 낳지 않는다', () => {
    const clean = checkBlueprint(guild, guildBlueprint);
    assert.equal(clean.complete, true);
    assert.equal(clean.lineage, null);

    const report = checkBlueprint(guild, { ...guildBlueprint, lineage: fertility });
    assert.equal(report.violations[0]?.rule, 'ageless-lineage');
  });

  test('종이 열지 않은 자리로는 대를 잇지 못한다', () => {
    const report = checkBlueprint(beast, {
      ...beastBlueprint,
      lineage: { ...fertility, slot: { domain: 'ecological', path: 'population' } },
    });
    assert.equal(report.violations[0]?.rule, 'off-species-lineage');
  });

  test('찍어 낸 그래프의 사유는 D1 의 것을 그대로 안고 온다', () => {
    const report = checkBlueprint(beast, {
      ...beastBlueprint,
      roots: beastBlueprint.roots.map((root) =>
        root.slot.path === 'hunger'
          ? { ...root, kind: 'resource' as const, targetsOwnState: false }
          : root,
      ),
    });
    const first = report.violations[0];
    assert.equal(first?.rule, 'broken-graph');
    assert.match(first?.message ?? '', /off-domain-condition/);
    assert.match(first?.path ?? '', /^\$\.nodes\[0\]/);
  });

  test('다른 종의 설계도는 그 자리에서 걸린다', () => {
    const report = checkBlueprint(beast, { ...beastBlueprint, speciesId: guild.id });
    assert.equal(report.violations[0]?.rule, 'bad-blueprint');
  });

  test('여럿을 한 번에 세우면 어긴 종만 걸러진다', () => {
    const batch = checkBlueprints([
      { archetype: beast, blueprint: beastBlueprint },
      { archetype: guild, blueprint: guildBlueprint },
    ]);
    assert.equal(batch.complete, true);
    assert.equal(batch.broken.length, 0);

    const withBroken = checkBlueprints([
      { archetype: beast, blueprint: { ...beastBlueprint, lineage: null } },
      { archetype: guild, blueprint: guildBlueprint },
    ]);
    assert.equal(withBroken.complete, false);
    assert.deepEqual(
      withBroken.broken.map((report) => report.speciesName),
      ['굴짐승'],
    );
  });
});
