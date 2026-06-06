/* HWS 공통 UI 엔진 — step 별 인라인 UI(≈230줄)·인라인 코어(≈460줄) 복제를 끝낸다.
 *
 * 설계: 시뮬레이션 동작은 전적으로 step-NNNN/sim-core.js 에서 온다(이 엔진은 그 파일을
 *   "그대로" 로드한다 → 결정론·회귀·장부는 자동으로 동일). 이 엔진이 맡는 것은 *프레젠테이션*뿐:
 *   캔버스 렌더(열지도+표준 오버레이), 재생 루프(분수 속도), 선언적 패널에서 컨트롤·통계표 구성,
 *   라이브 노브 배선, 버튼/클릭 디스패치. step 마다 바뀌는 것은 sim-core.js(새 시뮬 로직)와
 *   작은 panel.js(이 step 이 더한 노브·통계·버튼) 둘뿐 — 이 엔진은 건드리지 않는다.
 *
 * 표준 오버레이는 step-0006 의 상위집합(열지도·source/sink·고임·생명·무게중심·스파크라인)을 내장하고,
 *   데이터(agents/pools)가 없으면 자동 no-op 이라 더 단순한 step 에서도 그대로 쓰인다.
 *
 * 패널 스펙은 engine/PANEL.md 참조. 브라우저(file:// 더블클릭)·Node(headless 검증) 겸용.
 */
(function (global) {
  'use strict';

  /* 표준 시드·속도 — step-0006 과 동일. panel 에서 덮어쓸 수 있다. */
  var STD_SEEDS = [42, 7, 1234, 99, 2026];
  var STD_SPEEDS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100, 200];
  var STD_DEFAULT_SPEED = 10;

  /* ── 패널 → createSim 파라미터 (순수, DOM 없음) ──
   * 컨트롤의 *기본값*으로 만들 createSim 파라미터를 돌려준다. reset() 이 라이브 컨트롤 값으로
   * 만드는 것과 동일한 매핑이며, headless 검증이 "패널이 코어에 같은 값을 먹이는가"를 확인하는 데 쓴다. */
  function defaultParams(panel) {
    var byId = {};
    eachItem(panel, function (it) { if (it.id != null) byId[it.id] = it; });
    var params = {};
    eachItem(panel, function (it) {
      if (it.kind === 'check' && it.param != null) {
        params[it.param] = it.def;
      } else if (it.kind === 'slider' && it.param != null) {
        if (it.gateBy != null) {
          var gate = byId[it.gateBy];
          params[it.param] = (gate && gate.def) ? it.def : (it.gateOff != null ? it.gateOff : 0);
        } else {
          params[it.param] = it.def;
        }
      }
    });
    return params;
  }

  /* 패널의 모든 컨트롤 항목을 순회 (행 → 항목) */
  function eachItem(panel, fn) {
    var rows = panel.controls || [];
    for (var r = 0; r < rows.length; r++) {
      var items = rows[r].items || [];
      for (var c = 0; c < items.length; c++) fn(items[c], r, c);
    }
  }

  /* 열지도 색: 로그 스케일. step-0006 colorOf 와 동일. */
  function colorOf(e, sat) {
    var t = Math.log(1 + Math.max(0, e)) / Math.log(1 + sat);
    if (t > 1) t = 1;
    var r, g, b;
    if (t < 0.5) { var u = t * 2; r = 10 + 30 * u; g = 15 + 90 * u; b = 40 + 160 * u; }
    else { var v = (t - 0.5) * 2; r = 40 + 215 * v; g = 105 + 120 * v; b = 200 - 60 * v; }
    return [r | 0, g | 0, b | 0];
  }

  /* ── DOM 마운트 — 페이지를 구성하고 시뮬을 돌린다 ── */
  function mount(core, panel, opts) {
    opts = opts || {};
    var doc = global.document;
    var W = core.DEFAULTS.W, H = core.DEFAULTS.H;
    var seeds = panel.seeds || STD_SEEDS;
    var speeds = panel.speeds || STD_SPEEDS;
    var defSpeed = panel.defaultSpeed || STD_DEFAULT_SPEED;
    var ov = Object.assign({ sourceSink: true, pools: true, life: true, centroid: true, sparkline: true }, panel.overlays || {});
    var poolOpts = panel.poolOpts || { minE: 1.5, prom: 0.3 };

    /* 헤더(제목·부제) */
    var h1 = doc.createElement('h1'); h1.innerHTML = panel.title || 'HWS';
    var sub = doc.createElement('div'); sub.className = 'sub'; sub.innerHTML = panel.subtitle || '';
    doc.body.appendChild(h1); doc.body.appendChild(sub);

    /* 본문: 캔버스 + 패널 */
    var rowEl = doc.createElement('div'); rowEl.className = 'row';
    var cv = doc.createElement('canvas'); cv.id = 'cv'; cv.width = 512; cv.height = 512;
    var panelEl = doc.createElement('div'); panelEl.className = 'panel';
    rowEl.appendChild(cv); rowEl.appendChild(panelEl);
    doc.body.appendChild(rowEl);

    var ctx = cv.getContext('2d');
    var SCALE = cv.width / W;
    var img = ctx.createImageData(W, H);
    var off = doc.createElement('canvas'); off.width = W; off.height = H;
    var octx = off.getContext('2d');
    var satSmooth = 8;                                     // 자동 명암 포화점 EMA 상태(화면 떨림 평활, draw 간 유지)

    /* 컨트롤 레지스트리: id → {el, item} */
    var ctrls = {};
    function val(id) {
      var c = ctrls[id]; if (!c) return undefined;
      var el = c.el;
      if (el.type === 'checkbox') return el.checked;
      if (el.tagName === 'SELECT') return el.value;
      if (el.type === 'range') return parseFloat(el.value);
      return el.value;
    }

    /* ── 헤더 컨트롤(엔진 표준): Play/Step/Reset + 시드 + 속도 ── */
    var hdr = doc.createElement('div');
    var btnPlay = mkBtn('▶ 재생'), btnStep = mkBtn('+1 tick'), btnReset = mkBtn('리셋');
    hdr.appendChild(btnPlay); hdr.appendChild(txt(' ')); hdr.appendChild(btnStep); hdr.appendChild(txt(' ')); hdr.appendChild(btnReset);
    panelEl.appendChild(hdr);

    var hdr2 = doc.createElement('div'); hdr2.className = 'ctl';
    hdr2.appendChild(txt('시드 '));
    var selSeed = mkSelect(seeds.map(function (s) { return [String(s), String(s)]; }), String(seeds[0]));
    hdr2.appendChild(selSeed);
    hdr2.appendChild(txt(' 속도 '));
    var selSpeed = mkSelect(speeds.map(function (s) { return [String(s), String(s)]; }), String(defSpeed));
    hdr2.appendChild(selSpeed); hdr2.appendChild(txt(' tick/frame'));
    panelEl.appendChild(hdr2);
    ctrls['__seed'] = { el: selSeed }; ctrls['__speed'] = { el: selSpeed };

    /* ── 패널 선언 컨트롤 ── */
    var rows = panel.controls || [];
    for (var ri = 0; ri < rows.length; ri++) {
      var rowDiv = doc.createElement('div'); rowDiv.className = 'ctl';
      var items = rows[ri].items || [];
      for (var ci = 0; ci < items.length; ci++) buildItem(rowDiv, items[ci]);
      panelEl.appendChild(rowDiv);
    }

    /* ── 통계표 ── */
    var table = doc.createElement('table');
    var statRows = panel.stats || [];
    var statCells = [];
    for (var si = 0; si < statRows.length; si++) {
      var tr = doc.createElement('tr');
      var tdk = doc.createElement('td'); tdk.className = 'k'; tdk.innerHTML = statRows[si].label;
      var tdv = doc.createElement('td'); tdv.className = 'v'; tdv.textContent = '-';
      tr.appendChild(tdk); tr.appendChild(tdv); table.appendChild(tr);
      statCells.push(tdv);
    }
    panelEl.appendChild(table);

    /* ── 범례 ── */
    if (panel.legend) {
      var leg = doc.createElement('div'); leg.className = 'legend'; leg.innerHTML = panel.legend;
      panelEl.appendChild(leg);
    }

    /* ── 시뮬 상태 ── */
    var sim = null, playing = false, msg = '', msgUntil = 0;
    var popHist = [], lastSampledTick = -1, tickAcc = 0;

    function currentParam(it) {
      /* 게이트 슬라이더: 게이트 체크 off → gateOff, on → 슬라이더 값 */
      if (it.kind === 'slider' && it.gateBy != null) {
        var on = val(it.gateBy);
        return on ? val(it.id) : (it.gateOff != null ? it.gateOff : 0);
      }
      if (it.kind === 'slider') return val(it.id);
      if (it.kind === 'check') return val(it.id);
      return undefined;
    }

    function buildParams() {
      var params = {};
      eachItem(panel, function (it) {
        if (it.param == null) return;
        params[it.param] = currentParam(it);
      });
      return params;
    }

    function reset() {
      var seed = parseInt(val('__seed'), 10);
      sim = core.createSim(seed, buildParams());
      popHist = []; lastSampledTick = -1; tickAcc = 0;
      if (panel.onReset) panel.onReset(api());
      draw();
    }

    /* api — 패널의 action/clickMode 핸들러에 넘기는 컨텍스트 */
    function api() {
      return {
        sim: sim, core: core, W: W, H: H, SCALE: SCALE,
        val: val, redraw: draw,
        toast: function (m, ms) { msg = m; msgUntil = perf() + (ms || 2500); }
      };
    }

    function draw() {
      var E = sim.E, d = img.data;
      /* 자동 명암: 'auto' 컨트롤이 있고 켜져 있으면 현재 최대 E 에 포화점을 맞춘다(바닥 1.0).
       * 목표값을 EMA 로 평활 — 강한 흐름 구배(기복 step-0009)에서 maxE 가 tick 간 출렁이면 화면 전체 밝기가
       * 떨린다. 평활로 체감 떨림을 죽인다(시뮬 불변 — 색 정규화 상수일 뿐, 추세는 따라간다). */
      var autoOn = ctrls['auto'] ? val('auto') : false;
      var satTarget = 8;
      if (autoOn) {
        var mx = 0; for (var q = 0; q < E.length; q++) if (E[q] > mx) mx = E[q];
        satTarget = mx > 1.0 ? mx : 1.0;
      }
      satSmooth = satSmooth > 0 ? satSmooth + 0.06 * (satTarget - satSmooth) : satTarget;
      var sat = satSmooth;
      for (var i = 0; i < E.length; i++) {
        var c = colorOf(E[i], sat);
        d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, cv.width, cv.height);

      /* source/sink 마커 */
      if (ov.sourceSink) {
        ctx.strokeStyle = '#6fce8a'; ctx.lineWidth = 1.5; ctx.beginPath();
        ctx.arc((sim.p.source.x + 0.5) * SCALE, (sim.p.source.y + 0.5) * SCALE, sim.p.source.r * SCALE, 0, 6.2832); ctx.stroke();
        ctx.strokeStyle = '#e07070'; ctx.beginPath();
        ctx.arc((sim.p.sink.x + 0.5) * SCALE, (sim.p.sink.y + 0.5) * SCALE, sim.p.sink.r * SCALE, 0, 6.2832); ctx.stroke();
      }
      /* 고임 오버레이 */
      var pools = (ov.pools && core.detectPools) ? core.detectPools(sim, poolOpts) : [];
      if (ov.pools) {
        ctx.strokeStyle = '#57d6e0'; ctx.lineWidth = 1.5;
        for (var k = 0; k < pools.length; k++) {
          ctx.beginPath();
          ctx.arc((pools[k].x + 0.5) * SCALE, (pools[k].y + 0.5) * SCALE, 7, 0, 6.2832); ctx.stroke();
        }
      }
      /* 생명 오버레이 — 채운 노란 원, 반지름 ∝ √생물량 */
      var ag = sim.agents || [];
      if (ov.life && ag.length) {
        ctx.fillStyle = '#f0d060'; ctx.strokeStyle = '#5a4a10'; ctx.lineWidth = 1;
        for (var a = 0; a < ag.length; a++) {
          var rr = 2 + 3.0 * Math.sqrt(Math.max(0, ag[a].m));
          if (rr > 14) rr = 14;
          ctx.beginPath();
          ctx.arc((ag[a].x + 0.5) * SCALE, (ag[a].y + 0.5) * SCALE, rr, 0, 6.2832);
          ctx.fill(); ctx.stroke();
        }
      }
      /* 개체군 무게중심 — 자홍 십자 */
      if (ov.centroid && core.centroid) {
        var ct = core.centroid(sim);
        if (ct) {
          var ccx = (ct.x + 0.5) * SCALE, ccy = (ct.y + 0.5) * SCALE;
          ctx.strokeStyle = '#ff5fd0'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(ccx - 7, ccy); ctx.lineTo(ccx + 7, ccy);
          ctx.moveTo(ccx, ccy - 7); ctx.lineTo(ccx, ccy + 7); ctx.stroke();
        }
      }
      /* 패널이 더하는 step 고유 오버레이(있으면) */
      if (panel.drawHook) panel.drawHook(ctx, { sim: sim, core: core, SCALE: SCALE, pools: pools });

      /* 개체수 스파크라인 — tick 진행 시에만 샘플 */
      if (ov.sparkline) {
        if (sim.tick !== lastSampledTick) {
          lastSampledTick = sim.tick;
          popHist.push(ag.length);
          if (popHist.length > 240) popHist.shift();
        }
        if (popHist.length > 1) {
          var gw = 150, gh = 48, gx = cv.width - gw - 8, gy = 8;
          ctx.fillStyle = 'rgba(20,22,26,0.80)'; ctx.fillRect(gx, gy, gw, gh);
          ctx.strokeStyle = '#3a4250'; ctx.lineWidth = 1; ctx.strokeRect(gx, gy, gw, gh);
          var mxp = 1; for (var pi = 0; pi < popHist.length; pi++) if (popHist[pi] > mxp) mxp = popHist[pi];
          ctx.strokeStyle = '#f0d060'; ctx.lineWidth = 1.5; ctx.beginPath();
          for (var pj = 0; pj < popHist.length; pj++) {
            var X = gx + (pj / (popHist.length - 1)) * gw;
            var Y = gy + gh - 2 - (popHist[pj] / mxp) * (gh - 14);
            if (pj === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
          }
          ctx.stroke();
          ctx.fillStyle = '#8a93a0'; ctx.font = '10px Consolas';
          ctx.fillText('개체수 ' + ag.length + ' (peak ' + mxp + ')', gx + 5, gy + 12);
        }
      }
      /* 메시지 토스트 */
      if (msg && perf() < msgUntil) {
        ctx.fillStyle = '#f0d060'; ctx.font = '14px Segoe UI';
        ctx.fillText(msg, 8, 20);
      }
      /* 통계표 갱신 */
      var m = core.measure(sim), led = core.ledger ? core.ledger(sim) : null;
      var sctx = { sim: sim, core: core, m: m, led: led, pools: pools };
      for (var s2 = 0; s2 < statRows.length; s2++) {
        var out = statRows[s2].get(sctx);
        var cell = statCells[s2];
        if (out && typeof out === 'object') {
          cell.textContent = out.text; cell.className = 'v ' + (out.cls || '');
        } else {
          cell.textContent = out; cell.className = 'v';
        }
      }
    }

    function frame() {
      if (!playing) return;
      /* 분수 속도 — 누적기로 평균 tick/frame 을 정확히 맞춘다(step-0006 그대로) */
      var spd = parseFloat(val('__speed'));
      tickAcc += spd;
      var n = Math.floor(tickAcc); tickAcc -= n;
      for (var i = 0; i < n; i++) core.step(sim);
      draw();
      global.requestAnimationFrame(frame);
    }

    /* ── 이벤트 배선 ── */
    btnPlay.addEventListener('click', function () {
      playing = !playing;
      btnPlay.textContent = playing ? '⏸ 정지' : '▶ 재생';
      if (playing) { tickAcc = 0; global.requestAnimationFrame(frame); }
    });
    btnStep.addEventListener('click', function () { core.step(sim); draw(); });
    btnReset.addEventListener('click', reset);
    selSeed.addEventListener('change', reset);

    /* 컨트롤 항목 빌더 — 배선 포함 */
    function buildItem(parent, it) {
      if (it.kind === 'check') {
        var lab = doc.createElement('label'); if (it.title) lab.title = it.title;
        var inp = doc.createElement('input'); inp.type = 'checkbox'; inp.id = it.id; inp.checked = !!it.def;
        lab.appendChild(inp); lab.appendChild(txt(' ' + it.label));
        parent.appendChild(lab); parent.appendChild(txt(' '));
        ctrls[it.id] = { el: inp, item: it };
        inp.addEventListener('change', function () {
          if (it.view) { draw(); return; }
          if (it.param != null) { sim.p[it.param] = inp.checked; }
          if (it.gateFor != null) {
            /* 이 체크가 게이트하는 슬라이더의 param 재계산 */
            var sl = ctrls[it.gateFor];
            if (sl && sl.item.param != null) { sim.p[sl.item.param] = currentParam(sl.item); }
          }
          draw();
        });
      } else if (it.kind === 'slider') {
        if (it.label) parent.appendChild(txt(it.label + ' '));
        var rng = doc.createElement('input'); rng.type = 'range'; rng.id = it.id;
        rng.min = it.min; rng.max = it.max; rng.step = it.step; rng.value = it.def;
        if (it.title) rng.title = it.title;
        var span = doc.createElement('span'); span.id = 'v_' + it.id;
        span.textContent = it.fixed != null ? it.def.toFixed(it.fixed) : String(it.def);
        parent.appendChild(rng); parent.appendChild(span); parent.appendChild(txt(' '));
        ctrls[it.id] = { el: rng, item: it };
        rng.addEventListener('input', function () {
          var v = parseFloat(rng.value);
          span.textContent = it.fixed != null ? v.toFixed(it.fixed) : String(v);
          if (it.param != null) sim.p[it.param] = currentParam(it);
        });
      } else if (it.kind === 'select') {
        if (it.label) parent.appendChild(txt(it.label + ' '));
        var sel = mkSelect(it.options, it.def);
        sel.id = it.id;
        parent.appendChild(sel); parent.appendChild(txt(' '));
        ctrls[it.id] = { el: sel, item: it };
      } else if (it.kind === 'button') {
        var b = mkBtn(it.label); b.id = it.id; if (it.title) b.title = it.title;
        parent.appendChild(b); parent.appendChild(txt(' '));
        ctrls[it.id] = { el: b, item: it };
        b.addEventListener('click', function () {
          var fn = panel.actions && panel.actions[it.action];
          if (fn) fn(api());
          draw();
        });
      }
    }

    /* 캔버스 클릭 — role:'click' 셀렉트 값에 따라 panel.clickModes 디스패치 */
    cv.addEventListener('click', function (ev) {
      if (!panel.clickModes) return;
      var modeSel = findClickSelect(panel);
      var mode = modeSel ? val(modeSel.id) : Object.keys(panel.clickModes)[0];
      var fn = panel.clickModes[mode];
      if (!fn) return;
      var rect = cv.getBoundingClientRect();
      var cx = Math.floor((ev.clientX - rect.left) / SCALE);
      var cy = Math.floor((ev.clientY - rect.top) / SCALE);
      fn(api(), cx, cy);
      draw();
    });

    reset();
    return { sim: function () { return sim; }, reset: reset, draw: draw };
  }

  function findClickSelect(panel) {
    var found = null;
    eachItem(panel, function (it) { if (it.kind === 'select' && it.role === 'click') found = it; });
    return found;
  }

  /* DOM 소도구 */
  function mkBtn(label) { var b = global.document.createElement('button'); b.textContent = label; return b; }
  function txt(s) { return global.document.createTextNode(s); }
  function mkSelect(options, def) {
    var sel = global.document.createElement('select');
    for (var i = 0; i < options.length; i++) {
      var o = global.document.createElement('option');
      o.value = options[i][0]; o.textContent = options[i][1];
      if (String(options[i][0]) === String(def)) o.selected = true;
      sel.appendChild(o);
    }
    return sel;
  }
  function perf() { return (global.performance && global.performance.now) ? global.performance.now() : Date.now(); }

  var api = { mount: mount, defaultParams: defaultParams, eachItem: eachItem, colorOf: colorOf, STD_SEEDS: STD_SEEDS, STD_SPEEDS: STD_SPEEDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.HWS = api;
})(typeof window !== 'undefined' ? window : globalThis);
