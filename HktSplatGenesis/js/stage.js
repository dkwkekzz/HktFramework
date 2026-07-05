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

// Spark 공개 데모 에셋 — Marble 월드가 없을 때의 폴백 (네트워크 필요)
const SAMPLE_URL = 'https://sparkjs.dev/assets/splats/butterfly.spz';

let canvas = null, renderer = null, scene = null, camera = null;
let rig = null;      // 정합 노브(offset/scale/yaw)가 걸리는 부모 그룹
let mesh = null;     // 현재 SplatMesh
let objectUrl = null; // 파일 드롭용 blob URL (교체 시 revoke)
let enabled = false;
let statusCb = null, lastStatus = null; // 모듈이 app.js 보다 먼저 상태를 낼 수 있어(?world=) 버퍼링

const transform = { x: 0, y: 0, z: 0, scale: 1, yawDeg: 0, flip: false };

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
	// SparkRenderer 는 자동 생성이 아니다 — 공식 예제대로 scene 에 명시적으로 넣어야 스플랫이 그려진다
	scene.add(new SparkRenderer({ renderer }));
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
	setStatus('불러오는 중… ' + (name || url));
	try {
		const opts = { url };
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

function setEnabled(on) {
	enabled = !!on && !!mesh;
	if (canvas) canvas.style.display = enabled ? 'block' : 'none';
	const chk = document.getElementById('stageOn');
	if (chk) chk.checked = enabled;
}

// 오빗 카메라 미러 + 리사이즈 + 렌더 — app.js 의 tick 에서 매 프레임 호출
function frame(orbit, cssW, cssH) {
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
	get hasWorld() { return !!mesh; },
	SAMPLE_URL,
	init, load, setEnabled, frame, capture,
	setTransform(patch) { Object.assign(transform, patch); applyTransform(); },
	getTransform() { return { ...transform }; },
	onStatus(cb) { statusCb = cb; if (lastStatus) cb(lastStatus); },
};

// ?world=<url> — 하니스/딥링크용 자동 로드
const auto = new URLSearchParams(location.search).get('world');
if (auto) load(auto);
