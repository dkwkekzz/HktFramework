// =====================================================================
// 방사형 목적 그래프 뷰 (step D2) — 읽기 전용 렌더러
// ---------------------------------------------------------------------
// 중앙=현재 핵심 목적, 환(ring)=깊이. Scene 의 ui.goalGraph 만 소비한다.
// 세계 API 를 만지지 않는다 (불변 원칙 ⑥) — src/ 를 import 하지 않는다.
// 발견 상태 문법: 확인=선명 / 추정=흐림+떨림 / 미발견=성운 원호 / 반증=붕괴 잔상.
// =====================================================================

// 결정론적 지터 (Math.random 회피 — shot 재현성). id → 작은 오프셋.
function jitter(id, amp) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return ((h / 0xffff) - 0.5) * 2 * amp;
}

const COLORS = {
  확인: '#7ee787', 추정: '#d29922', 미발견: '#6e7681', 반증: '#f85149',
};

// goalGraph → 각 노드의 화면 좌표(깊이 환 배치).
function layout(goalGraph, cx, cy, ringGap) {
  const byDepth = new Map();
  for (const n of goalGraph.nodes) {
    if (!byDepth.has(n.depth)) byDepth.set(n.depth, []);
    byDepth.get(n.depth).push(n);
  }
  const pos = new Map();
  for (const [depth, nodes] of byDepth) {
    const r = depth * ringGap;
    nodes.forEach((n, i) => {
      const ang = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      pos.set(n.id, {
        x: cx + Math.cos(ang) * r + jitter(n.id, n.state === '추정' ? 4 : 0),
        y: cy + Math.sin(ang) * r + jitter(n.id + 'y', n.state === '추정' ? 4 : 0),
      });
    });
  }
  return pos;
}

export function renderRadial(canvas, goalGraph) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  const maxDepth = Math.max(1, ...goalGraph.nodes.map((n) => n.depth));
  const ringGap = Math.min(W, H) / 2 / (maxDepth + 1);
  const pos = layout(goalGraph, cx, cy, ringGap);

  // 환 가이드
  ctx.strokeStyle = '#21262d';
  for (let d = 1; d <= maxDepth; d++) {
    ctx.beginPath(); ctx.arc(cx, cy, d * ringGap, 0, Math.PI * 2); ctx.stroke();
  }
  // 에지 (발견된 양끝만 실선, 아니면 흐림)
  const stateOf = new Map(goalGraph.nodes.map((n) => [n.id, n.state]));
  for (const e of goalGraph.edges) {
    const a = pos.get(e.from), b = pos.get(e.to);
    if (!a || !b) continue;
    const faded = stateOf.get(e.from) === '미발견' || stateOf.get(e.to) === '미발견';
    ctx.strokeStyle = faded ? '#1b1f24' : '#30363d';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // 노드 (발견 상태 문법)
  for (const n of goalGraph.nodes) {
    const p = pos.get(n.id); if (!p) continue;
    const color = COLORS[n.state] ?? '#6e7681';
    ctx.save();
    if (n.state === '미발견') {
      // 성운 원호 — 위치만 암시, 내용 없음("?")
      ctx.globalAlpha = 0.35; ctx.strokeStyle = color; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 1.4); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 0.6; ctx.fillStyle = color;
      ctx.font = '10px sans-serif'; ctx.fillText('?', p.x - 3, p.y + 3);
    } else if (n.state === '반증') {
      // 붕괴 잔상 — 어두운 X
      ctx.globalAlpha = 0.5; ctx.strokeStyle = color;
      ctx.beginPath(); ctx.moveTo(p.x - 5, p.y - 5); ctx.lineTo(p.x + 5, p.y + 5);
      ctx.moveTo(p.x + 5, p.y - 5); ctx.lineTo(p.x - 5, p.y + 5); ctx.stroke();
    } else {
      // 확인=선명 / 추정=흐림
      ctx.globalAlpha = n.state === '추정' ? 0.55 : 1;
      ctx.fillStyle = color;
      if (n.state === '확인') { ctx.shadowColor = color; ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.arc(p.x, p.y, n.depth === 0 ? 8 : 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  return pos;
}

export default renderRadial;
