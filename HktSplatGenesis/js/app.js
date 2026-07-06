// HktSplatGenesis — 부트스트랩 + 유전자 UI + 렌더 루프
//
// "유전자(genotype) → 표현형(phenotype)" 이 이 프로젝트의 에셋 파이프라인이다.
// 프리셋은 유전자 공간의 한 점일 뿐 — 슬라이더로 연속 변형하면 중간 생물이 나온다.

(function () {
	'use strict';

	const { GENE_DEFS, PRESETS, hexToVec4 } = HktGenesisGenes; // js/presets.js 가 원본

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
		const g = HktGenesisGenes.materialize(p, emitter);
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
		// premultiplied: 무대(stage) 레이어 위에 캔버스 알파로 합성 (무대 꺼짐 = a1 클리어라 기존과 동일)
		// COPY_SRC: 하니스가 스왑체인을 readback 으로 촬영할 수 있게 (test/stage-shot.js)
		context.configure({
			device, format, alphaMode: 'premultiplied',
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
		});

		const engine = new HktGenesisEngine(device, context, format);
		const camera = new HktOrbitCamera(canvas);
		camera.radius = 4.5;

		// ── 패널 탭: 유전자 | 뼈대 | 무대 ──
		const TABS = ['genes', 'skel', 'stage'];
		for (const b of document.querySelectorAll('#tabs .tab')) {
			b.addEventListener('click', () => {
				document.querySelectorAll('#tabs .tab').forEach((x) => x.classList.toggle('on', x === b));
				for (const t of TABS) document.getElementById('tab-' + t).style.display = b.dataset.tab === t ? '' : 'none';
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

		// ── S 트랙 무대 UI: js/stage.js(ES module) 는 classic 스크립트보다 늦게 실행된다 —
		// 전역 접근은 항상 지연 getter 로 (부트 시점엔 HktGenesisStage 가 없을 수 있음) ──
		const stage = () => window.HktGenesisStage;
		const stageStatusEl = document.getElementById('stageStatus');
		let stageStatusBound = false;
		function bindStageStatus() {
			if (stageStatusBound || !stage()) return;
			stage().onStatus((html) => { stageStatusEl.innerHTML = html; });
			stageStatusBound = true;
		}
		document.getElementById('stageLoad').addEventListener('click', () => {
			const url = document.getElementById('stageUrl').value.trim();
			if (!url || !stage()) return;
			bindStageStatus();
			stage().load(url);
		});
		// 샘플 지형: repo 동봉 생성 에셋 — 무대(ply)와 collider(glb)를 한 번에 (오프라인 동작)
		document.getElementById('stageSample').addEventListener('click', () => {
			if (!stage()) return;
			bindStageStatus();
			document.getElementById('stageUrl').value = stage().SAMPLE_URL;
			stage().load(stage().SAMPLE_URL);
			fetch(stage().SAMPLE_URL.replace(/\.ply$/, '.glb')).then((r) => {
				if (!r.ok) throw new Error('HTTP ' + r.status);
				return r.arrayBuffer();
			}).then((buf) => loadColliderBuffer(buf, 'sample-terrain.glb'))
				.catch((e) => { stageStatusEl.innerHTML = '샘플 collider 로드 실패: ' + e.message; });
		});
		document.getElementById('stLod').addEventListener('change', (e) => {
			if (stage()) stage().setLod(e.target.checked);
		});
		document.getElementById('stageOn').addEventListener('change', (e) => {
			if (stage()) stage().setEnabled(e.target.checked);
		});
		// ── S2 충돌 지형: collider GLB → heightfield → 시뮬 바닥 ──
		// 삼각형 수프는 원본 좌표로 보관 — 정합 노브가 바뀌면 같은 변환으로 다시 굽는다
		let colliderTris = null, colliderName = '', bakeTimer = 0;
		let bakeCenter = [0, 0]; // 마지막 베이크 중심 (xz) — S5 버블 추종 판정
		// 베이크 영역 = 시뮬 버블 XZ (중심 ±4.8) — 버블이 움직이면 같은 영역을 다시 굽는다
		const hfRegion = (cx, cz) => ({ res: 128, originX: cx - 4.8, originZ: cz - 4.8, cell: 9.6 / 127 });
		function applyCollider(center, opts) {
			if (!colliderTris) return;
			const c = center || [camera.target[0], camera.target[2]];
			const tf = stage() ? stage().getTransform() : undefined;
			const hf = HktHeightfield.bake(colliderTris, Object.assign({ transform: tf }, hfRegion(c[0], c[1])));
			bakeCenter = c;
			engine.setHeightfield(hf);
			engine.setOccluder(colliderTris);      // S3: 같은 collider 가 가림의 근거
			engine.setOccluderTransform(tf);
			document.getElementById('stCollide').disabled = false;
			document.getElementById('stCollide').checked = true;
			if (opts && opts.silent) return; // 버블 추종 재베이크 — 상태/장면 유지
			stageStatusEl.innerHTML = `<b>충돌 지형 적용</b> — ${colliderName} · 커버리지 ${(hf.coverage * 100).toFixed(0)}%`;
			if (reseedFn) reseedFn(); // 나무 뿌리/재생성 지점이 지형을 반영하도록
		}
		// S5: 카메라 타깃이 베이크 중심에서 멀어지면 heightfield 를 새 버블 위치로 다시 굽는다
		let followCd = 0;
		function followCollider() {
			if (!colliderTris || !document.getElementById('stCollide').checked) return;
			if (++followCd < 30) return; // 매 프레임 검사 불필요 — 0.5초 간격
			followCd = 0;
			const dx = camera.target[0] - bakeCenter[0], dz = camera.target[2] - bakeCenter[1];
			if (dx * dx + dz * dz > 4) applyCollider([camera.target[0], camera.target[2]], { silent: true });
		}
		function rebakeCollider() { // 정합 슬라이더 조작 중 과도한 재베이크 방지
			if (!colliderTris || !document.getElementById('stCollide').checked) return;
			clearTimeout(bakeTimer);
			bakeTimer = setTimeout(applyCollider, 300);
		}
		function loadColliderBuffer(buf, name) {
			try {
				colliderTris = HktHeightfield.parseGLB(buf);
				colliderName = name;
				applyCollider();
			} catch (e) {
				stageStatusEl.innerHTML = 'collider 파싱 실패: ' + e.message;
			}
		}
		document.getElementById('stCollide').addEventListener('change', (e) => {
			if (e.target.checked) applyCollider();
			else { engine.setHeightfield(null); engine.setOccluder(null); reseedFn(); }
		});

		const stageDrop = document.getElementById('stageDrop');
		const stageFile = document.getElementById('stageFile');
		function loadStageFile(f) {
			if (!f) return;
			if (/\.glb$/i.test(f.name)) { // collider 경로 — 무대(비주얼)와 별개
				const r = new FileReader();
				r.onload = () => loadColliderBuffer(r.result, f.name);
				r.readAsArrayBuffer(f);
				return;
			}
			if (!stage()) return;
			bindStageStatus();
			stage().load(f);
		}
		['dragover', 'dragenter'].forEach((ev) => stageDrop.addEventListener(ev, (e) => { e.preventDefault(); stageDrop.classList.add('hot'); }));
		['dragleave', 'drop'].forEach((ev) => stageDrop.addEventListener(ev, (e) => { e.preventDefault(); stageDrop.classList.remove('hot'); }));
		stageDrop.addEventListener('drop', (e) => loadStageFile(e.dataTransfer.files[0]));
		stageDrop.addEventListener('click', () => stageFile.click());
		stageFile.addEventListener('change', (e) => loadStageFile(e.target.files[0]));
		// 정합 노브 → stage.setTransform (Marble 좌표계를 생명 월드에 맞추는 유일한 통로)
		// collider heightfield 도 같은 변환을 쓰므로 노브가 바뀌면 재베이크 (디바운스)
		for (const [id, key] of [['stX', 'x'], ['stY', 'y'], ['stZ', 'z'], ['stScale', 'scale'], ['stYaw', 'yawDeg']]) {
			const el = document.getElementById(id);
			el.addEventListener('input', () => {
				el.nextElementSibling.textContent = el.value;
				if (stage()) stage().setTransform({ [key]: parseFloat(el.value) });
				rebakeCollider();
			});
		}
		document.getElementById('stFlip').addEventListener('change', (e) => {
			if (stage()) stage().setTransform({ flip: e.target.checked });
			rebakeCollider();
		});

		// ?collider= 딥링크 (하니스/재현용) — 무대 ?world= 와 대칭
		const colliderUrl = new URLSearchParams(location.search).get('collider');
		if (colliderUrl) {
			fetch(colliderUrl).then((r) => {
				if (!r.ok) throw new Error('HTTP ' + r.status);
				return r.arrayBuffer();
			}).then((buf) => loadColliderBuffer(buf, colliderUrl))
				.catch((e) => { stageStatusEl.innerHTML = 'collider 로드 실패: ' + e.message; });
		}

		const countSel = document.getElementById('count');
		engine.setScene(parseInt(countSel.value), sceneEntities);
		countSel.addEventListener('change', () => engine.setScene(parseInt(countSel.value), sceneEntities));
		document.getElementById('reseed').addEventListener('click', () => { engine.setScene(engine.count, sceneEntities); simTime = 0; });
		reseedFn = () => { engine.setScene(engine.count, sceneEntities); simTime = 0; }; // 성장 시계도 리셋

		// ?scatter=<seed> — 절차 월드 개체 스트리밍 (T4). 지형 시각은 &tiles=<seed> 로 함께 켠다
		// (무대 타일과 같은 시드면 지형·개체가 정합). 장면을 8 void 슬롯으로 두고 스캐터가 채운다.
		let scatterMode = false, scatterWorld = null, scatterBakeAt = null, scatterCd = 0;
		const scatterSeed = new URLSearchParams(location.search).get('scatter');
		if (scatterSeed != null && window.HktGenesisScatter && window.HktGenesisTerrainGen) {
			scatterWorld = HktGenesisTerrainGen.world({ seed: parseInt(scatterSeed) || 1 });
			const scatterCfg = { radius: 20, slotStart: 0, slotCount: 8, cell: 6, density: 0.6 };
			const initScatter = () => {
				sceneEntities = Array.from({ length: 8 }, () => HktGenesisScatter.voidGenes());
				engine.setScene(engine.count, sceneEntities);
				HktGenesisScatter.configure(engine, scatterWorld, scatterCfg);
			};
			initScatter();
			reseedFn = () => { initScatter(); simTime = 0; }; // 스캐터 모드 재시드 = 슬롯 재구성
			// 개체 수 변경(setScene 재초기화) 뒤 슬롯을 다시 구성 (원 핸들러 다음에 실행)
			countSel.addEventListener('change', () => HktGenesisScatter.configure(engine, scatterWorld, scatterCfg));
			// T5 공용 fog — 무대(three)·생명(렌더 셰이더)에 같은 색·거리 (원거리 소실 톤 일치)
			const FOG = { hex: 0x93b4d6, color: [0.576, 0.706, 0.839], near: 16, far: 50 };
			engine.setFog(FOG);
			if (stage()) stage().setFog(FOG);
			scatterMode = true;
		}

		const pauseChk = document.getElementById('pause');
		const fpsEl = document.getElementById('fps');
		let last = performance.now(), simTime = 0, fpsAvg = 0, stageMs = 0, lifeMs = 0, frameMs = 0;

		// ── T6 계측 HUD (?hud=1) — 청크 월드 예산 관찰: 프레임 타임 분해(WebGL2 무대 vs
		// WebGPU 생명, CPU 인코드 시간 근사), 스플랫·메시 수, 타일 교체 지연, 메모리. 실 GPU
		// 프레임 시간(GPU 타임스탬프)이 아니라 CPU 인코드 시간이라 상대 비교·추세용 — 절대 60fps
		// 판정은 실 GPU 에서. swiftshader(헤드리스)는 CPU 라 수치가 실기와 다르다. ──
		const hudOn = new URLSearchParams(location.search).get('hud') != null;
		let hudEl = null, hudCd = 0;
		if (hudOn) {
			hudEl = document.createElement('div');
			hudEl.id = 'hud';
			hudEl.style.cssText = 'position:fixed;top:8px;right:8px;z-index:9999;font:11px/1.55 ui-monospace,monospace;color:#bfe;background:rgba(6,8,14,0.72);padding:8px 11px;border-radius:7px;white-space:pre;pointer-events:none;border:1px solid rgba(120,170,220,0.25)';
			document.body.appendChild(hudEl);
		}
		function updateHud() {
			if (!hudEl || --hudCd > 0) return;
			hudCd = 6; // ~0.1s 간격
			const mem = (performance.memory && performance.memory.usedJSHeapSize) ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + 'MB' : 'n/a';
			const lifeN = engine.count, lifeMB = (lifeN * 48 / 1048576).toFixed(1);
			let stageLine = '무대: off';
			if (stage() && stage().tiledMode && stage().tileStats) {
				const ts = stage().tileStats();
				stageLine = `무대 타일 ${ts.meshes}${ts.waterMeshes ? '(+물 ' + ts.waterMeshes + ')' : ''} · ${(ts.splats / 1000).toFixed(0)}k spl · 교체 ${ts.lastTileMs.toFixed(0)}ms`;
			} else if (stage() && stage().hasWorld) {
				stageLine = '무대: 단일 월드';
			}
			hudEl.textContent =
				`FPS ${fpsAvg.toFixed(0)}  frame ${frameMs.toFixed(1)}ms\n` +
				`life(WebGPU enc) ${lifeMs.toFixed(1)}ms\n` +
				`stage(WebGL2 enc) ${stageMs.toFixed(1)}ms\n` +
				`생명 ${(lifeN / 1024).toFixed(0)}k spl · ${lifeMB}MB\n` +
				`${stageLine}\n` +
				`JS heap ${mem}` +
				(hudOn ? '\n(enc=CPU 인코드, 실 GPU 시간 아님)' : '');
		}

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
			frameMs = frameMs * 0.9 + dt * 1000 * 0.1; // T6: 총 프레임 시간(rAF 간격)

			const aspect = canvas.width / canvas.height;
			const focalY = 0.5 * canvas.height / Math.tan(camera.fov / 2);
			// L6: 살(fleshK) 개체가 있을 때만 뼈대 FK — 세그먼트가 살 규칙의 유일한 형태 입력
			let bones = null;
			if (sceneEntities.some((g) => g.fleshK > 0)) {
				bones = (skel.clip === 'external' && extSkel)
					? extSkel.pose(pauseChk.checked ? 0 : dt, skel.speed, skel.fat) // 외부 클립은 증분 시간
					: skeleton.pose(skel.clip, simTime, skel.speed, skel.fat);       // built-in 은 절대 시간
			}
			// T4 스캐터: 카메라 타깃 밑 지형을 함수로 직접 베이크(버블 창)하고 근접 개체를 슬롯에 스트리밍
			if (scatterMode) {
				if (--scatterCd <= 0) {
					scatterCd = 12; // 0.2초 간격 재베이크 (버블 창)
					const tx = camera.target[0], tz = camera.target[2];
					if (!scatterBakeAt || (tx - scatterBakeAt[0]) ** 2 + (tz - scatterBakeAt[1]) ** 2 > 4) {
						engine.setHeightfield(HktHeightfield.bakeFn((x, z) => scatterWorld.height(x, z),
							{ res: 128, originX: tx - 4.8, originZ: tz - 4.8, cell: 9.6 / 127 }));
						scatterBakeAt = [tx, tz];
					}
				}
				HktGenesisScatter.update(camera.target[0], camera.target[2]);
			}
			// S 트랙: 무대가 켜져 있으면 생명 캔버스는 투명 클리어 → 무대 위 알파 합성
			bindStageStatus();
			const stageOn = stage() && stage().enabled;
			if (stageOn) {
				const t0 = performance.now();
				stage().frame(camera, canvas.clientWidth, canvas.clientHeight);
				stageMs = stageMs * 0.9 + (performance.now() - t0) * 0.1; // S4 예산 계측 (CPU 인코드 시간)
			}
			const l0 = performance.now();
			engine.frame({
				dt, time: simTime, genes, entities: sceneEntities, paused: pauseChk.checked, pull,
				bones, showBones: skel.bones,
				background: stageOn ? { r: 0, g: 0, b: 0, a: 0 } : undefined,
				gridCenter: engine.bubbleCenter(camera.target), // S5 버블 + T3 y 지형 추종
				view: camera.view(), proj: camera.proj(aspect),
				viewport: [canvas.width, canvas.height], focal: [focalY, focalY],
			});
			lifeMs = lifeMs * 0.9 + (performance.now() - l0) * 0.1; // T6: 생명(WebGPU) CPU 인코드 시간
			followCollider(); // S5: heightfield 베이크 영역도 버블을 따라 (재시드 없음)
			// 하니스 훅: 스왑체인 readback 은 present 전(같은 태스크)이어야 한다 — test/README 함정
			if (window.__hktAfterFrame) window.__hktAfterFrame({ device, context, canvas, camera, engine });

			updateHud();
			fpsAvg = fpsAvg * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
			fpsEl.textContent = `${fpsAvg.toFixed(0)} fps · ${(engine.count / 1024).toFixed(0)}k splats` +
				(stageOn ? ` · 무대 ${stageMs.toFixed(1)}ms` : '');
			requestAnimationFrame(tick);
		}
		requestAnimationFrame(tick);
	}

	boot().catch((e) => { console.error(e); fail('초기화 실패: ' + e.message); });
})();
