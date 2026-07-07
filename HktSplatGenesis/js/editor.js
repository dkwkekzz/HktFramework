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
	// genome: 형태 게놈 ① (C1) — 부위 반지름 배율. 항등이면 기존 살 그대로.
	const skel = { clip: 'walk', speed: 1.0, fat: 1.0, bones: true, origin: [0, 0], genome: HktGenesisGenome.create() };
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

	// ── 스켈레톤 배치 ────────────────────────────────────────────────────────
	// 스켈레톤 정의(게놈·클립·통통함)는 장면 공용 1벌이지만, 살(fleshK) 개체는 각자 제
	// emitter 위치에 이 스켈레톤의 *인스턴스*를 세운다 — 일반 엔진처럼 "하나의 스켈레톤을
	// 여러 캐릭터가 참조". 엔진 boneBuf 는 단일이라 전 인스턴스를 하나의 전역 뼈 테이블로
	// 이어붙이고(sceneBones), 개체별 뼈 친화(rest.w)는 제 구간의 절대 인덱스를 쓰도록
	// boneBase 를 실어 보낸다 (engine._initFleshCloud 가 base+si 로 시드).

	// 원점 기준 FK 세그먼트를 (ox,oz) 로 평행이동 (발 높이 = 지형). g(부위 그룹) 보존 —
	// 보존하지 않으면 채색(C3) 이 'other' 로 흡수돼 부위 색이 사라진다.
	function offsetSegsBy(segs, ox, oz) {
		const oy = groundAt(ox, oz);
		if (!ox && !oy && !oz) return segs;
		return segs.map((s) => ({
			a: [s.a[0] + ox, s.a[1] + oy, s.a[2] + oz],
			b: [s.b[0] + ox, s.b[1] + oy, s.b[2] + oz],
			ra: s.ra, rb: s.rb, g: s.g,
		}));
	}
	// 살 개체 목록 (배치 순서 = boneBase 배정 순서). 인스턴스는 이 순서로 뼈 테이블에 이어붙는다.
	function fleshObjects() { return objects.filter((o) => o.genes.form === 3); }
	// 뼈 친화(rest.w) 배정용 rest 포즈 — 원점 기준 (app.js 와 동일 규칙). 인스턴스별로 offset.
	function bindPoseRaw() {
		return (skel.clip === 'external' && extSkel) ? extSkel.pose(0, 1, 1, skel.genome) : skeleton.pose('idle', 0, 1, 1, skel.genome);
	}
	// 원점 기준 raw 포즈를 전 살 인스턴스 위치로 이어붙인다 (전역 뼈 테이블). 순서는 fleshObjects.
	// A 트랙: 개체별 애니메이션. `o.anim` 이 있으면 그 개체의 컨트롤러(입력→상태→클립)가 제
	// 포즈를 내고(이동 강도 주입 → 상태 머신 전이), 없으면 장면 공용 클립 포즈(sharedRaw)를 따른다.
	// built-in 리그·같은 게놈이라 세그먼트 수/순서가 공용 rest 와 동일 → 친화 인덱스 호환(재시드 불필요).
	function concatInstances(sharedRaw, dt) {
		const bones = [];
		for (const o of fleshObjects()) {
			const em = o.genes.emitter;
			let raw = sharedRaw;
			if (o.anim) {
				o.anim.input.setMove(0, o.anim.moveMag || 0);
				const r = o.anim.controller.update(playing ? (dt || 0) : 0, o.anim.input, { fat: skel.fat, genome: skel.genome });
				raw = r.segs;
				o.anim.stateName = r.state.name;
			}
			for (const s of offsetSegsBy(raw, em[0], em[2])) bones.push(s);
		}
		return bones;
	}
	// 개체별 A 트랙 애니메이션 켜기/끄기 — 켜면 제 스켈레톤 인스턴스 + 입력 + 상태 머신을 갖는다.
	// 스켈레톤 *정의*(게놈·리그)는 여전히 공용이라 세그먼트 순서가 같다 (친화 호환).
	function enableAnim(o) {
		if (o.anim) return;
		o.anim = {
			input: new HktGenesisAnim.CharacterInput(),
			controller: new HktGenesisAnim.AnimationController(new HktGenesisSkeleton.Skeleton()),
			moveMag: 0.5, stateName: 'idle',
		};
	}
	function disableAnim(o) { o.anim = null; }

	// ── 장면 → 엔진: void 패딩으로 개체 수를 2^k 로 맞춰 setScene ──────────
	function syncScene(keepTime) {
		if (!engine) return;
		// 살 개체는 스켈레톤 정의(게놈·클립·재질) 1벌을 공유하되, 인스턴스는 각자 제 emitter 에
		// 선다. 전 인스턴스를 하나의 전역 뼈 테이블로 이어붙이므로 개체별 뼈 친화 인덱스가 제
		// 구간의 절대값이 되도록 boneBase 를 실어 보낸다 (engine._initFleshCloud 가 base+si 로 시드).
		const rest = bindPoseRaw();
		let base = 0;
		objects.forEach((o) => {
			if (o.genes.form !== 3) return;
			const em = o.genes.emitter;
			// A 트랙: 애니 개체는 제 컨트롤러의 rest 로 시드 (공용 클립이 external 이어도 built-in 정합)
			const restRaw = o.anim ? o.anim.controller.bindBones() : rest;
			o.genes.bindBones = offsetSegsBy(restRaw, em[0], em[2]); // 이 인스턴스의 rest 뼈 (친화 가중용)
			o.genes.boneBase = base;                              // 전역 테이블 내 이 인스턴스의 시작 인덱스
			base += o.genes.bindBones.length;
			o.genes.genome = skel.genome;
			HktGenesisGenome.applyMatter(o.genes, skel.genome); // ③ 재질 차분 (미지정이면 무변)
		});
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
	// 드래그 이동 중엔 성장 시계를 유지한 채 재생성 — 나무/골렘/살이 자란 모습 그대로 새 위치를 따라오게 한다
	let liveReseedTimer = 0;
	function scheduleReseedKeepTime() { clearTimeout(liveReseedTimer); liveReseedTimer = setTimeout(() => syncScene(true), 60); }

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
	// [0,1] rgb → #rrggbb (색 피커 초기값). 역변환은 hexToVec4(genes.js).
	function vec3ToHex(c) {
		const h = (x) => Math.max(0, Math.min(255, Math.round(x * 255))).toString(16).padStart(2, '0');
		return '#' + h(c[0]) + h(c[1]) + h(c[2]);
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
	// W6 대기(mood) 는 terrParams 에 함께 실린다 — skyTop(천정)/skyHorizon(지평선). stage.setMood 로
	// 무대 하늘 돔에 배선(지형과 무관한 상층). skyOn 으로 켜고 끈다.
	const terrParams = { seed: 8, amp: 0.9, scale: 3.0, octaves: 4, extent: 4.8, biomes: true, waterY: -0.2, biomeScale: 40,
		skyOn: true, mood: { skyTop: [0.28, 0.45, 0.72], skyHorizon: [0.68, 0.78, 0.86] } };
	// 하늘 프리셋 — 빠른 무드 비교용 (맑음=컨셉 계열 진한 파랑, 황혼, 재)
	const SKY_PRESETS = {
		'맑음': { skyTop: [0.20, 0.45, 0.85], skyHorizon: [0.78, 0.87, 0.94] },
		'황혼': { skyTop: [0.18, 0.15, 0.34], skyHorizon: [0.95, 0.55, 0.30] },
		'재': { skyTop: [0.14, 0.10, 0.12], skyHorizon: [0.55, 0.24, 0.16] },
	};
	function buildTerrainDetail(d) {
		d.appendChild(el('<h2>절차 지형 (시드 → 무대 + 시뮬 바닥)</h2>'));

		// ── W1·W2·W4 월드 게놈: 프리셋 · 추출 JSON 로드 · 프로파일 검증 ──────────
		// 게놈 하나가 바이옴 셋·팔레트·수역·relief·대기(mood)를 정한다. 프리셋(W1)이나 이미지에서
		// 추출한 JSON(W4)을 불러오면 색족·성격이 통째로 바뀐다. 로드 시 W2 프로파일로 검증.
		d.appendChild(el('<h2 style="margin-top:4px">월드 게놈 (W1·W2·W4)</h2>'));
		const gPreset = el('<div class="inline"><label>프리셋</label></div>');
		for (const name of Object.keys(HktGenesisTerrainGen.PRESETS)) {
			const b = el(`<button style="margin-right:4px">${name}</button>`);
			b.addEventListener('click', () => applyWorldGenome(HktGenesisTerrainGen.preset(name), name));
			gPreset.appendChild(b);
		}
		d.appendChild(gPreset);
		const gLoad = el('<div class="inline"><label>게놈 JSON</label><input type="file" accept=".json,application/json"></div>');
		gLoad.querySelector('input').addEventListener('change', (e) => {
			const f = e.target.files[0]; if (!f) return;
			const r = new FileReader();
			r.onload = () => { try { applyWorldGenome(JSON.parse(r.result), f.name); } catch (err) { setStatus('게놈 JSON 파싱 실패: ' + err.message); } };
			r.readAsText(f);
		});
		d.appendChild(gLoad);
		if (worldGenomeStatus)
			d.appendChild(el(`<div class="note">게놈 <b>${worldGenomeStatus.label}</b>: ${worldGenomeStatus.ok ? '✅' : '⚠️'} ${worldGenomeStatus.text} · 바이옴 ${(terrParams.biomeSet || []).length || '기본'} · 범위↑ 로 바이옴 다양성 확인</div>`));
		d.appendChild(el('<h2 style="margin-top:8px">지형 relief</h2>'));

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

		// ── W6 대기(mood): 하늘 그라데이션 ─────────────────────────────────────
		// 무대 하늘 돔(setMood)에 라이브 배선 — 색을 바꾸면 지형 재생성 없이 즉시 반영된다.
		d.appendChild(el('<h2>하늘 (대기 mood)</h2>'));
		const applyMood = () => { if (stage() && stage().enabled) stage().setMood(terrParams.skyOn ? terrParams.mood : {}); };
		const skyOnRow = el('<div class="inline"><label><input type="checkbox"> 하늘 표시</label></div>');
		skyOnRow.querySelector('input').checked = terrParams.skyOn;
		skyOnRow.querySelector('input').addEventListener('change', (e) => { terrParams.skyOn = e.target.checked; applyMood(); });
		d.appendChild(skyOnRow);
		const skyRow = el('<div class="inline"><label>천정 / 지평선</label><input type="color" data-k="top" title="천정(하늘 위)"><input type="color" data-k="horizon" title="지평선(안개 톤)"></div>');
		const topPick = skyRow.querySelector('[data-k="top"]'), horPick = skyRow.querySelector('[data-k="horizon"]');
		topPick.value = vec3ToHex(terrParams.mood.skyTop);
		horPick.value = vec3ToHex(terrParams.mood.skyHorizon);
		topPick.addEventListener('input', () => { terrParams.mood.skyTop = hexToVec4(topPick.value).slice(0, 3); applyMood(); });
		horPick.addEventListener('input', () => { terrParams.mood.skyHorizon = hexToVec4(horPick.value).slice(0, 3); applyMood(); });
		d.appendChild(skyRow);
		const skyPresetRow = el('<div class="inline"><label>프리셋</label></div>');
		for (const [name, m] of Object.entries(SKY_PRESETS)) {
			const b = el(`<button style="margin-right:4px">${name}</button>`);
			b.addEventListener('click', () => {
				terrParams.mood = { skyTop: m.skyTop.slice(), skyHorizon: m.skyHorizon.slice() };
				terrParams.skyOn = true; skyOnRow.querySelector('input').checked = true;
				topPick.value = vec3ToHex(m.skyTop); horPick.value = vec3ToHex(m.skyHorizon);
				applyMood();
			});
			skyPresetRow.appendChild(b);
		}
		d.appendChild(skyPresetRow);
		d.appendChild(el('<div class="note">천정→지평선 세로 그라데이션(월드 y 기준). 지형 생성 후 무대가 켜지면 보인다 — 색은 라이브 반영.</div>'));

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
		d.appendChild(el('<h2>스켈레톤 (정의 공용 · 인스턴스별 배치)</h2>'));
		// 살 개체마다 이 스켈레톤의 인스턴스가 제 위치에 선다 — 위치는 각 히키토의 emitter.
		// 스켈레톤이 없을 때만 미리보기 원점을 노출(배치 전 포즈 확인용).
		if (!objects.some((o) => o.genes.form === 3)) {
			d.appendChild(numRow('미리보기 X', skel.origin[0], 0.1, (v) => { skel.origin[0] = v; refreshUI(); }));
			d.appendChild(numRow('미리보기 Z', skel.origin[1], 0.1, (v) => { skel.origin[1] = v; refreshUI(); }));
			d.appendChild(el('<div class="note">스켈레톤 정의(게놈·클립·통통함)는 공용 1벌 — 히키토(살) 개체를 배치하면 각 개체가 제 위치에 이 스켈레톤 인스턴스를 세운다. 여러 히키토는 각자 제 스켈레톤을 참조한다.</div>'));
		} else {
			d.appendChild(el('<div class="note">히키토 개체마다 이 스켈레톤 인스턴스가 제 위치(각 히키토 마커)에 선다 — 아래 게놈·클립·통통함은 전 인스턴스에 공통 적용된다.</div>'));
		}
		d.appendChild(el('<h2>살 문법</h2>'));
		d.appendChild(sliderRow('통통함', 0.5, 1.8, 0.05, skel.fat, (v) => { skel.fat = v; }));
		// 형태 게놈 ① — 부위별 반지름·길이 배율 (기본 문법 위에 곱). 항등(1)이면 기존 살.
		d.appendChild(el('<h2>형태 게놈 (반지름·길이 배율)</h2>'));
		// 체형 프리셋 — 수동 게놈(덩치/호리호리) 즉시 적용 (C2 비율 실증)
		const bodyBox = el('<div class="inline"><label>체형</label></div>');
		for (const [name, gen] of [['항등', null], ...Object.entries(HktGenesisGenome.GENOMES)]) {
			const b = el(`<button style="margin-right:4px">${name}</button>`);
			b.addEventListener('click', () => {
				skel.genome.morph = gen ? JSON.parse(JSON.stringify(gen.morph)) : {};
				refreshUI();
			});
			bodyBox.appendChild(b);
		}
		d.appendChild(bodyBox);
		const PR = HktGenesisGenome.PROFILE.radiusMul, PL = HktGenesisGenome.PROFILE.lengthMul;
		const morphLabels = { head: '머리', neck: '목', torso: '몸통', shoulder: '어깨', arm: '팔', hand: '손', leg: '다리', foot: '발' };
		// 엔트리는 {r, l} 객체 — 슬라이더가 r/l 을 각각 쓰고, 둘 다 항등이면 엔트리 제거
		const rd = (g, key) => { const e = skel.genome.morph[g]; if (e == null) return 1; return (typeof e === 'number') ? (key === 'r' ? e : 1) : (e[key] != null ? e[key] : 1); };
		const wr = (g, key, v) => {
			let e = skel.genome.morph[g];
			if (e == null || typeof e === 'number') e = { r: typeof e === 'number' ? e : 1 };
			e[key] = v;
			if (Math.abs((e.r != null ? e.r : 1) - 1) < 1e-6 && Math.abs((e.l != null ? e.l : 1) - 1) < 1e-6) delete skel.genome.morph[g];
			else skel.genome.morph[g] = e;
		};
		for (const [g, label] of Object.entries(morphLabels)) {
			d.appendChild(sliderRow(`${label} 굵기`, PR.min, PR.max, PR.step, rd(g, 'r'), (v) => wr(g, 'r', v)));
			d.appendChild(sliderRow(`${label} 길이`, PL.min, PL.max, PL.step, rd(g, 'l'), (v) => wr(g, 'l', v)));
		}
		d.appendChild(el('<div class="note">부위 굵기(반지름)·길이 배율 — 같은 클립을 무수정 재생하며 실루엣·비율만 바뀐다(형태 = 게놈 데이터). 다리 길이는 힙 보정이 발을 지면에 붙인다. 미지정(1) 부위는 기본 문법 그대로.</div>'));
		// 채색 게놈 ② — 부위 그룹 램프 양 끝(저속·고속). 보간은 속도·변형률 유도(절대 원칙 1).
		d.appendChild(el('<h2>부위 채색 (그룹 램프)</h2>'));
		if (!skel.genome.palette) skel.genome.palette = {};
		const palLabels = { head: '머리', torso: '몸통', arm: '팔', leg: '다리', appendix: '부속' };
		const palDef = { a: '#7a3b2a', b: '#ffd9a8' }; // 히키토 기본색
		for (const [g, label] of Object.entries(palLabels)) {
			const cur = skel.genome.palette[g] || {};
			const row = el(`<div class="inline"><label>${label}</label><input type="color" data-k="a" title="저속"><input type="color" data-k="b" title="고속"></div>`);
			for (const inp of row.querySelectorAll('input')) {
				const key = inp.dataset.k;
				inp.value = cur[key] || palDef[key];
				inp.addEventListener('input', () => {
					if (!skel.genome.palette[g]) skel.genome.palette[g] = {};
					skel.genome.palette[g][key] = inp.value;
				});
			}
			d.appendChild(row);
		}
		d.appendChild(el('<div class="note">부위별 색 램프의 양 끝(저속·고속) — 채색은 이 양 끝만 게놈이 정하고, 보간(heat=속도·변형률)은 렌더가 유도한다. 미지정 부위는 개체 팔레트 그대로.</div>'));
		// 부속 게놈 ④ — 가상 뼈 스프링 체인 (C4). 세그먼트 수가 변하므로 선택 시 재시드.
		d.appendChild(el('<h2>부속 (가상 뼈 체인)</h2>'));
		const apBox = el('<div class="inline"><label>부속</label></div>');
		for (const [name, chains] of [['없음', null], ...Object.entries(HktGenesisGenome.APPENDIX_PRESETS)]) {
			const b = el(`<button style="margin-right:4px">${name}</button>`);
			b.addEventListener('click', () => {
				if (chains) skel.genome.appendix = JSON.parse(JSON.stringify(chains));
				else delete skel.genome.appendix;
				syncScene(); // 가상 뼈 세그먼트 수 변화 → 뼈 친화 재시드
				refreshUI();
			});
			apBox.appendChild(b);
		}
		d.appendChild(apBox);
		d.appendChild(el('<div class="note">꼬리·뿔 같은 부속은 리그 밖 가상 뼈 — 클립은 이 뼈들을 모르고(클립 무수정), 움직임은 스프링 지연 추종이 만든다. 실뼈 뒤 고정 순서 append 라 뼈 친화 규약 유지.</div>'));
		// 게놈 입출력 (C5) — 추출기(tools/genome-extract) 게놈을 불러와 이 패널로 후보정한다
		d.appendChild(el('<h2>게놈 파일</h2>'));
		const ioBox = el('<div class="inline"><label>게놈 JSON</label><button>내보내기</button><button>불러오기</button></div>');
		const [expBtn, impBtn] = ioBox.querySelectorAll('button');
		expBtn.addEventListener('click', () => {
			const a = document.createElement('a');
			a.href = URL.createObjectURL(new Blob([JSON.stringify(skel.genome, null, '\t')], { type: 'application/json' }));
			a.download = (skel.genome.name || 'genome') + '.json';
			a.click();
			URL.revokeObjectURL(a.href);
		});
		const impFile = el('<input type="file" accept=".json" style="display:none">');
		impBtn.addEventListener('click', () => impFile.click());
		impFile.addEventListener('change', () => {
			const f = impFile.files[0];
			if (!f) return;
			f.text().then((t) => {
				skel.genome = JSON.parse(t);
				syncScene(); // 부속 세그 수가 바뀔 수 있으므로 재시드
				refreshUI();
				setStatus(`게놈 불러옴: ${skel.genome.name || f.name}`);
			}).catch((e) => setStatus('게놈 파싱 실패: ' + e.message));
		});
		ioBox.appendChild(impFile);
		d.appendChild(ioBox);
		d.appendChild(el('<div class="note">tools/genome-extract 가 이미지에서 추출한 게놈을 불러와 위 슬라이더로 후보정하고 다시 내보낸다 — 확정된 JSON 이 캐릭터의 원본.</div>'));
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

		// ── A 트랙: 개체별 애니메이션 사용 여부 ──────────────────────────────
		if (o.genes.form === 3) {
			d.appendChild(el('<h2>애니메이션 (A 트랙)</h2>'));
			const useRow = el('<div class="inline"><label><input type="checkbox"> 입력 상태 머신 사용</label></div>');
			const chk = useRow.querySelector('input');
			chk.checked = !!o.anim;
			chk.addEventListener('change', () => {
				if (chk.checked) enableAnim(o); else disableAnim(o);
				syncScene(true); // 친화 재시드 (bind 소스 정합)
				buildDetail();
				buildTree();
			});
			d.appendChild(useRow);
			if (o.anim) {
				// 이동 강도 → moveMag 주입: 상태 머신이 idle→walk→run 으로 전이 (입력→상태→클립 실증)
				d.appendChild(sliderRow('이동 강도', 0, 1, 0.05, o.anim.moveMag, (v) => { o.anim.moveMag = v; }));
				const btns = el('<div class="inline"><button data-a="jump">점프</button><button data-a="wave">인사</button></div>');
				for (const b of btns.querySelectorAll('button'))
					b.addEventListener('click', () => o.anim.input.trigger(b.dataset.a === 'jump' ? 'jump' : 'action', b.dataset.a === 'jump' ? undefined : 'wave'));
				d.appendChild(btns);
				d.appendChild(el(`<div class="note" id="animState-${o.id}">상태: ${o.anim.stateName}</div>`));
			} else {
				d.appendChild(el('<div class="note">끄면 장면 공용 클립(하단 타임라인)을 따른다. 켜면 이 개체만 입력→상태→클립으로 독립 구동.</div>'));
			}
		}

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
	let worldGenomeStatus = null; // { label, ok, text } — 마지막 적용 게놈의 W2 프로파일 판정

	// W1·W2·W4: 월드 게놈(프리셋 또는 추출 JSON)을 지형 파라미터로 적용한다. biomeSet/water/relief/
	// mood 가 terrParams 에 실려 create(terrParams) → world(genome) 이 그대로 소비한다(창 파라미터
	// seed/extent 는 유지). 적용 전 W2 스타일 프로파일로 검증해 판정을 패널에 남긴다(클램프 아님 — 표시).
	function applyWorldGenome(src, label) {
		const g = {}; for (const k in src) if (k[0] !== '_') g[k] = src[k]; // _meta 등 렌더 무관 키 제거
		if (window.HktGenesisWorldProfile) {
			const val = window.HktGenesisWorldProfile.validate(g);
			worldGenomeStatus = { label, ok: val.ok, text: val.ok ? '프로파일 OK' : '반려: ' + val.violations.map((v) => v.field).join(', ') };
		} else worldGenomeStatus = { label, ok: true, text: '(프로파일 검증기 미로드)' };
		const keep = { seed: terrParams.seed, extent: terrParams.extent }; // 창 파라미터 유지
		Object.assign(terrParams, g, keep);
		if (!terrParams.mood) terrParams.mood = { skyTop: [0.28, 0.45, 0.72], skyHorizon: [0.68, 0.78, 0.86] };
		terrParams.skyOn = true;
		generateTerrain(); // create(terrParams) 가 biomeSet/water/mood 소비 — 끝에서 buildDetail 재빌드
		setStatus(`월드 게놈 적용 — ${label} · ${worldGenomeStatus.text}`);
	}
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
			// W6: load() 는 하늘 돔을 숨기므로(단일 월드는 명시 적용) 여기서 mood 를 다시 켠다.
			if (terrParams.skyOn && terrParams.mood) stage().setMood(terrParams.mood);
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
		// 카메라 오른쪽 = cross(forward, up) = [-f.z, 0, f.x]. (이전 [f.z,0,-f.x] 은 부호 반대라
		// 픽킹이 커서의 좌우·상하 반대편을 집었다 — 배치/드래그가 커서와 어긋나던 원인)
		let r = [-f[2], 0, f[0]];
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
	// 드래그 이동은 window 리스너로 처리한다 — select() 가 마커 DOM 을 재생성해도(요소 교체)
	// 진행 중인 드래그가 끊기지 않는다. 좌클릭만 반응(우/중클릭은 카메라 회전·이동 몫).
	function startMarkerDrag(pointerId, onMove, onMoveEnd) {
		let moved = false;
		const onPm = (ev) => {
			if (ev.pointerId !== pointerId) return;
			const hit = groundHit(ev.clientX, ev.clientY);
			if (hit) { moved = true; onMove(hit); }
		};
		const onUp = (ev) => {
			if (ev.pointerId !== pointerId) return;
			window.removeEventListener('pointermove', onPm);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
			if (moved && onMoveEnd) onMoveEnd();
		};
		window.addEventListener('pointermove', onPm);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
	}
	function buildMarkers() {
		const box = $('markers');
		box.textContent = '';
		markerEls.clear();
		const mk = (key, label, sel, onMove, onMoveEnd) => {
			const m = el(`<div class="marker${isSelected(sel) ? ' on' : ''}"><span class="tag">${label}</span></div>`);
			m.addEventListener('pointerdown', (e) => {
				if (e.button !== 0 || e.altKey || e.shiftKey) return; // 좌클릭 순수만 = 기즈모 드래그
				e.preventDefault();
				e.stopPropagation(); // 배치 모드에서 마커 클릭이 지형 배치로 새지 않게
				select(sel);
				startMarkerDrag(e.pointerId, onMove, onMoveEnd);
			});
			box.appendChild(m);
			markerEls.set(key, m);
		};
		for (const o of objects)
			mk('obj:' + o.id, o.name, { kind: 'object', id: o.id },
				(hit) => {
					o.genes.emitter[0] = hit[0]; o.genes.emitter[2] = hit[2];
					buildTree();
					if (o.genes.form > 0) scheduleReseedKeepTime(); // 형태 개체는 재생성으로 따라오되 성장 유지
				},
				() => { buildDetail(); if (findObject(o.id).genes.form > 0) syncScene(true); });
		mk('skel', '스켈레톤', { kind: 'skeleton' },
			(hit) => { skel.origin = [hit[0], hit[2]]; },
			() => buildDetail());
	}
	function updateMarkers() {
		for (const [key, m] of markerEls) {
			let wp;
			if (key === 'skel') {
				const ox = skel.origin[0], oz = skel.origin[1];
				wp = [ox, groundAt(ox, oz) + 0.98, oz]; // Hips 높이 (미리보기 원점)
				// 살 개체가 있으면 각 히키토가 제 마커로 위치를 갖는다 — 공용 스켈레톤 마커는
				// 히키토가 없을 때만(선택 시) 미리보기 배치 핸들로 노출.
				m.style.display = (!sceneEntities.some((g) => g.fleshK > 0) && isSelected({ kind: 'skeleton' })) ? '' : 'none';
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

		// ── 배치: 좌클릭이 더는 회전을 안 하므로(우클릭=회전) 클릭 = 즉시 배치.
		// 유령(ghost) 프리뷰가 커서 아래 지형 착지점을 실시간으로 보여준다.
		const ghost = el('<div class="marker ghost"><span class="tag"></span></div>');
		ghost.style.display = 'none';
		// #markers 는 buildMarkers 가 매번 비운다 — 유령은 #viewport 에 붙여 유지 (좌표 원점 동일)
		$('viewport').appendChild(ghost);
		let placeHit = null; // 현재 프레임의 배치 착지점 (world)
		function updateGhost(cx, cy) {
			if (mode !== 'place' || cx == null) { ghost.style.display = 'none'; placeHit = null; return; }
			placeHit = groundHit(cx, cy);
			if (!placeHit) { ghost.style.display = 'none'; return; }
			const css = projectToCss([placeHit[0], placeHit[1], placeHit[2]]);
			if (!css) { ghost.style.display = 'none'; return; }
			ghost.style.display = '';
			ghost.style.left = css[0] + 'px';
			ghost.style.top = css[1] + 'px';
			ghost.querySelector('.tag').textContent = pal.value;
		}
		let downXY = null, downBtn = -1, lastCx = null, lastCy = null;
		canvas.addEventListener('pointerdown', (e) => { downXY = [e.clientX, e.clientY]; downBtn = e.button; });
		canvas.addEventListener('pointermove', (e) => { lastCx = e.clientX; lastCy = e.clientY; updateGhost(e.clientX, e.clientY); });
		canvas.addEventListener('pointerleave', () => { lastCx = null; updateGhost(null); });
		window.__updateGhost = () => updateGhost(lastCx, lastCy); // 카메라 회전/모드 전환 시 매 프레임 갱신
		canvas.addEventListener('click', (e) => {
			// 좌클릭(button 0) · 회전/이동 드래그(우/중클릭·shift)·인력(alt) 제외 · 실이동 작을 때만
			if (mode !== 'place' || e.button !== 0 || e.altKey || e.shiftKey || downBtn !== 0 || !downXY) return;
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

			// L6: 살(fleshK) 개체가 있을 때만 뼈대 FK. raw 포즈를 한 번만 계산(mixer/스프링 1회
			// 스텝)하고, 전 살 인스턴스 위치로 이어붙여 전역 뼈 테이블을 만든다 — 각 히키토가 제
			// 위치에 제 스켈레톤을 참조한다. 순서·boneBase 는 syncScene 과 동일(fleshObjects).
			let bones = null;
			if (sceneEntities.some((g) => g.fleshK > 0)) {
				// 공용 클립 포즈는 애니 미사용 개체가 하나라도 있을 때만 계산(외부 클립 mixer 중복 진행 방지)
				const needShared = fleshObjects().some((o) => !o.anim);
				const raw = !needShared ? null
					: (skel.clip === 'external' && extSkel)
						? extSkel.pose(playing ? dt : 0, skel.speed, skel.fat, skel.genome) // 외부 클립은 증분 시간
						: skeleton.pose(skel.clip, simTime, skel.speed, skel.fat, skel.genome);
				bones = concatInstances(raw, dt);
				// A 트랙: 선택된 애니 개체의 상태 HUD 갱신 (디테일 패널 노트)
				for (const o of fleshObjects()) if (o.anim) { const se = $('animState-' + o.id); if (se) se.textContent = '상태: ' + o.anim.stateName; }
			}
			const stageOn = stage() && stage().enabled;
			if (stageOn) stage().frame(camera, canvas.clientWidth, canvas.clientHeight);
			engine.frame({
				dt, time: simTime, genes: sceneEntities[0], entities: sceneEntities, paused: !playing, pull,
				bones, showBones: skel.bones,
				background: stageOn ? { r: 0, g: 0, b: 0, a: 0 } : undefined,
				gridCenter: engine.bubbleCenter(camera.target), // S5 버블 + T3 y 지형 추종
				view: lastView, proj: lastProj,
				viewport: [canvas.width, canvas.height], focal: [focalY, focalY],
			});
			followCollider();
			// 하니스 훅: 스왑체인 readback 은 present 전(같은 태스크)이어야 한다 — test/README 함정
			if (window.__hktAfterFrame) window.__hktAfterFrame({ device, context, canvas, camera, engine });

			updateMarkers();
			if (window.__updateGhost) window.__updateGhost();
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
		applyWorldGenome, // W1·W2·W4: 프리셋/추출 게놈 적용 (하니스/자동화)
		get worldGenomeStatus() { return worldGenomeStatus; },
		addObject, removeObject,
		selectObject: (id) => select(id == null ? null : { kind: 'object', id }),
		// A 트랙 개체별 애니메이션 제어 (하니스/자동화)
		setObjectAnim: (id, on) => { const o = findObject(id); if (o && o.genes.form === 3) { on ? enableAnim(o) : disableAnim(o); syncScene(true); } },
		setObjectMove: (id, mag) => { const o = findObject(id); if (o && o.anim) o.anim.moveMag = mag; },
		triggerObject: (id, name, val) => { const o = findObject(id); if (o && o.anim) o.anim.input.trigger(name, val); },
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
				// 살 인스턴스: 개체마다 제 스켈레톤이 전역 뼈 테이블의 [boneBase, boneBase+boneCount)
				// 구간을 차지한다 — 서로 다른 boneBase = 서로 다른 스켈레톤 참조 (다중 히키토 검증 지표).
				flesh: objects.filter((o) => o.genes.form === 3).map((o) => ({
					id: o.id, emitter: o.genes.emitter.slice(),
					boneBase: o.genes.boneBase || 0, boneCount: (o.genes.bindBones || []).length,
					anim: o.anim ? o.anim.stateName : null, // A 트랙: 애니 사용 여부·현재 상태
				})),
				objects: objects.map((o) => ({ id: o.id, name: o.name, preset: o.presetName, emitter: o.genes.emitter.slice() })),
			};
		},
	};

	boot().catch((e) => { console.error(e); fail('초기화 실패: ' + e.message); });
})();
