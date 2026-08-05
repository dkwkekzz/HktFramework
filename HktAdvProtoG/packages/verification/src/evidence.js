// V4 — 완료 증거 생성기: Step/Foundation 완료 증거 JSON 을 만들고 저장한다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { stateHash } from './deterministic.js';

export function buildEvidence({ step, status, results = {}, artifacts = [], limitations = [] }) {
  if (!step || !status) throw new Error('증거에는 step 과 status 가 필요하다');
  const body = { step, status, results, artifacts, limitations };
  return { ...body, contentHash: stateHash(body), generatedAt: new Date().toISOString() };
}

export function writeEvidence(filePath, evidence) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(evidence, null, 2) + '\n');
  return filePath;
}
