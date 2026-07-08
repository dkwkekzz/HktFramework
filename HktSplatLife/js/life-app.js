// HktSplatLife — 캐릭터(동적) 단독 데모 드라이버 (WebGPU only, 무대 없음)
//
// HktSplatGenesis 에서 갈라져 나온 "생명(캐릭터=동적)" 프로젝트의 부트/루프.
// 무대(Spark 환경) 레이어가 없으므로 alphaMode 'opaque' 로 배경까지 스스로 그린다 —
// 원본 app.js 의 렌더 조정층(director)·오픈월드·collider 배관이 전부 빠진 순수 생명 경로.
// "스플랫 = 세포": 색·모양은 시뮬 상태(pos/vel/energy)에서 셰이더가 유도한다(직접 그리지 않음).

(function () {
	'use strict';
	const { PRESETS, materialize } = HktGenesisGenes;

	// L6 뼈대: built-in FK(관절 53개) — 히키토 살(fleshK)의 유일한 형태 입력. three 불필요.
	const skeleton = new HktGenesisSkeleton.Skeleton();
	const skel = { clip: 'walk', speed: 1.0, fat: 1.0, bones: true, genome: HktGenesisGenome.IDENTITY };

	let genes = null, sceneEntities = null, reseed = null, simTime = 0;
	let lastPreset = '히키토';
	const N = 65536; // 2^16 — 정렬·슬라이스 제약 충족

	function bindBones() { return skeleton.pose('idle', 0, 1, 1, skel.genome); }
	function applyPreset(name) {
		lastPreset = name;
		const p = PRESETS[name];
		genes = materialize(p); // emitter 는 프리셋 기본
		genes.genome = skel.genome;
		HktGenesisGenome.applyMatter(genes, skel.genome); // 게놈 ③ 재질 차분 (미지정 = 무변경)
		if (genes.form === 3) genes.bindBones = bindBones(); // 살: 뼈 친화 시드 기준 세그먼트
		sceneEntities = [genes];
		if (reseed) reseed();
	}
	// 게놈(체형·채색·부속) 전환 — 부속은 세그먼트 수를 바꾸므로 항상 재시드(applyPreset 경유)
	function applyGenome(genome) {
		skel.genome = genome;
		applyPreset(lastPreset);
	}

	function fail(msg) { const m = document.getElementById('msg'); m.textContent = msg; m.style.display = 'flex'; }

	async function boot() {
		if (!navigator.gpu) return fail('이 브라우저는 WebGPU 를 지원하지 않습니다 (Chrome/Edge 113+).');
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) return fail('WebGPU 어댑터를 얻지 못했습니다.');
		const device = await adapter.requestDevice();
		device.addEventListener('uncapturederror', (e) => console.error('[HktSplatLife] GPU 오류:', e.error.message));

		const canvas = document.getElementById('gpu');
		const context = canvas.getContext('webgpu');
		const format = navigator.gpu.getPreferredCanvasFormat();
		context.configure({ device, format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });

		const engine = new HktGenesisEngine(device, context, format);
		const camera = new HktOrbitCamera(canvas); camera.radius = 4.5;
		reseed = () => { engine.setScene(N, sceneEntities); simTime = 0; };
		engine.setScene(N, [materialize(PRESETS['히키토'])]); // 초기 장면
		applyPreset('히키토');

		// 프리셋 버튼
		const box = document.getElementById('presets');
		for (const name of Object.keys(PRESETS)) {
			const b = document.createElement('button'); b.textContent = name;
			b.addEventListener('click', () => applyPreset(name));
			box.appendChild(b);
		}
		// 게놈(체형) 버튼 — 정체성 = 데이터: 같은 프리셋·같은 클립에 게놈만 갈아끼운다
		const gbox = document.getElementById('genomes');
		const genomeList = Object.assign({ '기본': HktGenesisGenome.IDENTITY }, HktGenesisGenome.GENOMES);
		for (const name of Object.keys(genomeList)) {
			const b = document.createElement('button'); b.textContent = name;
			b.addEventListener('click', () => applyGenome(genomeList[name]));
			gbox.appendChild(b);
		}
		document.getElementById('bones').addEventListener('change', (e) => { skel.bones = e.target.checked; });

		const fpsEl = document.getElementById('fps');
		let last = performance.now(), fpsAvg = 0;
		function tick(now) {
			const dpr = Math.min(devicePixelRatio || 1, 2);
			const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
			if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
			const dt = Math.min((now - last) / 1000, 0.05); last = now; simTime += dt;
			const aspect = canvas.width / canvas.height;
			const focalY = 0.5 * canvas.height / Math.tan(camera.fov / 2);
			// 살(fleshK) 개체가 있을 때만 뼈대 FK — 세그먼트가 살 규칙의 유일한 형태 입력
			let bones = null;
			if (sceneEntities.some((g) => g.fleshK > 0)) bones = skeleton.pose(skel.clip, simTime, skel.speed, skel.fat, skel.genome);
			engine.frame({
				dt, time: simTime, genes, entities: sceneEntities, paused: false, pull: [0, 0, 0, 0],
				bones, showBones: skel.bones,
				view: camera.view(), proj: camera.proj(aspect),
				viewport: [canvas.width, canvas.height], focal: [focalY, focalY],
			});
			// 하니스 훅 (present 전 같은 태스크에서 readback)
			if (window.__hktAfterFrame) window.__hktAfterFrame({ device, context, canvas, camera, engine });
			fpsAvg = fpsAvg * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
			fpsEl.textContent = `${fpsAvg.toFixed(0)} fps · ${(engine.count / 1024).toFixed(0)}k splats`;
			requestAnimationFrame(tick);
		}
		requestAnimationFrame(tick);
		window.__lifeReady = true;
	}

	boot().catch((e) => { console.error(e); fail('초기화 실패: ' + e.message); });
})();
