// HktSplatEnv — 환경(정적) 단독 무대 뷰어 드라이버 (Spark only, 생명 없음)
//
// HktSplatGenesis 에서 갈라져 나온 "환경(정적=무대)" 프로젝트의 부트/루프. 절차 월드를
// 타일로 스트리밍(terrain-gen → stage/Spark)하고 오빗 카메라 뷰만 무대에 미러한다.
// 무대는 스스로 렌더러(별도 캔버스) — 생명(WebGPU) 경로가 전혀 없다. "무대는 로드/생성한다".
//
// stage.js 는 ES module(window.HktGenesisStage 노출)이라 이 classic 스크립트보다 늦게 실행된다 —
// HktGenesisStage 가 뜰 때까지 rAF 로 기다렸다 시작한다.

(function () {
	'use strict';

	function start() {
		const S = window.HktGenesisStage;
		if (!S || !window.HktGenesisTerrainGen) { requestAnimationFrame(start); return; } // 모듈 로드 대기

		// 오빗 입력은 전면 오버레이(#view)에서 받고, 뷰 파라미터만 무대에 미러(투영 공유 금지).
		const view = document.getElementById('view');
		const camera = new HktOrbitCamera(view);
		camera.target = [0, 0, 0]; camera.radius = 24; camera.pitch = 0.82; camera.yaw = 0.5;

		const seed = parseInt(new URLSearchParams(location.search).get('seed')) || 7;
		S.startTileWorld({ seed, tile: { tileSize: 19.2, nearR: 1, farR: 2, nearG: 64, farG: 32 } });

		const fpsEl = document.getElementById('fps');
		let last = performance.now(), fpsAvg = 0;
		function tick(now) {
			const dt = Math.min((now - last) / 1000, 0.05); last = now;
			// stage.frame: 카메라 타깃을 따라 타일 링을 갱신(fire-and-forget)하고 렌더한다.
			S.frame(camera, view.clientWidth, view.clientHeight);
			fpsAvg = fpsAvg * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
			const st = S.tileStats ? S.tileStats() : {};
			fpsEl.textContent = `${fpsAvg.toFixed(0)} fps · 타일 ${st.meshes || 0} · 스플랫 ${((st.splats || 0) / 1000).toFixed(0)}k` +
				(st.vegMeshes ? ` · 식생 ${st.vegMeshes}` : '');
			requestAnimationFrame(tick);
		}
		requestAnimationFrame(tick);
		window.__envReady = true;
	}

	start();
})();
