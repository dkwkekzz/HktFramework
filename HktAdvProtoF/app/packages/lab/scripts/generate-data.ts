// Lab 데이터 스냅샷 생성기 — 계약·증거 파일을 브라우저가 읽을 수 있는 TS 모듈로 굳힌다.
//
// 브라우저에는 파일 시스템이 없다. 그렇다고 Lab 만 Vite 전용 문법(import.meta.glob)에 기대면
// node:test 로 페이지를 단언할 수 없게 된다. 그래서 평범한 TS 데이터 파일로 뽑아 둔다.
// 스냅샷이 낡으면 test/data.test.ts 가 잡는다.
//
//   실행: node packages/lab/scripts/generate-data.ts

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadContractSources, loadEvidence } from '@hkt/contracts/load';

const contractsDir = new URL('../../contracts/', import.meta.url);
const evidenceDir = new URL('../../contracts/evidence/', import.meta.url);
const target = new URL('../src/data.generated.ts', import.meta.url);

const sources = loadContractSources(contractsDir);
const evidence = loadEvidence(evidenceDir);

const body = `// 이 파일은 생성된다 — 직접 고치지 말 것.
// 생성: node packages/lab/scripts/generate-data.ts  (npm run verify 가 자동 수행)
// 원본: packages/contracts/*.yaml · packages/contracts/evidence/*.json

import type { ContractSource, Evidence } from '@hkt/contracts';

export const CONTRACT_SOURCES: readonly ContractSource[] = ${JSON.stringify(sources, null, 2)};

export const EVIDENCE: Readonly<Record<string, Evidence>> = ${JSON.stringify(
  Object.fromEntries(evidence),
  null,
  2,
)};
`;

writeFileSync(target, body, 'utf8');
console.log(
  `Lab 데이터 스냅샷: 계약 ${String(sources.length)}개 · 증거 ${String(evidence.size)}개 → ${fileURLToPath(target)}`,
);
