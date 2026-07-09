// ============================================================================
// Render — 3D 원근 투영 시각화 (Canvas 2D 위 소프트웨어 카메라, 외부 의존 0).
// 원장 미러를 읽기만 한다 (쓰기 금지). z 는 높이(up), x·y 는 지면.
// 카메라: 플레이어를 도는 orbit(드래그=회전, 휠=줌). HUD 는 화면공간 유지.
//
// 최소 코어 뷰어 — 플레이어와 원장 총합(보존)·체크섬·tx 스트림만 전시한다.
// 노드·아이템·전투 등 게임플레이 시각화는 feature 로 얹는다.
// ============================================================================

import { WORLD_SIZE, WORLD_HEIGHT, REGION_SIZE, FIELD_Z_LAYERS, PLAYER_MAX_ENERGY, CREATURE_MAX_ENERGY, CREATURE_DEATH_THRESHOLD, CREATURE_SEEK_RADIUS, POOL, dist3, fieldPhase } from '../shared/constants.js';

const CAUSE_LABEL = { spawn: '스폰', move: '이동', death: '소멸', diffuse: '확산', radiate: '복사', crystallize: '결정화', react: '반응', forage: '갈구', metabolize: '대사', harvest: '채집', attack: '강탈', burst: '발산', discharge: '방출', cook: '요리', craft: '제조' };
// 욕구 라벨/색 (feature-0010·0011) — 뷰어가 각 생명체 위에 그 동기를 적는다.
const DESIRE_LABEL = { forage: '채집', hunt: '사냥', none: '대기', eat: '식사', craft: '제조' };

function poolLabel(state, id) {
  if (id === state.playerId) return '나';
  if (id === POOL.SOURCE) return '태양';
  if (id === POOL.SINK) return '심우주';
  if (id.startsWith(POOL.MATERIAL)) return '국소장';
  if (id.startsWith(POOL.CRYSTAL)) return '결정';
  if (id.startsWith(POOL.CREATURE)) return '생명체';
  return state.entities.get(id)?.name ?? id;
}

export class Render {
  constructor(canvas, state, sim, net) {
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width;
    this.h = canvas.height;
    this.state = state;
    this.sim = sim;
    this.net = net;

    // orbit 카메라 (z-up). yaw=방위각, pitch=올려본 각, dist=거리.
    this.yaw = -Math.PI * 0.75;
    this.pitch = 0.55;
    this.dist = 620;
    this.focal = this.h * 0.9;

    // 입력: 드래그 회전 · 휠 줌
    let drag = null;
    canvas.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY }; });
    addEventListener('mouseup', () => { drag = null; });
    addEventListener('mousemove', (e) => {
      if (!drag) return;
      this.yaw -= (e.clientX - drag.x) * 0.006;
      this.pitch = Math.max(0.05, Math.min(1.45, this.pitch + (e.clientY - drag.y) * 0.005));
      drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('wheel', (e) => {
      this.dist = Math.max(150, Math.min(1600, this.dist * (1 + Math.sign(e.deltaY) * 0.12)));
      e.preventDefault();
    }, { passive: false });
  }

  // --- 카메라 기저 (target=플레이어) ---
  #camera() {
    const { sim } = this;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const fwd = [cp * Math.cos(this.yaw), cp * Math.sin(this.yaw), -sp];
    const target = [sim.x, sim.y, sim.z + 20];
    const pos = [target[0] - fwd[0] * this.dist, target[1] - fwd[1] * this.dist, target[2] - fwd[2] * this.dist];
    const rx = fwd[1], ry = -fwd[0], rz = 0;
    const rl = Math.hypot(rx, ry, rz) || 1;
    const right = [rx / rl, ry / rl, rz / rl];
    const up = [
      right[1] * fwd[2] - right[2] * fwd[1],
      right[2] * fwd[0] - right[0] * fwd[2],
      right[0] * fwd[1] - right[1] * fwd[0],
    ];
    return { pos, right, up, fwd };
  }

  #toCam(cam, x, y, z) {
    const rx = x - cam.pos[0], ry = y - cam.pos[1], rz = z - cam.pos[2];
    return [
      rx * cam.right[0] + ry * cam.right[1] + rz * cam.right[2],
      rx * cam.up[0] + ry * cam.up[1] + rz * cam.up[2],
      rx * cam.fwd[0] + ry * cam.fwd[1] + rz * cam.fwd[2],
    ];
  }

  #project(c) {
    if (c[2] <= 1) return null;
    return { sx: this.w / 2 + (c[0] / c[2]) * this.focal, sy: this.h / 2 - (c[1] / c[2]) * this.focal, f: c[2] };
  }

  #pt(cam, x, y, z) { return this.#project(this.#toCam(cam, x, y, z)); }

  // near 평면 클립 후 선분 그리기
  #seg(cam, ax, ay, az, bx, by, bz) {
    let a = this.#toCam(cam, ax, ay, az), b = this.#toCam(cam, bx, by, bz);
    const near = 1;
    if (a[2] <= near && b[2] <= near) return;
    if (a[2] <= near || b[2] <= near) {
      const t = (near - a[2]) / (b[2] - a[2]);
      const mid = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near];
      if (a[2] <= near) a = mid; else b = mid;
    }
    const pa = this.#project(a), pb = this.#project(b);
    if (!pa || !pb) return;
    this.ctx.beginPath(); this.ctx.moveTo(pa.sx, pa.sy); this.ctx.lineTo(pb.sx, pb.sy); this.ctx.stroke();
  }

  draw() {
    const { ctx, w, h, state } = this;
    const cam = this.#camera();

    ctx.fillStyle = '#0a0d13';
    ctx.fillRect(0, 0, w, h);

    // 지면(z=0) 지역 격자
    ctx.strokeStyle = '#2a3446';
    ctx.lineWidth = 1;
    for (let g = 0; g <= WORLD_SIZE; g += REGION_SIZE) {
      this.#seg(cam, g, 0, 0, g, WORLD_SIZE, 0);
      this.#seg(cam, 0, g, 0, WORLD_SIZE, g, 0);
    }

    // 국소장 3D 볼류메트릭 — 각 복셀을 농도에 따라 글로우로 그린다 (에너지 확산을 3D 로 시각화)
    this.#fieldVolume(cam);

    // 결정 마커 — 국소장에서 석출돼 동결된 정적 에너지를 밝은 결정으로 그린다 (feature-0005)
    this.#crystalMarkers(cam);

    // 생명체 마커 — 스스로 대사로 질서를 유지하는 살아있는 저엔트로피 섬 (feature-0006)
    this.#creatureMarkers(cam);

    // 엔티티(다른 플레이어) — 자신 포함, 깊이순(먼 것 먼저)
    const draws = [];
    for (const e of state.entities.values()) {
      const c = this.#toCam(cam, e.x, e.y, e.z);
      if (c[2] > 1) draws.push({ e, cam: c });
    }
    const selfC = this.#toCam(cam, this.sim.x, this.sim.y, this.sim.z);
    if (selfC[2] > 1) draws.push({ self: true, cam: selfC });
    draws.sort((a, b) => b.cam[2] - a.cam[2]);

    for (const d of draws) {
      if (d.self) { this.#drawSelf(cam); continue; }
      this.#drawEntity(cam, d.e, d.cam[2]);
    }

    this.#hud();
  }

  // 국소장 3D 볼류메트릭 — 각 복셀을 상태별 색으로 그린다(먼 것부터, painter's). feature-0005 step4:
  //   기체(옅은 하늘빛, 퍼짐) · 액체(진한 물빛, 중력으로 바닥에 고임) · 고밀도(붉은 열, 과포화→석출).
  //   에너지를 위에 부으면 액체가 아래 층으로 가라앉아 수평 수면을 이루는 걸 3D 로 본다.
  #fieldVolume(cam) {
    const { state } = this;
    if (state.field.size === 0) return;
    let max = 1;
    for (const v of state.field.values()) if (v > max) max = v;
    const RS = REGION_SIZE, LS = WORLD_HEIGHT / FIELD_Z_LAYERS, m = 0.02; // 셀 경계 얇은 실선용 미세 여백(복셀은 공간을 빈틈없이 채운다 — 간격은 표시용일 뿐)
    const cells = [];
    for (const [key, bal] of state.field) {
      const t = bal / max;
      if (t < 0.05) continue; // 거의 빈 복셀은 생략(시야 정리)
      const [cx, cy, cz] = key.split('_').map(Number);
      const d = this.#toCam(cam, (cx + 0.5) * RS, (cy + 0.5) * RS, (cz + 0.5) * LS)[2];
      cells.push({ cx, cy, cz, t, phase: fieldPhase(bal), d });
    }
    cells.sort((a, b) => b.d - a.d); // 먼 복셀 먼저 그린다
    for (const c of cells) {
      this.#voxelCube(cam,
        (c.cx + m) * RS, (c.cx + 1 - m) * RS,
        (c.cy + m) * RS, (c.cy + 1 - m) * RS,
        (c.cz + m) * LS, (c.cz + 1 - m) * LS, c.t, c.phase);
    }
  }

  // 결정 마커 — 각 개별 결정을 제 위치에 8면체(옥타)로 그린다(먼 것부터, painter's).
  //   확산장(파랑→빨강 반투명 큐브)과 대비되는 선명한 고체. 색상은 종(species)마다 다르다 —
  //   죽음의 잔해·hotspot 석출 등 다양하게 생성된 결정이 저마다 다른 색으로 선다(feature-0005 step2).
  //   가만두면 이 잔고는 불변이다(확산·복사 면역) — 국소장은 새어도 결정은 그대로 서 있다.
  #crystalMarkers(cam) {
    const { state } = this;
    if (state.crystals.size === 0) return;
    let max = 1;
    for (const c of state.crystals.values()) if (c.balance > max) max = c.balance;
    const marks = [];
    for (const c of state.crystals.values()) {
      if (c.balance <= 0) continue;
      const d = this.#toCam(cam, c.x, c.y, c.z)[2];
      if (d > 1) marks.push({ x: c.x, y: c.y, z: c.z, t: c.balance / max, bal: c.balance, species: c.species, raw: c.raw, crafted: c.crafted, d });
    }
    marks.sort((a, b) => b.d - a.d);
    for (const m of marks) this.#crystalOcta(cam, m.x, m.y, m.z, m.t, m.bal, m.species, m.raw, m.crafted);
  }

  #crystalOcta(cam, cx, cy, cz, t, bal, species, raw, crafted) {
    const { ctx } = this;
    const r = 24 + 90 * Math.min(1, t);           // 응집량에 따라 커지는 결정
    const hue = (species * 360 / 12) % 360;        // 종마다 다른 색상(생성 다양성)
    // 날것(raw)은 채도를 죽이고 점선 외곽으로 "아직 못 먹는 재료"로 구분한다(feature-0011). 요리되면 선명한 결정으로.
    const sat = raw ? 20 : 85;
    this.#stick(cam, cx, cy, cz, `hsla(${hue},${raw ? 15 : 80}%,70%,0.35)`); // 지면까지 수선 — 고도·위치 가독성
    const V = [[cx + r, cy, cz], [cx - r, cy, cz], [cx, cy + r, cz], [cx, cy - r, cz], [cx, cy, cz + r], [cx, cy, cz - r]];
    const P = V.map(v => this.#pt(cam, v[0], v[1], v[2]));
    if (P.some(p => !p)) return;
    // 8 삼각면 (위쪽 4 + 아래쪽 4). 밝은 반투명 + 선명한 외곽선 → 고체 결정감.
    const faces = [[4, 0, 2], [4, 2, 1], [4, 1, 3], [4, 3, 0], [5, 2, 0], [5, 1, 2], [5, 3, 1], [5, 0, 3]];
    ctx.fillStyle = `hsla(${hue}, ${sat}%, ${58 + t * 20}%, ${(raw ? 0.18 : 0.34) + 0.4 * t})`;
    ctx.strokeStyle = `hsla(${hue}, ${raw ? 30 : 95}%, 82%, ${0.6 + 0.35 * t})`;
    ctx.lineWidth = crafted ? 2.4 : 1.5;             // 제조 산물(feature-0010 step2)은 굵은 외곽으로 "만들어진 것" 강조
    if (raw) ctx.setLineDash([4, 3]); // 날것 = 점선(미완성 느낌)
    for (const f of faces) {
      ctx.beginPath();
      ctx.moveTo(P[f[0]].sx, P[f[0]].sy);
      ctx.lineTo(P[f[1]].sx, P[f[1]].sy);
      ctx.lineTo(P[f[2]].sx, P[f[2]].sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // 제조 산물은 밝은 겹고리로 한 번 더 감싼다("가공된 결정" — 원석·날것과 구분).
    if (crafted) {
      const c4 = P[4];
      ctx.strokeStyle = `hsla(${hue}, 95%, 88%, 0.9)`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(c4.sx, c4.sy, r * 0.5, 0, 7); ctx.stroke();
    }
    // 잔고 라벨 (결정 위) — 날것이면 "날것", 제조 산물이면 "✦제조" 표식
    const top = P[4];
    if (top) {
      ctx.fillStyle = `hsl(${hue}, ${raw ? 25 : 90}%, 88%)`;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      const tag = crafted ? '✦제조 ' : raw ? '⋯날것 ' : '◆ ';
      ctx.fillText(`${tag}${bal.toLocaleString()}`, top.sx, top.sy - 6);
      ctx.textAlign = 'left';
    }
  }

  // 생명체 마커 — feature-0006. 각 살아있는 생명체를 제 위치에 따뜻한 구체로 그린다(먼 것부터, painter's).
  //   정적 결정(옥타)·차가운 확산장(큐브)과 대비되는 살아있는 형태. 색은 활력(잔고/용량)에 따라
  //   건강한 초록(가득)→굶주린 붉음(임계 근처)으로 변한다 — 갈구가 대사를 못 따라가면 붉어지다 죽는다.
  //   잔고는 스스로 도는 항상성의 결과다: 세계가 풍요로우면 가득 차 안정, 고갈되면 말라 붕괴한다.
  #creatureMarkers(cam) {
    const { state } = this;
    if (!state.creatures || state.creatures.size === 0) return;
    const marks = [];
    for (const c of state.creatures.values()) {
      if (c.balance <= 0) continue;
      const d = this.#toCam(cam, c.x, c.y, c.z)[2];
      if (d > 1) marks.push({ ...c, d });
    }
    marks.sort((a, b) => b.d - a.d);
    // 욕망 표적선 먼저(마커 아래 깔리게) — 각 제어 생명체가 무엇을 향하는지 보인다(제어=욕망→이동의 시각화).
    for (const m of marks) this.#desireLink(cam, m);
    for (const m of marks) this.#creatureOrb(cam, m, m.d);
  }

  // 욕망 표적선 (feature-0010) — 욕망이 있는 생명체에서 그 표적(채집=결정·사냥=더 작은 생명체)까지 옅은 선.
  //   "이 생명체가 저것을 원해 저리로 간다"가 한눈에 보인다. 표적은 미러에서 유도(표시 전용, 서버 규칙 미러).
  #desireLink(cam, cre) {
    if (cre.desire !== 'forage' && cre.desire !== 'hunt' && cre.desire !== 'eat' && cre.desire !== 'craft') return;
    const t = this.#desireTargetPos(cre);
    if (!t) return;
    const { ctx } = this;
    const mine = cre.owner && cre.owner === this.state.playerId;
    const a = mine ? 0.7 : 0.3;
    ctx.strokeStyle = cre.desire === 'hunt' ? `rgba(230,120,90,${a})` : cre.desire === 'eat' ? `rgba(240,180,90,${a})` : cre.desire === 'craft' ? `rgba(180,150,235,${a})` : `rgba(120,220,150,${a})`;
    ctx.lineWidth = mine ? 2 : 1;
    ctx.setLineDash([4, 4]);
    this.#seg(cam, cre.x, cre.y, cre.z, t.x, t.y, t.z);
    ctx.setLineDash([]);
  }

  // 욕망 표적 위치 유도 — 서버 #desireTarget 의 미러(표시 전용). 채집=감지 반경 안 가장 가까운 결정,
  //   사냥=감지 반경 안 가장 가까운 더 작은 생명체. (feature-0010)
  #desireTargetPos(cre) {
    let best = null, bestD = CREATURE_SEEK_RADIUS;
    if (cre.desire === 'forage' || cre.desire === 'eat' || cre.desire === 'craft') {
      // 채집=먹을 수 있는 결정만 / 식사=아무 결정이나 / 제조=재료(raw, 아직 산물 아닌 결정) (feature-0011·0010 step2)
      for (const c of this.state.crystals.values()) {
        if (c.balance <= 0 || (cre.desire === 'forage' && c.raw) || (cre.desire === 'craft' && (!c.raw || c.crafted))) continue;
        const d = dist3(cre.x, cre.y, cre.z, c.x, c.y, c.z);
        if (d <= bestD) { best = c; bestD = d; }
      }
    } else if (cre.desire === 'hunt') {
      for (const v of this.state.creatures.values()) {
        if (v === cre || (v.size ?? 1) >= (cre.size ?? 1) || v.balance <= 0) continue;
        const d = dist3(cre.x, cre.y, cre.z, v.x, v.y, v.z);
        if (d <= bestD) { best = v; bestD = d; }
      }
    }
    return best;
  }

  #creatureOrb(cam, cre, depth) {
    const { ctx } = this;
    const { x: cx, y: cy, z: cz, balance: bal, size = 1, desire = 'none' } = cre;
    const p = this.#pt(cam, cx, cy, cz);
    if (!p) return;
    const mine = cre.owner && cre.owner === this.state.playerId;     // 내가 제어하는 생명체
    const cap = CREATURE_MAX_ENERGY * size;                          // 용량은 스탯(size)에 비례
    const vit = Math.max(0, Math.min(1, bal / cap));                 // 활력 = 잔고/용량
    const starving = bal < CREATURE_DEATH_THRESHOLD * size * 3;      // 임계 근처면 굶주림 경고색(예비도 size 비례)
    const hue = starving ? 8 + 60 * (bal / (CREATURE_DEATH_THRESHOLD * size * 3)) : 95 + 40 * vit; // 붉음→초록
    const scale = this.focal / depth;
    const r = Math.max(4, (8 + 5 * size + 8 * vit) * scale);         // 스탯이 높을수록 큰 몸
    this.#stick(cam, cx, cy, cz, `hsla(${hue},70%,60%,0.4)`);        // 지면까지 수선(고도 가독성)
    // 살아있는 광채 — 안쪽 밝은 코어 + 바깥 후광(맥동감)
    const glow = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 1.8);
    glow.addColorStop(0, `hsla(${hue},90%,${60 + 20 * vit}%,0.95)`);
    glow.addColorStop(1, `hsla(${hue},85%,55%,0)`);
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, r * 1.8, 0, 7); ctx.fill();
    ctx.fillStyle = `hsl(${hue},85%,${58 + 18 * vit}%)`;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, 7); ctx.fill();
    ctx.strokeStyle = `hsla(${hue},95%,85%,0.9)`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, 7); ctx.stroke();
    // 내가 제어하는 생명체 — 금색 고리로 강조(내 아바타를 한눈에 찾는다)
    if (mine) {
      ctx.strokeStyle = '#ffd76e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.sx, p.sy, r + 5, 0, 7); ctx.stroke();
    }
    // 에너지(질서) 막대 + 스탯·잔고 라벨
    this.#bar(p.sx, p.sy - r - 6, 34 * scale, vit, `hsl(${hue},80%,70%)`);
    if (scale > 0.4) {
      ctx.fillStyle = `hsl(${hue},85%,88%)`;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${'❋'.repeat(size)} ${bal}`, p.sx, p.sy - r - 10); // 스탯 = ❋ 개수
      // 욕구 스택 라벨 (feature-0012) — 중첩된 욕구를 **우선순위 순으로 쌓아** 그린다. 승자(맨 위·최우선, ▸)는
      //   밝게(내 것이면 금색), 나머지(·)는 흐리게 — "욕구는 중첩되고 우선순위가 다르다"가 한눈에. 감정(중요도
      //   증폭)은 ♥ 개수로 표시한다("감정은 중요도다"). 스택이 비었으면 단일 desire(하위 호환)만 그린다.
      const stack = (cre.desires && cre.desires.length) ? cre.desires
        : (desire && desire !== 'none' ? [[desire, 1, 0]] : []);
      for (let i = 0; i < stack.length; i++) {
        const [name, , emotion = 0, feeling = 0] = stack[i];
        const top = i === 0;
        const base = name === 'hunt' ? '#e6785a' : name === 'eat' ? '#f0b45a' : name === 'forage' ? '#78dc96' : name === 'craft' ? '#b496eb' : '#9fb4c8';
        ctx.fillStyle = top ? (mine ? '#ffd76e' : base) : `${base}88`; // 승자는 선명, 나머지는 반투명
        // 중요도(감정) = 외생 emotion + 자율 feeling(굶주림 등 상황이 스스로 만든 감정, feature-0012 step2). ♥ 개수로.
        const importance = emotion + feeling;
        const heart = importance > 0 ? ' ' + '♥'.repeat(Math.min(3, Math.ceil(importance / 30))) : '';
        ctx.fillText(`${top ? '▸' : '·'} ${DESIRE_LABEL[name] ?? name}${heart}`, p.sx, p.sy - r - 22 - i * 12);
      }
      ctx.textAlign = 'left';
    }
  }

  // 상태별 색 — 기체(옅은 하늘빛, 퍼짐) · 액체(진한 물빛, 불투명↑ = 고인 느낌) · 고밀도(붉은 열). feature-0005 step4.
  #voxelCube(cam, x0, x1, y0, y1, z0, z1, t, phase) {
    const V = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
               [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const P = V.map(v => this.#pt(cam, v[0], v[1], v[2]));
    if (P.some(p => !p)) return; // 카메라 뒤 복셀 생략(근사)
    const { ctx } = this;
    let hue, light, fillA, strokeA;
    if (phase === 'liquid') { hue = 200; light = 52 + t * 12; fillA = 0.34 + 0.34 * t; strokeA = 0.5 + 0.4 * t; }
    else if (phase === 'dense') { hue = 12; light = 50 + t * 16; fillA = 0.30 + 0.34 * t; strokeA = 0.5 + 0.4 * t; }
    else { hue = 205; light = 46 + t * 12; fillA = 0.06 + 0.16 * t; strokeA = 0.16 + 0.30 * t; } // gas
    ctx.fillStyle = `hsla(${hue}, 90%, ${light}%, ${fillA})`;
    ctx.strokeStyle = `hsla(${hue}, 95%, 72%, ${strokeA})`;
    ctx.lineWidth = 1;
    for (const f of [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]]) {
      ctx.beginPath();
      ctx.moveTo(P[f[0]].sx, P[f[0]].sy);
      for (let i = 1; i < 4; i++) ctx.lineTo(P[f[i]].sx, P[f[i]].sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // 높이 스틱 — 엔티티에서 지면(z=0)까지 수선 (고도 가독성)
  #stick(cam, x, y, z, color) {
    const { ctx } = this;
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    this.#seg(cam, x, y, 0, x, y, z);
    ctx.setLineDash([]);
    const g = this.#pt(cam, x, y, 0);
    if (g) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(g.sx, g.sy, 5, 2.5, 0, 0, 7); ctx.fill(); }
  }

  #drawEntity(cam, e, depth) {
    const { ctx } = this;
    const p = this.#pt(cam, e.x, e.y, e.z);
    if (!p) return;
    const scale = this.focal / depth;
    const bal = this.state.ledger.balance(e.id);
    this.#stick(cam, e.x, e.y, e.z, 'rgba(90,167,217,0.4)');
    ctx.fillStyle = '#5aa7d9';
    ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(3, 10 * scale), 0, 7); ctx.fill();
    this.#bar(p.sx, p.sy - 12 * scale, 30 * scale, bal / PLAYER_MAX_ENERGY, '#7ec3ea');
    this.#label(p.sx, p.sy - 20 * scale, e.name ?? '', '#bcd8ea', scale);
  }

  #drawSelf(cam) {
    const { ctx, sim } = this;
    this.#stick(cam, sim.x, sim.y, sim.z, 'rgba(255,215,110,0.5)');
    const p = this.#pt(cam, sim.x, sim.y, sim.z);
    if (!p) return;
    const scale = this.focal / this.#toCam(cam, sim.x, sim.y, sim.z)[2];
    ctx.fillStyle = '#f0f4f8';
    ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(4, 11 * scale), 0, 7); ctx.fill();
    ctx.strokeStyle = '#ffd76e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(6, 14 * scale), 0, 7); ctx.stroke();
  }

  #label(x, y, text, color, scale) {
    if (scale < 0.35 || !text) return;
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.font = `${Math.max(9, Math.round(11 * Math.min(1.4, scale)))}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
  }

  #bar(cx, y, width, ratio, color) {
    if (width < 6) return;
    const { ctx } = this;
    ctx.fillStyle = '#2a3040';
    ctx.fillRect(cx - width / 2, y, width, 4);
    ctx.fillStyle = color;
    ctx.fillRect(cx - width / 2, y, width * Math.max(0, Math.min(1, ratio)), 4);
  }

  #hud() {
    const { ctx, w, state, net, sim } = this;
    ctx.textAlign = 'left';

    // 좌상: 내 에너지 + 고도
    const energy = state.ledger.balance(state.playerId);
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    ctx.fillRect(10, 10, 270, 56);
    ctx.fillStyle = '#e8eef4';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${state.myName}  에너지 ${energy} / ${PLAYER_MAX_ENERGY}  ·  고도 ${Math.round(sim.z)}`, 20, 30);
    ctx.fillStyle = '#2a3040'; ctx.fillRect(20, 40, 250, 10);
    ctx.fillStyle = energy > 200 ? '#6fd08c' : '#d97b6f';
    ctx.fillRect(20, 40, 250 * energy / PLAYER_MAX_ENERGY, 10);

    // 좌상 아래: 제어(feature-0010) — 내가 제어하는 생명체 + 현재 욕망. 욕망이 이동을 부르고, 이동은 에너지로 지불된다.
    let mine = null;
    for (const c of state.creatures.values()) if (c.owner && c.owner === state.playerId) { mine = c; break; }
    const desire = mine?.desire ?? state.myDesire ?? 'none';
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    ctx.fillRect(10, 72, 270, 40);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#ffd76e';
    if (mine) ctx.fillText(`❋ 내 생명체 ${'❋'.repeat(mine.size ?? 1)} E${mine.balance}`, 20, 88);
    else ctx.fillText(`❋ 내 생명체 (없음)`, 20, 88);
    ctx.fillStyle = '#8fd9a8';
    ctx.fillText(`욕망 ▸ ${DESIRE_LABEL[desire] ?? desire}   (1채집 2사냥 3식사 4제조 0대기)`, 20, 104);

    // 우상: 보존 불변식 + 에너지 등급(태양·국소장·결정·생명체·심우주) 전시 + 네트워크 계측
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    ctx.fillRect(w - 265, 10, 255, 172);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#8fd9a8';
    ctx.fillText(`세계 총 에너지 ${state.worldTotal.toLocaleString()}`, w - 255, 28);
    ctx.fillStyle = '#9db2c4';
    ctx.fillText(`(창세 이후 불변 = 보존 법칙)`, w - 255, 44);
    // feature-0004: 태양(고)→국소장(중, 확산)→심우주(저, 손실) · feature-0005: 결정(석출, 정적·면역) · feature-0006: 생명체(대사로 질서 유지)
    ctx.fillStyle = '#e0b34e';
    ctx.fillText(`☀ 태양 ${state.worldSrc.toLocaleString()}  ·  국소장 ${state.worldMaterial.toLocaleString()}`, w - 255, 60);
    ctx.fillStyle = '#7cebd8';
    ctx.fillText(`◆ 결정(정적) ${state.worldCrystal.toLocaleString()}`, w - 255, 76);
    ctx.fillStyle = '#8fe6a0';
    ctx.fillText(`❋ 생명체(능동) ${state.worldCreature.toLocaleString()}`, w - 255, 92);
    ctx.fillStyle = '#7a8aa0';
    ctx.fillText(`심우주(손실) ${state.worldSink.toLocaleString()}  ↑엔트로피`, w - 255, 108);
    ctx.fillStyle = '#6b7a8c';
    ctx.font = '10px monospace';
    ctx.fillText(`상태: 기체·액체·고체 · 생명체(갈구↔대사)`, w - 255, 122);
    ctx.font = '12px monospace';
    ctx.fillStyle = state.checksumStatus === 'OK' ? '#8fd9a8' : '#e0b34e';
    ctx.fillText(`지역 체크섬 ${state.checksumStatus}`, w - 255, 140);
    ctx.fillStyle = '#9db2c4';
    ctx.fillText(`수신 ${net.bytesPerSec.toLocaleString()} B/s`, w - 255, 156);

    // 좌하: tx 피드 — 동기화되는 것의 전부
    ctx.font = '11px monospace';
    let ty = this.h - 14 - state.txFeed.length * 14;
    ctx.fillStyle = 'rgba(10,14,20,0.75)';
    ctx.fillRect(8, ty - 30, 260, state.txFeed.length * 14 + 34);
    ctx.fillStyle = '#5f7285';
    ctx.fillText('― 원장 tx 스트림 ―', 14, ty - 14);
    for (const tx of state.txFeed) {
      ctx.fillStyle = tx.to === state.playerId ? '#8fd9a8'
                    : tx.from === state.playerId ? '#d99a8f' : '#77879a';
      ctx.fillText(
        `[${CAUSE_LABEL[tx.cause] ?? tx.cause}] ${poolLabel(state, tx.from)} → ${poolLabel(state, tx.to)}  ${tx.amount}`,
        14, ty);
      ty += 14;
    }

    // 우하: 조작
    ctx.textAlign = 'right';
    ctx.fillStyle = '#5f7285';
    ctx.font = '11px sans-serif';
    ctx.fillText('WASD/방향키 이동 · R/F 상하 · 드래그 회전 · 휠 줌 · 1채집 2사냥 3식사 0대기', w - 14, this.h - 12);
    ctx.textAlign = 'left';
  }
}
