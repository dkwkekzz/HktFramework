// 이벤트 로그와 리플레이 저장소 (Foundation — R0/R1/N3 의 씨앗).
// 공리 "사건 기반 상태 변경": 상태는 이벤트 리듀서로만 만들어진다. 로그 재생 = 상태 재현.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createIdGenerator } from '../../verification/src/deterministic.js';

export class EventLog {
  #events = [];
  #nextId;
  constructor(idPrefix = 'ev') { this.#nextId = createIdGenerator(idPrefix); }

  append(type, payload, { tick = 0, traceId = null } = {}) {
    if (!type) throw new Error('이벤트 type 필수');
    const event = { id: this.#nextId(), seq: this.#events.length, type, tick, traceId, payload };
    this.#events.push(event);
    return event;
  }

  list() { return [...this.#events]; }
  get length() { return this.#events.length; }

  /** 초기 상태 + 리듀서로 상태 재구성 — 저장/복구·리플레이의 기반 */
  replay(initialState, reducer) {
    return this.#events.reduce((state, ev) => reducer(state, ev), initialState);
  }

  toJSON() { return { events: this.#events }; }

  static fromJSON(json, idPrefix = 'ev') {
    const log = new EventLog(idPrefix);
    for (const ev of json.events) {
      // 재적재 시에도 seq·내용 보존 — append 를 우회하지 않도록 검증 후 복원
      const restored = log.append(ev.type, ev.payload, { tick: ev.tick, traceId: ev.traceId });
      if (restored.seq !== ev.seq) throw new Error(`리플레이 순서 불일치: ${ev.id}`);
    }
    return log;
  }
}

export class ReplayStore {
  #dir;
  constructor(dir) { this.#dir = dir; }
  save(name, log) {
    const p = join(this.#dir, `${name}.replay.json`);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(log.toJSON(), null, 2) + '\n');
    return p;
  }
  load(name) {
    const p = join(this.#dir, `${name}.replay.json`);
    return EventLog.fromJSON(JSON.parse(readFileSync(p, 'utf8')));
  }
}
