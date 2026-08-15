// Master Intent Graph 의 정합 검사. npm run master:check 와 같은 판정을 테스트로도 돌린다.
//
// 두 가지를 본다.
//   1. 지금 저장소의 master/graph/ 가 Quality Gate 를 통과하는가
//   2. Gate 자체가 실제로 무언가를 잡아내는가 (통과만 하는 검사기는 검사기가 아니다)

import { describe, expect, it } from 'vitest';
import { buildGraph, capabilityGaps, loadGraph, validate } from '../print';

/** 최소한의 정상 그래프 — 여기에 한 군데씩 흠집을 내어 Gate 가 우는지 본다 */
const okDocs = () => [
  {
    path: 'capabilities.yaml',
    doc: {
      kind: 'capabilities',
      nodes: [
        { id: 'C_A', type: 'capability', semantic: '무언가 할 수 있다.', status: 'MISSING', cycles: [], where: [] },
      ],
    },
  },
  {
    path: 'R900.yaml',
    doc: {
      kind: 'region',
      region: 'R900',
      nodes: [
        { id: 'A-X', type: 'actor', text: '주체', wants: ['G-X'] },
        {
          id: 'G-X',
          type: 'goal',
          owner: 'A-X',
          desired_state: '무언가가 참이 된다.',
          motivation: ['그것이 없으면 곤란하다'],
        },
        {
          id: 'P-X',
          type: 'possibility',
          name: '한 길',
          achieves: ['G-X'],
          requires: { capabilities: ['C_A'] },
          changes: ['세계가 달라진다'],
        },
      ],
    },
  },
];

const errorsOf = (mutate: (docs: ReturnType<typeof okDocs>) => void): string[] => {
  const docs = okDocs();
  mutate(docs);
  return validate(buildGraph(docs)).errors;
};

describe('Master Graph — 현재 저장소', () => {
  const graph = validate(loadGraph());

  it('참조 무결성과 Quality Gate 를 통과한다 (master:check 동치)', () => {
    expect(graph.errors).toEqual([]);
  });

  it('골격 파일을 읽는다 (비어 있어도 형태는 읽힌다)', () => {
    expect(graph.files.map((f) => f.path)).toContain('master/graph/00-root.yaml');
    expect(graph.files.map((f) => f.path)).toContain('master/graph/capabilities.yaml');
    expect(graph.files.every((f) => ['root', 'region', 'capabilities'].includes(f.kind))).toBe(true);
  });

  it('Capability 는 capabilities.yaml 에만 정의되어 있다', () => {
    for (const file of graph.files) {
      if (file.kind === 'capabilities') continue;
      expect(file.nodes.filter((n) => n.type === 'capability')).toEqual([]);
    }
  });

  it('IMPLEMENTED / PARTIAL Capability 는 근거 Cycle 과 구현 위치를 가진다', () => {
    for (const node of graph.byId.values()) {
      if (node.type !== 'capability') continue;
      const status = String(node.raw.status);
      if (status === 'MISSING') continue;
      expect(node.raw.cycles, `${node.id}.cycles`).toBeTruthy();
      expect(node.raw.where, `${node.id}.where`).toBeTruthy();
    }
  });

  it('Possibility 의 가용성은 요구 Capability 상태에서 유도된다', () => {
    for (const node of graph.byId.values()) {
      if (node.type !== 'possibility') continue;
      const gaps = capabilityGaps(graph, node);
      for (const id of [...gaps.missing, ...gaps.partial]) {
        expect(graph.byId.get(id)?.type, `${node.id} 가 요구하는 ${id}`).toBe('capability');
      }
    }
  });
});

describe('Master Graph — Gate 가 실제로 잡는다', () => {
  it('통과 기준선 자체는 깨끗하다', () => {
    expect(validate(buildGraph(okDocs())).errors).toEqual([]);
  });

  it('없는 노드를 가리키면 잡는다', () => {
    const errors = errorsOf((d) => {
      (d[1]!.doc.nodes[2] as Record<string, unknown>).achieves = ['G-NOPE'];
    });
    expect(errors.join('\n')).toContain('G-NOPE');
  });

  it('type 과 어긋난 참조를 잡는다', () => {
    const errors = errorsOf((d) => {
      (d[1]!.doc.nodes[1] as Record<string, unknown>).owner = 'G-X';
    });
    expect(errors.join('\n')).toContain('허용');
  });

  it('motivation 없는 Goal 을 잡는다 (Capability 를 Goal 로 쓴 경우)', () => {
    const errors = errorsOf((d) => {
      delete (d[1]!.doc.nodes[1] as Record<string, unknown>).motivation;
    });
    expect(errors.join('\n')).toContain('motivation');
  });

  it('세계를 바꾸지 않는 Possibility 를 잡는다', () => {
    const errors = errorsOf((d) => {
      (d[1]!.doc.nodes[2] as Record<string, unknown>).changes = [];
    });
    expect(errors.join('\n')).toContain('changes');
  });

  it('근거 없는 IMPLEMENTED 를 잡는다', () => {
    const errors = errorsOf((d) => {
      Object.assign(d[0]!.doc.nodes[0] as Record<string, unknown>, { status: 'IMPLEMENTED' });
    });
    expect(errors.join('\n')).toContain('근거 Cycle');
  });

  it('Region 파일에 정의된 Capability 를 잡는다', () => {
    const errors = errorsOf((d) => {
      (d[1]!.doc.nodes as unknown[]).push({
        id: 'C_B',
        type: 'capability',
        semantic: '여기 있으면 안 된다.',
        status: 'MISSING',
      });
    });
    expect(errors.join('\n')).toContain('capabilities.yaml');
  });

  it('Id 접두와 type 이 어긋나면 잡는다', () => {
    const errors = errorsOf((d) => {
      (d[1]!.doc.nodes[0] as Record<string, unknown>).id = 'X-BAD';
    });
    expect(errors.join('\n')).toContain('시작해야');
  });

  it('길이 하나뿐인 Goal 은 실패가 아니라 확장 여지 경고다', () => {
    const graph = validate(buildGraph(okDocs()));
    expect(graph.errors).toEqual([]);
    expect(graph.warnings.join('\n')).toContain('G-X');
  });
});
