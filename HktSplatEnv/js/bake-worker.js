// HktSplatEnv — bake 워커 (classic worker, E21)
//
// 타일 bake(지형 tilePly · 수면 waterTilePly · 식생 bakeTile)를 메인 스레드 밖에서 굽는다.
// 풀 조명(cast shadow·AO) 근접 타일은 수백 ms 가 걸리므로(디테일 링 256격자는 ~800ms)
// 메인 스레드에서 굽으면 팬 잭이 걸린다 — 워커로 옮기면 프레임은 매끈하고 타일은 늦게 뜬다.
//
// 프로토콜: { id, params(월드 게놈), x0, z0, size, G, splatScale, opts(bake 옵션),
//            veg: { exclude: key 배열 | null } | null(식생 안 구움), only: 'veg' | undefined }
// 응답: { id, terrain, water, veg } (Uint8Array, transferable 이관)
// 결정론: 같은 params·좌표 = 같은 바이트 — 메인 스레드 동기 bake 폴백과 완전 동일 코드 경로.

importScripts('terrain-gen.js', 'scatter.js', 'vegetation.js');

let world = null, worldSig = '';

self.onmessage = (e) => {
	const m = e.data;
	try {
		const sig = JSON.stringify(m.params);
		if (sig !== worldSig) { world = HktGenesisTerrainGen.world(m.params); worldSig = sig; }
		const vegOnly = m.only === 'veg';
		const terrain = vegOnly ? null : world.tilePly(m.x0, m.z0, m.size, m.G, m.splatScale, m.opts);
		const water = vegOnly ? null : (world.waterTilePly ? world.waterTilePly(m.x0, m.z0, m.size, m.G, m.splatScale, m.opts) : null);
		const veg = m.veg ? HktGenesisVegetation.bakeTile(world, m.x0, m.z0, m.size,
			{ excludeKeys: m.veg.exclude ? new Set(m.veg.exclude) : null }) : null;
		const bufs = [];
		if (terrain) bufs.push(terrain.buffer);
		if (water) bufs.push(water.buffer);
		if (veg) bufs.push(veg.buffer);
		self.postMessage({ id: m.id, terrain, water, veg }, bufs);
	} catch (err) {
		// 실패는 null 로 응답 — 메인이 동기 bake 로 폴백한다
		self.postMessage({ id: m.id, error: String(err && err.message || err) });
	}
};
