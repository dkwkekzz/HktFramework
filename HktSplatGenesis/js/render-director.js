// HktSplatGenesis — 렌더 조정층 (RenderDirector, classic script)
//
// 두 렌더 영역의 **경계 소유자**다. 무대(환경=정적, Spark WebGL2, window.HktGenesisStage)와
// 생명(캐릭터=동적, WebGPU, engine)은 서로를 모른다 — 이 모듈이 유일하게 둘을 만나게 하고,
// 그 접점을 **명시된 계약**으로만 잇는다 (PLAN-RenderSeparation.md).
//
// 소유하는 env↔life 계약 (전부 환경→생명 단방향):
//   ① 프레임 시퀀싱   — 무대 먼저 그리고(아래 캔버스), 생명은 투명 배경으로 위에 합성.
//   ② 톤(sky/fog)     — 무대가 원본(getSkyFog), 생명 fog 로 미러 → 지평선에서 같은 톤으로 만남 (T5).
//   ③ 시뮬 바닥        — 오픈월드 절차 지형 높이를 heightfield 로 구워 생명 격자 바닥에 주입 (T3).
//   ④ 식생 승격        — 시뮬로 승격된 스폰 key 를 무대 Bake 식생 제외로 넘겨 이중 그리기 제거 (W-Q2c).
//   ⑤ 카메라 미러      — 한 오빗 카메라를 두 렌더러가 각자 미러(투영 공유 금지, 클립 규약 상이).
//
// app.js tick 은 입력(dt·bones·genes)만 모아 director.frame 을 부른다 — 렌더러 간 배관은 여기.
// 의존성은 주입(engine·getStage·heightfield)이라 전역에 직접 묶이지 않는다(프로젝트 분리 대비).

(function (global) {
	'use strict';

	// deps: { engine, getStage: ()=>window.HktGenesisStage|null, heightfield: HktHeightfield }
	function create(deps) {
		const engine = deps.engine;
		const getStage = deps.getStage;
		const heightfield = deps.heightfield;

		let openWorld = null;   // { world, stream, bakeCd } | null — 오픈월드 모드 상태
		let owWasActive = false; // 모드 종료 시 heightfield 정리 판정
		let stageMs = 0;         // 무대 CPU 인코드 시간 EMA (S4 예산 계측, fps 표시용)

		// 오픈월드 env↔life 다리 — 카메라 타깃을 따라 시뮬 바닥(heightfield)을 굽고(③) 스폰을
		// 갱신하며, 시뮬로 승격된 나무를 무대 Bake 식생에서 뺀다(④). bakeCd 주기로 값싸게.
		function updateOpenWorld(camera) {
			if (openWorld) {
				if (openWorld.bakeCd++ % 12 === 0) {
					// bakeFn 창(±20m)이 스캐터 반경을 덮어 먼 나무 뿌리도 지형 높이에 정확히 앉는다.
					const t = camera.target, R = 20, cell = 2 * R / 127;
					engine.setHeightfield(heightfield.bakeFn((x, z) => openWorld.world.height(x, z),
						{ res: 128, originX: t[0] - R, originZ: t[2] - R, cell }));
					openWorld.stream.update(t[0], t[2]);
					// 승격 집합이 안 바뀌면 setVegExclusion 이 즉시 반환(값싼 게이트) — 바뀔 때만 재Bake.
					const s = getStage();
					if (s && s.setVegExclusion) s.setVegExclusion(openWorld.stream.promotedKeys());
				}
				owWasActive = true;
			} else if (owWasActive) {
				engine.setHeightfield(null); owWasActive = false; // 모드 종료 — 평면 바닥 복귀
			}
		}

		// 한 프레임: 무대(환경) → 톤 미러 → 생명(캐릭터). lifeParams 는 app 이 모은 시뮬/카메라 입력.
		// 반환 { stageOn, stageMs } — app 이 fps 표시에 쓴다.
		function frame(camera, cssW, cssH, lifeParams) {
			// ① 무대: 켜져 있거나 오픈월드면(타일이 아직 안 실려 enabled=false 여도 링 로드 시작해야 함).
			const st = getStage();
			if (st && (st.enabled || openWorld)) {
				const t0 = (global.performance ? performance.now() : 0);
				st.frame(camera, cssW, cssH);
				stageMs = stageMs * 0.9 + ((global.performance ? performance.now() : 0) - t0) * 0.1;
			}
			const stageOn = st && st.enabled;
			// ② 톤: 무대 타일 월드가 켜져 있으면 생명도 무대와 같은 sky/fog 톤으로 원거리 페이드.
			const fog = (stageOn && st.tiledMode) ? st.getSkyFog() : null;
			// 생명: 무대가 켜져 있으면 투명 배경(①의 위에 알파 합성) + 버블(⑤ 지형 y 추종) + 톤.
			engine.frame(Object.assign({}, lifeParams, {
				fog,
				background: stageOn ? { r: 0, g: 0, b: 0, a: 0 } : undefined,
				gridCenter: engine.bubbleCenter(camera.target),
			}));
			return { stageOn, stageMs };
		}

		return {
			frame, updateOpenWorld,
			setOpenWorld(ow) { openWorld = ow || null; },   // {world, stream} → bakeCd 부여
			get openWorld() { return openWorld; },
		};
	}

	const api = { create };
	global.HktGenesisRenderDirector = api;
	if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
