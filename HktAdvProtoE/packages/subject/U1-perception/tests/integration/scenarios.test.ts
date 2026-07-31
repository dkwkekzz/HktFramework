import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { runScenario } from '@hkt/v0-module-contract';
import { u1Scenarios } from '../../scenarios/index.js';
import { labModule, runU1Scenarios } from '../../lab/index.js';

const contract = parseYaml(readFileSync(new URL('../../MODULE.yaml', import.meta.url), 'utf8')) as {
  id: string;
  name: string;
  scenarios: string[];
  depends_on: string[];
};

describe('U1 대표 장면', () => {
  it.each(u1Scenarios.map((scenario) => [scenario.id, scenario] as const))(
    '%s — 모든 단정이 통과한다',
    (_id, scenario) => {
      const run = runScenario(scenario, 'U1');
      const failed = run.assertions.filter((assertion) => !assertion.passed);
      expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
    },
  );

  it('계약이 선언한 장면과 실제 장면이 같다', () => {
    expect(labModule.scenarioIds).toEqual(contract.scenarios);
  });

  it('원문 「24」의 여덟 구획이 모두 채워진다', () => {
    for (const run of runU1Scenarios(0n)) {
      expect(run.view.purpose).not.toBe('');
      expect(run.view.input.length).toBeGreaterThan(0);
      expect(run.view.candidates.length).toBeGreaterThan(0);
      expect(run.view.result).not.toBe('');
      expect(run.view.reasons.length).toBeGreaterThan(0);
      expect(run.view.before).not.toBe('');
      expect(run.view.after).not.toBe('');
      expect(run.view.checks.length).toBe(run.assertions.length);
    }
  });

  it('다시 실행해도 결과가 같다 (GI-12)', () => {
    const first = JSON.stringify(runU1Scenarios(0n));
    for (let run = 0; run < 3; run += 1) expect(JSON.stringify(runU1Scenarios(0n))).toBe(first);
  });
});

describe('U1 계약', () => {
  it('id·name 이 디렉터리와 같고 선행이 원문 「11」과 맞는다', () => {
    expect(contract.id).toBe('U1');
    expect(contract.name).toBe('perception');
    // 원문 「11」 U1 의 선행은 "S0, S3, U0" 이다. S3 는 원문 「28」 6단계이므로 아직 없다.
    expect(contract.depends_on).toEqual(expect.arrayContaining(['S0', 'U0']));
    expect(contract.depends_on).not.toContain('S3');
  });
});

describe('원문 「2.4」 — 지각 모듈의 대표 장면', () => {
  it('벽 양쪽의 두 사람과 종소리가 한 화면에서 확인된다', () => {
    const scene = runU1Scenarios(0n).find(
      (run) => run.scenarioId === 'sight_and_sound_arrive_as_separate_perceptions',
    );
    expect(scene?.passed).toBe(true);
    // "브라우저의 /lab/U1-perception 페이지에서 한 번에 확인할 수 있어야 한다"
    expect(scene?.view.candidates.length).toBeGreaterThan(0);
  });
});

describe('VS1 — 한 주체의 생존 행동 (원문 「20」)', () => {
  it('“음식을 보기 전에는 알 수 없다”의 앞 절이 여기서 선다', () => {
    const scene = runU1Scenarios(0n).find(
      (run) => run.scenarioId === 'the_world_does_not_hand_its_events_to_everyone',
    );
    expect(scene?.passed).toBe(true);
  });

  it.todo('VS1 전체는 G0~G3 이 온 뒤 tests/slices 에서 실행한다');
});

/**
 * 원문 「24」 — "그래픽 모듈이 아니더라도 표·그래프·타임라인을 통해 반드시 눈으로 확인할 수
 * 있어야 한다."
 *
 * 처음 만든 화면은 `E_SIGHT_BLOCKED` 같은 코드 목록이었다. 통과는 했지만 **무엇을 만들었는지
 * 보이지 않았다.** 지각은 공간에서 일어나는 일이므로 공간으로 그려야 한다. 그 화면이 다시
 * 코드 목록으로 돌아가지 않도록 여기서 못을 박는다.
 */
describe('원문 「24」 — 눈으로 확인할 수 있는가', () => {
  const scene = () =>
    runU1Scenarios(0n).find((run) => run.scenarioId === 'a_wall_hides_the_sight_but_not_the_blast');

  it('위에서 본 무대를 그린다 — 누가 어디에 있고 무엇이 사이를 막는가', () => {
    const rows = scene()?.view.candidates ?? [];
    const map = rows.filter((row) => /^y=-?\d+$/.test(row.label));
    expect(map.length).toBeGreaterThan(0);
    // 근원 · 알게 된 몸 · 막는 것이 모두 무대에 있다.
    const drawn = map.map((row) => row.value).join('');
    for (const glyph of ['✷', '◉', '▓']) expect(drawn, `무대에 ${glyph} 가 없다`).toContain(glyph);
    // 빈 칸은 `·` 다. 공백으로 그리면 HTML 이 접어 무대가 무너진다.
    expect(drawn).toContain('·');
  });

  it('벽이 시선을 끊고 소리를 줄이는 것이 한 줄로 보인다', () => {
    const values = (scene()?.view.candidates ?? []).map((row) => row.value);
    // 끊긴 길과 줄어든 길이 같은 화면에 함께 있어야 대비가 보인다.
    expect(values.some((value) => value.includes('▓') && value.includes('╳'))).toBe(true);
    expect(values.some((value) => value.includes('▓') && value.includes('┈'))).toBe(true);
    // 닿는 거리 밖에서 흩어진 길도 제 모양이 있다.
    expect(values.some((value) => value.includes('╌'))).toBe(true);
  });

  it('세기가 무엇을 지나며 얼마가 되었는지 사다리로 보인다', () => {
    const values = (scene()?.view.candidates ?? []).map((row) => row.value);
    const ladder = values.find((value) => value.includes('→') && value.includes('문턱'));
    expect(ladder, '감쇠 사다리가 없다').toBeTypeOf('string');
    expect(ladder).toMatch(/를 지나며/);
  });

  it('상태 전후가 이 모듈의 목적을 그대로 읽는다', () => {
    const view = scene()?.view;
    expect(view?.before).toContain('세계에 일어난 일');
    expect(view?.before).toContain('감지할 수 있는 현상');
    expect(view?.after).toContain('주체가 알게 된 것');
  });

  it('현상이 많은 장면에서는 묶고, 몇 개를 묶었는지 화면에 적는다', () => {
    const many = runU1Scenarios(0n).find(
      (run) => run.scenarioId === 'the_world_does_not_hand_its_events_to_everyone',
    );
    const rows = many?.view.candidates ?? [];
    expect(rows.some((row) => row.label.includes('어디서 난 일인가'))).toBe(true);
    // 조용히 잘라 내면 "전부 보여 주었다"로 읽힌다 — 남긴 수를 적는다.
    expect(rows.some((row) => /나머지 \d+개/.test(row.value))).toBe(true);
  });
});
