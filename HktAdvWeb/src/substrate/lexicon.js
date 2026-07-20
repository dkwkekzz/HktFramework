// =====================================================================
// 속성 사전 로더 (step A2)
// ---------------------------------------------------------------------
// property-lexicon.yaml 이 속성명의 정본이다. 사전에 없는 속성명은
// 그래프 정합 검사(B1)와 substance.getProp 이 기계적으로 거부한다.
// (불변 원칙 ②의 판 자체 — Design-StepPlan §3 A2)
// =====================================================================
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { dataPath } from '../paths.js';

const VALUE_TYPES = new Set(['수치01', '수치', '불리언', '열거']);

// 사전 = { byName: Map<name, entry> } 형태로 로드하고 스키마를 검증한다.
export function loadLexicon(file = dataPath('property-lexicon.yaml')) {
  const raw = yaml.load(readFileSync(file, 'utf8'));
  return buildLexicon(raw);
}

// 파싱된 객체에서 사전을 구성한다 (테스트가 인라인 데이터로도 부를 수 있게 분리).
export function buildLexicon(raw) {
  if (!raw || !Array.isArray(raw.properties)) {
    throw new Error('사전 스키마 오류: properties 배열이 없다');
  }
  const byName = new Map();
  for (const entry of raw.properties) {
    if (!entry || typeof entry.name !== 'string') {
      throw new Error('사전 항목에 name 이 없다');
    }
    if (!VALUE_TYPES.has(entry['값형'])) {
      throw new Error(`속성 '${entry.name}': 알 수 없는 값형 '${entry['값형']}'`);
    }
    if (byName.has(entry.name)) {
      throw new Error(`속성 사전 중복명: '${entry.name}'`);
    }
    byName.set(entry.name, entry);
  }
  return new Lexicon(byName);
}

export class Lexicon {
  constructor(byName) {
    this.byName = byName;
  }

  has(name) {
    return this.byName.has(name);
  }

  // 미등재 속성 사용은 예외 — 오타가 "충족 불가 목적"을 만드는 것을 막는다.
  get(name) {
    const entry = this.byName.get(name);
    if (!entry) {
      throw new Error(`미등재 속성: '${name}' (property-lexicon 에 먼저 등재할 것)`);
    }
    return entry;
  }

  valueType(name) {
    return this.get(name)['값형'];
  }

  names() {
    return [...this.byName.keys()];
  }
}
