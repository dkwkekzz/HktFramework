// 계약 파일 로더 — 파일 시스템에 닿는 유일한 조각이라 별도 파일로 떼어 둔다.
// (브라우저 Lab 은 이 파일을 쓰지 않고 buildRegistry 에 텍스트를 직접 넘긴다.)

import { readFileSync, readdirSync } from 'node:fs';

import type { ContractSource } from './registry.ts';

/** 디렉터리의 *.yaml 을 전부 읽는다. */
export function loadContractSources(directory: URL): ContractSource[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.yaml'))
    .sort()
    .map((name) => ({ name, text: readFileSync(new URL(name, directory), 'utf8') }));
}
