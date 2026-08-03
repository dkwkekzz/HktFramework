// 계약·증거 파일 로더 — 파일 시스템에 닿는 유일한 조각이라 별도 파일로 떼어 둔다.
// (브라우저 Lab 은 이 파일을 쓰지 않고 buildRegistry 에 텍스트를 직접 넘긴다.)

import { existsSync, readFileSync, readdirSync } from 'node:fs';

import { stateHash } from '@hkt/core/v1';

import type { Evidence } from './evidence.ts';
import { MODULE_SOURCES, type ModuleSourceSpec } from './modules.ts';
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

/**
 * 소스 목록의 내용 해시 — 증거의 `sourceHash` 와 **같은 공식이어야** 한다.
 * 증거를 만드는 쪽과 대조하는 쪽이 이 함수 하나를 같이 쓴다 (#663).
 */
export function hashSources(appRoot: URL, sources: readonly string[]): string {
  return stateHash(
    sources.map((path) => ({ path, text: readFileSync(new URL(path, appRoot), 'utf8') })),
  );
}

/** 모듈 ID → 지금 소스의 해시. 증거의 sourceHash 와 다르면 그 증거는 낡았다. */
export function loadSourceHashes(
  appRoot: URL,
  specs: readonly ModuleSourceSpec[] = MODULE_SOURCES,
): Map<string, string> {
  return new Map(specs.map((spec) => [spec.id, hashSources(appRoot, spec.sources)]));
}
