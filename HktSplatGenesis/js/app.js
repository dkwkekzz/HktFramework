// HktSplatGenesis — 부트스트랩 + 유전자 UI + 렌더 루프
//
// "유전자(genotype) → 표현형(phenotype)" 이 이 프로젝트의 에셋 파이프라인이다.
// 프리셋은 유전자 공간의 한 점일 뿐 — 슬라이더로 연속 변형하면 중간 생물이 나온다.

(function () {
	'use strict';

	// ── 유전자 정의: [라벨, min, max, step] ──────────────────────────────
	const GENE_DEFS = {
		cohesion:   ['응집력',      0,    14,   0.1],
		volatility: ['휘발성(난류)', 0,    8,    0.1],
		updraft:    ['상승력',      -3,   5,    0.1],
		damping:    ['감쇠',        0,    6,    0.05],
		lifeBase:   ['수명(초)',    0.3,  6,    0.1],
		emitRadius: ['방사 반경',   0.05, 2,    0.05],
		flowFreq:   ['난류 스케일', 0.3,  8,    0.1],
		flowSpeed:  ['난류 속도',   0,    4,    0.05],
		size:       ['크기',        0.005, 0.15, 0.005],
		stretch:    ['신축(이방성)', 0,    3,    0.05],
		opacity:    ['불투명도',    0.02, 1,    0.02],
		luminosity: ['발광',        0,    4,    0.1],
	};

	// ── 원소 프리셋: 유전자 값만 다르고 시스템은 동일 — 속성이 형태를 만든다 ──
	const PRESETS = {
		'불의 정령': {
			cohesion: 2.5, volatility: 3.4, updraft: 2.2, damping: 1.2,
			lifeBase: 1.6, emitRadius: 0.35, flowFreq: 2.2, flowSpeed: 1.6,
			size: 0.035, stretch: 1.1, opacity: 0.5, luminosity: 2.4,
			colorA: '#a81c06', colorB: '#ffe08a',
		},
		'물의 정령': {
			cohesion: 9.0, volatility: 1.2, updraft: -0.4, damping: 2.4,
			lifeBase: 4.0, emitRadius: 0.55, flowFreq: 3.2, flowSpeed: 0.8,
			size: 0.05, stretch: 0.6, opacity: 0.55, luminosity: 0.9,
			colorA: '#0a2a8a', colorB: '#7fe9ff',
		},
		'숲의 정령': {
			cohesion: 3.5, volatility: 1.9, updraft: 0.6, damping: 1.6,
			lifeBase: 3.2, emitRadius: 0.85, flowFreq: 1.3, flowSpeed: 0.55,
			size: 0.045, stretch: 1.6, opacity: 0.45, luminosity: 1.3,
			colorA: '#0d3410', colorB: '#a8ff6b',
		},
	};

	const genes = {};        // 현재 유전자 (숫자) + colorA/colorB 는 vec4 배열로 유지
	let currentColors = { colorA: '#a81c06', colorB: '#ffe08a' };

	function hexToVec4(hex) {
		const v = parseInt(hex.slice(1), 16);
		return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255, 1];
	}

	function applyPreset(p) {
		for (const k of Object.keys(GENE_DEFS)) {
			genes[k] = p[k];
			const el = document.getElementById('g-' + k);
			el.value = p[k];
			el.nextElementSibling.textContent = p[k];
		}
		currentColors = { colorA: p.colorA, colorB: p.colorB };
		document.getElementById('colorA').value = p.colorA;
		document.getElementById('colorB').value = p.colorB;
		genes.colorA = hexToVec4(p.colorA);
		genes.colorB = hexToVec4(p.colorB);
	}

	function buildPanel() {
		const panel = document.getElementById('genes');
		for (const [k, [label, min, max, step]] of Object.entries(GENE_DEFS)) {
			const row = document.createElement('div');
			row.className = 'row';
			row.innerHTML = `<label>${label}</label>` +
				`<input type="range" id="g-${k}" min="${min}" max="${max}" step="${step}">` +
				`<span class="val"></span>`;
			panel.appendChild(row);
			const el = row.querySelector('input');
			el.addEventListener('input', () => {
				genes[k] = parseFloat(el.value);
				el.nextElementSibling.textContent = el.value;
			});
		}
		for (const c of ['colorA', 'colorB']) {
			document.getElementById(c).addEventListener('input', (e) => {
				currentColors[c] = e.target.value;
				genes[c] = hexToVec4(e.target.value);
			});
		}
		const presetBox = document.getElementById('presets');
		for (const name of Object.keys(PRESETS)) {
			const b = document.createElement('button');
			b.textContent = name;
			b.addEventListener('click', () => applyPreset(PRESETS[name]));
			presetBox.appendChild(b);
		}
	}

	function fail(msg) {
		document.getElementById('overlay').textContent = msg;
		document.getElementById('overlay').style.display = 'flex';
	}

	async function boot() {
		buildPanel();
		applyPreset(PRESETS['불의 정령']);

		if (!navigator.gpu) return fail('이 브라우저는 WebGPU 를 지원하지 않습니다 (Chrome/Edge 113+ 필요).');
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) return fail('WebGPU 어댑터를 얻지 못했습니다. chrome://flags 의 WebGPU 설정을 확인하세요.');
		const device = await adapter.requestDevice();
		device.addEventListener('uncapturederror', (e) => console.error('[HktSplatGenesis] GPU 오류:', e.error.message));

		const canvas = document.getElementById('gpu');
		const context = canvas.getContext('webgpu');
		const format = navigator.gpu.getPreferredCanvasFormat();
		context.configure({ device, format, alphaMode: 'opaque' });

		const engine = new HktGenesisEngine(device, context, format);
		const camera = new HktOrbitCamera(canvas);
		camera.radius = 4.5;

		const countSel = document.getElementById('count');
		engine.setCount(parseInt(countSel.value), genes);
		countSel.addEventListener('change', () => engine.setCount(parseInt(countSel.value), genes));
		document.getElementById('reseed').addEventListener('click', () => engine.setCount(engine.count, genes));

		const pauseChk = document.getElementById('pause');
		const fpsEl = document.getElementById('fps');
		let last = performance.now(), simTime = 0, fpsAvg = 0;

		function resize() {
			const dpr = Math.min(devicePixelRatio || 1, 2);
			const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
			if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
		}

		function tick(now) {
			resize();
			const dt = Math.min((now - last) / 1000, 0.05); // 탭 복귀 시 폭주 방지
			last = now;
			if (!pauseChk.checked) simTime += dt;

			const aspect = canvas.width / canvas.height;
			const focalY = 0.5 * canvas.height / Math.tan(camera.fov / 2);
			engine.frame({
				dt, time: simTime, genes, paused: pauseChk.checked,
				view: camera.view(), proj: camera.proj(aspect),
				viewport: [canvas.width, canvas.height], focal: [focalY, focalY],
			});

			fpsAvg = fpsAvg * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
			fpsEl.textContent = `${fpsAvg.toFixed(0)} fps · ${(engine.count / 1024).toFixed(0)}k splats`;
			requestAnimationFrame(tick);
		}
		requestAnimationFrame(tick);
	}

	boot().catch((e) => { console.error(e); fail('초기화 실패: ' + e.message); });
})();
