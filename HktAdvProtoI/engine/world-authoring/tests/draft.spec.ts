// T5 — 되먹임 고리 자체를 잰다. 모델도 세계도 가짜로 두고 **고리만** 본다:
// 걸린 자리가 다음 물음에 실리는가 · 되물어도 소용없는 걸림에서 멈추는가 · 상한을 지키는가.
//
// 여기에는 이 세계의 어휘도 방도 없다 — 기반의 시험이므로 게임 명사가 하나도 나오지 않는다.

import { describe, expect, it } from 'vitest';
import {
  draftQuestion,
  draftRegion,
  renderDraftSystem,
  type DraftAsk,
  type DraftTrial,
} from '../draft';

/** 형을 통과하는 가장 작은 brief — 답을 다 비운 것도 형은 통과한다 (비었다는 것이 남는다) */
const brief = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  depth: 'somewhere',
  answers: {
    distinction: { unanswered: '아직' },
    cause: { unanswered: '아직' },
    dwelling: { unanswered: '아직' },
    danger: { unanswered: '아직' },
    worth: { said: { unanswered: '아직' }, sources: [] },
    discovery: { unanswered: '아직' },
    opening: { unanswered: '아직' },
    birth: { said: { unanswered: '아직' }, born: [] },
  },
  ...extra,
});

const pass: DraftTrial = { ok: true, problems: [], retry: false };
const fixable = (...problems: string[]): DraftTrial => ({ ok: false, problems, retry: true });
const returned = (...problems: string[]): DraftTrial => ({ ok: false, problems, retry: false });

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

describe('T5 — 걸린 자리를 그대로 되묻는다', () => {
  it('형을 어긴 답은 걸린 자리가 다음 물음에 글자로 실린다', async () => {
    const model = port([{ id: 'A' }, brief('A')]);
    const result = await draftRegion({
      unknown: '얼어붙은 골짜기',
      system: '(세계)',
      schema: {},
      ask: model.ask,
      trial: () => pass,
    });

    expect(result.outcome).toBe('passed');
    expect(result.rounds.map((r) => r.stage)).toEqual(['shape', undefined]);
    // 첫 물음에는 미지 한 줄뿐이고, 두 번째 물음에는 걸린 자리가 실린다
    expect(model.asked[0]!.user).toContain('얼어붙은 골짜기');
    expect(model.asked[0]!.user).not.toContain('걸렸다');
    expect(model.asked[1]!.user).toContain('name');
    expect(model.asked[1]!.user).toContain('걸린 자리만 고쳐 다시 적는다');
  });

  it('세계에 서지 못한 답도 같은 방식으로 되묻는다 — 재는 쪽이 준 글 그대로다', async () => {
    const model = port([brief('A'), brief('B')]);
    let round = 0;
    const result = await draftRegion({
      unknown: '한 줄',
      system: '(세계)',
      schema: {},
      ask: model.ask,
      trial: () => (++round === 1 ? fixable('깊이 어휘에 없다: swamp') : pass),
    });

    expect(result.outcome).toBe('passed');
    expect(result.brief?.id).toBe('B');
    expect(model.asked[1]!.user).toContain('깊이 어휘에 없다: swamp');
  });

  it('되먹여도 소용없는 걸림에서는 상한을 다 쓰지 않고 멈춘다 — 사람에게 돌아간다', async () => {
    const model = port([brief('A')]);
    const result = await draftRegion({
      unknown: '한 줄',
      system: '(세계)',
      schema: {},
      ask: model.ask,
      trial: () => returned('그 규칙이 아직 세계에 없다'),
      attempts: 5,
    });

    expect(result.outcome).toBe('returned');
    // 한 번만 물었다 — 같은 답이 올 것을 알면서 다섯 번 묻지 않는다
    expect(model.asked.length).toBe(1);
    // 돌려보내면서도 낸 것은 들고 온다 — 사람이 무엇이 걸렸는지 볼 수 있어야 한다
    expect(result.brief?.id).toBe('A');
  });

  it('상한만큼 물어도 서지 않으면 멈추고 마지막에 걸린 것을 든다', async () => {
    const model = port([brief('A')]);
    const result = await draftRegion({
      unknown: '한 줄',
      system: '(세계)',
      schema: {},
      ask: model.ask,
      trial: () => fixable('아직도 걸린다'),
      attempts: 2,
    });

    expect(result.outcome).toBe('exhausted');
    expect(model.asked.length).toBe(2);
    expect(result.rounds.map((r) => r.problems)).toEqual([['아직도 걸린다'], ['아직도 걸린다']]);
  });

  it('되먹임에 실리는 것은 **마지막** 걸림이다 — 고친 자리를 다시 고치라 하지 않는다', () => {
    const asked = draftQuestion('한 줄', [
      { round: 1, asked: '', stage: 'shape', problems: ['처음 걸림'] },
      { round: 2, asked: '', stage: 'world', problems: ['그다음 걸림'] },
    ]);
    expect(asked).toContain('그다음 걸림');
    expect(asked).not.toContain('처음 걸림');
    expect(asked).toContain('앞서 2 번 냈고');
  });
});

describe('T5 — 시스템 글은 문서를 줄이지 않고 잇는다', () => {
  it('규율 · 어휘 · 지금 서 있는 세계 · 본보기 · 문서가 그대로 실린다', () => {
    const read = (path: string) => `<${path} 의 속>`;
    const text = renderDraftSystem(
      { documents: ['docs/one.md'], examples: ['examples/one.json'], rules: ['지어내지 않는다'] },
      {
        vocabulary: [{ of: '깊이', names: ['안', '밖'] }, { of: '없는 것', names: [] }],
        standing: ['방 하나가 서 있다'],
      },
      read,
    );

    expect(text).toContain('1. 지어내지 않는다');
    expect(text).toContain('깊이: 안 · 밖');
    expect(text).toContain('없는 것: (아직 없다)');
    expect(text).toContain('방 하나가 서 있다');
    expect(text).toContain('<examples/one.json 의 속>');
    expect(text).toContain('<docs/one.md 의 속>');
  });
});
