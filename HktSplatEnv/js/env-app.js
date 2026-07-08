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
		// temperate 프리셋 경유 — 지형 노브는 world() 기본값과 동일(바이트 동일)이고,
		// mood(하늘 그라데이션 돔 + fog 톤)가 실려 밋밋한 flat clear 대신 하늘이 그려진다.
		const genome = window.HktGenesisTerrainGen.preset('temperate');
		genome.mood.cloud = 0.45; // W-Q3 절차 구름
		S.startTileWorld(Object.assign(genome, { seed, tile: { tileSize: 19.2, nearR: 1, farR: 2, detG: 256, nearG: 192, farG: 48 } }));

		// 육지 스폰(E24) — 매크로 계곡(호수)에 원점이 잠긴 시드도 있으므로, 원점에서 나선으로
		// 물가 위 육지를 찾아 카메라 타깃을 옮긴다. 순수 월드 함수 평가라 값싸고 결정론이다.
		const w = window.HktGenesisTerrainGen.world(Object.assign({}, genome, { seed }));
		let spawn = [0, 0];
		if (w.heightAt(0, 0) <= w.waterY + 0.4) {
			outer: for (let r = 8; r <= 160; r += 8)
				for (let a = 0; a < 6.283; a += 0.45) {
					const x = Math.cos(a) * r, z = Math.sin(a) * r;
					if (w.heightAt(x, z) > w.waterY + 0.6) { spawn = [x, z]; break outer; }
				}
		}
		camera.target = [spawn[0], w.heightAt(spawn[0], spawn[1]) + 1, spawn[1]];

		// ── E25 걷기 모드 — 정적 무대 위의 게임형 인터랙션 실증 ─────────────────────
		// 'V' 토글: 오빗(부감) ↔ 1인칭 걷기. WASD 이동(Shift 달리기), 좌드래그 시선.
		// 지면 충돌은 물리엔진이 아니라 **월드 함수** heightAt(눈높이 = 지형 + 1.7m) — 무한
		// 스트리밍 세계 어디서든 성립한다(스플랫은 배경, 인터랙션은 함수 레이어 = 2층 구조).
		const EYE = 1.7;
		const walk = { on: false, x: spawn[0], z: spawn[1], yaw: 2.6, pitch: -0.06 };
		const keys = {};
		const clamp = (v, a, b) => (v < a ? a : v > b ? v : b);
		addEventListener('keydown', (e) => {
			if (e.code === 'KeyV') {
				walk.on = !walk.on;
				if (walk.on) { // 켤 때 오빗 타깃 자리에서 시작 — 시점 연속
					walk.x = camera.target[0]; walk.z = camera.target[2];
					walk.yaw = camera.yaw + Math.PI; // 오빗이 보던 방향을 그대로 바라본다
				} else { // 끌 때 서 있던 자리를 오빗 타깃으로
					camera.target = [walk.x, Math.max(w.heightAt(walk.x, walk.z), w.waterY) + 1, walk.z];
				}
			}
			keys[e.code] = true;
		});
		addEventListener('keyup', (e) => { keys[e.code] = false; });
		view.addEventListener('pointermove', (e) => { // 걷기 시선 — 좌드래그(오빗 핸들러와 공존, 모드로 분기)
			if (walk.on && (e.buttons & 1)) {
				walk.yaw -= e.movementX * 0.0032;
				walk.pitch = clamp(walk.pitch - e.movementY * 0.0032, -1.25, 1.25);
			}
		});
		// 걷기 카메라 — stage.frame 이 기대하는 오빗 호환 뷰(fov/up/target/_eye)를 합성한다
		function walkCam() {
			const ey = Math.max(w.heightAt(walk.x, walk.z), w.waterY) + EYE; // 지면·수면 위 눈높이
			const cp = Math.cos(walk.pitch);
			const dir = [cp * Math.sin(walk.yaw), Math.sin(walk.pitch), cp * Math.cos(walk.yaw)];
			return { fov: 1.0, up: [0, 1, 0],
				target: [walk.x + dir[0] * 4, ey + dir[1] * 4, walk.z + dir[2] * 4],
				_eye: () => [walk.x, ey, walk.z] };
		}
		function walkMove(dt) {
			const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
			const s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
			if (!f && !s) return;
			const sp = (keys.ShiftLeft || keys.ShiftRight ? 10 : 4.5) * dt;
			const sy = Math.sin(walk.yaw), cy = Math.cos(walk.yaw);
			walk.x += (sy * f + cy * s) * sp;
			walk.z += (cy * f - sy * s) * sp;
		}
		window.__envWalk = walk; // 하니스 기능 검증용(위치·모드 관찰)

		const fpsEl = document.getElementById('fps');
		let last = performance.now(), fpsAvg = 0;
		function tick(now) {
			const dt = Math.min((now - last) / 1000, 0.05); last = now;
			if (walk.on) walkMove(dt);
			// stage.frame: 카메라 타깃을 따라 타일 링을 갱신(fire-and-forget)하고 렌더한다.
			S.frame(walk.on ? walkCam() : camera, view.clientWidth, view.clientHeight);
			fpsAvg = fpsAvg * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
			const st = S.tileStats ? S.tileStats() : {};
			fpsEl.textContent = `${fpsAvg.toFixed(0)} fps · ${walk.on ? '걷기(V로 오빗)' : '오빗(V로 걷기)'} · 타일 ${st.meshes || 0} · 스플랫 ${((st.splats || 0) / 1000).toFixed(0)}k` +
				(st.vegMeshes ? ` · 식생 ${st.vegMeshes}` : '');
			requestAnimationFrame(tick);
		}
		requestAnimationFrame(tick);
		window.__envReady = true;
	}

	start();
})();
