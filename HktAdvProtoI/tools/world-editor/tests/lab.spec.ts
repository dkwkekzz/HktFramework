// T6 — 후보가 머무는 자리와 판정 표면, 그리고 승인.
//
// 재는 것은 셋이다:
//   ① 목록 하나를 돌리면 **세계를 만지지 않고** 후보가 남는가 (선 것도 돌아온 것도 못 선 것도)
//   ② 판정 표면이 판정에 필요한 것을 다 싣는가 — 그리고 **못 재는 것을 숨기지 않는가**
//   ③ 세계에 방이 들어오는 길이 승인 하나뿐인가
//
// 모델은 부르지 않는다 (T5 의 시험과 같은 까닭이다). 답은 문서가 이미 든 본보기 셋 —
// 가스 마을(A) · 유령 도시(B) · 마법도시(C) — 이고, 재는 쪽은 전부 진짜다.
//
// 승인은 **임시 자리**에 굳힌다. 저장소의 content/ 를 시험이 만지면 그 순간 시험이 세계를 바꾼다.

import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DraftAsk } from '../../../engine/world-authoring/draft';
import { admit } from '../admit';
import { authorBrief, renderRegionModule } from '../author';
import { readCandidates, removeCandidate, type Candidate } from '../candidates';
import { readUnknownList, runBatch } from '../draft';

const example = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../../content/authoring/examples/${name}.json`, import.meta.url)),
      'utf8',
    ),
  );

/** 미지 넷과 그에 답하는 가짜 모델 — 마지막 하나는 형도 갖추지 못한 답이다 */
const UNKNOWNS = ['가스로 가득 찬 마을', '죽은 자들의 도시', '마법의 도시', '무엇인지 모를 것'];
const ANSWERS = [
  example('GAS_VILLAGE'),
  example('GHOST_CITY'),
  example('MAGIC_CITY'),
  { id: 'BROKEN' },
];

let dir: string;
let candidates: Candidate[];
const asked: DraftAsk[] = [];

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'world-lab-'));
  let at = -1;
  candidates = await runBatch(
    UNKNOWNS,
    async (ask) => {
      asked.push(ask);
      // 한 줄에 한 번씩만 답한다 — 되먹임이 돌면 같은 답을 다시 낸다
      return ANSWERS[Math.min(++at, ANSWERS.length - 1)];
    },
    { attempts: 1, dir },
  );
}, 120_000);

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('T6 — 목록 하나가 후보 여럿이 된다', () => {
  it('빈 줄과 # 로 시작하는 줄은 미지가 아니다 — 목록에 사람이 이유를 적을 자리가 있다', () => {
    expect(readUnknownList('# 왜 이 목록인가\n\n첫 줄\n  둘째 줄  \n\n# 끝\n')).toEqual([
      '첫 줄',
      '둘째 줄',
    ]);
  });

  it('선 것도 돌아온 것도 못 선 것도 다 남는다 — 왜 못 섰는지가 다음 미지를 적게 한다', () => {
    expect(candidates.map((c) => [c.key, c.judgement.outcome, c.judgement.grade])).toEqual([
      ['GAS_VILLAGE', 'passed', 'A'],
      ['GHOST_CITY', 'returned', 'B'],
      ['MAGIC_CITY', 'returned', 'C'],
      // 형도 갖추지 못한 답에는 이름이 없다 — 줄 번호로 부른다
      ['LINE-004', 'exhausted', undefined],
    ]);
    expect(asked.length).toBe(4); // 한 줄에 한 번 (--attempts 1)
  });

  it('머무는 자리에 굳고, 다시 읽으면 같다 — 판정 · brief · 그림', () => {
    const read = readCandidates(dir);
    expect(read.map((c) => c.key)).toEqual(['GAS_VILLAGE', 'GHOST_CITY', 'LINE-004', 'MAGIC_CITY']);
    const stood = read.find((c) => c.key === 'GAS_VILLAGE')!;
    expect(stood.brief).toEqual(candidates[0]!.brief);
    expect(stood.judgement).toEqual(candidates[0]!.judgement);
    // 선 방에만 그림이 있다 — 서지 못한 방은 컴파일할 것이 없다
    expect(stood.topPng!.subarray(1, 4).toString()).toBe('PNG');
    expect(read.find((c) => c.key === 'LINE-004')!.topPng).toBeUndefined();
    expect(readdirSync(join(dir, 'LINE-004')).sort()).toEqual(['judgement.json']);
  });

  it('세계는 만지지 않는다 — 굳은 것이 전부 머무는 자리 안에 있다', () => {
    for (const key of readdirSync(dir)) {
      for (const file of readdirSync(join(dir, key))) {
        expect(['brief.json', 'judgement.json', 'top.png']).toContain(file);
      }
    }
  });
});

describe('T6 — 편중은 후보를 넣기 전과 뒤를 견주어 나온다', () => {
  it('선 방은 세계의 수를 움직인 자국을 지닌다 — 새로 세는 것이 없다', () => {
    const shifts = candidates[0]!.judgement.shifts;
    expect(shifts.length).toBeGreaterThan(0);
    // 방이 하나 는 것이 수에 그대로 보인다
    const depth = shifts.find((s) => s.id === 'region-depth')!;
    expect(Number(/\/ (\d+)/.exec(depth.after!)![1]) - Number(/\/ (\d+)/.exec(depth.before!)![1])).toBe(1);
    // **편중이 실린다** — 기회 자리의 분포가 이 방 때문에 움직인다 (T6 의 까닭)
    const opportunity = shifts.find((s) => s.id === 'ecology-opportunity')!;
    expect(opportunity.before).not.toBe(opportunity.after);
    expect(opportunity.after).toContain('baseline');
    // 무너뜨린 검사가 없다 — 무너뜨렸다면 애초에 서지 못했을 것이다
    expect(shifts.filter((s) => s.broke)).toEqual([]);
  });

  it('서지 못한 방은 편중을 재지 않는다 — 세계에 넣어 볼 수가 없다', () => {
    for (const candidate of candidates.slice(1)) {
      expect(candidate.judgement.shifts).toEqual([]);
    }
  });
});

describe('T6 — 판정 표면은 판정하지 않고 모은다', () => {
  it('후보가 다 실리고 등급이 갈려 보인다', async () => {
    const { renderLab } = await import('../lab');
    const html = renderLab(candidates);
    for (const candidate of candidates) expect(html).toContain(candidate.key);
    expect(html).toContain('grade-A');
    expect(html).toContain('grade-B');
    expect(html).toContain('failed'); // 서지 못한 것
    // 미지 한 줄이 방마다 남는다 — 무엇을 물어서 나온 방인지가 판정의 재료다
    for (const unknown of UNKNOWNS) expect(html).toContain(unknown);
  });

  it('여덟 답이 실리고, 비운 답은 비운 채로 보인다', async () => {
    const { renderLab } = await import('../lab');
    const html = renderLab(candidates);
    expect(html).toContain('특별함');
    expect(html).toContain('탄생');
    expect(html).toContain('unanswered'); // 비운 답의 표시
  });

  it('승인 명령은 선 방에만 붙는다 — 서지 못한 방은 반려만 할 수 있다', async () => {
    const { renderLab } = await import('../lab');
    const stood = renderLab([candidates[0]!]);
    const returned = renderLab([candidates[1]!]);
    expect(stood).toContain('npm run world:admit -- GAS_VILLAGE<');
    expect(returned).not.toContain('npm run world:admit -- GHOST_CITY<');
    expect(returned).toContain('GHOST_CITY --reject');
  });

  it('아직 재지 못하는 편중을 숨기지 않는다 — 없는 것을 통과로 적지 않는 어법 그대로다', async () => {
    const { renderLab } = await import('../lab');
    const html = renderLab([candidates[0]!]);
    expect(html).toContain('아직 재지 못하는 편중');
    // 없는 검사만 남는다 — 재료 계통의 편중(⑲ ⑳ ㉒)은 이제 위의 표에 실린다
    expect(html).toContain('㉝');
    expect(html).not.toContain('아직 재지 못하는 편중 — 기회 자리');
  });

  it('후보가 없으면 무엇을 하라고 적는다 — 빈 화면이 말없이 서 있지 않는다', async () => {
    const { renderLab } = await import('../lab');
    expect(renderLab([])).toContain('world:draft');
  });
});

describe('T6 — 세계에 방이 들어오는 길은 승인 하나다', () => {
  it('서지 못한 방은 들일 수 없다 — 등급 B·C 는 Cycle 의 것이다', () => {
    for (const candidate of candidates.slice(1)) {
      expect(() => admit(candidate, { briefs: dir, regions: dir })).toThrow('서지 못한 방이다');
    }
  });

  it('승인하면 brief 와 방이 굳는다 — 그 방은 T3 가 내는 것과 글자까지 같다', () => {
    const written = admit(candidates[0]!, {
      briefs: join(dir, 'admitted'),
      regions: join(dir, 'admitted'),
    });
    expect(written.brief.endsWith('GAS_VILLAGE.json')).toBe(true);
    expect(written.region.endsWith('gas-village.ts')).toBe(true);
    expect(readFileSync(written.region, 'utf8')).toBe(
      renderRegionModule(authorBrief(candidates[0]!.brief!)),
    );
    // brief 가 원본이다 — 방 파일은 여기서 다시 낼 수 있다
    expect(JSON.parse(readFileSync(written.brief, 'utf8'))).toEqual(candidates[0]!.brief);
    // 손으로 옮길 줄을 함께 낸다 (T3 의 규약 그대로)
    expect(written.seams).toContain('content/regions/graph.ts');
    // 그 방이 **새로 낳는 재료**의 자리도 댄다 — 없으면 승인 뒤 검사 ⑪ ㉑ 이 걸린다
    expect(written.seams).toContain('MATERIAL_SEEDS 에 아래를 더한다');
    expect(written.seams).toContain("id: 'GAS_RESIDUE'");
  });

  it('반려는 머무는 자리에서 지우는 일일 뿐이다 — 세계는 처음부터 만진 적이 없다', () => {
    expect(existsSync(join(dir, 'MAGIC_CITY'))).toBe(true);
    expect(removeCandidate(dir, 'MAGIC_CITY')).toBe(true);
    expect(existsSync(join(dir, 'MAGIC_CITY'))).toBe(false);
    expect(readCandidates(dir).map((c) => c.key)).not.toContain('MAGIC_CITY');
    // 없는 것을 반려해도 조용히 거짓을 돌려준다 — 던지지 않는다
    expect(removeCandidate(dir, 'MAGIC_CITY')).toBe(false);
  });
});
