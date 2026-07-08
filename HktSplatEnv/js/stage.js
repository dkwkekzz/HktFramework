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
const tiles = new Map();         // "tx,tz" -> { mesh, water, url, waterUrl, ring }
const tilePending = new Set();   // 로드 진행 중 키 (중복 로드 방지)
let tileCenterKey = null;        // 현재 중심 타일 — 바뀔 때만 링 재계산
let vegExclude = null;           // W-Q2c: 시뮬 승격된 스폰 key Set — Bake 식생에서 제외
let vegExcludeSig = '';          // 위 집합의 서명(정렬 join) — 바뀔 때만 재Bake(값싼 no-op 게이트)

// ── T5 공용 sky/fog 톤 ────────────────────────────────────────────────────
// Spark 스플랫은 three fog 를 지원하지 않으므로(무대 지형엔 clear 색이 곧 지평선 fog),
// 생명(WebGPU)의 원거리 fog 와 *같은 색*을 공유해 두 층이 지평선에서 같은 톤으로 만난다.
// stage 가 이 톤의 원본 — app/하니스는 getSkyFog() 로 읽어 engine.frame({fog}) 에 넘긴다.
let skyFog = { color: [0.62, 0.70, 0.82], start: 20, end: 55 }; // 기본: 옅은 청회색 하늘
let skyMesh = null; // W6 하늘 그라데이션 돔 (mood 에 skyTop/skyHorizon 이 있을 때만 생성)

function setStatus(html) { lastStatus = html; if (statusCb) statusCb(html); }

// 캔버스/렌더러는 최초 필요 시점에 생성 — WebGL 컨텍스트를 공짜로 잡지 않는다
function init() {
	if (renderer) return;
	canvas = document.createElement('canvas');
	canvas.id = 'stage';
	canvas.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; display:none;';
	// 합성 순서: 생명(#gpu)이 있으면 그 아래에, 단독(HktSplatEnv)이면 body 최하단에 깐다.
	const gpu = document.getElementById('gpu');
	if (gpu) gpu.parentNode.insertBefore(canvas, gpu);
	else document.body.insertBefore(canvas, document.body.firstChild);
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
	if (skyMesh) skyMesh.visible = false; // 단일 월드는 mood 를 명시할 때만(setMood) 하늘 돔을 켠다
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
	vegExclude = null; vegExcludeSig = ''; // 승격 제외는 월드마다 초기화(이전 월드 key 잔류 방지)
	tileWorld = window.HktGenesisTerrainGen.world(params);
	// E14 근접 밀도 상향: nearG 128(셀 0.15m)·farG 48 — LoD 예산(1.5M)의 노는 여유를 선명도로 쓴다
	tileCfg = Object.assign({ tileSize: 19.2, nearR: 1, farR: 2, nearG: 128, farG: 48, splatScale: 1 }, params && params.tile);
	// T5/W6 공용 sky/fog — 게놈 mood(있으면 하늘 돔+fog) 또는 기본 톤. fog end 는 far 링 반경에
	// 맞춰 지평선에서 소실(mood 가 명시 안 하면 기본값). mood.skyTop/skyHorizon 이 있으면 하늘 돔.
	const mood = (params && params.mood) || {};
	const farReach = tileCfg.tileSize * (tileCfg.farR + 0.5);
	setMood(Object.assign({ fogStart: farReach * 0.55, fogEnd: farReach }, mood));
	setStatus('타일 월드 스트리밍 — 시드 ' + tileWorld.params.seed);
}

function stopTileWorld() {
	for (const t of tiles.values()) disposeTile(t);
	tiles.clear(); tilePending.clear(); tileCenterKey = null; tileWorld = null; tileCfg = null;
	vegExclude = null; vegExcludeSig = '';
	if (skyMesh) skyMesh.visible = false;
	setEnabled(false);
}

function disposeTile(t) {
	if (!t) return;
	rig.remove(t.mesh);
	if (t.mesh.dispose) t.mesh.dispose();
	if (t.url) URL.revokeObjectURL(t.url);
	if (t.water) { rig.remove(t.water); if (t.water.dispose) t.water.dispose(); }
	if (t.waterUrl) URL.revokeObjectURL(t.waterUrl);
	if (t.veg) { rig.remove(t.veg); if (t.veg.dispose) t.veg.dispose(); }
	if (t.vegUrl) URL.revokeObjectURL(t.vegUrl);
}

// 공용 sky/fog 톤 설정 — 무대 clear 색(= 지평선 fog)과 생명 fog 가 공유하는 단일 원본.
// skyFog.color 는 *디스플레이(sRGB) 톤* — 화면에 실제로 보이는 색이다. 생명(WebGPU 비-sRGB
// 캔버스)은 이 값을 그대로 써서 그 톤으로 보인다. 무대(three)는 출력 시 linear→sRGB 인코딩을
// 하므로, 화면에 같은 톤이 나오려면 clear 를 linear(톤)으로 넣어야 한다(양층 픽셀 일치의 핵심).
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function setSkyFog(cfg) {
	cfg = cfg || {};
	if (cfg.color) skyFog.color = cfg.color.slice(0, 3);
	if (cfg.start != null) skyFog.start = cfg.start;
	if (cfg.end != null) skyFog.end = cfg.end;
	if (renderer) {
		const l = skyFog.color.map(srgbToLinear); // three 가 다시 sRGB 로 인코딩 → 화면 = skyFog.color
		renderer.setClearColor(new THREE.Color(l[0], l[1], l[2]), 1);
	}
}

// ── W6 대기(mood): 하늘 그라데이션 돔 + fog 배선 ──────────────────────────────
// 게놈 mood 를 무대(하늘 돔)와 생명 fog 톤(setSkyFog)에 배선한다. 하늘은 카메라를 따라오는
// 큰 구(BackSide)에 skyTop(천정)→skyHorizon(지평선) 세로 그라데이션을 굽는다 — 스크린 배경
// 텍스처가 아니라 **월드 y 방향** 기준이라 실제 지평선과 정합하고(카메라 각과 무관), 지평선에서
// skyHorizon = fog 톤과 같은 색으로 만나 생명·무대가 이어진다. mood 에 skyTop/skyHorizon 이
// 하나라도 있을 때만 돔을 세운다 — 없으면(구 sky 필드/무-mood) 기존 flat clear 거동 유지(회귀 안전).
const SKY_VERT = 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
// W-Q3 구름 — 그라데이션 하늘 위에 fbm 절차 구름. 시선을 하늘 평면에 투영(원근)해 천정에
// 뭉게구름, 지평선으로 갈수록 소실(지평선 fog 톤과 충돌 방지). cloudCov 0 이면 구름 없음(회귀).
const SKY_FRAG =
	'uniform vec3 topC; uniform vec3 botC; uniform float cloudCov; varying vec3 vDir;\n' +
	'float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }\n' +
	'float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);\n' +
	' float a=h21(i), b=h21(i+vec2(1.0,0.0)), c=h21(i+vec2(0.0,1.0)), d=h21(i+vec2(1.0,1.0));\n' +
	' return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }\n' +
	'float fbm(vec2 p){ float s=0.0, a=0.55; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+7.1; a*=0.5; } return s; }\n' +
	'void main(){\n' +
	' vec3 dir = normalize(vDir);\n' +
	' float hh = pow(clamp(dir.y, 0.0, 1.0), 0.5);\n' +
	' vec3 sky = mix(botC, topC, hh);\n' +
	' if (cloudCov > 0.001) {\n' +
	'  float dy = max(dir.y, 0.06);\n' +
	'  vec2 uv = dir.xz / dy * 1.05;\n' +         // 하늘 평면 투영 — 천정 뭉게, 지평선 늘어남(큰 puff)
	'  float n = fbm(uv);\n' +
	'  float thr = 0.90 - cloudCov * 0.55;\n' +   // 커버리지 ↑ → 임계 ↓ → 구름 ↑
	'  float cov = smoothstep(thr, thr + 0.22, n);\n' +
	'  float fade = smoothstep(0.04, 0.24, dir.y);\n' + // 지평선 근처 구름 소실
	'  float cl = cov * fade;\n' +
	'  vec3 cloudC = mix(vec3(0.62, 0.66, 0.74), vec3(1.0), smoothstep(0.45, 0.95, n));\n' + // 바닥 회색·윗면 흰색
	'  sky = mix(sky, cloudC, cl);\n' +
	' }\n' +
	' gl_FragColor = vec4(sky, 1.0);\n' +
	'#include <colorspace_fragment>\n}'; // 유니폼은 linear — colorspace_fragment 가 출력 sRGB 인코딩

function applySky(top, horizon, cloud) {
	init();
	const tl = top.map(srgbToLinear), hl = horizon.map(srgbToLinear);
	if (!skyMesh) {
		const geo = new THREE.SphereGeometry(500, 24, 12);
		const mat = new THREE.ShaderMaterial({
			uniforms: { topC: { value: new THREE.Color() }, botC: { value: new THREE.Color() }, cloudCov: { value: 0 } },
			vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
			side: THREE.BackSide, depthWrite: false, fog: false,
		});
		skyMesh = new THREE.Mesh(geo, mat);
		skyMesh.renderOrder = -1;      // 스플랫보다 먼저 (배경)
		skyMesh.frustumCulled = false; // 카메라를 감싸므로 컬링 금지
		scene.add(skyMesh);
	}
	skyMesh.visible = true;
	skyMesh.material.uniforms.topC.value.setRGB(tl[0], tl[1], tl[2]);
	skyMesh.material.uniforms.botC.value.setRGB(hl[0], hl[1], hl[2]);
	skyMesh.material.uniforms.cloudCov.value = (cloud != null) ? cloud : 0; // 없으면 구름 없음(회귀)
}

// 게놈 mood → 하늘 돔 + fog. skyHorizon(없으면 구 sky/현 fog 톤)이 지평선·fog 의 단일 원본.
function setMood(mood) {
	mood = mood || {};
	const horizon = mood.skyHorizon || mood.sky || skyFog.color;
	if (mood.skyTop || mood.skyHorizon) applySky(mood.skyTop || horizon, horizon, mood.cloud);
	else if (skyMesh) skyMesh.visible = false; // mood 없는 새 월드로 전환 시 이전 돔 숨김
	setSkyFog({ color: mood.fogColor || horizon, start: mood.fogStart, end: mood.fogEnd });
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
	// T5 수면 타일 — 이 타일에 수몰 셀이 있으면(null 아니면) 반투명 수면 메시를 함께 붙인다
	const waterBytes = tileWorld.waterTilePly ? tileWorld.waterTilePly(tx * S, tz * S, S, G, tileCfg.splatScale) : null;
	const waterUrl = waterBytes ? URL.createObjectURL(new File([waterBytes], 'water.ply')) : null;
	// W-Q2b Bake 식생 — 근접 링(0)만 정적 나무·바위 스플랫(밀도 = 게놈 생명 층 `world.params.life`).
	// 원경 링(1)은 굽지 않는다(LoD): fog(fogEnd=far 링 반경)로 소실되는 구간이라 예산을 아낀다.
	const vegBytes = (ring === 0 && window.HktGenesisVegetation)
		? window.HktGenesisVegetation.bakeTile(tileWorld, tx * S, tz * S, S, { excludeKeys: vegExclude }) : null;
	const vegUrl = vegBytes ? URL.createObjectURL(new File([vegBytes], 'veg.ply')) : null;
	try {
		const m = new SplatMesh({ url, fileName: 'tile.ply', lod: false });
		await m.initialized;
		let water = null, veg = null;
		if (waterUrl) { water = new SplatMesh({ url: waterUrl, fileName: 'water.ply', lod: false }); await water.initialized; }
		if (vegUrl) { veg = new SplatMesh({ url: vegUrl, fileName: 'veg.ply', lod: false }); await veg.initialized; }
		// 로드 중 중심이 옮겨가 더 이상 필요 없어졌으면 폐기 (팬 중 누수 방지)
		if (desiredRing(tx, tz) !== ring) {
			if (m.dispose) m.dispose(); URL.revokeObjectURL(url);
			if (water && water.dispose) water.dispose(); if (waterUrl) URL.revokeObjectURL(waterUrl);
			if (veg && veg.dispose) veg.dispose(); if (vegUrl) URL.revokeObjectURL(vegUrl);
			return;
		}
		rig.add(m);
		if (water) rig.add(water);
		if (veg) rig.add(veg);
		tiles.set(key, { mesh: m, water, veg, url, waterUrl, vegUrl, ring });
		if (!enabled) setEnabled(true);
	} catch (e) {
		console.error('[HktGenesisStage] 타일 로드 실패', key, e);
		URL.revokeObjectURL(url);
		if (waterUrl) URL.revokeObjectURL(waterUrl);
		if (vegUrl) URL.revokeObjectURL(vegUrl);
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

// ── W-Q2c 승격 훅: Bake 식생에서 시뮬 승격된 나무 제외 ─────────────────────────
// "밀도=Bake, 상호작용=시뮬" 구조의 마지막 조각. ScatterStream 이 카메라 근처 나무를 8 슬롯
// 시뮬로 승격하면(불×나무·성장·연소 = 상태 유도가 살아남), 그 정적 Bake 사본은 빼야 한다 —
// 안 그러면 같은 나무가 두 번 그려진다(Bake 블롭 + 시뮬 개체). 승격 key 는 시뮬·Bake 가 같은
// 셀 격자를 공유할 때만 정확히 일치하므로(app.js 가 stream/veg 에 같은 cell 을 준다), 여기서
// 그 key 를 excludeKeys 로 넘겨 근접 링(0) 식생 타일을 다시 굽는다. v0 하드컷(경계 팝 허용).
async function rebakeTileVeg(key) {
	const t = tiles.get(key);
	if (!t || t.ring !== 0 || !window.HktGenesisVegetation) return;
	const [tx, tz] = key.split(',').map(Number);
	const S = tileCfg.tileSize;
	const vegBytes = window.HktGenesisVegetation.bakeTile(tileWorld, tx * S, tz * S, S, { excludeKeys: vegExclude });
	// 기존 식생 메시 제거(동기) — await 전에 떼어 이중 표시 방지
	if (t.veg) { rig.remove(t.veg); if (t.veg.dispose) t.veg.dispose(); t.veg = null; }
	if (t.vegUrl) { URL.revokeObjectURL(t.vegUrl); t.vegUrl = null; }
	if (!vegBytes) return; // 전부 제외 = 빈 식생(완전히 승격된 셀뿐)
	const vegUrl = URL.createObjectURL(new File([vegBytes], 'veg.ply'));
	const veg = new SplatMesh({ url: vegUrl, fileName: 'veg.ply', lod: false });
	await veg.initialized;
	// await 사이 타일이 폐기/교체됐으면(팬) 새 메시 버림 — 누수 방지
	if (tiles.get(key) !== t) { if (veg.dispose) veg.dispose(); URL.revokeObjectURL(vegUrl); return; }
	t.veg = veg; t.vegUrl = vegUrl; rig.add(veg);
}

// 승격 key 집합(Set)을 받아 Bake 식생 제외를 갱신. 집합이 안 바뀌면 즉시 반환(값싼 게이트) —
// app.js tick 이 매 bake 주기 호출해도 실제 재Bake 는 승격이 바뀔 때만. 반환: 재Bake 프라미스.
function setVegExclusion(keys) {
	const sig = keys ? [...keys].sort().join('|') : '';
	if (sig === vegExcludeSig) return Promise.resolve();
	vegExcludeSig = sig;
	vegExclude = (keys && keys.size) ? keys : null;
	const jobs = [];
	for (const key of [...tiles.keys()]) { const t = tiles.get(key); if (t && t.ring === 0) jobs.push(rebakeTileVeg(key)); }
	return Promise.all(jobs);
}

function tileStats() {
	let splats = 0, waterMeshes = 0, waterSplats = 0, vegMeshes = 0, vegSplats = 0;
	for (const t of tiles.values()) {
		splats += (t.mesh.numSplats || 0);
		if (t.water) { waterMeshes++; waterSplats += (t.water.numSplats || 0); }
		if (t.veg) { vegMeshes++; vegSplats += (t.veg.numSplats || 0); }
	}
	return { meshes: tiles.size, splats, waterMeshes, waterSplats, vegMeshes, vegSplats, pending: tilePending.size, center: tileCenterKey, keys: [...tiles.keys()] };
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
	if (skyMesh && skyMesh.visible) skyMesh.position.copy(camera.position); // 하늘 돔은 카메라를 따라옴(무한 원경)
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
	startTileWorld, stopTileWorld, updateTileCenter, tileStats, setVegExclusion,
	setSkyFog, setMood, getSkyFog() { return { color: skyFog.color.slice(), start: skyFog.start, end: skyFog.end }; },
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
// ?tilesGenome=<url> — 추출된 월드 게놈(JSON)으로 걷는 타일 월드 시작 (W4 산출물 → T2 스트리밍).
// biomeSet/water 등 게놈 필드가 그대로 world(genome) 로 흘러 지형·색이 게놈에서 유도된다.
const tilesGenome = q.get('tilesGenome');
if (tilesGenome != null) {
	fetch(tilesGenome).then((r) => r.json()).then((raw) => {
		const g = {}; for (const k in raw) if (k[0] !== '_') g[k] = raw[k]; // _meta 등 렌더 무관 키 제거
		startTileWorld(g);
	}).catch((e) => console.error('[HktGenesisStage] 타일 게놈 로드 실패', e));
}
