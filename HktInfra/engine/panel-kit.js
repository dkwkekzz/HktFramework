// HktInfra engine/panel-kit.js — 시각 관찰 셸 *공통 키트* (재사용)
// 각 step 의 panel.js 가 이 위에 *그 step 의 관찰 화면만* 올린다 — net-core.js 가 engine/Net 을 잇듯.
// 의존 0(바닐라 DOM/Canvas). Node 에서도 로드되나 함수는 호출 시에만 document 를 만진다(헤드리스 안전).
//
// 제공:
//   h(tag, attrs, ...kids)             — DOM 생성 헬퍼
//   slider/toggle/select(opts)          — 라벨된 컨트롤, {node, get, set, on}
//   timeline(canvas, {ticks, rows})     — tick×행 그리드(초록=일치/빨강=불일치/회색=없음) — desync 타임라인의 핵심
//   stats(container, pairs)             — key/value 표
//   fmtHex(v)                           — 0x........ 포맷
'use strict';

function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'style') Object.assign(e.style, attrs[k]);
    else if (k.startsWith('on') && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
    else if (k === 'class') e.className = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  for (const c of kids) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}

function fmtHex(v) { return '0x' + (v >>> 0).toString(16).padStart(8, '0'); }

// 라벨 + 입력(range/checkbox/select) 한 줄. opts.on(value) 콜백.
function _control(kind, opts) {
  const id = 'c' + Math.random().toString(36).slice(2, 8);
  let input, read;
  if (kind === 'range') {
    input = h('input', { type: 'range', id, min: opts.min, max: opts.max, step: opts.step || 1, value: opts.value });
    read = () => Number(input.value);
  } else if (kind === 'toggle') {
    input = h('input', { type: 'checkbox', id });
    input.checked = !!opts.value;
    read = () => input.checked;
  } else { // select
    input = h('select', { id }, ...opts.options.map(o => h('option', { value: o.value }, o.label)));
    input.value = opts.value;
    read = () => input.value;
  }
  const valSpan = h('span', { class: 'val' }, kind === 'toggle' ? '' : String(opts.value));
  input.addEventListener('input', () => {
    if (kind !== 'toggle') valSpan.textContent = String(read());
    if (opts.on) opts.on(read());
  });
  const node = h('label', { class: 'ctl' }, h('span', { class: 'lbl' }, opts.label), input, valSpan);
  return { node, get: read, set: v => { if (kind === 'toggle') input.checked = !!v; else input.value = v; }, on: opts.on };
}
const slider = (o) => _control('range', o);
const toggle = (o) => _control('toggle', o);
const select = (o) => _control('select', o);

// tick × 행 그리드. rows: [{ label, cells:[true|false|null] }]. 초록=true, 빨강=false, 회색=null.
function timeline(canvas, model) {
  const ctx = canvas.getContext('2d');
  const rows = model.rows, ticks = model.ticks;
  const padL = 168, padT = 6, cw = Math.max(4, Math.floor((canvas.width - padL - 8) / ticks)), rh = 26, gap = 6;
  canvas.height = padT + rows.length * (rh + gap) + 18;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '12px ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  rows.forEach((row, ri) => {
    const y = padT + ri * (rh + gap);
    ctx.fillStyle = row.color || '#cdd6f4';
    ctx.textAlign = 'right';
    ctx.fillText(row.label, padL - 8, y + rh / 2);
    for (let t = 0; t < ticks; t++) {
      const c = row.cells[t];
      ctx.fillStyle = c == null ? '#313244' : c ? '#a6e3a1' : '#f38ba8';
      ctx.fillRect(padL + t * cw, y, Math.max(2, cw - 1), rh);
    }
  });
  // x축 눈금
  ctx.fillStyle = '#7f849c'; ctx.textAlign = 'center';
  for (let t = 0; t <= ticks; t += 10) ctx.fillText(String(t), padL + t * cw, canvas.height - 8);
}

function stats(container, pairs) {
  container.innerHTML = '';
  for (const [k, v, cls] of pairs) {
    container.append(h('div', { class: 'stat' },
      h('span', { class: 'k' }, k),
      h('span', { class: 'v ' + (cls || '') }, v)));
  }
}

const __kit = { h, slider, toggle, select, timeline, stats, fmtHex };
if (typeof module !== 'undefined' && module.exports) module.exports = __kit;
if (typeof globalThis !== 'undefined') globalThis.HktPanelKit = __kit;
