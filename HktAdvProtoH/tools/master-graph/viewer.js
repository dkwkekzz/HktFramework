// Master Graph Viewer — 생성되는 HTML 에 그대로 인라인된다. 외부 의존성 없음.
//
// 데이터는 window.__MASTER_GRAPH__ 로 주입된다 (html.ts 가 넣는다).
// 레이아웃은 고정 층(열) 배치다 — 그래프가 이미 층을 가지고 있으므로 force 를 쓰지 않는다.

(() => {
  const G = window.__MASTER_GRAPH__;

  // ── 상수 ─────────────────────────────────────────────────────────
  const W = 198; // 노드 폭
  const H = 28; // 기본 높이
  const H_POSS = 40; // Possibility 는 준비도 게이지를 담는다
  const VGAP = 7;
  const HGAP = 92;
  const TOP = 52;
  const LEFT = 34;

  const LAYERS = [
    { key: 'world_state', label: 'WORLD STATE', tone: 'world' },
    { key: 'actor', label: 'ACTOR', tone: 'actor' },
    { key: 'goal', label: 'GOAL', tone: 'goal' },
    { key: 'possibility', label: 'POSSIBILITY · OR', tone: 'poss' },
    { key: 'capability', label: 'CAPABILITY · AND', tone: 'impl' },
    { key: 'knowledge', label: 'KNOWLEDGE', tone: 'know' },
  ];
  const LAYER_INDEX = new Map(LAYERS.map((l, i) => [l.key, i]));
  const layerOf = (t) => (t === 'belief' ? 'knowledge' : t);

  const EDGE_STYLE = {
    causes: { color: 'var(--world)', label: '세계가 만든다', dash: '', w: 1.6 },
    wants: { color: 'var(--actor)', label: '원한다', dash: '4 3', w: 1.4 },
    achieves: { color: 'var(--goal)', label: '갈래 (OR)', dash: '', w: 1.6 },
    requires: { color: 'var(--poss)', label: '요구 (AND)', dash: '', w: 1 },
    supports: { color: 'var(--impl)', label: '돕는다', dash: '5 4', w: 1.3 },
    opposes: { color: 'var(--error)', label: '방해한다', dash: '5 4', w: 1.3 },
    reveals: { color: 'var(--know)', label: '드러낸다', dash: '2 3', w: 1.2 },
    creates_goal: { color: 'var(--goal)', label: '새 Goal 을 만든다', dash: '7 3', w: 1.8 },
    motivation: { color: 'var(--goal)', label: '상위 Goal', dash: '2 3', w: 1.2 },
    holder: { color: 'var(--actor)', label: '보유자', dash: '2 3', w: 1.2 },
    changed_by: { color: 'var(--world)', label: '바꾼다', dash: '5 4', w: 1.3 },
    contradicts: { color: 'var(--error)', label: '모순', dash: '2 3', w: 1.2 },
    knows: { color: 'var(--actor)', label: '안다', dash: '2 3', w: 1.2 },
    believes: { color: 'var(--actor)', label: '믿는다', dash: '2 3', w: 1.2 },
  };

  // 서브그래프 추적에 쓰는 뼈대 관계 — supports/opposes 는 곁가지라 제외한다
  const BACKBONE = new Set(['causes', 'wants', 'achieves', 'requires', 'reveals', 'motivation', 'creates_goal']);

  const byId = new Map(G.nodes.map((n) => [n.id, n]));
  const readiness = G.readiness;

  const short = (id) => String(id).replace(/^M[WAGPCKB]-/, '').replace(/^DC-/, '');
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  // ── 그리기 방향 ──────────────────────────────────────────────────
  // achieves 는 MP→MG 로 적히지만, 그림에서는 Goal 에서 갈래가 뻗어 나가야 읽힌다.
  const drawEdges = G.edges
    .filter((e) => byId.has(e.from) && byId.has(e.to))
    .map((e) => (e.kind === 'achieves' ? { ...e, a: e.to, b: e.from } : { ...e, a: e.from, b: e.to }));

  // ── 층별 정렬 (barycenter) — 선이 덜 꼬이게 세로 순서를 잡는다 ────
  const columns = LAYERS.map((l) => G.nodes.filter((n) => layerOf(n.type) === l.key));

  const succ = new Map();
  const pred = new Map();
  for (const n of G.nodes) {
    succ.set(n.id, []);
    pred.set(n.id, []);
  }
  for (const e of drawEdges) {
    succ.get(e.a).push(e.b);
    pred.get(e.b).push(e.a);
  }

  const orderOf = new Map();
  const reindex = () => columns.forEach((col) => col.forEach((n, i) => orderOf.set(n.id, i)));
  reindex();

  const bary = (ids, wantLayer) => {
    const vals = ids.filter((id) => layerOf(byId.get(id).type) === wantLayer).map((id) => orderOf.get(id));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  for (let sweep = 0; sweep < 6; sweep += 1) {
    const forward = sweep % 2 === 0;
    const idx = forward ? [...columns.keys()] : [...columns.keys()].reverse();
    for (const ci of idx) {
      const neighborLayer = LAYERS[forward ? ci - 1 : ci + 1]?.key;
      if (!neighborLayer) continue;
      const keyed = columns[ci].map((n, i) => ({
        n,
        i,
        b: bary(forward ? pred.get(n.id) : succ.get(n.id), neighborLayer),
      }));
      keyed.sort((x, y) => {
        if (x.b == null && y.b == null) return x.i - y.i;
        if (x.b == null) return 1; // 이웃이 없는 노드는 아래로 모은다
        if (y.b == null) return -1;
        return x.b - y.b || x.i - y.i;
      });
      columns[ci] = keyed.map((k) => k.n);
      reindex();
    }
  }

  // ── 좌표 ─────────────────────────────────────────────────────────
  const colHeight = (col) =>
    col.reduce((sum, n) => sum + (n.type === 'possibility' ? H_POSS : H) + VGAP, 0) - VGAP;

  const tallest = Math.max(...columns.map((c) => (c.length ? colHeight(c) : 0)));
  const pos = new Map();
  let maxY = 0;
  columns.forEach((col, ci) => {
    const x = LEFT + ci * (W + HGAP);
    // 열마다 개수가 크게 다르다 — 같은 중심선에 맞춰야 사선이 덜 생긴다
    let y = TOP + (tallest - colHeight(col)) / 2;
    for (const n of col) {
      const h = n.type === 'possibility' ? H_POSS : H;
      pos.set(n.id, { x, y, w: W, h, cx: x + W / 2, cy: y + h / 2, ci });
      y += h + VGAP;
    }
    maxY = Math.max(maxY, y);
  });
  const worldW = LEFT * 2 + columns.length * W + (columns.length - 1) * HGAP;
  const worldH = maxY + 40;

  // ── SVG 조립 ─────────────────────────────────────────────────────
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs = {}, parent) => {
    const e = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    if (parent) parent.appendChild(e);
    return e;
  };

  const svg = document.getElementById('graph');
  svg.setAttribute('viewBox', `0 0 ${worldW} ${worldH}`);
  const defs = el('defs', {}, svg);
  for (const [kind, s] of Object.entries(EDGE_STYLE)) {
    const m = el(
      'marker',
      {
        id: `arw-${kind}`,
        viewBox: '0 0 8 8',
        refX: 7,
        refY: 4,
        markerWidth: 6,
        markerHeight: 6,
        orient: 'auto-start-reverse',
      },
      defs,
    );
    el('path', { d: 'M0,0 L8,4 L0,8 z', fill: s.color }, m);
  }

  const viewport = el('g', { id: 'viewport' }, svg);
  const gEdges = el('g', {}, viewport);
  const gNodes = el('g', {}, viewport);

  // 열 머리글 — 열마다 세로 중심이 다르므로 옅은 띠로 머리글과 노드를 잇는다
  const gBands = el('g', {}, viewport);
  columns.forEach((col, ci) => {
    if (col.length === 0) return;
    const x = LEFT + ci * (W + HGAP);
    el('rect', { x: x - 8, y: 20, width: W + 16, height: worldH - 40, rx: 8, class: 'colband' }, gBands);
    const t = el('text', { x, y: 14, class: 'colhead' }, viewport);
    t.textContent = `${LAYERS[ci].label}  ${col.length}`;
    el('line', { x1: x, y1: 22, x2: x + W, y2: 22, class: 'colrule' }, viewport);
  });
  viewport.insertBefore(gBands, viewport.firstChild);
  viewport.insertBefore(gEdges, gBands.nextSibling);

  // ── 엣지 ─────────────────────────────────────────────────────────
  const edgeEls = [];
  for (const e of drawEdges) {
    const a = pos.get(e.a);
    const b = pos.get(e.b);
    if (!a || !b) continue;
    const s = EDGE_STYLE[e.kind] ?? { color: 'var(--ink-3)', dash: '', w: 1 };
    let d;
    if (b.ci > a.ci) {
      const x1 = a.x + a.w;
      const x2 = b.x;
      const k = Math.max(30, (x2 - x1) * 0.45);
      d = `M${x1},${a.cy} C${x1 + k},${a.cy} ${x2 - k},${b.cy} ${x2},${b.cy}`;
    } else if (b.ci < a.ci) {
      // 되돌아가는 관계 — 왼쪽 면에서 나가 상대의 오른쪽 면으로 들어간다
      const x1 = a.x;
      const x2 = b.x + b.w;
      const k = Math.max(30, (x1 - x2) * 0.45);
      d = `M${x1},${a.cy} C${x1 - k},${a.cy} ${x2 + k},${b.cy} ${x2},${b.cy}`;
    } else {
      // 같은 열 — 오른쪽으로 나갔다 돌아온다
      const x1 = a.x + a.w;
      const out = x1 + 46;
      d = `M${x1},${a.cy} C${out},${a.cy} ${out},${b.cy} ${x1},${b.cy}`;
    }
    const p = el(
      'path',
      {
        d,
        class: 'edge',
        stroke: s.color,
        'stroke-dasharray': s.dash,
        'stroke-width': s.w,
        'marker-end': `url(#arw-${e.kind})`,
        opacity: e.kind === 'requires' ? 0.3 : 0.85,
      },
      gEdges,
    );
    p.dataset.kind = e.kind;
    p.dataset.a = e.a;
    p.dataset.b = e.b;
    edgeEls.push({ e, p });
  }

  // ── 노드 ─────────────────────────────────────────────────────────
  const TONE = {
    world_state: ['var(--world-bg)', 'var(--world)'],
    actor: ['var(--actor-bg)', 'var(--actor)'],
    goal: ['var(--goal-bg)', 'var(--goal)'],
    possibility: ['var(--poss-bg)', 'var(--poss)'],
    knowledge: ['var(--know-bg)', 'var(--know)'],
    belief: ['var(--know-bg)', 'var(--know)'],
  };
  const OVERLAY_TONE = {
    IMPLEMENTED: ['var(--impl-bg)', 'var(--impl)'],
    PARTIAL: ['var(--part-bg)', 'var(--part)'],
    MISSING: ['var(--miss-bg)', 'var(--miss)'],
  };

  const nodeEls = new Map();
  for (const n of G.nodes) {
    const p = pos.get(n.id);
    const [fill, stroke] =
      n.type === 'capability' ? OVERLAY_TONE[n.overlay ?? 'MISSING'] : TONE[n.type] ?? ['var(--panel-2)', 'var(--line)'];
    const g = el('g', { class: 'node', transform: `translate(${p.x},${p.y})` }, gNodes);
    g.dataset.id = n.id;
    const rectAttrs = { width: p.w, height: p.h, fill, stroke };
    // 잠정 조각(grounded: false) — 근거 문서가 이름만 댄 노드는 점선 테두리다
    if (n.partOf && !n.partOf.grounded) rectAttrs['stroke-dasharray'] = '5 4';
    el('rect', rectAttrs, g);

    const label = el('text', { x: 9, y: n.type === 'possibility' ? 15 : 18 }, g);
    label.textContent = clip(short(n.id), 27);

    // 구멍 표시 — 비어 있는 인과 필드가 있으면 오른쪽 위에 점을 찍는다
    if (n.holes.length > 0) {
      el('circle', { cx: p.w - 8, cy: 8, r: 2.8, class: 'holemark' }, g);
    }

    if (n.type === 'capability') {
      const sub = el('text', { x: p.w - 9, y: 18, class: 'sub', 'text-anchor': 'end' }, g);
      sub.textContent = n.overlay ?? '';
    }

    if (n.type === 'possibility') {
      const r = readiness[n.id];
      const bw = p.w - 18;
      el('rect', { x: 9, y: 22, width: bw, height: 4.5, rx: 2.2, fill: 'var(--panel-2)', stroke: 'none' }, g);
      if (r && !r.unspecified) {
        const iw = (r.implemented / r.total) * bw;
        const pw = (r.partial / r.total) * bw;
        if (iw > 0) el('rect', { x: 9, y: 22, width: iw, height: 4.5, rx: 2.2, fill: 'var(--impl)', stroke: 'none' }, g);
        if (pw > 0) el('rect', { x: 9 + iw, y: 22, width: pw, height: 4.5, fill: 'var(--part)', stroke: 'none' }, g);
      }
      const sub = el('text', { x: 9, y: 36, class: 'sub' }, g);
      sub.textContent = r
        ? r.unspecified
          ? '요구 Capability 미기재'
          : `${r.implemented}/${r.total} 세계에 있음`
        : '';
    }

    nodeEls.set(n.id, g);
    g.addEventListener('click', (ev) => {
      ev.stopPropagation();
      select(n.id);
    });
  }

  // ── 상태 ─────────────────────────────────────────────────────────
  const state = {
    selected: null,
    lens: null, // DC-* — Constraint 렌즈
    systemLens: null, // MS-* — 척추(시스템) 렌즈
    query: '',
    kinds: new Set(Object.keys(EDGE_STYLE)),
    onlyMissing: false,
    onlyHoles: false,
  };

  const systems = G.systems ?? [];
  const systemById = new Map(systems.map((s) => [s.id, s]));
  const membershipsOf = (n) => (n.partOf && n.partOf.memberships) || [];
  const inSystem = (n, sysId) => membershipsOf(n).some((m) => m.system === sysId);

  const neighborsOf = (id) => {
    const up = new Set();
    const down = new Set();
    const walk = (start, map, into) => {
      const stack = [start];
      while (stack.length) {
        const cur = stack.pop();
        for (const e of drawEdges) {
          if (!BACKBONE.has(e.kind)) continue;
          const from = map === 'down' ? e.a : e.b;
          const to = map === 'down' ? e.b : e.a;
          if (from === cur && !into.has(to)) {
            into.add(to);
            stack.push(to);
          }
        }
      }
    };
    walk(id, 'down', down);
    walk(id, 'up', up);
    return new Set([id, ...up, ...down]);
  };

  const constraintNodes = new Map(G.constraints.map((c) => [c.id, new Set(c.nodes)]));

  function visibleSet() {
    // 필터를 통과하는 노드 — null 이면 전부
    let keep = null;
    const restrict = (pred) => {
      const next = new Set();
      for (const n of G.nodes) if ((keep === null || keep.has(n.id)) && pred(n)) next.add(n.id);
      keep = next;
    };
    if (state.onlyMissing) {
      // MISSING Capability 와 그것을 요구하는 Possibility · 그 Goal 까지 남긴다
      const seed = new Set(G.nodes.filter((n) => n.type === 'capability' && n.overlay === 'MISSING').map((n) => n.id));
      for (const e of drawEdges) {
        if (e.kind === 'requires' && seed.has(e.b)) seed.add(e.a);
      }
      for (const e of drawEdges) {
        if (e.kind === 'achieves' && seed.has(e.b)) seed.add(e.a);
      }
      restrict((n) => seed.has(n.id));
    }
    if (state.onlyHoles) restrict((n) => n.holes.length > 0);
    if (state.lens) restrict((n) => constraintNodes.get(state.lens)?.has(n.id));
    if (state.systemLens) restrict((n) => inSystem(n, state.systemLens));
    if (state.query) {
      const q = state.query.toLowerCase();
      restrict((n) => n.id.toLowerCase().includes(q) || (n.text ?? '').toLowerCase().includes(q));
    }
    if (state.selected) {
      const sub = neighborsOf(state.selected);
      restrict((n) => sub.has(n.id));
    }
    return keep;
  }

  function apply() {
    const keep = visibleSet();
    for (const [id, g] of nodeEls) {
      g.classList.toggle('dim', keep !== null && !keep.has(id));
      g.classList.toggle('sel', id === state.selected);
    }
    for (const { e, p } of edgeEls) {
      const kindOn = state.kinds.has(e.kind);
      const inSet = keep === null || (keep.has(e.a) && keep.has(e.b));
      p.classList.toggle('dim', !kindOn || !inSet);
      p.classList.toggle('hot', inSet && keep !== null && kindOn);
    }
    document.querySelectorAll('button.lens[data-dc]').forEach((b) => b.classList.toggle('on', b.dataset.dc === state.lens));
    document.querySelectorAll('button.lens[data-sys]').forEach((b) => b.classList.toggle('on', b.dataset.sys === state.systemLens));
  }

  // ── 상세 패널 ────────────────────────────────────────────────────
  const detail = document.getElementById('detail');
  const SKIP_FIELDS = new Set(['id', 'type']);
  const TEXT_FIELD = {
    world_state: 'statement',
    actor: 'perspective',
    goal: 'desired_state',
    possibility: 'meaningful_difference',
    capability: 'semantic',
    knowledge: 'statement',
    belief: 'statement',
  };

  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function refHtml(id) {
    if (!byId.has(id)) return `<span class="chip hole">${esc(id)} — 정의 없음</span>`;
    const n = byId.get(id);
    const om = n.type === 'capability' ? ` <span class="om">${n.overlay ?? ''}</span>` : '';
    return `<button class="ref" data-goto="${esc(id)}">${esc(short(id))}${om}</button>`;
  }

  function valueHtml(v) {
    if (Array.isArray(v)) {
      if (v.length === 0) return '<span class="chip hole">비어 있음</span>';
      return (
        '<ul>' +
        v
          .map((x) =>
            typeof x === 'string' && byId.has(x) ? `<li>${refHtml(x)}</li>` : `<li>${esc(String(x))}</li>`,
          )
          .join('') +
        '</ul>'
      );
    }
    if (v && typeof v === 'object') {
      return Object.entries(v)
        .map(([k, x]) => `<div class="field"><div class="k">${esc(k)}</div><div class="v">${valueHtml(x)}</div></div>`)
        .join('');
    }
    if (v == null || v === '') return '<span class="chip hole">비어 있음</span>';
    return esc(String(v).replace(/\s+/g, ' ').trim());
  }

  function showConstraint(dc) {
    const c = G.constraints.find((x) => x.id === dc);
    if (!c) return;
    detail.innerHTML =
      `<h3>${esc(c.id)}</h3><div class="kind">CONSTRAINT · ${esc(c.scope.join(' · '))} · ${esc(c.status)}</div>` +
      `<p class="body">${esc(c.statement)}</p>` +
      (c.rationale ? `<div class="field"><div class="k">근거</div><div class="v">${esc(c.rationale)}</div></div>` : '') +
      `<div class="field"><div class="k">이 원칙 아래 있는 노드 ${c.nodes.length}</div><div class="v">${
        c.nodes.map((id) => refHtml(id)).join(' ') || '없음'
      }</div></div>` +
      (c.supports.length
        ? `<div class="field"><div class="k">지지하는 Constraint</div><div class="v">${c.supports.map(esc).join(' · ')}</div></div>`
        : '') +
      (c.conflictsWith.length
        ? `<div class="field"><div class="k">충돌</div><div class="v">${c.conflictsWith.map(esc).join(' · ')}</div></div>`
        : '');
    bindRefs();
  }

  function showSystem(sysId) {
    const s = systemById.get(sysId);
    if (!s) return;
    const members = G.nodes.filter((n) => inSystem(n, sysId));
    const segRows = (s.segments ?? [])
      .slice()
      .reverse()
      .map((seg) => {
        const inSeg = members.filter((n) => membershipsOf(n).some((m) => m.system === sysId && m.segment === seg.id));
        return `<div class="field"><div class="k">${esc(seg.name)}</div><div class="v">${
          inSeg.map((n) => refHtml(n.id)).join(' ') || '<span class="chip">비어 있음</span>'
        }</div></div>`;
      })
      .join('');
    const noSeg = members.filter((n) => membershipsOf(n).some((m) => m.system === sysId && !m.segment));
    detail.innerHTML =
      `<h3>${esc(s.name)}</h3><div class="kind">SYSTEM · ${esc(s.id)} · ${esc(s.status)}</div>` +
      `<p class="body">${esc(s.semantic || '')}</p>` +
      `<div class="field"><div class="k">근거</div><div class="v">${esc(s.source)}</div></div>` +
      segRows +
      (noSeg.length
        ? `<div class="field"><div class="k">${(s.segments ?? []).length ? '공통 바닥 — 층에 속하지 않는다' : '조각'}</div><div class="v">${noSeg
            .map((n) => refHtml(n.id))
            .join(' ')}</div></div>`
        : '');
    bindRefs();
  }

  function showNode(id) {
    const n = byId.get(id);
    if (!n) return;
    const r = readiness[id];
    const parts = [];
    parts.push(`<h3>${esc(n.id)}</h3><div class="kind">${esc(n.type)}${n.overlay ? ` · ${esc(n.overlay)}` : ''}</div>`);
    if (n.partOf && !n.partOf.grounded) {
      parts.push('<p class="body"><span class="chip hole">잠정 — 근거 문서가 이름만 댔다. 그 전체의 설계 문서가 서면 semantic 을 개정한다</span></p>');
    }
    if (n.text) parts.push(`<p class="body">${esc(n.text)}</p>`);

    if (membershipsOf(n).length) {
      parts.push(
        `<div class="field"><div class="k">척추 — 어느 시스템의 조각인가</div><div class="v"><ul>` +
          membershipsOf(n)
            .map((m) => {
              const s = systemById.get(m.system);
              const seg = s && m.segment ? (s.segments ?? []).find((g) => g.id === m.segment) : null;
              const name = s ? s.name : m.system;
              return `<li><button class="ref" data-sysgoto="${esc(m.system)}">${esc(name)}</button>${
                seg ? ` · ${esc(seg.name)}` : ''
              }${m.role ? ` — ${esc(m.role)}` : ''}${m.source ? ` <span class="om">(${esc(m.source)})</span>` : ''}</li>`;
            })
            .join('') +
          `</ul></div></div>`,
      );
    }

    if (r) {
      parts.push(
        `<div class="field"><div class="k">준비도 — 요구 Capability 중 세계에 있는 것</div><div class="v">` +
          (r.unspecified
            ? '<span class="chip hole">요구 Capability 미기재</span>'
            : `${r.implemented} IMPLEMENTED · ${r.partial} PARTIAL · ${r.missing} MISSING / ${r.total}` +
              `<div class="bar"><i class="i-impl" style="width:${(r.implemented / r.total) * 100}%"></i>` +
              `<i class="i-part" style="width:${(r.partial / r.total) * 100}%"></i>` +
              `<i class="i-none" style="width:${(r.missing / r.total) * 100}%"></i></div>` +
              (r.blockers.length
                ? `<div style="margin-top:6px">아직 없는 요구: ${r.blockers.map((b) => refHtml(b)).join(' ')}</div>`
                : '<div style="margin-top:6px">막는 것이 없다 — 요구가 전부 세계에 있다</div>')) +
          `</div></div>`,
      );
    }

    const wk = (G.works ?? {})[id];
    if (wk && (wk.candidates.length || wk.cycles.length)) {
      const rows = [];
      for (const c of wk.cycles) {
        const done = /COMPLETE/.test(c.status);
        rows.push(
          `<li><span class="chip ${done ? 'ok' : ''}">Cycle</span> cycles/${esc(c.id)} · ${esc(c.status)}</li>`,
        );
      }
      for (const f of wk.candidates) {
        rows.push(
          `<li><span class="chip ${f.selected ? 'ok' : ''}">후보</span> ${esc(f.fr)} (${esc(f.track)} · ${esc(
            f.status,
          )}${f.selected ? ' · SELECTED' : ''}) — frontier/${esc(f.track.toLowerCase())}.md</li>`,
        );
      }
      parts.push(
        `<div class="field"><div class="k">작업 연결 — 이 노드를 세운 Cycle · 겨냥한 Frontier 후보</div>` +
          `<div class="v"><ul>${rows.join('')}</ul></div></div>`,
      );
    } else if (n.type === 'capability') {
      parts.push(
        `<div class="field"><div class="k">작업 연결</div>` +
          `<div class="v"><span class="chip hole">겨냥한 후보도 다룬 Cycle 도 없다 — NEXT 가 후보를 세우기 전이다</span></div></div>`,
      );
    }

    if (n.constraints.length) {
      parts.push(
        `<div class="field"><div class="k">Constraint — 이 노드를 거르는 원칙</div><div class="v">` +
          n.constraints
            .map((dc) => {
              const ev = n.eval[dc];
              const cls = ev === 'SATISFIED' ? 'chip ok' : ev ? 'chip' : 'chip hole';
              return `<button class="ref" data-dc="${esc(dc)}"><span class="${cls}">${esc(short(dc))} · ${esc(
                ev ?? '판정 없음',
              )}</span></button>`;
            })
            .join(' ') +
          `</div></div>`,
      );
    }

    if (n.holes.length) {
      parts.push(
        `<div class="field"><div class="k">구멍 — 비어 있는 인과 필드</div><div class="v">` +
          n.holes.map((f) => `<span class="chip hole">${esc(f)}</span>`).join(' ') +
          `</div></div>`,
      );
    }

    const incoming = drawEdges.filter((e) => e.to === id || e.from === id);
    if (incoming.length) {
      const rows = incoming
        .map((e) => {
          const other = e.from === id ? e.to : e.from;
          const dir = e.from === id ? '→' : '←';
          return `<li>${esc(EDGE_STYLE[e.kind]?.label ?? e.kind)} ${dir} ${refHtml(other)}</li>`;
        })
        .join('');
      parts.push(`<div class="field"><div class="k">관계 ${incoming.length}</div><div class="v"><ul>${rows}</ul></div></div>`);
    }

    const textField = TEXT_FIELD[n.type];
    for (const [k, v] of Object.entries(n.raw)) {
      if (SKIP_FIELDS.has(k) || k === textField) continue;
      if (k === 'constraints' || k === 'constraint_evaluation' || k === 'overlay' || k === 'part_of') continue;
      parts.push(`<div class="field"><div class="k">${esc(k)}</div><div class="v">${valueHtml(v)}</div></div>`);
    }

    parts.push(`<div class="field"><div class="k">원본</div><div class="v">graph/${esc(n.file)}</div></div>`);
    detail.innerHTML = parts.join('');
    bindRefs();
  }

  function bindRefs() {
    detail.querySelectorAll('[data-goto]').forEach((b) => {
      b.addEventListener('click', () => select(b.dataset.goto));
    });
    detail.querySelectorAll('[data-dc]').forEach((b) => {
      b.addEventListener('click', () => {
        state.lens = state.lens === b.dataset.dc ? null : b.dataset.dc;
        showConstraint(b.dataset.dc);
        apply();
      });
    });
    detail.querySelectorAll('[data-sysgoto]').forEach((b) => {
      b.addEventListener('click', () => {
        state.systemLens = b.dataset.sysgoto;
        showSystem(b.dataset.sysgoto);
        apply();
      });
    });
  }

  function select(id) {
    state.selected = state.selected === id ? null : id;
    if (state.selected) {
      showNode(state.selected);
      fitTo(neighborsOf(state.selected));
    } else {
      detail.innerHTML = '<div class="empty">노드를 고르면 그 노드가 속한 인과 경로만 남고 원문이 여기 열린다.</div>';
    }
    apply();
  }

  // ── 줌 · 팬 ──────────────────────────────────────────────────────
  const canvas = document.getElementById('canvas');
  const view = { x: 0, y: 0, k: 1 };
  const setView = () => viewport.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);

  const syncViewBox = () => {
    const r = canvas.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    return r;
  };

  /** 주어진 사각형이 화면에 들어오게 맞춘다 */
  function fitBox(box, maxScale) {
    const r = syncViewBox();
    const pad = 26;
    const k = Math.min(
      maxScale,
      Math.max(0.12, Math.min((r.width - pad * 2) / box.w, (r.height - pad * 2) / box.h)),
    );
    view.k = k;
    view.x = r.width / 2 - (box.x + box.w / 2) * k;
    view.y = r.height / 2 - (box.y + box.h / 2) * k;
    setView();
  }

  function fit() {
    fitBox({ x: 0, y: 0, w: worldW, h: worldH }, 1);
  }

  /** 고른 노드의 서브그래프만 화면에 채운다 — 여기서부터 글자가 읽힌다 */
  function fitTo(ids) {
    const ps = [...ids].map((id) => pos.get(id)).filter(Boolean);
    if (ps.length === 0) return;
    const x1 = Math.min(...ps.map((p) => p.x));
    const y1 = Math.min(...ps.map((p) => p.y));
    const x2 = Math.max(...ps.map((p) => p.x + p.w));
    const y2 = Math.max(...ps.map((p) => p.y + p.h));
    fitBox({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, 1.35);
  }

  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const r = canvas.getBoundingClientRect();
    const mx = ev.clientX - r.left;
    const my = ev.clientY - r.top;
    const next = Math.min(3, Math.max(0.15, view.k * (ev.deltaY < 0 ? 1.12 : 1 / 1.12)));
    view.x = mx - ((mx - view.x) / view.k) * next;
    view.y = my - ((my - view.y) / view.k) * next;
    view.k = next;
    setView();
  }, { passive: false });

  // 팬 — setPointerCapture 를 쓰지 않는다. 캡처하면 이후 click 의 target 이 캔버스로
  // 바뀌어 노드 클릭이 사라진다. 대신 window 에서 추적하고 실제 이동 거리로 드래그를 가른다.
  let dragging = null;
  let moved = false;
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    dragging = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y };
    moved = false;
  });
  window.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    const dx = ev.clientX - dragging.x;
    const dy = ev.clientY - dragging.y;
    if (!moved && Math.hypot(dx, dy) < 4) return; // 클릭과 드래그를 가르는 문턱
    moved = true;
    canvas.classList.add('drag');
    view.x = dragging.vx + dx;
    view.y = dragging.vy + dy;
    setView();
  });
  window.addEventListener('pointerup', () => {
    dragging = null;
    canvas.classList.remove('drag');
  });
  canvas.addEventListener('click', (ev) => {
    if (moved) return; // 화면을 끌었을 뿐이면 선택을 지우지 않는다
    if (ev.target === svg || ev.target === canvas || ev.target.classList.contains('colband')) select(null);
  });
  window.addEventListener('resize', () => {
    syncViewBox();
    if (state.selected) fitTo(neighborsOf(state.selected));
    else fit();
  });

  document.getElementById('zoom-in').addEventListener('click', () => {
    view.k = Math.min(3, view.k * 1.25);
    setView();
  });
  document.getElementById('zoom-out').addEventListener('click', () => {
    view.k = Math.max(0.15, view.k / 1.25);
    setView();
  });
  document.getElementById('zoom-fit').addEventListener('click', fit);

  // ── 사이드바 구성 ────────────────────────────────────────────────
  const legend = document.getElementById('legend');
  legend.innerHTML = Object.entries(EDGE_STYLE)
    .filter(([k]) => drawEdges.some((e) => e.kind === k))
    .map(
      ([k, s]) =>
        `<label class="tg on" data-kind="${k}"><span class="dot" style="border-color:${s.color};background:${s.color}"></span>${s.label}</label>`,
    )
    .join('');
  legend.querySelectorAll('.tg').forEach((l) => {
    l.addEventListener('click', () => {
      const k = l.dataset.kind;
      if (state.kinds.has(k)) state.kinds.delete(k);
      else state.kinds.add(k);
      l.classList.toggle('on', state.kinds.has(k));
      l.classList.toggle('off', !state.kinds.has(k));
      apply();
    });
  });

  const systemsEl = document.getElementById('systems');
  if (systemsEl) {
    systemsEl.innerHTML = systems
      .map((s) => {
        const count = G.nodes.filter((n) => inSystem(n, s.id)).length;
        const tag = s.status !== 'DEFINED' ? ` · ${s.status}` : '';
        return `<button class="lens" data-sys="${s.id}">${esc(s.name)}${tag}<span class="n">${count}</span></button>`;
      })
      .join('');
    systemsEl.querySelectorAll('.lens').forEach((b) => {
      b.addEventListener('click', () => {
        state.systemLens = state.systemLens === b.dataset.sys ? null : b.dataset.sys;
        if (state.systemLens) showSystem(state.systemLens);
        apply();
      });
    });
  }

  const lenses = document.getElementById('lenses');
  lenses.innerHTML = G.constraints
    .slice()
    .sort((a, b) => b.nodes.length - a.nodes.length || a.id.localeCompare(b.id))
    .map((c) => `<button class="lens" data-dc="${c.id}">${short(c.id)}<span class="n">${c.nodes.length}</span></button>`)
    .join('');
  lenses.querySelectorAll('.lens').forEach((b) => {
    b.addEventListener('click', () => {
      state.lens = state.lens === b.dataset.dc ? null : b.dataset.dc;
      if (state.lens) showConstraint(state.lens);
      apply();
    });
  });

  const ranks = document.getElementById('ranks');
  const ranked = G.nodes
    .filter((n) => n.type === 'possibility')
    .map((n) => ({ n, r: readiness[n.id] }))
    .sort((a, b) => {
      if (a.r.unspecified !== b.r.unspecified) return a.r.unspecified ? 1 : -1;
      return b.r.score - a.r.score;
    });
  ranks.innerHTML = ranked
    .map(({ n, r }) => {
      const total = r.total || 1;
      const bar = r.unspecified
        ? '<i class="i-none" style="width:100%"></i>'
        : `<i class="i-impl" style="width:${(r.implemented / total) * 100}%"></i>` +
          `<i class="i-part" style="width:${(r.partial / total) * 100}%"></i>` +
          `<i class="i-none" style="width:${(r.missing / total) * 100}%"></i>`;
      return (
        `<button class="rank" data-goto="${n.id}"><div class="top"><span class="name">${short(n.id)}</span>` +
        `<span class="frac">${r.unspecified ? '미기재' : `${r.implemented}/${r.total}`}</span></div>` +
        `<div class="bar">${bar}</div></button>`
      );
    })
    .join('');
  ranks.querySelectorAll('.rank').forEach((b) => b.addEventListener('click', () => select(b.dataset.goto)));

  const problems = document.getElementById('problems');
  problems.innerHTML = G.problems.length
    ? G.problems
        .map((p) => `<div class="problem ${p.severity}"><span class="sev">${p.severity}</span> ${esc(p.message)}</div>`)
        .join('')
    : '<div class="hint">참조·양방향·Constraint 정합 모두 통과.</div>';

  document.getElementById('q').addEventListener('input', (ev) => {
    state.query = ev.target.value.trim();
    apply();
  });
  document.getElementById('only-missing').addEventListener('click', (ev) => {
    state.onlyMissing = !state.onlyMissing;
    ev.currentTarget.classList.toggle('on', state.onlyMissing);
    apply();
  });
  document.getElementById('only-holes').addEventListener('click', (ev) => {
    state.onlyHoles = !state.onlyHoles;
    ev.currentTarget.classList.toggle('on', state.onlyHoles);
    apply();
  });

  select(null);
  fit();
  apply();
})();
