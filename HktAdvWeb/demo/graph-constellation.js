// =====================================================================
// 별자리 지도 + 파문 연출 (step D3) — 읽기 전용 렌더러
// ---------------------------------------------------------------------
// 전체 믿음 DAG 를 별자리로. Scene(ui.goalGraph + effects)만 소비한다.
// 세계 규칙 재유도 금지 (불변 원칙 ⑥) — src/ 를 import 하지 않는다. 파문 경로는
// ViewModel 이 effects[{kind:'ripple', path}] 로 계산해 준다(렌더러는 재유도 안 함).
// 완료=밝은 별 / 진행=맥동 / 추정=깜빡임 / 미발견=성운 / 반증=붕괴 잔상.
// =====================================================================

function hash(id) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 131 + id.charCodeAt(i)) & 0x7fffffff; return h; }

// 노드 좌표: 깊이=반지름, 해시=각도 (결정론적 별자리 배치).
function layout(nodes, W, H) {
  const cx = W / 2, cy = H / 2;
  const maxDepth = Math.max(1, ...nodes.map((n) => n.depth));
  const ring = Math.min(W, H) / 2 / (maxDepth + 1);
  const pos = new Map();
  for (const n of nodes) {
    const ang = (hash(n.id) % 360) * Math.PI / 180;
    pos.set(n.id, { x: cx + Math.cos(ang) * n.depth * ring, y: cy + Math.sin(ang) * n.depth * ring });
  }
  return pos;
}

const STAR = { 확인: '#7ee787', 추정: '#d29922', 미발견: '#484f58', 반증: '#f85149' };

// scene, phase(0..1 애니메이션 위상) → 한 프레임 그리기.
export function renderConstellation(canvas, scene, phase = 0) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#010409'; ctx.fillRect(0, 0, W, H);
  const nodes = scene.ui.goalGraph.nodes;
  const pos = layout(nodes, W, H);

  // 에지(별자리 선)
  ctx.strokeStyle = '#161b22';
  for (const e of scene.ui.goalGraph.edges) {
    const a = pos.get(e.from), b = pos.get(e.to); if (!a || !b) continue;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  // 별(노드)
  for (const n of nodes) {
    const p = pos.get(n.id); if (!p) continue;
    ctx.save();
    const c = STAR[n.state] ?? '#484f58';
    let alpha = 1, size = 3;
    if (n.state === '확인') { size = 4; ctx.shadowColor = c; ctx.shadowBlur = 10; }
    else if (n.state === '추정') { alpha = 0.4 + 0.4 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2 + hash(n.id))); } // 깜빡임
    else if (n.state === '미발견') { alpha = 0.25; size = 6; ctx.shadowColor = c; ctx.shadowBlur = 6; } // 성운
    else if (n.state === '반증') { alpha = 0.5; }
    ctx.globalAlpha = alpha; ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // effects 연출
  for (const fx of scene.effects ?? []) {
    if (fx.kind === 'ripple') drawRipple(ctx, fx.path.map((id) => pos.get(id)).filter(Boolean), phase);
    else if (fx.kind === 'collapse') drawCollapse(ctx, (fx.nodes ?? []).map((id) => pos.get(id)).filter(Boolean));
    else if (fx.kind === 'retro-bind') drawRetro(ctx, fx, pos);
    else if (fx.kind === 'confirm') drawPulse(ctx, pos.get(fx.node), phase, '#7ee787');
  }
  return pos;
}

// 파문: 완료 노드에서 조상 경로를 따라 빛이 오른다.
function drawRipple(ctx, path, phase) {
  if (path.length < 2) return;
  ctx.save();
  ctx.strokeStyle = '#58a6ff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
  for (const p of path.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  // 진행하는 빛의 머리
  const seg = phase * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(seg)), t = seg - i;
  const a = path[i], b = path[i + 1];
  const hx = a.x + (b.x - a.x) * t, hy = a.y + (b.y - a.y) * t;
  ctx.fillStyle = '#a5d6ff'; ctx.shadowColor = '#58a6ff'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawCollapse(ctx, pts) {
  ctx.save(); ctx.strokeStyle = '#f85149'; ctx.globalAlpha = 0.7;
  for (const p of pts) {
    ctx.beginPath(); ctx.moveTo(p.x - 6, p.y - 6); ctx.lineTo(p.x + 6, p.y + 6);
    ctx.moveTo(p.x + 6, p.y - 6); ctx.lineTo(p.x - 6, p.y + 6); ctx.stroke();
  }
  ctx.restore();
}

function drawRetro(ctx, fx, pos) {
  const target = pos.get(fx.node); if (!target) return;
  ctx.save(); ctx.strokeStyle = '#bc8cff'; ctx.setLineDash([3, 3]); ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.arc(target.x, target.y, 10, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawPulse(ctx, p, phase, color) {
  if (!p) return;
  ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = 1 - phase;
  ctx.beginPath(); ctx.arc(p.x, p.y, 4 + phase * 16, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

export default renderConstellation;
