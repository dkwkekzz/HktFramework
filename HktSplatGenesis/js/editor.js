// HktSplatGenesis — 에디터 (editor.html 전용 부트, index.html 데모와 별개 진입점)
//
// 일반 게임 에디터 형태의 작업 확인 도구. 세 기둥:
//  ① 지형 생성 — terrain-gen.js(시드 fBm) → 무대 PLY(Spark 로드) + collider heightfield(시뮬 바닥)
//  ② 오브젝트 배치 — 아웃라이너/배치 모드/마커 드래그로 개체(프리셋 유전자)를 지형 위에 놓는다
//  ③ 애니메이션 — 스켈레톤(클립/FBX) 타임라인 (재생·스크럽·배속)
//
// 에디터는 시뮬의 *입력*(유전자·emitter·뼈대 세그먼트·heightfield)만 만든다 —
// 렌더 속성 유도·GPU 상주 원칙은 엔진 쪽 그대로 (엔진/셰이더 무수정).
//
// 엔진 제약과 패딩: 스플랫 풀은 개체 수로 균등 슬라이스되고 슬라이스는 256 배수 필수
// (setScene). 개체 수를 2^k 로 패딩하기 위해 "무(void) 개체"를 쓴다 — opacity 0 은
// 렌더 VS 의 조기 컬(alpha<0.004)로 완전 불가시, emitter y=64 는 시뮬 버블(격자 y ±1.6)
// 밖이라 이웃 규칙에도 잡히지 않는다. 비용은 유휴 슬라이스의 사소한 sim 연산뿐.

(function () {
	'use strict';

	const { GENE_DEFS, PRESETS, hexToVec4, materialize } = HktGenesisGenes;

	// ── 장면 모델 ──────────────────────────────────────────────────────────
	const objects = [];       // {id, name, presetName, genes, colors:{colorA,colorB(hex)}}
	let nextId = 1;
	let selection = null;     // {kind:'terrain'|'skeleton'|'object', id?}
	let mode = 'select';      // 'select' | 'place'
	let sceneEntities = [];   // syncScene 산출물 (objects 유전자 + void 패딩)
	let ready = false;

	// 스켈레톤은 장면 공용 1개 — 엔진 bones 버퍼가 단일이라 fleshK 개체 전부가 공유한다.
	// origin(xz)으로 지형 위 어디에 세울지 정하고, 발 높이는 매 프레임 지형에서 유도.
	const skeleton = new HktGenesisSkeleton.Skeleton();
	const skel = { clip: 'walk', speed: 1.0, fat: 1.0, bones: true, origin: [0, 0] };
	let extSkel = null;

	let terrain = null;        // terrain-gen 결과 {params, height, triSoup, plyBytes}
	let colliderTris = null;   // heightfield/occluder 원본 삼각형 수프
	let bakeCenter = [0, 0];

	let engine = null, camera = null, canvas = null, device = null, context = null;
	let simTime = 0, playing = true;
	let lastView = null, lastProj = null, lastAspect = 1;

	// 무(void) 개체 — 2^k 패딩 전용 (상단 주석). 모든 힘 0 + 완전 불가시.
	const VOID_ENTITY = {
		cohesion: 0, volatility: 0, updraft: 0, damping: 1, lifeBase: 9999, emitRadius: 0.1,
		flowFreq: 1, flowSpeed: 0, size: 0.005, stretch: 0, opacity: 0, luminosity: 0,
		gravity: 0, binding: 0, restDist: 0.6, viscosity: 0, reach: 0.06, mortality: 0,
		rigid: 0, toughness: 1, bondK: 0, growRate: 0, flamm: 0, heatEmit: 0, fleshK: 0,
		colorA: [0, 0, 0, 1], colorB: [0, 0, 0, 1], form: 0, emitter: [0, 64, 0],
	};

	const $ = (id) => document.getElementById(id);
	let statusTimer = 0;
	function setStatus(msg) {
		$('status').textContent = msg;
		clearTimeout(statusTimer);
		statusTimer = setTimeout(() => { $('status').textContent = ''; }, 5000);
	}
	function fail(msg) {
		$('overlay').textContent = msg;
		$('overlay').style.display = 'flex';
	}

	// ── 지형 높이 조회: 생성 지형이 있으면 전역 height, 없으면 엔진 heightfield(외부 collider) ──
	function groundAt(x, z) {
		if (terrain) return terrain.height(x, z);
		return engine ? engine.terrainHeightAt(x, z) : 0;
	}

	// ── 스켈레톤 배치: FK 세그먼트를 origin 만큼 평행이동 (발 높이 = 지형) ──
	function skelOffset() {
		return [skel.origin[0], groundAt(skel.origin[0], skel.origin[1]), skel.origin[1]];
	}
	function offsetSegs(segs) {
		const o = skelOffset();
		if (!o[0] && !o[1] && !o[2]) return segs;
		return segs.map((s) => ({
			a: [s.a[0] + o[0], s.a[1] + o[1], s.a[2] + o[2]],
			b: [s.b[0] + o[0], s.b[1] + o[1], s.b[2] + o[2]],
			ra: s.ra, rb: s.rb,
		}));
	}
	// 뼈 친화(rest.w) 배정 기준 — 현재 모션 소스와 같은 리그/순서 (app.js 와 동일 규칙)
	function currentBindBones() {
		const raw = (skel.clip === 'external' && extSkel) ? extSkel.pose(0, 1, 1) : skeleton.pose('idle', 0, 1, 1);
		return offsetSegs(raw);
	}

	// ── 장면 → 엔진: void 패딩으로 개체 수를 2^k 로 맞춰 setScene ──────────
	function syncScene(keepTime) {
		if (!engine) return;
		objects.forEach((o) => { if (o.genes.form === 3) o.genes.bindBones = currentBindBones(); });
		const ents = objects.map((o) => o.genes);
		let pow = 1;
		while (pow < Math.max(1, ents.length)) pow <<= 1;
		while (ents.length < pow) ents.push(VOID_ENTITY);
		sceneEntities = ents;
		engine.setScene(parseInt($('count').value), sceneEntities);
		if (!keepTime) setTime(0); // 성장 시계 리셋 (재시드 의미론 — app.js 와 동일)
	}
	// 이동/수치 입력 연타 시 과도한 재시드 방지
	let reseedTimer = 0;
	function scheduleReseed() { clearTimeout(reseedTimer); reseedTimer = setTimeout(() => syncScene(), 250); }

	// ── 개체 CRUD ──────────────────────────────────────────────────────────
	function addObject(presetName, x, z) {
		if (objects.length >= 8) { setStatus('개체 상한 8 — 엔진 Entity 테이블 크기'); return null; }
		const p = PRESETS[presetName];
		if (!p) { setStatus('알 수 없는 프리셋: ' + presetName); return null; }
		const base = p.emitter || [0, 0.6, 0];
		const g = materialize(p, [x == null ? base[0] : x, base[1], z == null ? base[2] : z]);
		// 첫 살(fleshK) 개체는 스켈레톤을 그 자리에 세운다 — 살은 emitter 가 아니라 뼈대에서 자라므로
		if (g.fleshK > 0 && !objects.some((o) => o.genes.fleshK > 0) && x != null)
			skel.origin = [x, z];
		const o = { id: nextId++, name: `${presetName} #${nextId - 1}`, presetName, genes: g, colors: { colorA: p.colorA, colorB: p.colorB } };
		objects.push(o);
		syncScene();
		select({ kind: 'object', id: o.id });
		setStatus(`배치: ${o.name}`);
		return o.id;
	}
	function removeObject(id) {
		const i = objects.findIndex((o) => o.id === id);
		if (i < 0) return;
		const wasSelected = selection && selection.kind === 'object' && selection.id === id;
		objects.splice(i, 1);
		syncScene();
		if (wasSelected) select(null); else refreshUI();
	}
	function findObject(id) { return objects.find((o) => o.id === id); }

	function select(sel) {
		selection = sel;
		refreshUI();
	}
	function refreshUI() { buildTree(); buildDetail(); buildMarkers(); }

	// ── 타임라인 ───────────────────────────────────────────────────────────
	function setTime(t) {
		simTime = Math.max(0, t);
		// 외부(Mixamo) 클립은 mixer 절대 시간으로 스크럽 — built-in 은 절대 시간 함수라 그대로
		if (skel.clip === 'external' && extSkel && extSkel.mixer) extSkel.mixer.setTime(simTime * skel.speed);
	}
	function setPlaying(on) {
		playing = !!on;
		$('tlPlay').textContent = playing ? '⏸' : '⏵';
	}

	// ── 아웃라이너 ─────────────────────────────────────────────────────────
	function buildTree() {
		const tree = $('tree');
		tree.textContent = '';
		const mk = (icon, name, sub, sel, onDel) => {
			const el = document.createElement('div');
			el.className = 'item' + (isSelected(sel) ? ' on' : '');
			el.innerHTML = `<span class="ic">${icon}</span><span class="nm">${name}</span><span class="sub">${sub || ''}</span>`;
			if (onDel) {
				const d = document.createElement('button');
				d.className = 'del'; d.textContent = '×'; d.title = '삭제';
				d.addEventListener('click', (e) => { e.stopPropagation(); onDel(); });
				el.appendChild(d);
			}
			el.addEventListener('click', () => select(sel));
			tree.appendChild(el);
		};
		mk('🏔', '지형', terrain ? `시드 ${terrain.params.seed}` : '미생성', { kind: 'terrain' });
		mk('🦴', '스켈레톤', skel.clip === 'external' ? 'Mixamo' : skel.clip, { kind: 'skeleton' });
		for (const o of objects)
			mk('◆', o.name, `(${o.genes.emitter[0].toFixed(1)}, ${o.genes.emitter[2].toFixed(1)})`,
				{ kind: 'object', id: o.id }, () => removeObject(o.id));
	}
	function isSelected(sel) {
		return selection && selection.kind === sel.kind && selection.id === sel.id;
	}

	// ── 디테일(인스펙터) ───────────────────────────────────────────────────
	function el(html) {
		const t = document.createElement('template');
		t.innerHTML = html.trim();
		return t.content.firstChild;
	}
	function sliderRow(label, min, max, step, value, onInput) {
		const row = el(`<div class="row"><label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}"><span class="val"></span></div>`);
		const input = row.querySelector('input'), val = row.querySelector('.val');
		input.value = value; val.textContent = value;
		input.addEventListener('input', () => { val.textContent = input.value; onInput(parseFloat(input.value)); });
		return row;
	}
	function numRow(label, value, step, onChange) {
		const row = el(`<div class="inline"><label>${label}</label><input type="number" step="${step}"></div>`);
		const input = row.querySelector('input');
		input.value = value;
		input.addEventListener('change', () => onChange(parseFloat(input.value) || 0));
		return row;
	}

	function buildDetail() {
		const d = $('detail');
		d.textContent = '';
		if (!selection) { d.appendChild(el('<div class="note">아웃라이너에서 지형 / 스켈레톤 / 개체를 선택하세요.</div>')); return; }
		if (selection.kind === 'terrain') buildTerrainDetail(d);
		else if (selection.kind === 'skeleton') buildSkeletonDetail(d);
		else {
			const o = findObject(selection.id);
			if (o) buildObjectDetail(d, o); else selection = null;
		}
	}

	// 지형 생성 파라미터 — 시드/진폭/기복/옥타브/범위 → [생성] 이 무대+collider 를 한 번에 굽는다
	const terrParams = { seed: 8, amp: 0.9, scale: 3.0, octaves: 4, extent: 4.8, biomes: true, waterY: -0.2, biomeScale: 40 };
	function buildTerrainDetail(d) {
		d.appendChild(el('<h2>절차 지형 (시드 → 무대 + 시뮬 바닥)</h2>'));
		const seedRow = el('<div class="inline"><label>시드</label><input type="number" step="1"><button>🎲</button></div>');
		const seedInput = seedRow.querySelector('input');
		seedInput.value = terrParams.seed;
		seedInput.addEventListener('change', () => { terrParams.seed = parseInt(seedInput.value) || 0; });
		seedRow.querySelector('button').addEventListener('click', () => {
			terrParams.seed = (Math.random() * 1e6) | 0;
			seedInput.value = terrParams.seed;
			generateTerrain();
		});
		d.appendChild(seedRow);
		d.appendChild(sliderRow('진폭', 0.2, 1.1, 0.05, terrParams.amp, (v) => { terrParams.amp = v; }));
		d.appendChild(sliderRow('기복 크기', 1, 8, 0.1, terrParams.scale, (v) => { terrParams.scale = v; }));
		d.appendChild(sliderRow('옥타브', 1, 6, 1, terrParams.octaves, (v) => { terrParams.octaves = v; }));
		// 범위를 키우면 바이옴(온·습도)이 창 안에서 바뀌어 보인다 — T2 청크 스트리밍 전의 단일창 미리보기
		d.appendChild(sliderRow('범위(반폭)', 4.8, 40, 0.1, terrParams.extent, (v) => { terrParams.extent = v; }));
		// 바이옴: 저주파 2채널(온·습도)로 평야/산악/사막/설원 을 경계 보간 (끄면 단일 fBm)
		const bioRow = el('<div class="inline"><label><input type="checkbox"> 바이옴</label></div>');
		bioRow.querySelector('input').checked = terrParams.biomes;
		bioRow.querySelector('input').addEventListener('change', (e) => { terrParams.biomes = e.target.checked; });
		d.appendChild(bioRow);
		d.appendChild(sliderRow('바이옴 크기(m)', 15, 80, 1, terrParams.biomeScale, (v) => { terrParams.biomeScale = v; }));
		d.appendChild(sliderRow('수위 Y', -0.7, 0.6, 0.05, terrParams.waterY, (v) => { terrParams.waterY = v; }));
		const btns = el('<div class="inline"><button>지형 생성</button><button>지형 제거</button></div>');
		btns.children[0].addEventListener('click', () => generateTerrain());
		btns.children[1].addEventListener('click', () => clearTerrain());
		d.appendChild(btns);
		const stageRow = el('<div class="inline"><label><input type="checkbox" id="stageOn"> 무대 표시</label></div>');
		stageRow.querySelector('input').checked = !!(stage() && stage().enabled);
		stageRow.querySelector('input').addEventListener('change', (e) => { if (stage()) stage().setEnabled(e.target.checked); });
		d.appendChild(stageRow);
		d.appendChild(el(`<div class="note" id="terrStatus">${terrainStatus()}</div>`));
		d.appendChild(el('<div class="note">무대는 로드, 생명은 배양 — 생성 PLY 는 Spark 무대로, 같은 height 의 collider 는 시뮬 바닥(heightfield)으로 들어간다.</div>'));
	}
	function terrainStatus() {
		if (!terrain) return '지형 미생성 — 평면 바닥(y=0)';
		const p = terrain.params;
		return `<b>지형 적용됨</b> — 시드 ${p.seed} · 진폭 ${p.amp} · 범위 ±${p.extent}m · 커버리지 ${(lastCoverage * 100).toFixed(0)}%`;
	}

	// 스켈레톤 — 위치/살 문법/뼈대 표시/FBX 드롭 (클립·배속은 하단 타임라인)
	function buildSkeletonDetail(d) {
		d.appendChild(el('<h2>스켈레톤 (장면 공용 1개)</h2>'));
		d.appendChild(numRow('위치 X', skel.origin[0], 0.1, (v) => { skel.origin[0] = v; refreshUI(); }));
		d.appendChild(numRow('위치 Z', skel.origin[1], 0.1, (v) => { skel.origin[1] = v; refreshUI(); }));
		d.appendChild(el('<h2>살 문법</h2>'));
		d.appendChild(sliderRow('통통함', 0.5, 1.8, 0.05, skel.fat, (v) => { skel.fat = v; }));
		const bonesRow = el('<div class="inline"><label><input type="checkbox"> 뼈대 표시</label></div>');
		bonesRow.querySelector('input').checked = skel.bones;
		bonesRow.querySelector('input').addEventListener('change', (e) => { skel.bones = e.target.checked; });
		d.appendChild(bonesRow);
		d.appendChild(el('<h2>Mixamo 불러오기</h2>'));
		const drop = el('<div id="drop">FBX 파일을 여기에 드롭<br>(Mixamo → Download → FBX)</div>');
		const file = el('<input type="file" accept=".fbx" style="display:none">');
		const status = el(`<div class="note" id="skelStatus">${extSkel ? `<b>불러옴</b> — 뼈 ${extSkel.bones.length}개` : (typeof THREE !== 'undefined' && THREE.FBXLoader ? 'FBX 로더 준비됨.' : 'vendor three 미로드 — FBX 비활성.')}</div>`);
		['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('hot'); }));
		['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('hot'); }));
		drop.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) readFBXFile(e.dataTransfer.files[0], status); });
		drop.addEventListener('click', () => file.click());
		file.addEventListener('change', (e) => readFBXFile(e.target.files[0], status));
		d.appendChild(drop); d.appendChild(file); d.appendChild(status);
		d.appendChild(el('<div class="note">살(fleshK) 개체 — 예: 히키토 — 를 배치하면 이 뼈대 위에 살이 자란다. 클립·배속·스크럽은 하단 타임라인.</div>'));
	}

	// 개체 — 프리셋 유전자 사본을 직접 편집 (매 프레임 entity 테이블로 올라가 즉시 반영)
	function buildObjectDetail(d, o) {
		d.appendChild(el(`<h2>${o.name} <span style="opacity:.6">(${o.presetName})</span></h2>`));
		d.appendChild(numRow('위치 X', o.genes.emitter[0], 0.1, (v) => { o.genes.emitter[0] = v; buildTree(); if (o.genes.form > 0) scheduleReseed(); }));
		d.appendChild(numRow('위치 Z', o.genes.emitter[2], 0.1, (v) => { o.genes.emitter[2] = v; buildTree(); if (o.genes.form > 0) scheduleReseed(); }));
		d.appendChild(numRow('지상고 Y', o.genes.emitter[1], 0.1, (v) => { o.genes.emitter[1] = v; if (o.genes.form > 0) scheduleReseed(); }));
		d.appendChild(el('<h2>유전자</h2>'));
		for (const [k, [label, min, max, step]] of Object.entries(GENE_DEFS))
			d.appendChild(sliderRow(label, min, max, step, o.genes[k], (v) => { o.genes[k] = v; }));
		d.appendChild(el('<h2>팔레트</h2>'));
		const colors = el('<div class="inline"><label>몸통(저속)</label><input type="color" data-k="colorA"><label>끝(고속)</label><input type="color" data-k="colorB"></div>');
		for (const input of colors.querySelectorAll('input')) {
			const k = input.dataset.k;
			input.value = o.colors[k];
			input.addEventListener('input', () => { o.colors[k] = input.value; o.genes[k] = hexToVec4(input.value); });
		}
		d.appendChild(colors);
		const delBtn = el('<div class="inline"><button>개체 삭제</button></div>');
		delBtn.querySelector('button').addEventListener('click', () => removeObject(o.id));
		d.appendChild(delBtn);
		if (o.genes.form > 0) d.appendChild(el('<div class="note">형태(form) 개체 — 위치 변경은 재시드로 반영된다 (골격/부착점 재생성).</div>'));
	}

	function readFBXFile(f, statusEl) {
		if (!f) return;
		statusEl.innerHTML = '읽는 중… ' + f.name;
		const r = new FileReader();
		r.onload = () => {
			try {
				extSkel = HktGenesisSkeleton.parseFBX(r.result);
				$('extOpt').disabled = false;
				$('tlClip').value = 'external';
				skel.clip = 'external';
				syncScene(); // 리그/순서가 달라지므로 뼈 친화 재배정 (필수 — CLAUDE.md 재시드 규칙)
				statusEl.innerHTML = `<b>불러오기 완료</b> — ${f.name}` +
					(extSkel.clipName ? ` · 클립 “${extSkel.clipName}”` : ' · 클립 없음(바인드 포즈)') +
					` · 뼈 ${extSkel.bones.length}개`;
				buildTree();
			} catch (e) {
				statusEl.innerHTML = 'FBX 파싱 실패: ' + e.message;
			}
		};
		r.readAsArrayBuffer(f);
	}

	// ── 지형 생성/제거 ─────────────────────────────────────────────────────
	const stage = () => window.HktGenesisStage;
	let lastCoverage = 0;
	function generateTerrain(params) {
		Object.assign(terrParams, params || {});
		terrain = HktGenesisTerrainGen.create(terrParams);
		const ext = terrain.params.extent;
		// collider 해상도·PLY 밀도는 범위에 비례(상한) — splatScale 로 커버리지 유지
		colliderTris = terrain.triSoup(Math.min(256, Math.round(128 * ext / 4.8)));
		applyCollider();
		if (stage()) {
			const dens = Math.min(320, Math.round(160 * ext / 4.8));
			const scale = 0.55 * (ext / 4.8) * (160 / dens);
			stage().load(new File([terrain.plyBytes(dens, scale)], 'editor-terrain.ply'));
		}
		if (selection && selection.kind === 'terrain') buildDetail(); else buildTree();
		setStatus(`지형 생성 — 시드 ${terrain.params.seed}`);
	}
	function clearTerrain() {
		terrain = null; colliderTris = null; lastCoverage = 0;
		engine.setHeightfield(null);
		engine.setOccluder(null);
		if (stage()) stage().setEnabled(false);
		syncScene();
		refreshUI();
	}
	// heightfield 베이크: 시뮬 버블 XZ(중심 ±4.8) — app.js S2/S5 와 동일 지역·추종 규칙
	function applyCollider(center, opts) {
		if (!colliderTris) return;
		const c = center || [camera.target[0], camera.target[2]];
		const hf = HktHeightfield.bake(colliderTris, { res: 128, originX: c[0] - 4.8, originZ: c[1] - 4.8, cell: 9.6 / 127 });
		bakeCenter = c;
		lastCoverage = hf.coverage;
		engine.setHeightfield(hf);
		engine.setOccluder(colliderTris);      // S3: 같은 collider 가 가림의 근거
		engine.setOccluderTransform(null);     // 에디터 지형은 생명 좌표 원본 — 항등
		if (opts && opts.silent) return;
		syncScene(); // 나무 뿌리/재생성 지점이 지형을 반영하도록
	}
	let followCd = 0;
	function followCollider() {
		if (!colliderTris) return;
		if (++followCd < 30) return; // 0.5초 간격
		followCd = 0;
		const dx = camera.target[0] - bakeCenter[0], dz = camera.target[2] - bakeCenter[1];
		if (dx * dx + dz * dz > 4) applyCollider([camera.target[0], camera.target[2]], { silent: true });
	}

	// ── 뷰포트 픽킹: 화면 광선 → 지형 교점 ─────────────────────────────────
	function rayFromClient(cx, cy) {
		const rect = canvas.getBoundingClientRect();
		const nx = ((cx - rect.left) / rect.width) * 2 - 1;
		const ny = 1 - ((cy - rect.top) / rect.height) * 2;
		const th = Math.tan(camera.fov / 2);
		const eye = camera._eye();
		let f = [camera.target[0] - eye[0], camera.target[1] - eye[1], camera.target[2] - eye[2]];
		const fl = Math.hypot(...f); f = f.map((v) => v / fl);
		let r = [f[2], 0, -f[0]];
		const rl = Math.hypot(...r) || 1; r = r.map((v) => v / rl);
		const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
		const dir = [0, 1, 2].map((i) => r[i] * nx * th * lastAspect + u[i] * ny * th + f[i]);
		return { org: eye, dir };
	}
	// 광선을 따라 전진하며 지형면과의 부호 변화를 잡고 이분법으로 조인다
	function groundHit(cx, cy) {
		const { org, dir } = rayFromClient(cx, cy);
		const y = (t) => org[1] + dir[1] * t;
		const h = (t) => groundAt(org[0] + dir[0] * t, org[2] + dir[2] * t);
		let t0 = 0.05, f0 = y(t0) - h(t0);
		for (let t = 0.4; t <= 90; t += 0.35) {
			const ft = y(t) - h(t);
			if (f0 > 0 && ft <= 0) {
				let lo = t0, hi = t;
				for (let k = 0; k < 24; k++) {
					const m = (lo + hi) / 2;
					if (y(m) - h(m) > 0) lo = m; else hi = m;
				}
				const tm = (lo + hi) / 2;
				return [org[0] + dir[0] * tm, y(tm), org[2] + dir[2] * tm];
			}
			t0 = t; f0 = ft;
		}
		return null;
	}

	// ── 마커: 개체/스켈레톤의 화면 투영 핸들 (선택·드래그 이동) ─────────────
	function mulPoint(m, p) { // column-major mat4 × [p,1]
		return [
			m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
			m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
			m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
			m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15],
		];
	}
	function projectToCss(p) {
		if (!lastView) return null;
		const v = mulPoint(lastView, p);
		if (v[2] > -0.05) return null; // 카메라 뒤
		const c = mulPoint(lastProj, v);
		if (c[3] <= 0) return null;
		return [(c[0] / c[3] * 0.5 + 0.5) * canvas.clientWidth, (0.5 - c[1] / c[3] * 0.5) * canvas.clientHeight];
	}
	const markerEls = new Map(); // key: 'obj:<id>' | 'skel'
	function buildMarkers() {
		const box = $('markers');
		box.textContent = '';
		markerEls.clear();
		const mk = (key, label, sel, onMove, onMoveEnd) => {
			const m = el(`<div class="marker${isSelected(sel) ? ' on' : ''}"><span class="tag">${label}</span></div>`);
			m.addEventListener('pointerdown', (e) => {
				e.preventDefault();
				select(sel);
				const mEl = markerEls.get(key); // select 의 rebuild 로 요소가 교체된다
				if (!mEl) return;
				mEl.setPointerCapture(e.pointerId);
				let moved = false;
				const onPm = (ev) => {
					const hit = groundHit(ev.clientX, ev.clientY);
					if (hit) { moved = true; onMove(hit); }
				};
				const onUp = () => {
					mEl.removeEventListener('pointermove', onPm);
					mEl.removeEventListener('pointerup', onUp);
					if (moved && onMoveEnd) onMoveEnd();
				};
				mEl.addEventListener('pointermove', onPm);
				mEl.addEventListener('pointerup', onUp);
			});
			box.appendChild(m);
			markerEls.set(key, m);
		};
		for (const o of objects)
			mk('obj:' + o.id, o.name, { kind: 'object', id: o.id },
				(hit) => { o.genes.emitter[0] = hit[0]; o.genes.emitter[2] = hit[2]; },
				() => { buildTree(); buildDetail(); if (findObject(o.id).genes.form > 0) scheduleReseed(); });
		mk('skel', '스켈레톤', { kind: 'skeleton' },
			(hit) => { skel.origin = [hit[0], hit[2]]; },
			() => buildDetail());
	}
	function updateMarkers() {
		for (const [key, m] of markerEls) {
			let wp;
			if (key === 'skel') {
				const o = skelOffset();
				wp = [o[0], o[1] + 0.98, o[2]]; // Hips 높이
				m.style.display = sceneEntities.some((g) => g.fleshK > 0) || isSelected({ kind: 'skeleton' }) ? '' : 'none';
			} else {
				const o = findObject(parseInt(key.slice(4)));
				if (!o) continue;
				const em = o.genes.emitter;
				wp = [em[0], em[1] + groundAt(em[0], em[2]), em[2]];
			}
			const css = projectToCss(wp);
			if (!css) { m.style.left = '-100px'; continue; }
			m.style.left = css[0] + 'px';
			m.style.top = css[1] + 'px';
		}
	}

	// ── 부트 ───────────────────────────────────────────────────────────────
	async function boot() {
		// 팔레트/타임라인 정적 UI
		const pal = $('palette');
		for (const name of Object.keys(PRESETS)) {
			const opt = document.createElement('option');
			opt.value = name; opt.textContent = name;
			pal.appendChild(opt);
		}
		pal.value = '나무';
		$('modeSelect').addEventListener('click', () => setMode('select'));
		$('modePlace').addEventListener('click', () => setMode('place'));
		$('addObj').addEventListener('click', () => addObject(pal.value, camera ? camera.target[0] : 0, camera ? camera.target[2] : 0));
		$('reseed').addEventListener('click', () => syncScene());
		$('count').addEventListener('change', () => syncScene());
		$('tlPlay').addEventListener('click', () => setPlaying(!playing));
		$('tlRewind').addEventListener('click', () => { setTime(0); syncScene(); });
		let scrubbing = false;
		$('tlScrub').addEventListener('pointerdown', () => { scrubbing = true; });
		$('tlScrub').addEventListener('pointerup', () => { scrubbing = false; });
		$('tlScrub').addEventListener('input', (e) => setTime(parseFloat(e.target.value)));
		window.__tlScrubbing = () => scrubbing;
		$('tlSpeed').addEventListener('input', (e) => { skel.speed = parseFloat(e.target.value); });
		$('tlClip').addEventListener('change', (e) => {
			const wasExternal = skel.clip === 'external';
			skel.clip = e.target.value;
			// built-in ↔ 외부 리그 전환은 세그먼트 수/순서가 달라지므로 친화 재배정
			if (wasExternal !== (skel.clip === 'external') && objects.some((o) => o.genes.form === 3)) syncScene();
			buildTree();
		});
		document.addEventListener('keydown', (e) => {
			const tag = document.activeElement && document.activeElement.tagName;
			if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
			if (e.key === 'Delete' && selection && selection.kind === 'object') removeObject(selection.id);
			if (e.key === 'Escape') setMode('select');
		});

		if (!navigator.gpu) return fail('이 브라우저는 WebGPU 를 지원하지 않습니다 (Chrome/Edge 113+ 필요).');
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) return fail('WebGPU 어댑터를 얻지 못했습니다. chrome://flags 의 WebGPU 설정을 확인하세요.');
		device = await adapter.requestDevice();
		device.addEventListener('uncapturederror', (e) => console.error('[HktSplatGenesis 에디터] GPU 오류:', e.error.message));

		canvas = $('gpu');
		context = canvas.getContext('webgpu');
		const format = navigator.gpu.getPreferredCanvasFormat();
		context.configure({
			device, format, alphaMode: 'premultiplied',
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
		});

		engine = new HktGenesisEngine(device, context, format);
		camera = new HktOrbitCamera(canvas);
		camera.radius = 5.5;
		syncScene();
		select({ kind: 'terrain' }); // 첫 작업 = 지형 생성으로 유도
		ready = true;

		// 배치 클릭 (드래그 회전과 구분: 이동량 작을 때만)
		let downXY = null;
		canvas.addEventListener('pointerdown', (e) => { if (!e.altKey) downXY = [e.clientX, e.clientY]; });
		canvas.addEventListener('click', (e) => {
			if (mode !== 'place' || e.altKey || !downXY) return;
			if (Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) > 5) return;
			const hit = groundHit(e.clientX, e.clientY);
			if (hit) addObject(pal.value, hit[0], hit[2]);
		});

		// Alt+드래그 인력 — 데모(app.js)와 동일 상호작용 (검증 도구로 유지)
		const pull = [0, 0, 0, 0];
		canvas.addEventListener('pointerdown', (e) => {
			if (!e.altKey) return;
			const { org, dir } = rayFromClient(e.clientX, e.clientY);
			const t = (camera.target[1] - org[1]) / dir[1];
			if (isFinite(t) && t > 0) {
				pull[0] = org[0] + dir[0] * t; pull[1] = org[1] + dir[1] * t; pull[2] = org[2] + dir[2] * t; pull[3] = 55;
			}
		});
		canvas.addEventListener('pointermove', (e) => {
			if (pull[3] <= 0) return;
			if (!e.altKey || e.buttons === 0) { pull[3] = 0; return; }
			const { org, dir } = rayFromClient(e.clientX, e.clientY);
			const t = (camera.target[1] - org[1]) / dir[1];
			if (isFinite(t) && t > 0) { pull[0] = org[0] + dir[0] * t; pull[1] = org[1] + dir[1] * t; pull[2] = org[2] + dir[2] * t; }
		});
		canvas.addEventListener('pointerup', () => { pull[3] = 0; });

		function resize() {
			const dpr = Math.min(devicePixelRatio || 1, 2);
			const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
			if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
		}

		let last = performance.now(), fpsAvg = 0;
		function tick(now) {
			resize();
			const dt = Math.min((now - last) / 1000, 0.05);
			last = now;
			if (playing) simTime += dt;

			lastAspect = canvas.width / canvas.height;
			const focalY = 0.5 * canvas.height / Math.tan(camera.fov / 2);
			lastView = camera.view();
			lastProj = camera.proj(lastAspect);

			// L6: 살(fleshK) 개체가 있을 때만 뼈대 FK — origin 오프셋을 얹어 지형 위에 세운다
			let bones = null;
			if (sceneEntities.some((g) => g.fleshK > 0)) {
				const raw = (skel.clip === 'external' && extSkel)
					? extSkel.pose(playing ? dt : 0, skel.speed, skel.fat) // 외부 클립은 증분 시간
					: skeleton.pose(skel.clip, simTime, skel.speed, skel.fat);
				bones = offsetSegs(raw);
			}
			const stageOn = stage() && stage().enabled;
			if (stageOn) stage().frame(camera, canvas.clientWidth, canvas.clientHeight);
			engine.frame({
				dt, time: simTime, genes: sceneEntities[0], entities: sceneEntities, paused: !playing, pull,
				bones, showBones: skel.bones,
				background: stageOn ? { r: 0, g: 0, b: 0, a: 0 } : undefined,
				gridCenter: camera.target, // S5 시뮬 버블
				view: lastView, proj: lastProj,
				viewport: [canvas.width, canvas.height], focal: [focalY, focalY],
			});
			followCollider();
			// 하니스 훅: 스왑체인 readback 은 present 전(같은 태스크)이어야 한다 — test/README 함정
			if (window.__hktAfterFrame) window.__hktAfterFrame({ device, context, canvas, camera, engine });

			updateMarkers();
			if (!window.__tlScrubbing()) $('tlScrub').value = simTime % 60;
			$('tlTime').textContent = simTime.toFixed(1) + 's';
			fpsAvg = fpsAvg * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
			$('fps').textContent = `${fpsAvg.toFixed(0)} fps · ${(engine.count / 1024).toFixed(0)}k splats`;
			requestAnimationFrame(tick);
		}
		requestAnimationFrame(tick);
	}

	function setMode(m) {
		mode = m;
		$('modeSelect').classList.toggle('on', m === 'select');
		$('modePlace').classList.toggle('on', m === 'place');
		$('viewport').classList.toggle('place', m === 'place');
	}

	// ── 하니스/자동화 API ──────────────────────────────────────────────────
	window.HktGenesisEditor = {
		get ready() { return ready; },
		generateTerrain, clearTerrain,
		addObject, removeObject,
		selectObject: (id) => select(id == null ? null : { kind: 'object', id }),
		setMode, setPalette: (p) => { $('palette').value = p; },
		setClip: (c) => { $('tlClip').value = c; $('tlClip').dispatchEvent(new Event('change')); },
		setTime, play: setPlaying,
		debug() {
			return {
				mode, simTime, playing,
				terrain: terrain ? terrain.params : null,
				coverage: lastCoverage,
				entities: sceneEntities.length,
				skeleton: { clip: skel.clip, origin: skel.origin.slice() },
				objects: objects.map((o) => ({ id: o.id, name: o.name, preset: o.presetName, emitter: o.genes.emitter.slice() })),
			};
		},
	};

	boot().catch((e) => { console.error(e); fail('초기화 실패: ' + e.message); });
})();
