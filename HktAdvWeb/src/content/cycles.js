// =====================================================================
// 주기 시계 — 상태형 재료의 구동기 (콘텐츠 단계 C1)
// ---------------------------------------------------------------------
// 엔진(StepPlan A~F)은 완성되어 있다. 이 파일은 그 위에서 게임을 굴리기 위한
// 콘텐츠 기계다: 틱을 진행하며 각 주기(순행·월식·한파·호송·무리분산)의 창
// (window) 열림/닫힘을 계산하고, 그 효과를 술어가 읽는 상태(world/stage 경로)와
// 무대 개체(소멸타이머·재생성)에 반영한다.
//
// 상태형 demand 의 실체 통로:
//   world.주기.월식 / world.주기.호송 / world.권속.무리분산 / world.환경.기온 /
//   stage.<id>.잔여시간 / stage.<id>.신선도
// 주기는 world-composition.yaml `cycles` 가 정본 (period > window). 서로 소로 잡아
// 두 창의 드문 겹침이 설계하지 않은 자연 발생 이벤트가 된다 (§6).
// =====================================================================
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { dataPath } from '../paths.js';

export function loadCycles(file = dataPath('world-composition.yaml')) {
  return yaml.load(readFileSync(file, 'utf8')).cycles ?? [];
}

// 주기 = {name, period, window, affects}. phase = tick % period, 창은 phase < window.
export class CycleClock {
  constructor(cycles, { state, world, onTick } = {}) {
    this.cycles = cycles.map((c) => ({ ...c }));
    this.byName = new Map(this.cycles.map((c) => [c.name, c]));
    this.tick = 0;
    this.state = state ?? { world: {}, stage: {} };
    this.state.world ??= {};
    this.state.stage ??= {};
    this.world = world ?? null;
    // onTick(clock, {opened:[names], closed:[names]}) — 창 전이 시 콘텐츠 효과 훅.
    this.onTick = onTick ?? null;
    this._open = new Map();
    this.log = [];
    // 시작 시점(tick 0)의 창 상태를 seed 하고 효과를 한 번 반영한다.
    const opened = [];
    for (const c of this.cycles) {
      const open = this.isOpen(c.name);
      this._open.set(c.name, open);
      if (open) opened.push(c.name);
    }
    if (this.onTick) this.onTick(this, { opened, closed: [] });
  }

  has(name) { return this.byName.has(name); }
  phase(name) { const c = this.byName.get(name); return this.tick % c.period; }
  isOpen(name) { const c = this.byName.get(name); return (this.tick % c.period) < c.window; }
  // 다음 창까지 남은 틱 (0 = 지금 열려 있음).
  ticksUntilOpen(name) {
    const c = this.byName.get(name); const p = this.tick % c.period;
    return p < c.window ? 0 : c.period - p;
  }
  // 현재 창이 닫히기까지 남은 틱 (0 = 지금 닫혀 있음).
  windowClosesIn(name) {
    const c = this.byName.get(name); const p = this.tick % c.period;
    return p < c.window ? c.window - p : 0;
  }

  // n 틱 진행. 각 틱: 자연 감쇠(잔여시간·신선도·소멸타이머) → 창 전이 검출 → 효과 훅.
  step(n = 1) {
    for (let i = 0; i < n; i++) this._one();
    return this.tick;
  }

  _one() {
    this.tick += 1;

    // ── 자연 감쇠: 상태형 재료 "시간과 기회" 는 가만두면 잦아든다 ──
    for (const s of Object.values(this.state.stage ?? {})) {
      if (typeof s['잔여시간'] === 'number') s['잔여시간'] = Math.max(0, s['잔여시간'] - 1);
      if (typeof s['신선도'] === 'number') s['신선도'] = Math.max(0, s['신선도'] - 1);
    }
    if (this.world) {
      for (const e of this.world.all()) {
        if (typeof e.properties['소멸타이머'] === 'number') {
          e.properties['소멸타이머'] -= 1;
          if (e.properties['소멸타이머'] <= 0) this.world.remove(e.id);
        }
      }
    }

    // ── 창 전이 검출 ──
    const opened = [];
    const closed = [];
    for (const c of this.cycles) {
      const open = this.isOpen(c.name);
      const was = this._open.get(c.name) ?? false;
      if (open && !was) { opened.push(c.name); this.log.push(`t${this.tick}: [${c.name}] 창 열림`); }
      if (!open && was) { closed.push(c.name); this.log.push(`t${this.tick}: [${c.name}] 창 닫힘`); }
      this._open.set(c.name, open);
    }

    if (this.onTick) this.onTick(this, { opened, closed });
  }
}

// 다섯 알려진 주기의 world/stage 상태 쓰기 — 콘텐츠가 아는 각 창의 의미를 한 곳에.
// regen: { 'S-0045': () => spec } 처럼 순행 창이 열릴 때 재생성할 무대 원천 스펙 팩토리.
// 순행이 무대를 재생성하는 첫 사례(§7 C1) — "세계는 재료를 생성하지 않는다"의 예외가
// 아니라, 주기(세계의 리듬)가 이미 있던 무대를 되살리는 것(스폰 아님, 리듬의 산물).
export function worldCycleEffects(regen = {}) {
  return (clock, { opened }) => {
    const st = clock.state;
    st.world ??= {}; st.stage ??= {};
    st.world['주기'] ??= {}; st.world['권속'] ??= {}; st.world['환경'] ??= {};
    if (clock.has('월식')) st.world['주기']['월식'] = clock.isOpen('월식');
    if (clock.has('호송')) st.world['주기']['호송'] = clock.isOpen('호송');
    if (clock.has('무리분산')) st.world['권속']['무리분산'] = clock.isOpen('무리분산');
    if (clock.has('한파')) st.world['환경']['기온'] = clock.isOpen('한파') ? -30 : -10;

    // 순행: 창이 (다시) 열리면 R1 무대의 신선도·잔여시간을 되채우고 원천을 재생성한다.
    if (opened.includes('순행')) {
      const win = clock.byName.get('순행').window;
      st.stage['S-0045'] = { ...(st.stage['S-0045'] ?? {}), 잔여시간: win };
      st.stage['S-0103'] = { ...(st.stage['S-0103'] ?? {}), 신선도: win };
      const spec = regen['S-0045'];
      if (spec && clock.world) {
        const s = typeof spec === 'function' ? spec() : spec;
        if (!clock.world.has(s.id)) clock.world.add(s);
      }
    }
  };
}
