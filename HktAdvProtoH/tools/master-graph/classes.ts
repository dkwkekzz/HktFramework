// Class 관문 검사 — growth/classes/*.yaml 의 CL-* 가 닫혔는지를 값으로 대조한다.
//
// FC (Design-Fairy-Class-Layer0-R0.md) §12 는 Class 하나에 열두 질문을 요구하지만,
// 칸이 된 것은 그중 넷뿐이다 (Human 결정 — HISTORY Q70(c)). 나머지 여덟은 다른 DC 가
// 값으로 요구하지 않으므로 semantic · detail · world_shape 산문에 남는다.
//
// 이 검사는 그래프를 읽지 않는다 — grants 가 가리키는 MC-* 의 존재만 그래프에 묻는다.
// growth/ 는 Master Graph 의 노드가 아니라 그 위에 얹히는 획득 경로이기 때문이다
// (DC-GROWTH-NOT-A-STAGE).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Problem } from './model';

/** 비면 그 Class 가 닫히지 않은 것으로 보는 칸 — 각각을 요구하는 DC 가 따로 있다 */
const GATES = [
  { key: 'response', dc: 'DC-GROWTH-CLASS-OWNS-THE-RESPONSE' },
  { key: 'counterplay', dc: 'DC-COMBAT-STRONG-RULE-HAS-COUNTERPLAY' },
  { key: 'cannot_yet', dc: 'DC-GROWTH-CAPABILITY-DECLARES-ITS-LIMITS' },
  { key: 'extends_toward', dc: 'DC-GROWTH-CLASS-CLOSES-BEFORE-THE-NEXT-LAYER' },
] as const;

const isEmpty = (v: unknown): boolean =>
  v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

export interface ClassCheck {
  count: number;
  problems: Problem[];
}

/** master/ 루트와 이미 읽은 노드 ID 집합을 받아 CL-* 를 검사한다 */
export function checkClasses(masterDir: string, knownNodeIds: Set<string>): ClassCheck {
  const dir = join(masterDir, 'growth', 'classes');
  const problems: Problem[] = [];
  if (!existsSync(dir)) return { count: 0, problems };

  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort();
  for (const file of files) {
    const doc = parseYaml(readFileSync(join(dir, file), 'utf8')) as Record<string, unknown> | null;
    const id = String(doc?.id ?? '');
    if (!id) {
      problems.push({ severity: 'ERROR', code: 'CLASS_NO_ID', message: `growth/classes/${file}: id 없는 Class` });
      continue;
    }

    for (const gate of GATES) {
      if (isEmpty(doc?.[gate.key])) {
        problems.push({
          severity: 'ERROR',
          code: 'CLASS_GATE_EMPTY',
          message: `${id} 의 ${gate.key} 가 비었다 — ${gate.dc} 가 요구하는 칸이다 (SCHEMA.md CL-*)`,
        });
      }
    }

    // origin_trace 는 DC-GROWTH-CLASS-ORIGIN-TRACE 가 필수로 요구한다
    const trace = (doc?.origin_trace ?? {}) as Record<string, unknown>;
    for (const key of ['world_state', 'goal', 'possibility']) {
      if (isEmpty(trace[key])) {
        problems.push({
          severity: 'ERROR',
          code: 'CLASS_NO_ORIGIN',
          message: `${id} 의 origin_trace.${key} 가 비었다 — DC-GROWTH-CLASS-ORIGIN-TRACE`,
        });
      }
    }

    // grants 와 origin_trace 가 가리키는 것은 전부 실재하는 노드여야 한다
    const refs = [
      ...((doc?.grants ?? []) as unknown[]),
      ...(['world_state', 'goal', 'possibility'].flatMap((k) => (trace[k] ?? []) as unknown[])),
    ].filter((x): x is string => typeof x === 'string');
    for (const ref of refs) {
      if (!knownNodeIds.has(ref)) {
        problems.push({
          severity: 'ERROR',
          code: 'CLASS_UNKNOWN_REF',
          message: `${id} 가 없는 노드 ${ref} 를 가리킨다`,
        });
      }
    }

    // transitions_to 는 실재하는 CL-* 만 가리킨다 (비어 있는 것은 정상 — 위층이 아직 없다)
    for (const t of (doc?.transitions_to ?? []) as Record<string, unknown>[]) {
      const to = String(t?.to ?? '');
      if (to && !files.some((f) => f === `${to}.yaml`)) {
        problems.push({
          severity: 'ERROR',
          code: 'CLASS_UNKNOWN_TRANSITION',
          message: `${id} 의 transitions_to 가 없는 Class ${to} 를 가리킨다`,
        });
      }
    }
  }

  return { count: files.length, problems };
}
