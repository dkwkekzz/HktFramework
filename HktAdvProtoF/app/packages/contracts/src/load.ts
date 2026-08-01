// 계약·증거 파일 로더 — 파일 시스템에 닿는 유일한 조각이라 별도 파일로 떼어 둔다.
// (브라우저 Lab 은 이 파일을 쓰지 않고 buildRegistry 에 텍스트를 직접 넘긴다.)

import { existsSync, readFileSync, readdirSync } from 'node:fs';

import type { Evidence } from './evidence.ts';
import type { ContractSource } from './registry.ts';

/** 디렉터리의 *.yaml 을 전부 읽는다. */
export function loadContractSources(directory: URL): ContractSource[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.yaml'))
    .sort()
    .map((name) => ({ name, text: readFileSync(new URL(name, directory), 'utf8') }));
}

/** evidence/ 의 <모듈ID>.json 을 전부 읽는다. 없는 증거는 그냥 없는 것으로 둔다. */
export function loadEvidence(evidenceDir: URL): Map<string, Evidence> {
  const out = new Map<string, Evidence>();
  if (!existsSync(evidenceDir)) return out;
  for (const name of readdirSync(evidenceDir).sort()) {
    if (!name.endsWith('.json')) continue;
    const id = name.slice(0, -'.json'.length);
    out.set(id, JSON.parse(readFileSync(new URL(name, evidenceDir), 'utf8')) as Evidence);
  }
  return out;
}
