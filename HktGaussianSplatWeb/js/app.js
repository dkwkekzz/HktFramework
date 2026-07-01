// HktGaussianSplat Web — 부트스트랩: 파일 로드, 정렬 워커, 렌더 루프, UI
(function () {
	'use strict';

	const canvas = document.getElementById('gl');
	const $ = (id) => document.getElementById(id);
	const elCount = $('count'), elFps = $('fps'), elErr = $('err'), elDrop = $('drop');

	let renderer, camera;
	try {
		renderer = new HktSplatRenderer(canvas);
		camera = new HktOrbitCamera(canvas);
	} catch (e) {
		showError(e.message);
		return;
	}

	// ── 정렬 워커 (인라인 Blob — file:// 에서도 동작) ──
	const WORKER_SRC = `
		let positions = null, count = 0;
		self.onmessage = (e) => {
			const m = e.data;
			if (m.type === 'cloud') { positions = m.positions; count = m.count; }
			else if (m.type === 'sort' && positions) {
				const v = m.view;
				const n = count;
				const depths = new Float32Array(n);
				let mn = Infinity, mx = -Infinity;
				for (let i = 0; i < n; i++) {
					const x = positions[i*3], y = positions[i*3+1], z = positions[i*3+2];
					// 카메라 공간 z (column-major view). 카메라는 -Z 를 보므로 먼 곳일수록 작음.
					const d = v[2]*x + v[6]*y + v[10]*z + v[14];
					depths[i] = d; if (d < mn) mn = d; if (d > mx) mx = d;
				}
				const range = 65535 / ((mx - mn) || 1);
				const counts = new Uint32Array(65536);
				const bucket = new Uint32Array(n);
				for (let i = 0; i < n; i++) { const b = ((depths[i]-mn)*range) | 0; bucket[i] = b; counts[b]++; }
				const starts = new Uint32Array(65536);
				let sum = 0;
				for (let b = 0; b < 65536; b++) { starts[b] = sum; sum += counts[b]; }
				const order = new Uint32Array(n);
				for (let i = 0; i < n; i++) { order[starts[bucket[i]]++] = i; }
				self.postMessage({ type: 'sorted', order, gen: m.gen }, [order.buffer]);
			}
		};`;
	const worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })));

	let sortPending = false, latestOrder = null, needSort = true, loadGen = 0;
	worker.onmessage = (e) => {
		if (e.data.type === 'sorted') {
			sortPending = false;
			// 이전 클라우드의 늦게 도착한 정렬 결과 폐기:
			// (a) 로드 세대가 다르거나 (b) 길이가 현재 스플랫 수와 다르면 무시.
			if (e.data.gen === loadGen && e.data.order.length === renderer.count) {
				latestOrder = e.data.order;
				renderer.setIndices(latestOrder);
			}
		}
	};

	// ── UI 상태 ──
	const opt = { opacityScale: 1, pointScale: 1, bg: 0.04 };
	$('opacity').oninput = (e) => opt.opacityScale = parseFloat(e.target.value);
	$('scale').oninput = (e) => opt.pointScale = parseFloat(e.target.value);
	$('bg').oninput = (e) => opt.bg = parseFloat(e.target.value);

	// ── 파일 로드 ──
	$('file').onchange = (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); };
	['dragenter', 'dragover'].forEach((t) => document.addEventListener(t, (e) => {
		e.preventDefault(); elDrop.classList.add('dragover');
	}));
	['dragleave', 'drop'].forEach((t) => document.addEventListener(t, (e) => {
		e.preventDefault(); if (t === 'dragleave' && e.target !== elDrop) return; elDrop.classList.remove('dragover');
	}));
	document.addEventListener('drop', (e) => {
		e.preventDefault();
		const f = e.dataTransfer.files[0];
		if (f) loadFile(f);
	});

	function loadFile(file) {
		hideError();
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const t0 = performance.now();
				const cloud = HktSplatPly.parse(reader.result, file.name);
				renderer.setCloud(cloud.count, cloud.texData);
				worker.postMessage({ type: 'cloud', count: cloud.count, positions: cloud.positions }, [cloud.positions.buffer]);
				camera.frame(cloud.bounds.center, cloud.bounds.radius);
				// 새 로드 세대 — in-flight 정렬 결과 무효화, 정렬 상태 리셋
				loadGen++;
				sortPending = false;
				latestOrder = null;
				needSort = true;
				elCount.textContent = cloud.count.toLocaleString();
				elDrop.classList.add('hide');
				console.log('[HktSplat] 로드 %d 스플랫, %dms', cloud.count, (performance.now() - t0) | 0);
			} catch (err) {
				showError('로드 실패: ' + err.message);
				console.error(err);
			}
		};
		reader.onerror = () => showError('파일 읽기 실패');
		reader.readAsArrayBuffer(file);
	}

	// ── 리사이즈 ──
	function resize() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
		if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
	}
	window.addEventListener('resize', resize);
	resize();

	// ── 렌더 루프 ──
	let frames = 0, lastFpsT = performance.now();
	function loop() {
		resize();
		const aspect = canvas.width / canvas.height;
		const view = camera.view();
		const proj = camera.proj(aspect);

		// 카메라가 움직였으면 재정렬 요청 (워커 응답 대기 중이면 스킵)
		if ((camera._dirty || needSort) && !sortPending && renderer.count) {
			camera._dirty = false; needSort = false; sortPending = true;
			worker.postMessage({ type: 'sort', view: view, gen: loadGen });
		}

		renderer.render(view, proj, opt);

		frames++;
		const now = performance.now();
		if (now - lastFpsT >= 500) {
			elFps.textContent = Math.round((frames * 1000) / (now - lastFpsT));
			frames = 0; lastFpsT = now;
		}
		requestAnimationFrame(loop);
	}
	requestAnimationFrame(loop);

	function showError(msg) { elErr.style.display = 'block'; elErr.textContent = msg; }
	function hideError() { elErr.style.display = 'none'; }
})();
