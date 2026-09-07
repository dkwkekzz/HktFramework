// T5 완료 조건 — **미지 한 줄 → brief → 방 하나가 사람 손 없이 검사를 통과한다.**
// 그리고 지어낸 세계 사실은 T4 가 잡아 돌려보낸다.
//
// 모델은 부르지 않는다. 부르면 시험이 두 번 같지 않고 돈이 들며 인증이 있어야 돌아간다 —
// 시험이 재는 것은 **모델이 잘 답하는가**가 아니라 **낸 답을 이 세계가 제대로 재는가**다.
// 그래서 답은 가짜로 두고(문서가 이미 든 본보기 brief 셋), 재는 쪽(T4 → T3 → T1)은 전부 진짜다.
//
// 쓰는 답 셋은 Tool-Scale §2 가 등급 A · B · C 의 예로 든 바로 그 방들이다 —
// 세계 사실을 새로 지어내지 않으려고 문서가 이미 든 예를 그대로 썼다 (T3 · T4 의 시험과 같다).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WORLD_CONTRACTS } from '../../../content/authoring';
import { draftRegion, type DraftAsk } from '../../../engine/world-authoring/draft';
import { parseRegionBrief } from '../../../engine/world-authoring/brief';
import { gradeRegion } from '../../../engine/world-authoring/grade';
import { authorBrief, checkAuthored } from '../author';
import { briefPathOf, draftSchema, draftSystem, runDraft, trialBrief } from '../draft';

const example = (name: string): Record<string, unknown> =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../../content/authoring/examples/${name}.json`, import.meta.url)),
      'utf8',
    ),
  );

/** 본보기 하나를 조금 고쳐 낸 답 — 초안기가 그렇게 낼 수 있는 모양이다 */
const answered = (name: string, mutate: (raw: Record<string, unknown>) => void = () => {}) => {
  const raw = example(name);
  mutate(raw);
  return raw;
};

/** 물음을 기록하는 가짜 모델 — 답을 순서대로 낸다 */
function port(answers: readonly unknown[]) {
  const asked: DraftAsk[] = [];
  return {
    asked,
    ask: async (ask: DraftAsk) => {
      asked.push(ask);
      return answers[Math.min(asked.length - 1, answers.length - 1)];
    },
  };
}

/** 고리를 돈다 — 시스템 글은 따로 재므로 여기서는 짧게 둔다 (재는 쪽은 전부 진짜다) */
const draft = (unknown: string, answers: readonly unknown[], attempts = 3) => {
  const model = port(answers);
  return draftRegion({
    unknown,
    system: '(시험)',
    schema: draftSchema(),
    ask: model.ask,
    trial: trialBrief,
    attempts,
  }).then((result) => ({ result, asked: model.asked }));
};

describe('T5 — 미지 한 줄에서 낸 방이 사람 손 없이 선다', () => {
  it('낸 brief 가 등급 A 이고, 그 방이 검사를 하나도 무너뜨리지 않는다', async () => {
    const { result, asked } = await draft('가스로 가득 찬 마을', [answered('GAS_VILLAGE')]);

    expect(result.outcome).toBe('passed');
    expect(asked.length).toBe(1); // 한 번에 섰다 — 되먹임이 필요 없었다
    const brief = result.brief!;

    // 그 brief 하나가 방 하나가 된다 (T3) — 그리고 들이고 나면 검사가 다 선다 (T1)
    const report = checkAuthored(authorBrief(brief));
    expect(report.items.filter((item) => item.status === 'fail')).toEqual([]);
    expect(report.ok).toBe(true);
    expect(gradeRegion(brief, WORLD_CONTRACTS).grade).toBe('A');
  });

  it('굳힌 brief 에서 나오는 방은 두 번 내도 같다 — 초안이 비결정이어도 세계는 결정론이다', async () => {
    const { result } = await draft('가스로 가득 찬 마을', [answered('GAS_VILLAGE')]);
    const brief = result.brief!;
    expect(JSON.stringify(authorBrief(brief))).toBe(JSON.stringify(authorBrief(brief)));
    expect(briefPathOf(brief)).toBe('content/authoring/briefs/GAS_VILLAGE.json');
  });
});

describe('T5 — 지어낸 것은 되먹이고, 없는 의미를 요구하면 돌려보낸다', () => {
  it('어휘 밖의 이름은 되먹인다 — 다음 물음에 아는 어휘가 실린다', async () => {
    const { result, asked } = await draft('늪이 된 마을', [
      answered('GAS_VILLAGE', (raw) => {
        raw.depth = 'swamp'; // 이 세계에 없는 깊이다
      }),
      answered('GAS_VILLAGE'),
    ]);

    expect(result.outcome).toBe('passed');
    expect(asked[1]!.user).toContain('swamp');
    expect(asked[1]!.user).toContain('civil · outer · wild · deep · abyss');
  });

  it('없는 방에 이으면 되먹인다 — 이을 자리가 없으면 세계에 붙지 못한다', async () => {
    const { result, asked } = await draft(
      '아무 데도 닿지 않는 마을',
      [
        answered('GAS_VILLAGE', (raw) => {
          raw.neighbours = [{ region: 'NOWHERE', transition: 'road', direction: 'bidirectional' }];
        }),
      ],
      1,
    );

    expect(result.outcome).toBe('exhausted');
    expect(asked.length).toBe(1);
    expect(result.rounds[0]!.problems.join()).toContain('그 이름의 방도, 밝혀진 경계도 없다');
  });

  it('이웃을 하나도 적지 않으면 검사 ⑦⑧ 이 잡는다 — T1 이 되먹임의 자리다', async () => {
    const { result } = await draft(
      '홀로 뜬 마을',
      [
        answered('GAS_VILLAGE', (raw) => {
          raw.neighbours = [];
        }),
      ],
      1,
    );

    const problems = result.rounds[0]!.problems.join('\n');
    expect(problems).toContain('나갈 곳 없는 방');
    expect(problems).toContain('시작 방에서 닿지 않는 방');
  });

  it('규칙 하나를 요구하면 되묻지 않고 돌려보낸다 (등급 B)', async () => {
    const { result, asked } = await draft('죽은 자들의 도시', [answered('GHOST_CITY')], 5);

    expect(result.outcome).toBe('returned');
    expect(asked.length).toBe(1); // 되물어도 같은 답이 온다 — 다섯 번 묻지 않는다
    expect(gradeRegion(result.brief!, WORLD_CONTRACTS).grade).toBe('B');
  });

  it('아직 없는 층을 요구하면 되묻지 않고 돌려보낸다 (등급 C)', async () => {
    const { result, asked } = await draft('마법의 도시', [answered('MAGIC_CITY')], 5);

    expect(result.outcome).toBe('returned');
    expect(asked.length).toBe(1);
    expect(gradeRegion(result.brief!, WORLD_CONTRACTS).grade).toBe('C');
  });

  it('형을 어긴 답은 걸린 자리를 되묻고, 고쳐 오면 선다', async () => {
    const { result, asked } = await draft('가스로 가득 찬 마을', [
      { id: 'GAS_VILLAGE', name: '가스로 가득 찬 마을' }, // 여덟 답이 없다
      answered('GAS_VILLAGE'),
    ]);

    expect(result.outcome).toBe('passed');
    expect(result.rounds[0]!.stage).toBe('shape');
    expect(asked[1]!.user).toContain('answers');
  });
});

describe('T5 — 모델에게 무엇을 건네는가', () => {
  it('답의 형은 T2 의 schema 그대로다 — 손으로 옮겨 적은 형이 아니다', () => {
    const schema = draftSchema() as {
      $schema: string;
      required: string[];
      properties: { answers: { required: string[] } };
    };
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(schema.required).toContain('answers');
    expect(schema.properties.answers.required).toEqual([
      'distinction',
      'cause',
      'dwelling',
      'danger',
      'worth',
      'discovery',
      'opening',
      'birth',
    ]);
    // 형이 실제로 이 세계의 brief 를 받아들인다
    expect(parseRegionBrief(example('GAS_VILLAGE')).ok).toBe(true);
  });

  it('시스템 글에 확정 문서 · 지금의 어휘 · 지금 서 있는 방이 실린다', () => {
    const system = draftSystem();

    // 규율 (content/authoring/prompts)
    expect(system).toContain('세계 사실을 지어내지 않는다');
    // 어휘 — 계약에서 읽는다. 손으로 적은 목록이 아니다
    for (const depth of WORLD_CONTRACTS.depths) expect(system).toContain(depth);
    for (const region of WORLD_CONTRACTS.regions) expect(system).toContain(region);
    // 확정 문서를 줄이지 않고 그대로 잇는다
    expect(system).toContain('── 확정 문서 (content/roadmap/L0-Game.md)');
    expect(system).toContain(
      readFileSync(
        fileURLToPath(new URL('../../../content/roadmap/L0-Game.md', import.meta.url)),
        'utf8',
      ),
    );
    // 본보기 하나
    expect(system).toContain('── 본보기 (content/authoring/examples/GAS_VILLAGE.json)');
  });

  it('runDraft 는 도구가 짓는 시스템 글과 형을 함께 건넨다', async () => {
    const model = port([answered('GAS_VILLAGE')]);
    const result = await runDraft('가스로 가득 찬 마을', model.ask, 1);

    expect(result.outcome).toBe('passed');
    expect(model.asked[0]!.system).toContain('세계 사실을 지어내지 않는다');
    expect((model.asked[0]!.schema as { $schema: string }).$schema).toContain('draft-07');
  });
});
