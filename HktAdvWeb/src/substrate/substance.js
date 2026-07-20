// =====================================================================
// 속성 물질 (step A2)
// ---------------------------------------------------------------------
// 모든 물질·개체는 속성 집합을 가진다. 속성명은 사전(lexicon)이 정본이며,
// 사전에 없는 속성 조회는 예외다 — demand 판정(불변 원칙 ②)의 판.
// (Design-StepPlan §3 A2)
// =====================================================================
import { compare } from './compare.js';

// 개체 하나. properties 는 {속성명 → 값}.
export class Substance {
  constructor({ id, archetype, kind = null, tags = [], properties = {}, epistemic = null }, lexicon) {
    if (!id) throw new Error('Substance 에 id 가 없다');
    this.id = id;
    this.archetype = archetype ?? null;
    // kind = 재료 범주(물질·정보·지식·능력·생명체·관계·접근권). has 술어가 이 범주로 거른다.
    this.kind = kind;
    // tags = 술어에서 묶어 부르는 이름 (신.조직·신.권속 …) — event 술어의 target_tag 원천.
    this.tags = [...tags];
    this.properties = { ...properties };
    // epistemic = 재료 자체의 발견 상태 (지식 재료의 확인/추정 등). has 술어의
    // epistemic 제약이 belief 노드 대신 재료의 이 값을 우선 본다 (predicate.js evalHas).
    this.epistemic = epistemic ?? null;
    this.lexicon = lexicon ?? null;
    // 사전이 주어지면 생성 시점에 속성명을 검증한다 (오타 조기 차단).
    if (lexicon) {
      for (const name of Object.keys(this.properties)) {
        lexicon.get(name); // 미등재면 예외
      }
    }
  }
}

// 사전 기반 속성 조회 — 미등재 이름은 예외.
export function getProp(s, name, lexicon = s.lexicon) {
  if (lexicon) lexicon.get(name); // 미등재면 예외
  return s.properties[name];
}

// 속성 술어 판정: getProp 값이 op value 를 만족하는가.
// 속성이 아예 없으면 미충족(false) — 예외 아님(사전엔 있으나 이 개체엔 없음).
export function hasProp(s, name, op, value, lexicon = s.lexicon) {
  if (lexicon) lexicon.get(name); // 미등재 속성명은 여기서 거부
  const actual = s.properties[name];
  if (actual === undefined) return false;
  return compare(actual, op, value);
}

// 개체 컬렉션. id·archetype 조회 + 속성 조건 스캔(선형).
export class World {
  constructor(lexicon = null) {
    this.lexicon = lexicon;
    this.substances = new Map(); // id → Substance
  }

  add(spec) {
    const s = spec instanceof Substance ? spec : new Substance(spec, this.lexicon);
    if (this.substances.has(s.id)) {
      throw new Error(`중복 Substance id: '${s.id}'`);
    }
    this.substances.set(s.id, s);
    return s;
  }

  get(id) {
    return this.substances.get(id) ?? null;
  }

  has(id) {
    return this.substances.has(id);
  }

  // 세계에서 개체를 제거한다 (무대 소멸·소진 등).
  remove(id) {
    return this.substances.delete(id);
  }

  byArchetype(archetype) {
    return [...this.substances.values()].filter((s) => s.archetype === archetype);
  }

  // 속성 조건으로 스캔 — 아키타입이 달라도 속성만 맞으면 찾는다 (다중 해법의 씨앗).
  scan(name, op, value) {
    if (this.lexicon) this.lexicon.get(name); // 미등재 거부
    return [...this.substances.values()].filter(
      (s) => hasProp(s, name, op, value, this.lexicon),
    );
  }

  all() {
    return [...this.substances.values()];
  }
}
