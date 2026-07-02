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
		damping:    ['감쇠',        0,    14,   0.05],
		lifeBase:   ['수명(초)',    0.3,  6,    0.1],
		emitRadius: ['방사 반경',   0.05, 2,    0.05],
		flowFreq:   ['난류 스케일', 0.3,  8,    0.1],
		flowSpeed:  ['난류 속도',   0,    4,    0.05],
		size:       ['크기',        0.005, 0.15, 0.005],
		stretch:    ['신축(이방성)', 0,    3,    0.05],
		opacity:    ['불투명도',    0.02, 1,    0.02],
		luminosity: ['발광',        0,    4,    0.1],
		// ── L2: 이웃 규칙 유전자 ──
		gravity:    ['중력',        0,    15,   0.1],
		binding:    ['이웃 응집',   0,    30,   0.5],
		restDist:   ['휴지 간격',   0.3,  0.95, 0.05],
		viscosity:  ['점성',        0,    12,   0.5],
		reach:      ['이웃 반경',   0.06, 0.3,  0.01],
		mortality:  ['필멸(0/1)',   0,    1,    1],
		// ── L3: 골격(클러스터) 유전자 ──
		rigid:      ['강성',        0,    1,    0.05],
		toughness:  ['인성(파단)',  0.2,  3,    0.05],
		bondK:      ['골격 결합',   0,    500,  5],
		// ── L4: 성장/연소 유전자 ──
		growRate:   ['성장 속도',   0,    0.6,  0.01],
		flamm:      ['가연성',      0,    3,    0.1],
		// ── L5: 상호작용 유전자 ──
		heatEmit:   ['발열',        0,    2,    0.1],
		// ── L6: 뼈대 SDF 살 유전자 ──
		fleshK:     ['살 강성(SDF)', 0,   80,   1],
	};

	// ── 원소 프리셋: 유전자 값만 다르고 시스템은 동일 — 속성이 형태를 만든다 ──
	const PRESETS = {
		'불의 정령': {
			cohesion: 2.5, volatility: 3.4, updraft: 2.2, damping: 1.2,
			lifeBase: 1.6, emitRadius: 0.35, flowFreq: 2.2, flowSpeed: 1.6,
			size: 0.035, stretch: 1.1, opacity: 0.5, luminosity: 2.4,
			gravity: 0, binding: 0, restDist: 0.6, viscosity: 0, reach: 0.14, mortality: 1,
			rigid: 0, toughness: 1, bondK: 0, growRate: 0, flamm: 0, heatEmit: 1.2, fleshK: 0,
			colorA: '#a81c06', colorB: '#ffe08a',
		},
		'물': {
			cohesion: 1.2, volatility: 0.3, updraft: 0, damping: 1.0,
			lifeBase: 4.0, emitRadius: 0.9, flowFreq: 1.0, flowSpeed: 0.4,
			size: 0.05, stretch: 0.8, opacity: 0.65, luminosity: 0.8,
			gravity: 7, binding: 10, restDist: 0.55, viscosity: 6, reach: 0.15, mortality: 0,
			rigid: 0, toughness: 1, bondK: 0, growRate: 0, flamm: 0, heatEmit: 0, fleshK: 0,
			colorA: '#0a2a8a', colorB: '#7fe9ff',
		},
		'숲의 정령': {
			cohesion: 3.5, volatility: 1.9, updraft: 0.6, damping: 1.6,
			lifeBase: 3.2, emitRadius: 0.85, flowFreq: 1.3, flowSpeed: 0.55,
			size: 0.045, stretch: 1.6, opacity: 0.45, luminosity: 1.3,
			gravity: 0, binding: 0, restDist: 0.6, viscosity: 0, reach: 0.14, mortality: 1,
			rigid: 0, toughness: 1, bondK: 0, growRate: 0, flamm: 0, heatEmit: 0, fleshK: 0,
			colorA: '#0d3410', colorB: '#a8ff6b',
		},
		'나무': {
			cohesion: 0, volatility: 2.4, updraft: 0, damping: 2.0,
			lifeBase: 3.0, emitRadius: 0.5, flowFreq: 1.8, flowSpeed: 0.9,
			size: 0.05, stretch: 0.8, opacity: 0.75, luminosity: 0.8,
			gravity: 0, binding: 0, restDist: 0.6, viscosity: 0, reach: 0.12, mortality: 0,
			rigid: 0, toughness: 1, bondK: 0, growRate: 0.12, flamm: 1.2, heatEmit: 0, fleshK: 0, form: 2,
			colorA: '#5a4a2e', colorB: '#86e05c',
		},
		'돌골렘': {
			cohesion: 0, volatility: 0, updraft: 0, damping: 2.5,
			lifeBase: 4.0, emitRadius: 0.9, flowFreq: 1.0, flowSpeed: 0.3,
			size: 0.055, stretch: 0.3, opacity: 0.9, luminosity: 0.6,
			gravity: 6, binding: 0, restDist: 0.6, viscosity: 0, reach: 0.14, mortality: 0,
			rigid: 0.5, toughness: 0.5, bondK: 300, form: 1, growRate: 0, flamm: 0, heatEmit: 0, fleshK: 0,
			colorA: '#57534b', colorB: '#ff9b3d',
		},
		'슬라임': {
			cohesion: 3.0, volatility: 0.25, updraft: 0, damping: 2.0,
			lifeBase: 4.0, emitRadius: 0.9, flowFreq: 1.0, flowSpeed: 0.3,
			size: 0.06, stretch: 0.5, opacity: 0.8, luminosity: 0.5,
			gravity: 4, binding: 14, restDist: 0.6, viscosity: 8, reach: 0.16, mortality: 0,
			rigid: 0, toughness: 1, bondK: 0, growRate: 0, flamm: 0, heatEmit: 0, fleshK: 0,
			colorA: '#1c7a2f', colorB: '#b7ff5e',
		},
		// L6: 뼈대 SDF 살 — 구름으로 태어난 스플랫이 제 뼈(부피 가중 친화)를 찾아가
		// 살이 된다. 뼈대 자체는 skeleton.js (FK + 살 문법), 여기 유전자는 살의 재질만.
		'히키토': {
			cohesion: 0, volatility: 0.15, updraft: 0, damping: 9.0,
			lifeBase: 4.0, emitRadius: 1.0, flowFreq: 1.5, flowSpeed: 0.6,
			size: 0.035, stretch: 0.5, opacity: 0.9, luminosity: 0.5,
			gravity: 1.0, binding: 0, restDist: 0.9, viscosity: 0, reach: 0.13, mortality: 0,
			rigid: 0, toughness: 1, bondK: 0, growRate: 0, flamm: 0, heatEmit: 0, fleshK: 60,
			emitter: [0, 1.0, 0], form: 3,
			colorA: '#7a3b2a', colorB: '#ffd9a8',
		},
	};

	const genes = {};        // 현재 유전자 (숫자) + colorA/colorB 는 vec4 배열로 유지
	let currentColors = { colorA: '#a81c06', colorB: '#ffe08a' };
	let reseedFn = null;     // boot 이후 연결 — 프리셋 전환 시 형태(form) 재생성용
	let sceneEntities = [genes]; // 장면의 개체 목록 — 개체 0 은 항상 genes(슬라이더 연동)

	// ── L6 뼈대: FK 는 CPU(관절 53개), 살은 GPU(fleshK 유전자) — skeleton.js 참조 ──
	const skeleton = new HktGenesisSkeleton.Skeleton();
	const skel = { clip: 'walk', speed: 1.0, fat: 1.0, bones: true };
	let extSkel = null; // FBX 드롭으로 불러온 외부 리그 (없으면 built-in)

	// 뼈 친화(rest.w) 배정 기준 세그먼트 — 현재 모션 소스와 같은 리그/순서여야 한다
	function currentBindBones() {
		return (skel.clip === 'external' && extSkel) ? extSkel.pose(0, 1, 1) : skeleton.pose('idle', 0, 1, 1);
	}

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
		genes.form = p.form || 0; // 0 = 코어 구름, 1 = 골렘, 2 = 나무, 3 = 살 구름 (setScene 이 해석)
		genes.emitter = p.emitter || [0, 0.6, 0];
		// form 3: 뼈 친화 배정 기준이 되는 바인드 세그먼트 (순서 = 매 프레임 pose 와 동일)
		if (genes.form === 3) genes.bindBones = currentBindBones();
		sceneEntities = [genes];  // 단일 개체 장면
		if (reseedFn) reseedFn(); // 프리셋 = 새 존재 → 형태 재생성
	}

	// 프리셋 → 독립 유전자 사본 (장면의 부가 개체용 — 슬라이더 비연동)
	function prepGenes(p, emitter) {
		const g = {};
		for (const k of Object.keys(GENE_DEFS)) g[k] = p[k];
		g.colorA = hexToVec4(p.colorA);
		g.colorB = hexToVec4(p.colorB);
		g.form = p.form || 0;
		g.emitter = emitter || p.emitter || [0, 0.6, 0];
		if (g.form === 3) g.bindBones = currentBindBones();
		return g;
	}

	// ── L5 장면: 다중 개체 공존 — 개체 간 상호작용은 공유 격자의 창발 ──
	const SCENES = {
		'불×나무': () => {
			applyPreset(PRESETS['나무']); // 개체 0 = 나무 (슬라이더 연동)
			const fire = prepGenes(PRESETS['불의 정령'], [1.15, 0.35, 0]);
			// 나무 곁의 작은 모닥불 — 플룸이 수관을 삼키지 않게 축소
			fire.emitRadius = 0.22;
			fire.lifeBase = 1.0;
			fire.updraft = 1.5;
			fire.size = 0.03;
			sceneEntities = [genes, fire];
			if (reseedFn) reseedFn();
		},
	};

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
		const sceneBox = document.getElementById('scenes');
		for (const [name, fn] of Object.entries(SCENES)) {
			const b = document.createElement('button');
			b.textContent = name;
			b.addEventListener('click', fn);
			sceneBox.appendChild(b);
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

		// ── 패널 탭: 유전자 | 뼈대 ──
		for (const b of document.querySelectorAll('#tabs .tab')) {
			b.addEventListener('click', () => {
				document.querySelectorAll('#tabs .tab').forEach((x) => x.classList.toggle('on', x === b));
				document.getElementById('tab-genes').style.display = b.dataset.tab === 'genes' ? '' : 'none';
				document.getElementById('tab-skel').style.display = b.dataset.tab === 'skel' ? '' : 'none';
			});
		}

		// L6 뼈대 UI (skeleton/skel 은 모듈 스코프 — applyPreset 의 bindBones 계산과 공유)
		document.getElementById('skelClip').addEventListener('change', (e) => {
			const wasExternal = skel.clip === 'external';
			skel.clip = e.target.value;
			// built-in ↔ 외부 리그 전환은 세그먼트 수/순서가 달라지므로 친화 재배정
			if (wasExternal !== (skel.clip === 'external') && genes.form === 3) {
				genes.bindBones = currentBindBones();
				if (reseedFn) reseedFn();
			}
		});
		for (const [id, key] of [['skelSpeed', 'speed'], ['skelFat', 'fat']]) {
			const el = document.getElementById(id);
			el.addEventListener('input', () => {
				skel[key] = parseFloat(el.value);
				el.nextElementSibling.textContent = el.value;
			});
		}
		document.getElementById('skelBones').addEventListener('change', (e) => { skel.bones = e.target.checked; });

		// ── FBX 드롭: 실제 Mixamo 클립 — hikito-flesh 의 드롭존 대응 ──
		const drop = document.getElementById('drop');
		const fbxFile = document.getElementById('fbxFile');
		const statusEl = document.getElementById('skelStatus');
		const setStatus = (html) => { statusEl.innerHTML = html; };
		setStatus(typeof THREE !== 'undefined' && THREE.FBXLoader
			? 'FBX 로더 준비됨 — Mixamo FBX 를 드롭하세요.'
			: 'vendor/three.min.js 미로드 — FBX 드롭 비활성.');
		function loadFBXBuffer(buf, name) {
			try {
				extSkel = HktGenesisSkeleton.parseFBX(buf);
				document.getElementById('extOpt').disabled = false;
				document.getElementById('skelClip').value = 'external';
				skel.clip = 'external';
				// 새 리그 기준으로 뼈 친화 재배정 — 살이 새 뼈대로 옮겨 자란다
				if (genes.form === 3) {
					genes.bindBones = currentBindBones();
					if (reseedFn) reseedFn();
				}
				setStatus(`<b>불러오기 완료</b> — ${name}` +
					(extSkel.clipName ? ` · 클립 “${extSkel.clipName}”` : ' · 클립 없음(바인드 포즈)') +
					` · 뼈 ${extSkel.bones.length}개`);
			} catch (e) {
				setStatus('FBX 파싱 실패: ' + e.message);
			}
		}
		function readFBXFile(f) {
			if (!f) return;
			setStatus('읽는 중… ' + f.name);
			const r = new FileReader();
			r.onload = () => loadFBXBuffer(r.result, f.name);
			r.readAsArrayBuffer(f);
		}
		['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('hot'); }));
		['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('hot'); }));
		drop.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) readFBXFile(e.dataTransfer.files[0]); });
		drop.addEventListener('click', () => fbxFile.click());
		fbxFile.addEventListener('change', (e) => readFBXFile(e.target.files[0]));

		const countSel = document.getElementById('count');
		engine.setScene(parseInt(countSel.value), sceneEntities);
		countSel.addEventListener('change', () => engine.setScene(parseInt(countSel.value), sceneEntities));
		document.getElementById('reseed').addEventListener('click', () => { engine.setScene(engine.count, sceneEntities); simTime = 0; });
		reseedFn = () => { engine.setScene(engine.count, sceneEntities); simTime = 0; }; // 성장 시계도 리셋

		const pauseChk = document.getElementById('pause');
		const fpsEl = document.getElementById('fps');
		let last = performance.now(), simTime = 0, fpsAvg = 0;

		// ── Alt+드래그 인력: 화면 광선 ∩ 수평면(카메라 타겟 높이) 을 인력점으로 ──
		const pull = [0, 0, 0, 0];
		function pullPointFromEvent(e) {
			const rect = canvas.getBoundingClientRect();
			const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
			const ny = 1 - ((e.clientY - rect.top) / rect.height) * 2;
			const th = Math.tan(camera.fov / 2);
			const aspect = canvas.width / canvas.height;
			const eye = camera._eye();
			// 카메라 기저: forward = target - eye
			let f = [camera.target[0] - eye[0], camera.target[1] - eye[1], camera.target[2] - eye[2]];
			const fl = Math.hypot(...f); f = f.map((v) => v / fl);
			let r = [f[2], 0, -f[0]]; // cross(f, up)
			const rl = Math.hypot(...r) || 1; r = r.map((v) => v / rl);
			const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
			const dir = [0, 1, 2].map((i) => r[i] * nx * th * aspect + u[i] * ny * th + f[i]);
			const t = (camera.target[1] - eye[1]) / dir[1]; // 카메라 타겟 높이의 수평면
			if (!isFinite(t) || t <= 0) return null;
			return [eye[0] + dir[0] * t, eye[1] + dir[1] * t, eye[2] + dir[2] * t];
		}
		canvas.addEventListener('pointerdown', (e) => {
			if (!e.altKey) return;
			const p = pullPointFromEvent(e);
			if (p) { pull[0] = p[0]; pull[1] = p[1]; pull[2] = p[2]; pull[3] = 55; }
		});
		canvas.addEventListener('pointermove', (e) => {
			if (pull[3] <= 0) return;
			if (!e.altKey || e.buttons === 0) { pull[3] = 0; return; }
			const p = pullPointFromEvent(e);
			if (p) { pull[0] = p[0]; pull[1] = p[1]; pull[2] = p[2]; }
		});
		canvas.addEventListener('pointerup', () => { pull[3] = 0; });

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
			// L6: 살(fleshK) 개체가 있을 때만 뼈대 FK — 세그먼트가 살 규칙의 유일한 형태 입력
			let bones = null;
			if (sceneEntities.some((g) => g.fleshK > 0)) {
				bones = (skel.clip === 'external' && extSkel)
					? extSkel.pose(pauseChk.checked ? 0 : dt, skel.speed, skel.fat) // 외부 클립은 증분 시간
					: skeleton.pose(skel.clip, simTime, skel.speed, skel.fat);       // built-in 은 절대 시간
			}
			engine.frame({
				dt, time: simTime, genes, entities: sceneEntities, paused: pauseChk.checked, pull,
				bones, showBones: skel.bones,
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
