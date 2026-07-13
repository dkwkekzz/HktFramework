// ============================================================================
// Render — 3D 원근 투영 시각화 (Canvas 2D 위 소프트웨어 카메라, 외부 의존 0).
//
// 불변 원칙 ③: 렌더러는 **순수·교체 가능한 Scene 소비자**다. ViewModel 이 만든 Scene
//   (정규화된 세계 속성 + 이펙트 서술자)만 받아 그린다 — 원장/스냅샷/sim 상태를 직접 읽지
//   않고, 세계 규칙(표적·acting·활력…)을 재유도하지 않는다. 여기 남는 것은 카메라·투영·
//   캔버스 드로잉과 **의미→표현 매핑**(색·모양·아이콘·라벨)뿐. 미래의 리치 렌더 모듈은 같은
//   Scene 을 받아 다르게 그린다.
//
//   z 는 높이(up), x·y 는 지면. 카메라: 내 생명체(없으면 자아 점)를 도는 orbit(드래그=회전,
//   휠=줌). HUD 는 화면공간 유지. 클릭/터치=표적 지목(Scene 개체로 히트테스트).
// ============================================================================

import { WORLD_SIZE, WORLD_HEIGHT, REGION_SIZE, FIELD_Z_LAYERS, PLAYER_MAX_ENERGY } from '../shared/constants.js';

// --- 의미 이름 → 표현 매핑 (렌더러 소유) ---
const CAUSE_LABEL = { spawn: '스폰', move: '이동', death: '소멸', diffuse: '확산', radiate: '복사', crystallize: '결정화', react: '반응', forage: '갈구', metabolize: '대사', harvest: '채집', attack: '강탈', burst: '발산', emit: '발산', detonate: '폭발', discharge: '방출', cook: '요리', craft: '제조', heat: '가열', combust: '연소', melt: '용해', shatter: '파괴' };
// 욕구 라벨/색/아이콘 — 뷰어가 각 생명체 위에 그 동기를 또렷이 적는다(전략 수단 + 동기 이름 hunger·safety·order 공용).
const DESIRE_LABEL = { forage: '채집', hunt: '사냥', none: '대기', eat: '식사', craft: '제조', flee: '회피', hunger: '허기', safety: '안전', order: '질서' };
const DESIRE_ICON  = { forage: '🌿', hunt: '⚔', none: '✋', eat: '🍚', craft: '🔨', flee: '🏃', hunger: '🍖', safety: '🛡', order: '⚙' };
// 욕구별 대표색 — 표적선·오라·아이콘·버튼이 공유해 "어느 욕구인지"가 색으로도 한눈에 갈린다.
const DESIRE_COLOR = { forage: '#78dc96', hunt: '#e6785a', eat: '#f0b45a', craft: '#b496eb', flee: '#7fc7ff', none: '#9fb4c8' };
const DESIRE_RGB   = { forage: [120,220,150], hunt: [230,120,90], eat: [240,180,90], craft: [180,150,235], flee: [127,199,255], none: [159,180,200] };
// 고정 라벨 없는 종류(파이어볼·열·플레이어)는 원 id 로 떨어진다(구 poolLabel else 분기와 동일).
const KIND_LABEL = { self: '나', source: '태양', sink: '심우주', material: '국소장', crystal: '결정', creature: '생명체' };

function txLabel(ep) { return KIND_LABEL[ep.kind] ?? ep.name ?? ep.id; }

export class Render {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width;
    this.h = canvas.height;
    this.scene = null;                   // 마지막 프레임 Scene(클릭 피킹의 히트테스트에 쓴다)
    this.lastCam = null;                 // 마지막 프레임 카메라(클릭 피킹의 화면투영에 쓴다)
    this.onSelectTarget = null;          // (sel) => void — 클릭 지정 표적을 서버로(main.js 결선)

    // orbit 카메라 (z-up). yaw=방위각, pitch=올려본 각, dist=거리.
    this.yaw = -Math.PI * 0.75;
    this.pitch = 0.55;
    this.dist = 620;
    this.focal = this.h * 0.9;

    // 입력: 드래그 회전 · 휠 줌 · **클릭/터치=표적 지목**.
    //   드래그(회전)와 클릭(지목)을 이동거리로 가른다: 누른 뒤 6px 미만 움직이면 클릭=피킹, 그 이상이면 회전.
    let drag = null, moved = 0, downXY = null;
    const onDown = (x, y) => { drag = { x, y }; downXY = { x, y }; moved = 0; };
    const onMove = (x, y) => {
      if (!drag) return;
      moved += Math.abs(x - drag.x) + Math.abs(y - drag.y);
      this.yaw -= (x - drag.x) * 0.006;
      // pitch: 내려다보기(+)·올려다보기(−) 모두 허용. 정확히 ±π/2 면 right 축 붕괴 → 그 안쪽으로 클램프.
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch + (y - drag.y) * 0.005));
      drag = { x, y };
    };
    const onUp = (x, y) => {
      if (downXY && moved < 6) this.#pickAt(x, y); // 거의 안 움직였으면 클릭 = 표적 지목
      drag = null; downXY = null;
    };
    canvas.addEventListener('mousedown', (e) => onDown(e.clientX, e.clientY));
    addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    addEventListener('mouseup', (e) => onUp(e.clientX, e.clientY));
    // 터치 — 한 손가락 탭=지목, 드래그=회전(마우스와 동일 처리).
    canvas.addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t) onDown(t.clientX, t.clientY); }, { passive: true });
    canvas.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); }, { passive: true });
    canvas.addEventListener('touchend', (e) => { const t = e.changedTouches[0]; if (t) onUp(t.clientX, t.clientY); });
    canvas.addEventListener('wheel', (e) => {
      this.dist = Math.max(150, Math.min(1600, this.dist * (1 + Math.sign(e.deltaY) * 0.12)));
      e.preventDefault();
    }, { passive: false });
  }

  // 클릭/터치 피킹 — 화면 좌표에 가장 가까운 결정·생명체를 골라 표적으로 지목한다(서버로 TARGET).
  //   Scene 개체(월드 중심)를 화면에 투영(#pt)해 클릭점과의 픽셀 거리로 고른다. 임계 밖이면 **빈 곳** = 해제.
  //   생명체를 결정보다 우선(작은 먹이 클릭이 뒤 결정에 가리지 않게). 캔버스 CSS 스케일 보정.
  #pickAt(clientX, clientY) {
    const cam = this.lastCam, scene = this.scene; if (!cam || !scene || !this.onSelectTarget) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = (clientX - rect.left) * (this.w / rect.width);
    const my = (clientY - rect.top) * (this.h / rect.height);
    const THRESH = 46; // 픽셀 임계(터치 여유)
    let best = null, bestD = THRESH;
    for (const c of scene.creatures) { // 생명체 우선
      const p = this.#pt(cam, c.pos.x, c.pos.y, c.pos.z); if (!p) continue;
      const d = Math.hypot(p.sx - mx, p.sy - my);
      if (d < bestD) { bestD = d; best = { kind: 'creature', seq: c.id }; }
    }
    for (const c of scene.crystals) {
      const p = this.#pt(cam, c.pos.x, c.pos.y, c.pos.z); if (!p) continue;
      const d = Math.hypot(p.sx - mx, p.sy - my);
      if (d < bestD) { bestD = d; best = { kind: 'crystal', seq: c.id }; }
    }
    this.onSelectTarget(best ?? { kind: 'none' }); // 빈 곳 클릭 = 지정 해제(대기)
  }

  // --- 카메라 기저 (target = 내 생명체, 없으면 자아 점) ---
  #camera(scene) {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const fwd = [cp * Math.cos(this.yaw), cp * Math.sin(this.yaw), -sp];
    const mine = scene.self.creature;
    const t = mine ? mine.pos : scene.self.pos;
    const target = [t.x, t.y, t.z + 20];
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

  // 매 프레임 Scene 을 그린다(순수 소비 — 상태 조회 없음).
  draw(scene) {
    const { ctx, w, h } = this;
    this.scene = scene;
    this.t = scene.t; // 애니메이션 위상(펄스·마칭앤츠)
    const cam = this.#camera(scene);
    this.lastCam = cam; // 클릭 피킹이 쓰는 화면투영 기저

    ctx.fillStyle = '#0a0d13';
    ctx.fillRect(0, 0, w, h);

    // 지면(z=0) 지역 격자
    ctx.strokeStyle = '#2a3446';
    ctx.lineWidth = 1;
    for (let g = 0; g <= WORLD_SIZE; g += REGION_SIZE) {
      this.#seg(cam, g, 0, 0, g, WORLD_SIZE, 0);
      this.#seg(cam, 0, g, 0, WORLD_SIZE, g, 0);
    }

    // 국소장 3D 볼류메트릭 — 각 복셀을 농도에 따라 글로우로 (에너지 확산을 3D 로)
    this.#fieldVolume(cam, scene.field);
    // 결정 마커 — 석출돼 동결된 정적 에너지 (feature-0005)
    this.#crystalMarkers(cam, scene.crystals);
    // 생명체 마커 — 스스로 질서를 유지하는 저엔트로피 섬 (feature-0006)
    this.#creatureMarkers(cam, scene.creatures);
    // 파이어볼 마커 — 발산이 쏜 투사체 (feature-0009)
    this.#fireballMarkers(cam, scene.fireballs);

    // 엔티티(다른 플레이어) + 자아, 깊이순(먼 것 먼저)
    const draws = [];
    for (const p of scene.players) {
      const c = this.#toCam(cam, p.pos.x, p.pos.y, p.pos.z);
      if (c[2] > 1) draws.push({ player: p, cam: c });
    }
    const selfC = this.#toCam(cam, scene.self.pos.x, scene.self.pos.y, scene.self.pos.z);
    if (selfC[2] > 1) draws.push({ self: true, cam: selfC });
    draws.sort((a, b) => b.cam[2] - a.cam[2]);
    for (const d of draws) {
      if (d.self) { this.#drawSelf(cam, scene.self); continue; }
      this.#drawEntity(cam, d.player, d.cam[2]);
    }

    this.#hud(scene);
  }

  // 국소장 3D 볼류메트릭 — 각 복셀을 상태별 색으로(먼 것부터). 기체·액체·고밀도(열).
  #fieldVolume(cam, cells) {
    if (!cells.length) return;
    const RS = REGION_SIZE, LS = WORLD_HEIGHT / FIELD_Z_LAYERS, m = 0.02; // 셀 경계 얇은 실선용 미세 여백
    const marks = [];
    for (const c of cells) {
      const d = this.#toCam(cam, (c.cell.cx + 0.5) * RS, (c.cell.cy + 0.5) * RS, (c.cell.cz + 0.5) * LS)[2];
      marks.push({ ...c, d });
    }
    marks.sort((a, b) => b.d - a.d); // 먼 복셀 먼저
    for (const c of marks) {
      this.#voxelCube(cam,
        (c.cell.cx + m) * RS, (c.cell.cx + 1 - m) * RS,
        (c.cell.cy + m) * RS, (c.cell.cy + 1 - m) * RS,
        (c.cell.cz + m) * LS, (c.cell.cz + 1 - m) * LS, c.magnitude, c.phase);
    }
  }

  // 결정 마커 — 각 결정을 8면체(옥타)로(먼 것부터). 색은 종(species)마다 다르다.
  #crystalMarkers(cam, list) {
    if (!list.length) return;
    const marks = [];
    for (const c of list) {
      const d = this.#toCam(cam, c.pos.x, c.pos.y, c.pos.z)[2];
      if (d > 1) marks.push({ ...c, d });
    }
    marks.sort((a, b) => b.d - a.d);
    for (const m of marks) this.#crystalOcta(cam, m.pos.x, m.pos.y, m.pos.z, m.magnitude, m.energy, m.species, m.raw, m.crafted, m.tier, m.burning, m.heat);
  }

  #crystalOcta(cam, cx, cy, cz, t, bal, species, raw, crafted, tier = 0, burning = false, hot = 0) {
    const { ctx } = this;
    const r = 24 + 90 * Math.min(1, t);           // 응집량에 따라 커지는 결정
    const hue = burning ? 16 : (species * 360 / 12) % 360;   // feature-0013: 연소=적열(주황), 아니면 종 색
    // 날것(raw)은 채도를 죽이고 점선 외곽으로 "아직 못 먹는 재료"로 구분. 요리되면 선명한 결정으로.
    const sat = burning ? 95 : (raw ? 20 : 85);   // feature-0013: 연소=고채도
    this.#stick(cam, cx, cy, cz, `hsla(${hue},${raw ? 15 : 80}%,70%,0.35)`); // 지면까지 수선 — 고도·위치 가독성
    const V = [[cx + r, cy, cz], [cx - r, cy, cz], [cx, cy + r, cz], [cx, cy - r, cz], [cx, cy, cz + r], [cx, cy, cz - r]];
    const P = V.map(v => this.#pt(cam, v[0], v[1], v[2]));
    if (P.some(p => !p)) return;
    // 8 삼각면 (위쪽 4 + 아래쪽 4). 밝은 반투명 + 선명한 외곽선 → 고체 결정감.
    const faces = [[4, 0, 2], [4, 2, 1], [4, 1, 3], [4, 3, 0], [5, 2, 0], [5, 1, 2], [5, 3, 1], [5, 0, 3]];
    ctx.fillStyle = `hsla(${hue}, ${sat}%, ${58 + t * 20}%, ${(raw ? 0.18 : 0.34) + 0.4 * t})`;
    ctx.strokeStyle = `hsla(${hue}, ${raw ? 30 : 95}%, 82%, ${0.6 + 0.35 * t})`;
    ctx.lineWidth = crafted ? 2.4 : 1.5;             // 제조 산물은 굵은 외곽으로 "만들어진 것" 강조
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
    // feature-0013: 달아오름(hot)·연소(burning) 글로우 — 뜨거울수록 주황 halo, 연소 중이면 밝은 적열.
    const fire = burning ? 1 : Math.min(1, hot || 0);
    if (fire > 0.02) {
      const ctr = this.#pt(cam, cx, cy, cz);
      if (ctr) {
        ctx.strokeStyle = `hsla(${burning ? 14 : 32}, 100%, ${burning ? 60 : 70}%, ${0.2 + 0.55 * fire})`;
        ctx.lineWidth = 2 + 3 * fire;
        ctx.beginPath(); ctx.arc(ctr.sx, ctr.sy, r * (0.75 + 0.7 * fire), 0, 7); ctx.stroke();
      }
    }
    // 제조 산물은 밝은 겹고리로 감싼다. 단계(tier)만큼 고리를 더 그린다.
    if (crafted) {
      const c4 = P[4];
      ctx.strokeStyle = `hsla(${hue}, 95%, 88%, 0.9)`; ctx.lineWidth = 1;
      for (let k = 1; k <= tier; k++) { ctx.beginPath(); ctx.arc(c4.sx, c4.sy, r * (0.4 + 0.18 * k), 0, 7); ctx.stroke(); }
    }
    // 잔고 라벨 (결정 위) — 날것=재료, 제조 산물은 단계별 ✦중간(tier1)·✦✦완성(tier2) 표식
    const top = P[4];
    if (top) {
      ctx.fillStyle = `hsl(${hue}, ${raw ? 25 : 90}%, 88%)`;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      const tag = crafted ? (tier >= 2 ? '✦✦완성 ' : '✦중간 ') : raw ? '⋯재료 ' : '◆ ';
      ctx.fillText(`${tag}${bal.toLocaleString()}`, top.sx, top.sy - 6);
      ctx.textAlign = 'left';
    }
  }

  // 파이어볼 마커 — feature-0009. 발산이 쏜 투사체를 밝은 불덩이(백열 코어 + 주황 halo)로.
  #fireballMarkers(cam, list) {
    const { ctx } = this;
    if (!list.length) return;
    const marks = [];
    for (const fb of list) {
      const p = this.#pt(cam, fb.pos.x, fb.pos.y, fb.pos.z);
      if (p) marks.push({ p, size: fb.size || 1, d: this.#toCam(cam, fb.pos.x, fb.pos.y, fb.pos.z)[2] });
    }
    marks.sort((a, b) => b.d - a.d); // 먼 것부터(painter's)
    for (const m of marks) {
      const scale = this.focal / m.d;                     // 원근 축소(생명체 마커와 같은 방식)
      const r = Math.max(3, (7 + 4 * m.size) * scale);    // size 에 따라 커지는 불덩이
      const g = ctx.createRadialGradient(m.p.sx, m.p.sy, 0, m.p.sx, m.p.sy, r * 2.4);
      g.addColorStop(0, 'rgba(255,250,230,0.98)'); // 백열 코어
      g.addColorStop(0.35, 'rgba(255,150,40,0.85)'); // 주황
      g.addColorStop(1, 'rgba(255,80,0,0)');          // 사라지는 halo
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(m.p.sx, m.p.sy, r * 2.4, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,245,0.95)';
      ctx.beginPath(); ctx.arc(m.p.sx, m.p.sy, r * 0.5, 0, 7); ctx.fill(); // 밝은 심
    }
  }

  // 생명체 마커 — feature-0006. 각 생명체를 따뜻한 구체로(먼 것부터). 색은 활력에 따라 초록↔붉음.
  #creatureMarkers(cam, list) {
    if (!list.length) return;
    const marks = [];
    for (const c of list) {
      const d = this.#toCam(cam, c.pos.x, c.pos.y, c.pos.z)[2];
      if (d > 1) marks.push({ v: c, d });
    }
    marks.sort((a, b) => b.d - a.d);
    for (const m of marks) this.#desireLink(cam, m.v);   // 표적선 먼저(마커 아래 깔리게)
    for (const m of marks) this.#creatureOrb(cam, m.v, m.d);
  }

  // 욕망 표적선 — 욕망이 있는 생명체에서 그 표적까지 옅은 선(ViewModel 이 target 을 미리 계산).
  #desireLink(cam, v) {
    const desire = v.motive.name;
    if (desire !== 'forage' && desire !== 'hunt' && desire !== 'eat' && desire !== 'craft') return;
    if (!v.target) return;
    const t = v.target.pos;
    const { ctx } = this;
    const mine = v.faction === 'mine';
    const [r, g, b] = DESIRE_RGB[desire] ?? DESIRE_RGB.none;
    const a = mine ? 0.95 : 0.28;
    ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
    ctx.lineWidth = mine ? 3 : 1;
    // 내 생명체의 표적선 = 마칭앤츠(흐르는 점선)로 방향·움직임 강조.
    ctx.setLineDash(mine ? [10, 8] : [4, 4]);
    if (mine && ctx.lineDashOffset !== undefined) ctx.lineDashOffset = -((this.t ?? 0) * 42) % 18;
    this.#seg(cam, v.pos.x, v.pos.y, v.pos.z, t.x, t.y, t.z);
    ctx.setLineDash([]);
    if (ctx.lineDashOffset !== undefined) ctx.lineDashOffset = 0;
    // 표적에 조준 고리 — 내 생명체가 무엇을 노리는지 콕 집는다(약동하는 고리).
    if (mine) {
      const tp = this.#pt(cam, t.x, t.y, t.z);
      if (tp) {
        const pulse = 10 + 4 * Math.sin((this.t ?? 0) * 5);
        ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(tp.sx, tp.sy, pulse, 0, 7); ctx.stroke();
      }
    }
  }

  #creatureOrb(cam, v, depth) {
    const { ctx } = this;
    const cx = v.pos.x, cy = v.pos.y, cz = v.pos.z, bal = v.energy, size = v.size, desire = v.motive.name;
    const p = this.#pt(cam, cx, cy, cz);
    if (!p) return;
    const mine = v.faction === 'mine';                              // 내가 제어하는 생명체
    const vit = v.vitality;                                         // 활력 = 잔고/용량
    const hue = v.starving ? 8 + 60 * v.starveT : 95 + 40 * vit;    // 붉음→초록
    const scale = this.focal / depth;
    const r = Math.max(4, (8 + 5 * size + 8 * vit) * scale);        // 스탯이 높을수록 큰 몸
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
    // 내가 제어하는 생명체 — 금색 고리(내 아바타) + 욕구 오라(지금 무엇을 원하는지 색·맥동으로)
    if (mine) {
      ctx.strokeStyle = '#ffd76e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.sx, p.sy, r + 5, 0, 7); ctx.stroke();
      // 욕구 오라 — 승자 욕구 색으로 바깥을 감싸는 맥동 고리. 표적 사거리 안(=행동 중)이면 더 밝게 번뜩.
      const dc = DESIRE_RGB[desire] ?? DESIRE_RGB.none;
      const acting = v.motive.acting;
      const pulse = (acting ? 0.6 : 0.35) + (acting ? 0.35 : 0.18) * (0.5 + 0.5 * Math.sin((this.t ?? 0) * (acting ? 9 : 3)));
      ctx.strokeStyle = `rgba(${dc[0]},${dc[1]},${dc[2]},${pulse})`;
      ctx.lineWidth = acting ? 5 : 3;
      ctx.beginPath(); ctx.arc(p.sx, p.sy, r + 12 + (acting ? 3 * Math.sin((this.t ?? 0) * 9) : 0), 0, 7); ctx.stroke();
    }
    // 에너지(질서) 막대 + 스탯·잔고 라벨
    this.#bar(p.sx, p.sy - r - 6, 34 * scale, vit, `hsl(${hue},80%,70%)`);
    if (scale > 0.4) {
      ctx.fillStyle = `hsl(${hue},85%,88%)`;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${'❋'.repeat(size)} ${bal}`, p.sx, p.sy - r - 10); // 스탯 = ❋ 개수
      // 욕구 스택 라벨 — 중첩된 욕구를 우선순위 순으로 쌓아 그린다. 승자(맨 위·▸)는 밝게, 나머지(·)는 흐리게.
      //   감정(중요도 증폭)은 ♥ 개수로. 스택이 비었으면 그리지 않는다(ViewModel 이 단일 desire 도 스택으로 채움).
      const stack = v.motive.stack;
      let yLabel = p.sy - r - 22;
      for (let i = 0; i < stack.length; i++) {
        const [name, , emotion = 0, feeling = 0] = stack[i];
        const top = i === 0;
        const base = DESIRE_COLOR[name] ?? DESIRE_COLOR.none;
        const importance = emotion + feeling;
        const heart = importance > 0 ? ' ' + '♥'.repeat(Math.min(3, Math.ceil(importance / 30))) : '';
        if (top) {
          ctx.font = `bold ${mine ? 14 : 11}px monospace`;
          ctx.fillStyle = mine ? '#ffe9b0' : base;
          ctx.fillText(`${DESIRE_ICON[name] ?? '▸'} ${DESIRE_LABEL[name] ?? name}${heart}`, p.sx, yLabel);
          ctx.font = '10px monospace';
          yLabel -= mine ? 17 : 13;
        } else {
          ctx.fillStyle = `${base}88`; // 하위 욕구는 반투명
          ctx.fillText(`· ${DESIRE_LABEL[name] ?? name}${heart}`, p.sx, yLabel);
          yLabel -= 12;
        }
      }
      ctx.textAlign = 'left';
    }
  }

  // 상태별 색 — 기체(옅은 하늘빛) · 액체(진한 물빛, 불투명↑) · 고밀도(붉은 열).
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
    const p = this.#pt(cam, e.pos.x, e.pos.y, e.pos.z);
    if (!p) return;
    const scale = this.focal / depth;
    this.#stick(cam, e.pos.x, e.pos.y, e.pos.z, 'rgba(90,167,217,0.4)');
    ctx.fillStyle = '#5aa7d9';
    ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(3, 10 * scale), 0, 7); ctx.fill();
    this.#bar(p.sx, p.sy - 12 * scale, 30 * scale, e.energy / PLAYER_MAX_ENERGY, '#7ec3ea');
    this.#label(p.sx, p.sy - 20 * scale, e.name ?? '', '#bcd8ea', scale);
  }

  #drawSelf(cam, self) {
    const { ctx } = this;
    const p = this.#pt(cam, self.pos.x, self.pos.y, self.pos.z);
    if (!p) return;
    const scale = this.focal / this.#toCam(cam, self.pos.x, self.pos.y, self.pos.z)[2];
    // 아바타 통합: 내가 생명체를 몰면 자아 점은 조향 레티클(방향키가 미는 목적지)일 뿐 — 은은한 십자 표식만.
    if (self.hasCreature) {
      const r = Math.max(3, 7 * scale);
      ctx.strokeStyle = 'rgba(255,215,110,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, 7); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.sx - r * 1.7, p.sy); ctx.lineTo(p.sx + r * 1.7, p.sy);
      ctx.moveTo(p.sx, p.sy - r * 1.7); ctx.lineTo(p.sx, p.sy + r * 1.7);
      ctx.stroke();
      return;
    }
    // 소유 생명체가 없을 때(관전 데모 등)만 예전 아바타 점을 그린다.
    this.#stick(cam, self.pos.x, self.pos.y, self.pos.z, 'rgba(255,215,110,0.5)');
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

  #hud(scene) {
    const { ctx, w } = this;
    const self = scene.self, world = scene.world;
    ctx.textAlign = 'left';

    // 좌상: 내 에너지 + 고도
    const energy = self.energy;
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    ctx.fillRect(10, 10, 270, 56);
    ctx.fillStyle = '#e8eef4';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${self.name}  에너지 ${energy} / ${PLAYER_MAX_ENERGY}  ·  고도 ${self.altitude}`, 20, 30);
    ctx.fillStyle = '#2a3040'; ctx.fillRect(20, 40, 250, 10);
    ctx.fillStyle = energy > 200 ? '#6fd08c' : '#d97b6f';
    ctx.fillRect(20, 40, 250 * energy / PLAYER_MAX_ENERGY, 10);

    // 좌상 아래: 제어 콜아웃 — 내 생명체 + 지금 무엇을 하는가(이동 중 / 행동 중 / 표적 없음).
    const mine = self.creature;
    const desire = mine?.motive.name ?? self.desire ?? 'none';
    const [dr, dg, db] = DESIRE_RGB[desire] ?? DESIRE_RGB.none;
    const dcol = `rgb(${dr},${dg},${db})`;
    ctx.fillStyle = 'rgba(10,14,20,0.82)';
    ctx.fillRect(10, 72, 300, 58);
    ctx.fillStyle = dcol; ctx.fillRect(10, 72, 4, 58); // 욕구 색 띠
    ctx.font = '12px monospace';
    ctx.fillStyle = '#ffd76e';
    if (mine) ctx.fillText(`❋ 내 생명체 ${'❋'.repeat(mine.size ?? 1)}  E${mine.energy}`, 22, 90);
    else ctx.fillText(`❋ 내 생명체 (재소환 중…)`, 22, 90);
    // 무엇을 하는가 — 아이콘+욕구 + 상태. 표적 없으면 그 이유를 알려준다.
    let status = '';
    if (mine && desire !== 'none') {
      status = !mine.target ? '— 주변에 표적 없음' : mine.motive.acting ? '— 도달·수행 중 ✦' : '— 표적으로 이동 중 →';
    } else if (mine) status = '— 대기(방향키로 데려간다)';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = dcol;
    ctx.fillText(`${DESIRE_ICON[desire] ?? ''} ${DESIRE_LABEL[desire] ?? desire} ${status}`, 22, 108);
    ctx.font = '10px monospace'; ctx.fillStyle = '#7a8aa0';
    ctx.fillText(`1채집 2사냥 3식사 4제조 0대기`, 22, 124);

    // 우상: 보존 불변식 + 에너지 등급 전시 + 네트워크 계측
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    ctx.fillRect(w - 265, 10, 255, 172);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#8fd9a8';
    ctx.fillText(`세계 총 에너지 ${world.total.toLocaleString()}`, w - 255, 28);
    ctx.fillStyle = '#9db2c4';
    ctx.fillText(`(창세 이후 불변 = 보존 법칙)`, w - 255, 44);
    ctx.fillStyle = '#e0b34e';
    ctx.fillText(`☀ 태양 ${world.src.toLocaleString()}  ·  국소장 ${world.material.toLocaleString()}`, w - 255, 60);
    ctx.fillStyle = '#7cebd8';
    ctx.fillText(`◆ 결정(정적) ${world.crystal.toLocaleString()}`, w - 255, 76);
    ctx.fillStyle = '#8fe6a0';
    ctx.fillText(`❋ 생명체(능동) ${world.creature.toLocaleString()}`, w - 255, 92);
    ctx.fillStyle = '#7a8aa0';
    ctx.fillText(`심우주(손실) ${world.sink.toLocaleString()}  ↑엔트로피`, w - 255, 108);
    ctx.fillStyle = '#6b7a8c';
    ctx.font = '10px monospace';
    ctx.fillText(`상태: 기체·액체·고체 · 생명체(갈구↔대사)`, w - 255, 122);
    ctx.font = '12px monospace';
    ctx.fillStyle = world.checksum === 'OK' ? '#8fd9a8' : '#e0b34e';
    ctx.fillText(`지역 체크섬 ${world.checksum}`, w - 255, 140);
    ctx.fillStyle = '#9db2c4';
    ctx.fillText(`수신 ${world.bytesPerSec.toLocaleString()} B/s`, w - 255, 156);

    // 좌하: tx 피드 — 동기화되는 것의 전부
    ctx.font = '11px monospace';
    let ty = this.h - 14 - scene.txFeed.length * 14;
    ctx.fillStyle = 'rgba(10,14,20,0.75)';
    ctx.fillRect(8, ty - 30, 260, scene.txFeed.length * 14 + 34);
    ctx.fillStyle = '#5f7285';
    ctx.fillText('― 원장 tx 스트림 ―', 14, ty - 14);
    for (const tx of scene.txFeed) {
      ctx.fillStyle = tx.dir === 'in' ? '#8fd9a8' : tx.dir === 'out' ? '#d99a8f' : '#77879a';
      ctx.fillText(
        `[${CAUSE_LABEL[tx.cause] ?? tx.cause}] ${txLabel(tx.from)} → ${txLabel(tx.to)}  ${tx.amount}`,
        14, ty);
      ty += 14;
    }

    // 우하
    ctx.textAlign = 'right';
    ctx.fillStyle = '#5f7285';
    ctx.font = '11px sans-serif';
    ctx.fillText('WASD/방향키 이동 · R/F 상하 · 드래그 회전 · 휠 줌 · 1채집 2사냥 3식사 0대기', w - 14, this.h - 12);
    ctx.textAlign = 'left';
  }
}
