// HktSplatGenesis — 무대(stage) 레이어 (S 트랙, ES module)
//
// worldlabs Marble 등 외부 생성 3DGS 월드를 Spark(WebGL2 + three ESM)로 로드·렌더한다.
// 생명(WebGPU #gpu) 캔버스 *아래*에 깔리는 별도 캔버스 — 위 캔버스가 투명 클리어로 합성된다.
// 데이터는 단방향: 무대는 생명을 모르고, 생명은 무대를 (S2 부터) heightfield 로만 안다.
//
// three 사본 격리 (CLAUDE.md 컨벤션): 이 모듈의 three(r180+ ESM, import map 으로 해석)와
// 전역 THREE(vendor/three.min.js r147 UMD, FBX 전용)는 절대 혼용 금지. 이 파일 밖으로
// three 객체를 내보내지 않는다 — 노출 API 는 숫자/문자열/콜백뿐.
//
// 좌표 정합 (PLAN-SparkTerrain.md): 투영 행렬은 규약이 달라(z∈[0,1] vs [-1,1]) 공유 불가 —
// 오빗 카메라의 *뷰 파라미터*(eye/target/up/fov)만 매 프레임 미러한다. near/far 는
// math.js proj() 와 동일(0.05/1000).

import * as THREE from 'three';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';

// 생성 샘플 지형 (repo 동봉, 오프라인 동작) — Marble 월드가 없을 때의 시작점
const SAMPLE_URL = 'assets/worlds/sample-terrain.ply';
// S4 스플랫 예산: LoD 슬라이스가 프레임당 이 수를 넘지 않게 (Spark 권장 0.5M~2.5M 중간값)
const LOD_BUDGET = 1500000;

let canvas = null, renderer = null, scene = null, camera = null;
let rig = null;      // 정합 노브(offset/scale/yaw)가 걸리는 부모 그룹
let mesh = null;     // 현재 SplatMesh
let objectUrl = null; // 파일 드롭용 blob URL (교체 시 revoke)
let lastSrc = null, lastName = null; // LoD 토글 시 재로드용
let lodOn = true;    // S4: Tiny-LoD (브라우저에서 LoD 트리 생성) / .rad 는 precomputed
let enabled = false;
let statusCb = null, lastStatus = null; // 모듈이 app.js 보다 먼저 상태를 낼 수 있어(?world=) 버퍼링

const transform = { x: 0, y: 0, z: 0, scale: 1, yawDeg: 0, flip: false };

// ── T2 청크 스트리밍 상태 ────────────────────────────────────────────────
// 절차 월드를 정사각 타일로 나눠 카메라 타깃 중심의 링을 로드한다. 근접 링(ring 0)은
// 풀 밀도, 외곽 링(ring 1)은 저밀도(격자 반감), 링 밖은 dispose. 타일 PLY 는 월드
// 함수 평가로 브라우저에서 즉석 생성 — 네트워크·디스크 불필요(오프라인 동작).
let tileWorld = null;            // HktGenesisTerrainGen.world 결과 (PLY 굽는 원본)
let tileCfg = null;              // { tileSize, nearR, farR, nearG, farG, splatScale }
const tiles = new Map();         // "tx,tz" -> { mesh, url, ring }
const tilePending = new Set();   // 로드 진행 중 키 (중복 로드 방지)
let tileCenterKey = null;        // 현재 중심 타일 — 바뀔 때만 링 재계산

function setStatus(html) { lastStatus = html; if (statusCb) statusCb(html); }

// 캔버스/렌더러는 최초 필요 시점에 생성 — WebGL 컨텍스트를 공짜로 잡지 않는다
function init() {
	if (renderer) return;
	canvas = document.createElement('canvas');
	canvas.id = 'stage';
	canvas.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; display:none;';
	const gpu = document.getElementById('gpu');
	gpu.parentNode.insertBefore(canvas, gpu); // DOM 순서 = 합성 순서: 무대가 아래
	renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
	renderer.setClearColor(0x06070f, 1); // 월드가 하늘을 안 덮을 때 페이지 배경과 연속
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(55, 1, 0.05, 1000);
	// SparkRenderer 는 자동 생성이 아니다 — 공식 예제대로 scene 에 명시적으로 넣어야 스플랫이 그려진다.
	// S4: LoD 구동 + 프레임 스플랫 예산 — 대용량 월드에서 시점 기준 슬라이스만 렌더/fetch
	scene.add(new SparkRenderer({ renderer, enableLod: true, lodSplatCount: LOD_BUDGET }));
	rig = new THREE.Group();
	scene.add(rig);
}

function applyTransform() {
	if (!rig) return;
	rig.position.set(transform.x, transform.y, transform.z);
	rig.scale.setScalar(transform.scale);
	rig.rotation.set(0, transform.yawDeg * Math.PI / 180, 0);
	// 캡처/생성 3DGS 는 y-down 인 경우가 많다 — 뒤집기는 메시에 건다 (yaw 와 독립)
	if (mesh) mesh.rotation.x = transform.flip ? Math.PI : 0;
}

async function load(src, name) {
	init();
	if (mesh) { rig.remove(mesh); if (mesh.dispose) mesh.dispose(); mesh = null; }
	if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
	let url = src;
	if (src instanceof File) {
		objectUrl = URL.createObjectURL(src);
		url = objectUrl;
		// blob URL 은 확장자가 없다 — fileName 힌트로 Spark 가 포맷을 추정하게 한다
		name = name || src.name;
	}
	lastSrc = src; lastName = name;
	setStatus('불러오는 중… ' + (name || url));
	try {
		// lod: 로드 시 Tiny-LoD 트리 생성 (브라우저) — .rad 는 트리가 파일에 있어 그대로 스트리밍
		const opts = { url, lod: lodOn };
		if (name) opts.fileName = name;
		mesh = new SplatMesh(opts);
		await mesh.initialized;
		rig.add(mesh);
		applyTransform();
		const cnt = mesh.numSplats != null ? ` · 스플랫 ${(mesh.numSplats / 1e6).toFixed(2)}M` : '';
		setStatus(`<b>불러오기 완료</b> — ${name || url}${cnt}`);
		setEnabled(true);
		return true;
	} catch (e) {
		console.error('[HktGenesisStage]', e);
		setStatus('불러오기 실패: ' + e.message);
		return false;
	}
}

function hasContent() { return !!mesh || tiles.size > 0; }

function setEnabled(on) {
	enabled = !!on && hasContent();
	if (canvas) canvas.style.display = enabled ? 'block' : 'none';
	const chk = document.getElementById('stageOn');
	if (chk) chk.checked = enabled;
}

// ── T2 타일 스트리밍 ─────────────────────────────────────────────────────
// 절차 월드 스트리밍 시작 — 이후 updateTileCenter(카메라 타깃)로 링을 갱신한다.
// params: 월드 파라미터(seed/amp/…) + { tile: { tileSize, nearR, farR, nearG, farG, splatScale } }
function startTileWorld(params) {
	init();
	if (!window.HktGenesisTerrainGen) { console.error('[HktGenesisStage] terrain-gen 미로드'); return; }
	if (mesh) { rig.remove(mesh); if (mesh.dispose) mesh.dispose(); mesh = null; }
	for (const t of tiles.values()) disposeTile(t);
	tiles.clear(); tilePending.clear(); tileCenterKey = null;
	tileWorld = window.HktGenesisTerrainGen.world(params);
	tileCfg = Object.assign({ tileSize: 19.2, nearR: 1, farR: 2, nearG: 64, farG: 32, splatScale: 1 }, params && params.tile);
	setStatus('타일 월드 스트리밍 — 시드 ' + tileWorld.params.seed);
}

function stopTileWorld() {
	for (const t of tiles.values()) disposeTile(t);
	tiles.clear(); tilePending.clear(); tileCenterKey = null; tileWorld = null; tileCfg = null;
	setEnabled(false);
}

function disposeTile(t) {
	if (!t) return;
	rig.remove(t.mesh);
	if (t.mesh.dispose) t.mesh.dispose();
	if (t.url) URL.revokeObjectURL(t.url);
}

// 현재 중심 기준으로 key 타일이 속할 링(0 근접·1 외곽) — 범위 밖이면 null
function desiredRing(tx, tz) {
	if (!tileCenterKey) return null;
	const [ctx, ctz] = tileCenterKey.split(',').map(Number);
	const dx = Math.abs(tx - ctx), dz = Math.abs(tz - ctz);
	if (dx > tileCfg.farR || dz > tileCfg.farR) return null;
	return (dx <= tileCfg.nearR && dz <= tileCfg.nearR) ? 0 : 1;
}

async function loadTile(tx, tz, ring) {
	const key = tx + ',' + tz;
	if (tilePending.has(key)) return;
	tilePending.add(key);
	const S = tileCfg.tileSize, G = ring === 0 ? tileCfg.nearG : tileCfg.farG;
	const bytes = tileWorld.tilePly(tx * S, tz * S, S, G, tileCfg.splatScale);
	const url = URL.createObjectURL(new File([bytes], 'tile.ply'));
	try {
		const m = new SplatMesh({ url, fileName: 'tile.ply', lod: false });
		await m.initialized;
		// 로드 중 중심이 옮겨가 더 이상 필요 없어졌으면 폐기 (팬 중 누수 방지)
		if (desiredRing(tx, tz) !== ring) { if (m.dispose) m.dispose(); URL.revokeObjectURL(url); return; }
		rig.add(m);
		tiles.set(key, { mesh: m, url, ring });
		if (!enabled) setEnabled(true);
	} catch (e) {
		console.error('[HktGenesisStage] 타일 로드 실패', key, e);
		URL.revokeObjectURL(url);
	} finally {
		tilePending.delete(key);
	}
}

// 카메라 타깃 월드 좌표로 링을 갱신. 중심 타일이 바뀔 때만 재계산(값싸다).
// 반환: 모든 로드/언로드가 끝나는 프라미스 (하니스가 await, 앱은 fire-and-forget).
function updateTileCenter(wx, wz) {
	if (!tileWorld) return Promise.resolve();
	const S = tileCfg.tileSize;
	const ctx = Math.floor(wx / S), ctz = Math.floor(wz / S);
	const ck = ctx + ',' + ctz;
	if (ck === tileCenterKey) return Promise.resolve();
	tileCenterKey = ck;
	// 원하는 타일 집합
	const want = new Map();
	for (let dz = -tileCfg.farR; dz <= tileCfg.farR; dz++)
		for (let dx = -tileCfg.farR; dx <= tileCfg.farR; dx++) {
			const tx = ctx + dx, tz = ctz + dz;
			want.set(tx + ',' + tz, (Math.abs(dx) <= tileCfg.nearR && Math.abs(dz) <= tileCfg.nearR) ? 0 : 1);
		}
	// 범위 밖 dispose
	for (const [k, t] of tiles) if (!want.has(k)) { disposeTile(t); tiles.delete(k); }
	// 신규 로드 + 링 변경(near↔far) 재로드
	const loads = [];
	for (const [k, ring] of want) {
		const cur = tiles.get(k);
		if (cur && cur.ring === ring) continue;
		if (cur) { disposeTile(cur); tiles.delete(k); }
		const [tx, tz] = k.split(',').map(Number);
		loads.push(loadTile(tx, tz, ring));
	}
	return Promise.all(loads);
}

function tileStats() {
	let splats = 0;
	for (const t of tiles.values()) splats += (t.mesh.numSplats || 0);
	return { meshes: tiles.size, splats, pending: tilePending.size, center: tileCenterKey, keys: [...tiles.keys()] };
}

// 오빗 카메라 미러 + 리사이즈 + 렌더 — app.js 의 tick 에서 매 프레임 호출
function frame(orbit, cssW, cssH) {
	// 타일 모드면 카메라 타깃을 따라 링 갱신 (중심 타일 불변 시 즉시 반환 — 값싸다).
	// fire-and-forget: 로드는 비동기, 다음 프레임부터 화면에 반영된다.
	if (tileWorld && orbit && orbit.target) updateTileCenter(orbit.target[0], orbit.target[2]);
	if (!enabled || !renderer) return;
	const dpr = Math.min(devicePixelRatio || 1, 2);
	const w = Math.floor(cssW * dpr), h = Math.floor(cssH * dpr);
	if (canvas.width !== w || canvas.height !== h) renderer.setSize(w, h, false);
	camera.fov = orbit.fov * 180 / Math.PI;
	camera.aspect = cssW / cssH;
	camera.up.fromArray(orbit.up);
	camera.position.fromArray(orbit._eye());
	camera.lookAt(orbit.target[0], orbit.target[1], orbit.target[2]);
	camera.updateProjectionMatrix();
	renderer.render(scene, camera);
}

// 하니스용: 한 프레임 렌더 직후 같은 태스크에서 캡처 (preserveDrawingBuffer 불필요)
function capture(orbit, cssW, cssH) {
	if (!renderer) return null;
	const was = enabled;
	enabled = true;
	frame(orbit, cssW, cssH);
	enabled = was;
	return canvas.toDataURL('image/png');
}

window.HktGenesisStage = {
	get enabled() { return enabled; },
	get hasWorld() { return hasContent(); },
	SAMPLE_URL,
	init, load, setEnabled, frame, capture,
	startTileWorld, stopTileWorld, updateTileCenter, tileStats,
	get tiledMode() { return !!tileWorld; },
	setTransform(patch) { Object.assign(transform, patch); applyTransform(); },
	getTransform() { return { ...transform }; },
	get lod() { return lodOn; },
	setLod(on) { // 로드 시점 옵션이라 현재 월드를 같은 소스로 재로드
		lodOn = !!on;
		if (lastSrc) load(lastSrc, lastName);
	},
	onStatus(cb) { statusCb = cb; if (lastStatus) cb(lastStatus); },
};

// ?world=<url> [&lod=0|1] — 하니스/딥링크용 자동 로드
const q = new URLSearchParams(location.search);
if (q.get('lod') != null) lodOn = q.get('lod') !== '0';
const auto = q.get('world');
if (auto) load(auto);
// ?tiles=<seed> — 절차 월드 타일 스트리밍 자동 시작 (frame 이 카메라 타깃을 따라 링 갱신)
const tilesSeed = q.get('tiles');
if (tilesSeed != null) startTileWorld({ seed: parseInt(tilesSeed) || 1 });
