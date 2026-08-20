// HktSplatLife — 캐릭터(동적) 단독 데모 드라이버 (WebGPU only, 무대 없음)
//
// HktSplatGenesis 에서 갈라져 나온 "생명(캐릭터=동적)" 프로젝트의 부트/루프.
// 무대(Spark 환경) 레이어가 없으므로 alphaMode 'opaque' 로 배경까지 스스로 그린다 —
// 원본 app.js 의 렌더 조정층(director)·오픈월드·collider 배관이 전부 빠진 순수 생명 경로.
// "스플랫 = 세포": 색·모양은 시뮬 상태(pos/vel/energy)에서 셰이더가 유도한다(직접 그리지 않음).

(function () {
	'use strict';
	const { PRESETS, materialize } = HktGenesisGenes;

	// L6 뼈대: built-in FK(관절 53개) — 히키토 살(fleshK)의 형태 입력. 외부 FBX 로드 시엔
	// 그 리그가 뼈대를 대신 구동한다(아래 extSkel) — three 는 FBX 파싱/FK 입력 전용.
	const skeleton = new HktGenesisSkeleton.Skeleton();
	const skel = { clip: 'walk', speed: 1.0, fat: 1.0, bones: true, genome: HktGenesisGenome.IDENTITY };

	let genes = null, sceneEntities = null, reseed = null, simTime = 0;
	let lastPreset = '히키토';
	// F1 이펙트: 이벤트 구동 이펙트 개체들이 스플랫 풀의 슬라이스를 나눠 갖는다.
	// 새 이펙트를 만들고 싶으면 fx.js FX_PRESETS 에 게놈 한 줄 — 여기 코드는 손대지 않는다.
	// 세트(FX_SETS)는 슬라이스 예산의 데이터 — 바꾸면 이펙트 개체 구성이 통째로 갈린다.
	let fxSet = Object.keys(HktGenesisFx.FX_SETS)[0];
	let fx = new HktGenesisFx.FxSystem();
	// F6 표현 강도: 사건이 주는 세기(게놈 아님). 슬라이더가 이 값을 정하고 발생 때 곱한다 —
	// 같은 이펙트가 스침(0.4) ↔ 정통(2.5) 으로 갈린다.
	let fxPower = 1.0;
	let lastBones = null; // 이펙트 발생점(타격 부위)을 뼈에서 잡기 위한 마지막 포즈
	// 외부 FBX 리그(Mixamo 등) — 있으면 살(히키토)의 뼈대를 이 클립이 구동한다(없으면 built-in FK).
	// three(r147) 는 FBX 파싱/FK 입력만 — 렌더·시뮬은 여전히 자체 WebGPU (절대 원칙 유지).
	let extSkel = null, useExternal = false;
	const N = 131072; // 2^17 — 정렬(2의 거듭제곱)·슬라이스(256 배수) 충족. Genesis 기본 밀도(128k)와 일치 —
	                  // 불·물 등 발광 개체는 premultiplied-over 누적 밀도가 곧 볼륨감이라 64k 는 성기게 보인다.

	// 살 시드용 바인드 포즈 — 외부 FBX 활성 시 그 리그의 현재 포즈(dt=0, 믹서 미진행)로 시드한다.
	function bindBones() {
		return (useExternal && extSkel)
			? extSkel.pose(0, 1, 1, skel.genome)
			: skeleton.pose('idle', 0, 1, 1, skel.genome);
	}
	function applyPreset(name) {
		lastPreset = name;
		const p = PRESETS[name];
		genes = materialize(p); // emitter 는 프리셋 기본
		genes.genome = skel.genome;
		HktGenesisGenome.applyMatter(genes, skel.genome); // 게놈 ③ 재질 차분 (미지정 = 무변경)
		if (genes.form === 3) genes.bindBones = bindBones(); // 살: 뼈 친화 시드 기준 세그먼트
		// 장면 = 기반 개체 슬라이스 + 이펙트 개체 슬라이스 (총 8, 각 16384 스플랫)
		sceneEntities = fx.compose(genes);
		if (reseed) reseed();
	}
	// 게놈(체형·채색·부속) 전환 — 부속은 세그먼트 수를 바꾸므로 항상 재시드(applyPreset 경유)
	function applyGenome(genome) {
		skel.genome = genome;
		applyPreset(lastPreset);
	}

	function fail(msg) { const m = document.getElementById('msg'); m.textContent = msg; m.style.display = 'flex'; }

	async function boot() {
		if (!navigator.gpu) return fail('이 브라우저는 WebGPU 를 지원하지 않습니다 (Chrome/Edge 113+).');
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) return fail('WebGPU 어댑터를 얻지 못했습니다.');
		const device = await adapter.requestDevice();
		device.addEventListener('uncapturederror', (e) => console.error('[HktSplatLife] GPU 오류:', e.error.message));

		const canvas = document.getElementById('gpu');
		const context = canvas.getContext('webgpu');
		const format = navigator.gpu.getPreferredCanvasFormat();
		context.configure({ device, format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });

		const engine = new HktGenesisEngine(device, context, format);
		const camera = new HktOrbitCamera(canvas); camera.radius = 4.5;
		reseed = () => { engine.setScene(N, sceneEntities); simTime = 0; fx.clear(); };
		engine.setScene(N, fx.compose(materialize(PRESETS['히키토']))); // 초기 장면 (기반 + 이펙트 슬라이스)
		applyPreset('히키토');

		// 프리셋 버튼
		const box = document.getElementById('presets');
		for (const name of Object.keys(PRESETS)) {
			const b = document.createElement('button'); b.textContent = name;
			b.addEventListener('click', () => applyPreset(name));
			box.appendChild(b);
		}
		// 게놈(체형) 버튼 — 정체성 = 데이터: 같은 프리셋·같은 클립에 게놈만 갈아끼운다
		const gbox = document.getElementById('genomes');
		const genomeList = Object.assign({ '기본': HktGenesisGenome.IDENTITY }, HktGenesisGenome.GENOMES);
		for (const name of Object.keys(genomeList)) {
			const b = document.createElement('button'); b.textContent = name;
			b.addEventListener('click', () => applyGenome(genomeList[name]));
			gbox.appendChild(b);
		}
		document.getElementById('bones').addEventListener('change', (e) => { skel.bones = e.target.checked; });

		// ── F1 이펙트 발생 UI ────────────────────────────────────────────────
		// 발생점(anchor)은 "어디서 터지는가" 라는 *게임 쪽* 관심사라 앱이 정한다 —
		// 이펙트의 정체성(게놈)과 발생 사건(이벤트)의 분리를 지키기 위함.
		const TORSO = HktGenesisGenome.GROUP_IDS.indexOf('torso');
		const HAND = HktGenesisGenome.GROUP_IDS.indexOf('hand');
		function bonePoint(groupId, fallback) {
			if (lastBones) for (const sg of lastBones) if (sg.g === groupId) return sg.b.slice();
			return fallback.slice();
		}
		function towardCamera(org) {
			const e = camera._eye();
			return [e[0] - org[0], e[1] - org[1], e[2] - org[2]];
		}
		// 이펙트 이름 → 발생 사건. 미등록 이펙트는 캐릭터 앞 기본 지점에서 위로 터진다.
		const FX_AIM = {
			// 타격: 몸통을 맞고 파편이 *때린 쪽*(카메라)으로 튄다
			'타격': () => { const o = bonePoint(TORSO, [0, 1.15, 0]); return { origin: o, dir: towardCamera(o), strength: 1 }; },
			// 파이어볼: 손 근처에서 터진다 (없으면 캐릭터 옆)
			'파이어볼 폭발': () => ({ origin: bonePoint(HAND, [0.75, 1.0, 0]), dir: [0, 1, 0], strength: 1 }),
			// 회복 오라: 발밑에서 솟는다
			'회복 오라': () => ({ origin: [0, 0.05, 0], dir: [0, 1, 0], strength: 1, radius: 0.35 }),
			// 물결파: 몸 한가운데서 사방으로 번진다 (온 고리 — 방향이 없다)
			'물결파': () => { const o = bonePoint(TORSO, [0, 1.15, 0]); return { origin: o, dir: towardCamera(o), strength: 1, radius: 0.12 }; },
			// 검격: 같은 지점, 칼자국 면이 카메라를 향한다. roll 이 칼날 각도 — 매번 조금씩
			// 달라져야 같은 자리를 두 번 베어도 같은 그림이 되지 않는다.
			'검격': () => {
				const o = bonePoint(TORSO, [0, 1.15, 0]);
				return { origin: o, dir: towardCamera(o), strength: 1, radius: 0.03, roll: -0.6 + Math.random() * 1.2 };
			},
			// 굴절 파면: 빛살·칼자국과 같은 자리·같은 축 (보통 타격이 동반으로 켠다)
			'굴절 파면': () => { const o = bonePoint(TORSO, [0, 1.15, 0]); return { origin: o, dir: towardCamera(o), strength: 1, radius: 0.1 }; },
			// 전격: 몸통을 타고 사방으로 튀는 방전
			'전격': () => { const o = bonePoint(TORSO, [0, 1.15, 0]); return { origin: o, dir: towardCamera(o), strength: 1, radius: 0.05 }; },
			// 기 모으기: 손 앞 허공으로 기운이 빨려든다 (수축 이펙트 — 원점이 곧 도착점)
			'기 모으기': () => ({ origin: bonePoint(HAND, [0.75, 1.0, 0]), dir: [0, 1, 0], strength: 1, radius: 0.04 }),
			// 삼중 파문: 발밑에서 지면을 따라 번지는 겹 고리 (축 = 위 → 원판이 바닥에 눕는다)
			'삼중 파문': () => ({ origin: [0, 0.06, 0], dir: [0, 1, 0], strength: 1, radius: 0.1 }),
			// 나선 폭풍: 발밑에서 감겨 오르는 소용돌이
			'나선 폭풍': () => ({ origin: [0, 0.1, 0], dir: [0, 1, 0], strength: 1, radius: 0.12 }),
		};
		function fire(name, power) {
			const aim = (FX_AIM[name] || (() => ({ origin: [0, 1.0, 0], dir: [0, 1, 0] })))();
			aim.time = simTime;
			// F6: 사건의 세기 = 기본 세기 × 표현 강도 슬라이더. 게놈의 감도(pow*)가 이 값을
			// 채널마다 다르게 받는다 — 강도는 이벤트의 몫이고 감도는 게놈의 몫이다.
			aim.strength = (aim.strength != null ? aim.strength : 1) * (power != null ? power : fxPower);
			fx.trigger(name, aim);
		}
		// 이펙트 버튼은 *현재 세트*에서 자동 생성 — 세트를 바꾸면 버튼·단축키가 함께 갈린다.
		const fbox = document.getElementById('fxButtons');
		function refreshFxButtons() {
			fbox.innerHTML = '';
			fx.names.forEach((name, i) => {
				const b = document.createElement('button');
				b.textContent = `${name} (${i + 1})`;
				b.addEventListener('click', () => fire(name));
				fbox.appendChild(b);
			});
		}
		// 이펙트 세트 = 슬라이스 예산(개체 슬롯 8개)의 데이터. 세트를 갈면 이펙트 개체 구성이
		// 통째로 바뀌므로 장면을 다시 조립한다(applyPreset 경유 = 재시드).
		const setBox = document.getElementById('fxSets');
		function applyFxSet(name) {
			fxSet = name;
			fx = new HktGenesisFx.FxSystem({ names: HktGenesisFx.FX_SETS[name] });
			applyPreset(lastPreset);
			for (const b of setBox.children) b.classList.toggle('on', b.dataset.set === name);
			refreshFxButtons();
			refreshGeneTargets();
		}
		for (const name of Object.keys(HktGenesisFx.FX_SETS)) {
			const b = document.createElement('button');
			b.textContent = name; b.dataset.set = name;
			b.classList.toggle('on', name === fxSet);
			b.addEventListener('click', () => applyFxSet(name));
			setBox.appendChild(b);
		}
		refreshFxButtons();
		// 표현 강도 슬라이더 (F6) — 발생 사건의 세기. 게놈은 그대로다.
		const powEl = document.getElementById('fxPower');
		const powVal = document.getElementById('fxPowerVal');
		powEl.addEventListener('input', () => {
			fxPower = parseFloat(powEl.value);
			powVal.textContent = `×${fxPower.toFixed(2)}`;
		});
		// ── 이펙트 게놈 슬라이더 ────────────────────────────────────────────
		// 항목은 GENE_DEFS(유전자 스키마)에서 자동 생성한다 — 유전자를 추가해도 UI 코드는 그대로.
		// 값은 살아 있는 유전자에 바로 쓴다(엔진이 매 프레임 개체 테이블을 다시 패킹 = 재시드 없음).
		const GENE_GROUPS = [
			['F1 이펙트', ['fxK', 'burst', 'cone', 'swirl', 'shell', 'grow', 'curve', 'ember']],
			['기본 재료', ['lifeBase', 'damping', 'gravity', 'updraft', 'volatility', 'size', 'stretch', 'opacity', 'luminosity']],
			['F2 굴절', ['refract', 'chroma', 'caustic', 'rarefy']],
			['F3 파열', ['shred', 'shredFreq', 'tear', 'shredPow']],
			['F4 광선', ['disc', 'discThick', 'rayLen', 'rayThin', 'rayAlign']],
			['F5 방위', ['arc', 'arcSharp']],
			['F6 표현 강도(감도)', ['powVel', 'powSize', 'powLum', 'powLife']],
			['F7 시간 결', ['flicker', 'flickerHz', 'flash', 'coreGlow']],
			['F8 방사 구조', ['implode', 'ripple', 'twist']],
		];
		const geneSel = document.getElementById('fxGeneTarget');
		const geneList = document.getElementById('fxGeneList');
		function buildGeneSliders() {
			const name = geneSel.value;
			geneList.innerHTML = '';
			if (!name) return;
			for (const [label, keys] of GENE_GROUPS) {
				const h = document.createElement('div'); h.className = 'grp'; h.textContent = label;
				geneList.appendChild(h);
				for (const k of keys) {
					const def = HktGenesisGenes.GENE_DEFS[k];
					if (!def) continue;
					const [ko, min, max, step] = def;
					const v = fx.geneValue(name, k);
					const nameEl = document.createElement('span'); nameEl.textContent = ko; nameEl.title = k;
					const sl = document.createElement('input');
					sl.type = 'range'; sl.min = min; sl.max = max; sl.step = step;
					sl.value = Math.min(Math.max(v, min), max);
					const val = document.createElement('span'); val.className = 'v'; val.textContent = (+sl.value).toFixed(2);
					sl.addEventListener('input', () => {
						const nv = parseFloat(sl.value);
						val.textContent = nv.toFixed(2);
						fx.setGene(name, k, nv);
					});
					geneList.appendChild(nameEl); geneList.appendChild(sl); geneList.appendChild(val);
				}
			}
		}
		function refreshGeneTargets() {
			geneSel.innerHTML = '';
			for (const n of fx.names) {
				const o = document.createElement('option'); o.value = n; o.textContent = n;
				geneSel.appendChild(o);
			}
			buildGeneSliders();
		}
		geneSel.addEventListener('change', buildGeneSliders);
		refreshGeneTargets();
		// 자동 반복 — 게놈 차이(짧은 타격 / 긴 폭발)가 시간축에서 드러나게
		let autoFx = null;
		document.getElementById('fxAuto').addEventListener('change', (e) => {
			if (autoFx) { clearInterval(autoFx); autoFx = null; }
			if (!e.target.checked) return;
			let k = 0;
			autoFx = setInterval(() => fire(fx.names[k++ % fx.names.length]), 700);
		});
		window.addEventListener('keydown', (e) => {
			const i = '123456789'.indexOf(e.key);
			if (i >= 0 && i < fx.names.length) fire(fx.names[i]);
		});
		window.__hktFire = fire; // 하니스/콘솔 훅

		// ── 외부 FBX 리그: 드롭/샘플/복귀 + 클립 선택 ──────────────────────────
		const setStatus = (html) => { document.getElementById('skelStatus').innerHTML = html; };
		function refreshClips() {
			const box = document.getElementById('clips'); box.innerHTML = '';
			if (!useExternal || !extSkel) return;
			for (const name of extSkel.clipNames()) {
				const b = document.createElement('button'); b.textContent = name || '(무명 클립)';
				b.addEventListener('click', () => { extSkel.play(name, 0.25); setStatus(`클립 재생: <b>${name}</b>`); });
				box.appendChild(b);
			}
		}
		function loadFBXBuffer(buf, name) {
			try {
				extSkel = HktGenesisSkeleton.parseFBX(buf);
				useExternal = true;
				applyPreset(lastPreset); // 소스 전환 → 세그먼트 순서 변경 → 뼈 친화(rest.w) 재시드 필수
				refreshClips();
				setStatus(`FBX 로드: <b>${name}</b> · 뼈 ${extSkel.bones.length}개` +
					(extSkel.clipName ? ` · 클립 “${extSkel.clipName}”` : ' · 클립 없음(바인드 포즈)') +
					(lastPreset !== '히키토' ? ' — <b>히키토</b> 프리셋을 골라야 살이 뼈를 따라간다.' : ''));
			} catch (e) { setStatus('FBX 파싱 실패: ' + e.message); }
		}
		function readFBXFile(f) {
			if (!f) return;
			const r = new FileReader();
			r.onload = () => loadFBXBuffer(r.result, f.name);
			r.readAsArrayBuffer(f);
		}
		const drop = document.getElementById('drop');
		const fbxFile = document.getElementById('fbxFile');
		if (typeof THREE === 'undefined' || !THREE.FBXLoader) setStatus('vendor/three.min.js 미로드 — FBX 비활성.');
		else setStatus('FBX 로더 준비됨 — 샘플 또는 Mixamo FBX 를 드롭하세요.');
		['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('hot'); }));
		['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('hot'); }));
		drop.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) readFBXFile(e.dataTransfer.files[0]); });
		drop.addEventListener('click', () => fbxFile.click());
		fbxFile.addEventListener('change', (e) => readFBXFile(e.target.files[0]));
		document.getElementById('fbxBuiltin').addEventListener('click', () => {
			useExternal = false; extSkel = null;
			applyPreset(lastPreset); refreshClips();
			setStatus('내장 스켈레톤 (built-in FK).');
		});
		// 동봉 로코모션 샘플 (Mixamo, assets/anim/). 라벨=한글, 파일=영문.
		const FBX_SAMPLES = [
			['걷기', 'walk'], ['뛰기', 'run'], ['대기', 'idle'],
			['점프', 'jump'], ['공격', 'attack'], ['삼바', 'samba'],
		];
		async function loadSample(file, label) {
			setStatus(`샘플 로드 중… (${label})`);
			try {
				const buf = await (await fetch(`assets/anim/${file}.fbx`)).arrayBuffer();
				loadFBXBuffer(buf, `${file}.fbx`);
			} catch (e) { setStatus(`샘플 로드 실패(${label}): ` + e.message); }
		}
		const sbox = document.getElementById('fbxSamples');
		for (const [label, file] of FBX_SAMPLES) {
			const b = document.createElement('button'); b.textContent = label;
			b.addEventListener('click', () => loadSample(file, label));
			sbox.appendChild(b);
		}

		const fpsEl = document.getElementById('fps');
		let last = performance.now(), fpsAvg = 0;
		function tick(now) {
			const dpr = Math.min(devicePixelRatio || 1, 2);
			const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
			if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
			const dt = Math.min((now - last) / 1000, 0.05); last = now; simTime += dt;
			const aspect = canvas.width / canvas.height;
			const focalY = 0.5 * canvas.height / Math.tan(camera.fov / 2);
			// 살(fleshK) 개체가 있을 때만 뼈대 FK — 세그먼트가 살 규칙의 유일한 형태 입력
			let bones = null;
			if (sceneEntities.some((g) => g.fleshK > 0)) {
				bones = (useExternal && extSkel)
					? extSkel.pose(dt, skel.speed, skel.fat, skel.genome)         // 외부 FBX: 증분 시간(dt)으로 믹서 진행
					: skeleton.pose(skel.clip, simTime, skel.speed, skel.fat, skel.genome); // 내장: 절대 시간
				lastBones = bones; // 이펙트 발생점(타격 부위)의 근거
			}
			engine.frame({
				dt, time: simTime, genes, entities: sceneEntities, paused: false, pull: [0, 0, 0, 0],
				bones, showBones: skel.bones, fxEvents: fx.buffer(),
				view: camera.view(), proj: camera.proj(aspect),
				viewport: [canvas.width, canvas.height], focal: [focalY, focalY],
			});
			// 하니스 훅 (present 전 같은 태스크에서 readback)
			if (window.__hktAfterFrame) window.__hktAfterFrame({ device, context, canvas, camera, engine });
			fpsAvg = fpsAvg * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
			fpsEl.textContent = `${fpsAvg.toFixed(0)} fps · ${(engine.count / 1024).toFixed(0)}k splats · fx ${fx.activeCount(simTime)}`;
			requestAnimationFrame(tick);
		}
		requestAnimationFrame(tick);
		window.__lifeReady = true;
	}

	boot().catch((e) => { console.error(e); fail('초기화 실패: ' + e.message); });
})();
