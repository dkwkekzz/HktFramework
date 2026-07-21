// =====================================================================
// 존 시뮬레이션 (P0.5) — 직접 조작: 이동·사냥·채집이 좌표 위에서 일어난다
// ---------------------------------------------------------------------
// "게임처럼 보이는" 층: 지역(region)마다 연속 좌표의 존(field)이 있고, 그 위에
// 캐릭터(플레이어·봇)·몹(권속·짐승·마수)·채집 노드가 실체로 움직인다.
// 규칙의 권위는 그대로다 — 몹 처치의 전리품은 법칙 '전투' 로, 채집 완료는
// 기존 act(채취/수확) 로 흘러서 원장·사건·done_when·파문 경로를 벗어나지 않는다.
// 존은 "어디서(공간)·언제(창)" 를 정할 뿐, "무엇이 되는가"는 법칙이 정한다.
// =====================================================================

const ZONE = { w: 1400, h: 900 };
const SPAWN = { x: 200, y: 450 };

// 무대 노드의 존 좌표 (표현 배치 — 규칙은 무대/법칙에 있다)
const NODE_POS = {
  'S-0045': [{ x: 430, y: 300 }],
  'S-0103': [{ x: 780, y: 640 }],
  'S-0102': [{ x: 1120, y: 300 }],
  'S-0201': [{ x: 420, y: 300, target: '수정-표층-R2', label: '수정 노두(표층)' },
             { x: 1060, y: 660, target: '수정-심부-R2', label: '수정 심부(험지)' }],
  'S-0302': [{ x: 520, y: 420 }],
  'S-0502': [{ x: 700, y: 450, interact: '협상', label: '자유민 시장' }],
};

// 지역별 몹 배치 — 사냥의 대상이자 전리품(속성 재료)의 원천
const MOB_DEFS = {
  R1: [
    { archetype: '권속', n: 3, hp: 34, dmg: 5, speed: 70, aggro: 130, area: { x: 1080, y: 320, r: 190 },
      spoils: () => [{ kind: '물질', tags: ['신.권속'], archetype: '권속심장',
        properties: { 생체촉매활성: r(0.5, 0.8), 신성잔향보존율: r(0.4, 0.72) } }] },
    { archetype: '평원짐승', n: 4, hp: 16, dmg: 2, speed: 60, aggro: 0, flee: true, area: { x: 650, y: 450, r: 380 },
      spoils: () => [{ kind: '물질', tags: ['가죽'], archetype: '평원짐승가죽',
        properties: { 내한성: r(0.2, 0.4) } }] },
  ],
  R3: [
    { archetype: '마수', n: 3, hp: 42, dmg: 6, speed: 80, aggro: 150, area: { x: 950, y: 350, r: 240 },
      spoils: () => [{ kind: '물질', tags: ['마수'], archetype: '마수뼈',
        properties: { 공명전달률: r(0.62, 0.8), 에너지손실률: r(0.22, 0.38) } }] },
  ],
};

function r(a, b) { return Math.round((a + Math.random() * (b - a)) * 100) / 100; }
function d2(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
function stepTo(e, tx, ty, dist) {
  const dx = tx - e.x, dy = ty - e.y;
  const len = Math.hypot(dx, dy);
  if (len <= dist) { e.x = tx; e.y = ty; return true; }
  e.x += (dx / len) * dist; e.y += (dy / len) * dist;
  return false;
}
function cmp(v, op, want) {
  if (op === '>=') return v >= want; if (op === '<=') return v <= want;
  if (op === '==') return v === want; if (op === '>') return v > want;
  if (op === '<') return v < want; if (op === '!=') return v !== want;
  return false;
}

const GATHER_TIME = 2.0;   // 채집 채널링(초)
const ATTACK_CD = 1.0;     // 공격 쿨다운(초)
const ATTACK_RANGE = 46;
const GATHER_RANGE = 52;
const PLAYER_SPEED = 170;  // 유닛/초
const RESPAWN_MOB = 22;    // 몹 리스폰(초)
const RESPAWN_PLAYER = 5;

export class ZoneSim {
  constructor(game) {
    this.game = game;
    this.avatars = new Map();  // playerId → avatar
    this.mobs = [];
    this.hits = [];            // 떠오르는 전투 텍스트 [{region,x,y,text,ttl,color}]
    this._mn = 0;
    for (const [region, defs] of Object.entries(MOB_DEFS)) {
      for (const def of defs) for (let i = 0; i < def.n; i++) this.mobs.push(this._mob(region, def));
    }
    // 봇에게도 몸을 준다 — 세계에 움직이는 타인이 보이게 (사회적 배경 복사)
    for (const b of game.bots) this.avatar(b, true);
  }

  _mob(region, def) {
    const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * def.area.r;
    return {
      id: `m${++this._mn}`, region, def, archetype: def.archetype,
      x: def.area.x + Math.cos(a) * rr, y: def.area.y + Math.sin(a) * rr,
      hp: def.hp, maxHp: def.hp, target: null, wanderT: Math.random() * 3, cd: 0,
      dead: false, respawnT: 0,
    };
  }

  avatar(p, isBot = false) {
    let a = this.avatars.get(p.id);
    if (!a) {
      a = { x: SPAWN.x + Math.random() * 60, y: SPAWN.y + Math.random() * 60,
        hp: 60, maxHp: 60, moveTarget: null, attackTarget: null,
        gatherTarget: null, gatherT: 0, cd: 0, dead: false, respawnT: 0, isBot, wanderT: 1 };
      this.avatars.set(p.id, a);
    }
    return a;
  }

  onRegionChange(p) {
    const a = this.avatar(p);
    a.x = SPAWN.x; a.y = SPAWN.y;
    a.moveTarget = a.attackTarget = a.gatherTarget = null;
  }

  pop(region, x, y, text, color = '#ffd479') {
    this.hits.push({ region, x, y, text, ttl: 1.6, color });
  }

  // ── 입력 명령 (서버 권위 — 클라이언트는 의도만 보낸다) ──
  cmd(p, c) {
    const a = this.avatar(p);
    if (a.dead) throw new Error('쓰러져 있다 — 곧 깨어난다');
    if (p.traveling) throw new Error('지역 이동 중이다');
    if (c.cmd === 'moveTo') {
      a.moveTarget = { x: Math.max(20, Math.min(ZONE.w - 20, c.x)), y: Math.max(20, Math.min(ZONE.h - 20, c.y)) };
      a.attackTarget = null; a.gatherTarget = null; a.gatherT = 0;
      return { ok: true };
    }
    if (c.cmd === 'attack') {
      const m = this.mobs.find((m) => m.id === c.target && !m.dead && m.region === p.region);
      if (!m) throw new Error('그 사냥감이 보이지 않는다');
      a.attackTarget = m.id; a.gatherTarget = null; a.gatherT = 0;
      return { ok: true };
    }
    if (c.cmd === 'gather') {
      const node = this.nodes(p).find((n) => n.id === c.target);
      if (!node) throw new Error('그 채집물이 보이지 않는다');
      if (!node.alive) throw new Error(node.hint ?? '지금은 채집할 수 없다');
      a.gatherTarget = c.target; a.attackTarget = null; a.gatherT = 0;
      return { ok: true };
    }
    if (c.cmd === 'stop') { a.moveTarget = a.attackTarget = a.gatherTarget = null; a.gatherT = 0; return { ok: true }; }
    throw new Error(`알 수 없는 명령: ${c.cmd}`);
  }

  // ── 채집 노드 뷰 — 무대·원천·주기 상태에서 파생 (규칙 재유도 없음, 상태 읽기만) ──
  nodes(p) {
    const g = this.game;
    const st = g.session.state.stage;
    const out = [];
    for (const sid of g.session.regions.stagesOf(p.region)) {
      const defs = NODE_POS[sid] ?? [];
      const specs = g.sourcesByStage.get(sid) ?? [];
      defs.forEach((pos, i) => {
        if (sid === 'S-0103') {
          const 신선도 = st['S-0103']?.['신선도'] ?? 0;
          out.push({ id: `${sid}#${i}`, stage: sid, kind: 'node', archetype: '재앙의흉터',
            label: '재앙의 흉터', x: pos.x, y: pos.y, alive: 신선도 > 0,
            hint: 신선도 > 0 ? `신선도 ${신선도}` : '풍화됨 — 다음 순행을 기다려라', verb: '수확' });
          return;
        }
        if (pos.interact === '협상') {
          out.push({ id: `${sid}#${i}`, stage: sid, kind: 'node', archetype: '시장',
            label: pos.label, x: pos.x, y: pos.y, alive: true, hint: '증표(잔향≥0.3) 필요', verb: '협상' });
          return;
        }
        const spec = pos.target ? specs.find((s) => s.id === pos.target) : specs[i] ?? specs[0];
        if (!spec) return;
        const live = g.session.world.has(spec.id);
        const gateOpen = spec.gate ? g.session.clock.isOpen(spec.gate) : true;
        const sub = live ? g.session.world.get(spec.id) : null;
        out.push({
          id: `${sid}#${i}`, stage: sid, kind: 'node', archetype: spec.archetype,
          label: pos.label ?? spec.archetype, x: pos.x, y: pos.y,
          alive: live && gateOpen, subId: spec.id, verb: '채취',
          hint: !live ? '소멸/소진 — 다음 창을 기다려라'
            : !gateOpen ? `[${spec.gate}] 창까지 ${g.session.clock.ticksUntilOpen(spec.gate)}틱` : null,
          resonate: sub ? this._resonates(p, sub.properties) : false,
        });
      });
    }
    return out;
  }

  // 재료 공명 발광(§6.4): 활성 말단의 demand 속성을 가진 대상이 은은히 빛난다.
  _resonates(p, props) {
    const goal = this.game.graph.goalsById.get(p.active);
    for (const d of goal?.demand ?? []) {
      if ((d.kind !== '물질' && d.kind !== '생명체') || !d.property) continue;
      const v = props[d.property.name];
      if (v === undefined) continue;
      const want = typeof d.property.value === 'string' && d.property.value.startsWith('const.')
        ? this.game.graph.constants[d.property.value.slice(6)] : d.property.value;
      if (cmp(v, d.property.op, want)) return true;
    }
    return false;
  }

  // ── 시뮬 스텝 (dt 초) — 이동·전투·채집·몹 AI·리스폰 ──
  step(dt) {
    const g = this.game;
    for (const h of this.hits) h.ttl -= dt;
    this.hits = this.hits.filter((h) => h.ttl > 0);

    // 플레이어(와 봇 몸)
    for (const p of [...g.players.values(), ...g.bots]) {
      const a = this.avatar(p, p.isBot);
      if (a.dead) {
        if ((a.respawnT -= dt) <= 0) {
          a.dead = false; a.hp = a.maxHp; a.x = SPAWN.x; a.y = SPAWN.y;
          if (!a.isBot) g.say(p, '정신을 차렸다 — 회복 기반이 없다는 게 이런 뜻이다 (0.5 가지의 씨앗)', 'warn');
        }
        continue;
      }
      if (p.traveling) continue;
      a.cd = Math.max(0, a.cd - dt);

      if (a.isBot) { this._botWalk(a, dt); continue; }

      // 공격 대상 추적 → 사거리 → 타격
      if (a.attackTarget) {
        const m = this.mobs.find((m) => m.id === a.attackTarget && !m.dead && m.region === p.region);
        if (!m) { a.attackTarget = null; }
        else {
          if (d2(a, m) > ATTACK_RANGE * ATTACK_RANGE) stepTo(a, m.x, m.y, PLAYER_SPEED * dt);
          else if (a.cd <= 0) {
            a.cd = ATTACK_CD;
            const dmg = 7 + Math.floor(Math.random() * 4);
            m.hp -= dmg;
            m.target = p.id; // 반격 어그로
            this.pop(p.region, m.x, m.y - 18, `-${dmg}`, '#ffd479');
            if (m.hp <= 0) this._kill(p, m);
          }
        }
      } else if (a.gatherTarget) {
        const node = this.nodes(p).find((n) => n.id === a.gatherTarget);
        if (!node) { a.gatherTarget = null; a.gatherT = 0; }
        else if (d2(a, node) > GATHER_RANGE * GATHER_RANGE) stepTo(a, node.x, node.y, PLAYER_SPEED * dt);
        else {
          a.gatherT += dt;
          if (a.gatherT >= GATHER_TIME) {
            a.gatherTarget = null; a.gatherT = 0;
            this._gather(p, node);
          }
        }
      } else if (a.moveTarget) {
        if (stepTo(a, a.moveTarget.x, a.moveTarget.y, PLAYER_SPEED * dt)) a.moveTarget = null;
      }
    }

    // 몹 AI — 어그로 추적·공격 / 배회 / 도주
    for (const m of this.mobs) {
      if (m.dead) {
        if ((m.respawnT -= dt) <= 0) Object.assign(m, this._mob(m.region, m.def), { id: m.id });
        continue;
      }
      m.cd = Math.max(0, m.cd - dt);
      const tp = m.target ? g.players.get(m.target) : null;
      const ta = tp && !tp.traveling && tp.region === m.region ? this.avatars.get(tp.id) : null;
      if (ta && !ta.dead) {
        if (m.def.flee) { // 도주형: 반대 방향으로
          stepTo(m, m.x + (m.x - ta.x), m.y + (m.y - ta.y), m.def.speed * dt);
          if (d2(m, ta) > 460 * 460) m.target = null;
        } else if (d2(m, ta) > ATTACK_RANGE * ATTACK_RANGE) {
          stepTo(m, ta.x, ta.y, m.def.speed * dt);
          if (d2(m, { x: m.def.area.x, y: m.def.area.y }) > 560 * 560) { m.target = null; } // 리시
        } else if (m.cd <= 0) {
          m.cd = 1.2;
          ta.hp -= m.def.dmg;
          this.pop(m.region, ta.x, ta.y - 18, `-${m.def.dmg}`, '#ff8d8d');
          if (ta.hp <= 0) {
            ta.dead = true; ta.respawnT = RESPAWN_PLAYER; ta.hp = 0;
            ta.moveTarget = ta.attackTarget = ta.gatherTarget = null;
            m.target = null;
            g.say(tp, `${m.archetype} 에게 쓰러졌다`, 'warn');
            g.broadcast(`누군가 ${m.archetype} 에게 쓰러졌다`);
          }
        }
      } else {
        m.target = null;
        // 어그로 탐지
        if (m.def.aggro > 0) {
          for (const p of g.players.values()) {
            const a = this.avatars.get(p.id);
            if (a && !a.dead && !p.traveling && p.region === m.region && d2(m, a) < m.def.aggro * m.def.aggro) { m.target = p.id; break; }
          }
        }
        if (!m.target) { // 배회
          m.wanderT -= dt;
          if (m.wanderT <= 0) {
            m.wanderT = 2 + Math.random() * 3;
            const ang = Math.random() * Math.PI * 2;
            m.wx = m.def.area.x + Math.cos(ang) * m.def.area.r * Math.random();
            m.wy = m.def.area.y + Math.sin(ang) * m.def.area.r * Math.random();
          }
          if (m.wx !== undefined) stepTo(m, m.wx, m.wy, m.def.speed * 0.4 * dt);
        }
      }
    }
  }

  _botWalk(a, dt) {
    a.wanderT -= dt;
    if (a.wanderT <= 0) {
      a.wanderT = 3 + Math.random() * 4;
      a.wx = 200 + Math.random() * 900; a.wy = 200 + Math.random() * 550;
    }
    if (a.wx !== undefined) stepTo(a, a.wx, a.wy, 80 * dt);
  }

  // 처치 → 전리품은 법칙 '전투' 경유 (사건·에너지·완료 판정이 정상 경로를 탄다)
  _kill(p, m) {
    m.dead = true; m.respawnT = RESPAWN_MOB;
    const av = this.avatar(p);
    av.attackTarget = null;
    this.pop(p.region, m.x, m.y, `${m.archetype} 처치`, '#8fe3ae');
    try {
      const res = this.game.session.apply(p, '전투', null, { spoils: m.def.spoils(), stage: null });
      const got = res.adds.map((s) => this.game._matSummary(s)).join(', ');
      this.game.say(p, `${m.archetype} 처치 → ${got}`, 'gain');
      this.game._afterAct(p, { verb: '전투' });
    } catch (e) {
      this.game.say(p, `${m.archetype} 은 쓰러졌지만 수습할 힘이 없다 — ${e.message}`, 'warn');
    }
  }

  // 채집 완료 → 기존 act 경로 재사용 (시간 창·gate·consume 관문이 그대로 작동)
  _gather(p, node) {
    try {
      if (node.verb === '수확') this.game.act(p.id, { verb: '수확', stage: node.stage });
      else if (node.verb === '협상') this.game.act(p.id, { verb: '협상', stage: node.stage, params: { 신뢰단계: 1 } });
      else this.game.act(p.id, { verb: '채취', stage: node.stage, target: node.subId, params: { 정밀도: 0.85 } });
      const a = this.avatar(p);
      this.pop(p.region, a.x, a.y - 24, '획득!', '#8fe3ae');
    } catch (e) {
      this.game.say(p, e.message, 'warn');
    }
  }

  // ── 클라이언트가 그릴 존 뷰 ──
  view(p) {
    const a = this.avatar(p);
    const entities = [];
    for (const n of this.nodes(p)) entities.push({ ...n });
    for (const m of this.mobs) {
      if (m.region !== p.region || m.dead) continue;
      entities.push({ id: m.id, kind: 'mob', archetype: m.archetype, x: Math.round(m.x), y: Math.round(m.y),
        hp: m.hp, maxHp: m.maxHp, aggro: m.target === p.id,
        resonate: this._resonates(p, Object.assign({}, ...(m.def.spoils?.() ?? []).map((s) => s.properties))) });
    }
    for (const [oid, o] of this.game.players) {
      if (oid === p.id || o.traveling || o.region !== p.region) continue;
      const oa = this.avatars.get(oid);
      if (oa) entities.push({ id: oid, kind: 'player', name: o.name, x: Math.round(oa.x), y: Math.round(oa.y), hp: oa.hp, maxHp: oa.maxHp, dead: oa.dead });
    }
    for (const b of this.game.bots) {
      if (b.region !== p.region) continue;
      const ba = this.avatars.get(b.id);
      if (ba) entities.push({ id: b.id, kind: 'player', name: '낯선 모험가', x: Math.round(ba.x), y: Math.round(ba.y), hp: ba.maxHp, maxHp: ba.maxHp });
    }
    return {
      w: ZONE.w, h: ZONE.h,
      you: { x: Math.round(a.x), y: Math.round(a.y), hp: Math.max(0, Math.round(a.hp)), maxHp: a.maxHp,
        dead: a.dead, respawnIn: a.dead ? Math.ceil(a.respawnT) : 0,
        gathering: a.gatherTarget ? { target: a.gatherTarget, progress: Math.min(1, a.gatherT / GATHER_TIME) } : null,
        attacking: a.attackTarget },
      entities,
      hits: this.hits.filter((h) => h.region === p.region).map((h) => ({ x: Math.round(h.x), y: Math.round(h.y), text: h.text, color: h.color, ttl: h.ttl })),
    };
  }
}
