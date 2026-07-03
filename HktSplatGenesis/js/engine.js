// HktSplatGenesis — WebGPU 엔진: 스플랫 풀 + 시뮬/키/정렬/렌더 파이프라인
//
// 프레임 흐름 (전부 GPU 상주, CPU 왕복 없음):
//   sim(자율 규칙) → key(뷰 깊이) → bitonic sort(back-to-front) → 인스턴스드 쿼드 래스터

(function (global) {
	'use strict';

	const WG = 256;            // compute workgroup 크기 (셰이더와 일치)
	const SPLAT_STRIDE = 12;   // float 12개 = 48B (wgsl.js Splat 과 일치)
	const GRID_CELLS = 262144; // 64³ (wgsl.js GRID_CONST 와 일치)
	const GRID_SLOTS = 16;
	const GRID_DIM = 64;
	const CLUSTER_K = 256;       // 클러스터 크기 (wgsl.js K 와 일치)
	const CLUSTER_STRIDE = 24;   // u32/f32 24개 = 96B (wgsl.js Cluster 와 일치)
	const ENTITY_STRIDE = 36;    // f32 36개 = 144B (wgsl.js Entity 와 일치)
	const MAX_ENTITIES = 8;
	const MAX_BONES = 128;       // L6 뼈 세그먼트 상한 (Mixamo FBX 풀 리그 ~65개 + 여유)
	const GRID_CELL = 0.15;      // 전역 격자 셀 크기 (개체 reach 는 이하로 클램프)
	const GRID_ORIGIN = [-4.8, -0.8, -4.8];

	function HktGenesisEngine(device, context, format) {
		this.device = device;
		this.context = context;
		this.format = format;
		this.count = 0;
		this._passes = [];       // 바이토닉 (k, j) 단계 목록
		this._buildPipelines();
	}

	HktGenesisEngine.prototype._buildPipelines = function () {
		const d = this.device;
		const W = global.HktGenesisWGSL;

		this.simPipe = d.createComputePipeline({
			layout: 'auto',
			compute: { module: d.createShaderModule({ code: W.SIM }), entryPoint: 'main' },
		});
		this.gridClearPipe = d.createComputePipeline({
			layout: 'auto',
			compute: { module: d.createShaderModule({ code: W.GRID_CLEAR }), entryPoint: 'main' },
		});
		this.gridBuildPipe = d.createComputePipeline({
			layout: 'auto',
			compute: { module: d.createShaderModule({ code: W.GRID_BUILD }), entryPoint: 'main' },
		});
		this.clusterPipe = d.createComputePipeline({
			layout: 'auto',
			compute: { module: d.createShaderModule({ code: W.CLUSTER }), entryPoint: 'main' },
		});
		this.keyPipe = d.createComputePipeline({
			layout: 'auto',
			compute: { module: d.createShaderModule({ code: W.KEY }), entryPoint: 'main' },
		});

		// 정렬은 동적 오프셋 유니폼이 필요해 명시 레이아웃 사용
		this.sortBGL = d.createBindGroupLayout({
			entries: [
				{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
				{ binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
			],
		});
		this.sortPipe = d.createComputePipeline({
			layout: d.createPipelineLayout({ bindGroupLayouts: [this.sortBGL] }),
			compute: { module: d.createShaderModule({ code: W.SORT }), entryPoint: 'main' },
		});

		this.renderPipe = d.createRenderPipeline({
			layout: 'auto',
			vertex: { module: d.createShaderModule({ code: W.RENDER }), entryPoint: 'vs' },
			fragment: {
				module: d.createShaderModule({ code: W.RENDER }),
				entryPoint: 'fs',
				targets: [{
					format: this.format,
					// back-to-front premultiplied over
					blend: {
						color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
						alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
					},
				}],
			},
			primitive: { topology: 'triangle-strip' },
		});

		// 유니폼 버퍼 (크기는 wgsl.js 구조체와 일치)
		this.simUB = d.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
		this.keyUB = d.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
		this.camUB = d.createBuffer({ size: 160, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
		this.entityBuf = d.createBuffer({ size: MAX_ENTITIES * ENTITY_STRIDE * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
		// L6 뼈대 세그먼트 테이블 — 세그먼트당 vec4 2개 (a.xyz+r1, b.xyz+r2)
		this.boneBuf = d.createBuffer({ size: MAX_BONES * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
		this._boneCount = 0;

		// L6 뼈대 오버레이 (라인 + 관절 점) — 살 위에 겹쳐 그리는 디버그 시각화
		const overlayModule = d.createShaderModule({ code: W.OVERLAY });
		const overlayBlend = {
			color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
			alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
		};
		this.overlayLinePipe = d.createRenderPipeline({
			layout: 'auto',
			vertex: { module: overlayModule, entryPoint: 'vsLine' },
			fragment: { module: overlayModule, entryPoint: 'fsLine', targets: [{ format: this.format, blend: overlayBlend }] },
			primitive: { topology: 'line-list' },
		});
		this.overlayJointPipe = d.createRenderPipeline({
			layout: 'auto',
			vertex: { module: overlayModule, entryPoint: 'vsJoint' },
			fragment: { module: overlayModule, entryPoint: 'fsJoint', targets: [{ format: this.format, blend: overlayBlend }] },
			primitive: { topology: 'triangle-strip' },
		});
		this.overlayLineBG = d.createBindGroup({
			layout: this.overlayLinePipe.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: this.boneBuf } },
				{ binding: 1, resource: { buffer: this.camUB } },
			],
		});
		this.overlayJointBG = d.createBindGroup({
			layout: this.overlayJointPipe.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: this.boneBuf } },
				{ binding: 1, resource: { buffer: this.camUB } },
			],
		});

		// S2 지형 heightfield — 기본은 1×1 더미 + on=0 (평면 바닥 폴백). setHeightfield 로 교체.
		this.hfUB = d.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
		this.hfTex = d.createTexture({ size: [1, 1], format: 'r32float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
		this._hf = null; // CPU 사본 — terrainHeightAt (emitter 보정, 하니스 지표)

		// L2 이웃 격자 (스플랫 수와 무관 — 1회 생성)
		this.gridCountBuf = d.createBuffer({ size: GRID_CELLS * 4, usage: GPUBufferUsage.STORAGE });
		this.gridSlotsBuf = d.createBuffer({ size: GRID_CELLS * GRID_SLOTS * 4, usage: GPUBufferUsage.STORAGE });
		this.gridClearBG = d.createBindGroup({
			layout: this.gridClearPipe.getBindGroupLayout(0),
			entries: [{ binding: 0, resource: { buffer: this.gridCountBuf } }],
		});
	};

	// 단일 개체 호환 래퍼
	HktGenesisEngine.prototype.setCount = function (n, genes) {
		this.setScene(n, [genes]);
	};

	// 장면 구성: 스플랫 풀을 균등 슬라이스로 개체들에 배정 (2의 거듭제곱 필수 — 바이토닉 전제)
	HktGenesisEngine.prototype.setScene = function (n, ents) {
		if ((n & (n - 1)) !== 0) throw new Error('count 는 2의 거듭제곱이어야 함: ' + n);
		if (ents.length < 1 || ents.length > MAX_ENTITIES) throw new Error('개체 수 1..8');
		const slice = n / ents.length;
		if (slice % CLUSTER_K !== 0) throw new Error('슬라이스는 256 의 배수여야 함');
		const d = this.device;
		this.count = n;
		this.entities = ents;
		this.sliceSize = slice;

		if (this.splatBuf) { this.splatBuf.destroy(); this.pairBuf.destroy(); this.sortUB.destroy(); this.restBuf.destroy(); this.clusterBuf.destroy(); }
		// COPY_SRC: 하니스/Evaluator 의 스플랫 상태 readback 용 (디버그 한정 — 프레임 경로 왕복 금지)
		this.splatBuf = d.createBuffer({ size: n * SPLAT_STRIDE * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
		this.pairBuf = d.createBuffer({ size: n * 8, usage: GPUBufferUsage.STORAGE });
		this.restBuf = d.createBuffer({ size: n * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
		this.clusterBuf = d.createBuffer({ size: (n / CLUSTER_K) * CLUSTER_STRIDE * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
		// 슬라이스별 초기화 조립 — 골렘 본드의 클러스터 인덱스는 전역 기준으로 보정
		const splatAll = new Float32Array(n * SPLAT_STRIDE);
		const restAll = new Float32Array(n * 4);
		const clusterAll = new Float32Array((n / CLUSTER_K) * CLUSTER_STRIDE);
		const clusterAllU = new Uint32Array(clusterAll.buffer);
		ents.forEach((rawGenes, ei) => {
			const genes = this._terrainAdjust(rawGenes); // S2: emitter 를 지형 위로 (나무가 능선에 뿌리내림)
			const init = (genes.form === 1) ? this._initGolem(slice, genes)
				: (genes.form === 2) ? this._initTree(slice, genes)
				: (genes.form === 3) ? this._initFleshCloud(slice, genes)
				: this._initCloud(slice, genes);
			splatAll.set(init.splat, ei * slice * SPLAT_STRIDE);
			restAll.set(init.rest, ei * slice * 4);
			const cBase = ei * (slice / CLUSTER_K);
			clusterAll.set(init.cluster, cBase * CLUSTER_STRIDE);
			const cu = new Uint32Array(init.cluster.buffer);
			for (let ci = 0; ci < slice / CLUSTER_K; ci++)
				for (let b = 0; b < 8; b++) {
					const e = cu[ci * CLUSTER_STRIDE + 16 + b];
					if (e !== 0xffffffff)
						clusterAllU[(cBase + ci) * CLUSTER_STRIDE + 16 + b] =
							(e & 0xf0000000) | ((e & 0x0fffffff) + cBase);
				}
		});
		d.queue.writeBuffer(this.splatBuf, 0, splatAll);
		d.queue.writeBuffer(this.restBuf, 0, restAll);
		d.queue.writeBuffer(this.clusterBuf, 0, clusterAll);

		// 바이토닉 단계 테이블: (k, j) 를 256B 정렬 슬롯에 미리 기록 → 프레임마다 동적 오프셋만 변경
		this._passes = [];
		for (let k = 2; k <= n; k <<= 1)
			for (let j = k >> 1; j > 0; j >>= 1) this._passes.push([k, j]);
		this.sortUB = d.createBuffer({ size: this._passes.length * 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
		const table = new Uint32Array(this._passes.length * 64);
		this._passes.forEach(([k, j], i) => { table[i * 64] = k; table[i * 64 + 1] = j; });
		d.queue.writeBuffer(this.sortUB, 0, table);

		// 바인드 그룹 재구성
		this._buildSimBG();
		this.gridBuildBG = d.createBindGroup({
			layout: this.gridBuildPipe.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: this.splatBuf } },
				{ binding: 1, resource: { buffer: this.simUB } },
				{ binding: 2, resource: { buffer: this.gridCountBuf } },
				{ binding: 3, resource: { buffer: this.gridSlotsBuf } },
			],
		});
		this.keyBG = d.createBindGroup({
			layout: this.keyPipe.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: this.splatBuf } },
				{ binding: 1, resource: { buffer: this.pairBuf } },
				{ binding: 2, resource: { buffer: this.keyUB } },
			],
		});
		this.sortBG = d.createBindGroup({
			layout: this.sortBGL,
			entries: [
				{ binding: 0, resource: { buffer: this.pairBuf } },
				{ binding: 1, resource: { buffer: this.sortUB, offset: 0, size: 16 } },
			],
		});
		this.renderBG = d.createBindGroup({
			layout: this.renderPipe.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: this.splatBuf } },
				{ binding: 1, resource: { buffer: this.pairBuf } },
				{ binding: 2, resource: { buffer: this.camUB } },
				{ binding: 3, resource: { buffer: this.clusterBuf } },
				{ binding: 4, resource: { buffer: this.entityBuf } },
			],
		});
		this.clusterBG = d.createBindGroup({
			layout: this.clusterPipe.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: this.splatBuf } },
				{ binding: 1, resource: { buffer: this.simUB } },
				{ binding: 2, resource: { buffer: this.restBuf } },
				{ binding: 3, resource: { buffer: this.clusterBuf } },
				{ binding: 4, resource: { buffer: this.entityBuf } },
			],
		});
	};

	// simBG 는 setScene(버퍼 재생성)과 setHeightfield(텍스처 교체) 양쪽에서 재구성된다
	HktGenesisEngine.prototype._buildSimBG = function () {
		if (!this.splatBuf) return;
		this.simBG = this.device.createBindGroup({
			layout: this.simPipe.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: this.splatBuf } },
				{ binding: 1, resource: { buffer: this.simUB } },
				{ binding: 2, resource: { buffer: this.gridCountBuf } },
				{ binding: 3, resource: { buffer: this.gridSlotsBuf } },
				{ binding: 4, resource: { buffer: this.restBuf } },
				{ binding: 5, resource: { buffer: this.entityBuf } },
				{ binding: 6, resource: { buffer: this.boneBuf } },
				{ binding: 7, resource: this.hfTex.createView() },
				{ binding: 8, resource: { buffer: this.hfUB } },
			],
		});
	};

	// S2 지형 heightfield 설치/해제 — hf = { data: Float32Array(res²), res, originX, originZ, cell } | null
	// 무대(collider 메시)와 시뮬의 유일한 접점: 시뮬은 이 텍스처만 안다 (GPU 상주 원칙 유지)
	HktGenesisEngine.prototype.setHeightfield = function (hf) {
		const d = this.device;
		this.hfTex.destroy();
		this._hf = hf || null;
		const u = new Float32Array(8);
		if (hf) {
			this.hfTex = d.createTexture({
				size: [hf.res, hf.res], format: 'r32float',
				usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
			});
			d.queue.writeTexture({ texture: this.hfTex }, hf.data, { bytesPerRow: hf.res * 4 }, [hf.res, hf.res]);
			u.set([hf.originX, hf.originZ, hf.cell, hf.res, 1]);
		} else {
			this.hfTex = d.createTexture({ size: [1, 1], format: 'r32float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
		}
		d.queue.writeBuffer(this.hfUB, 0, u);
		this._buildSimBG();
	};

	// CPU 측 지형 높이 (bilinear) — emitter 보정·하니스 지표용. 지형 없으면 평면 0.
	HktGenesisEngine.prototype.terrainHeightAt = function (x, z) {
		const hf = this._hf;
		if (!hf) return 0;
		const cl = (v) => Math.max(0, Math.min(hf.res - 2, v));
		const u = cl((x - hf.originX) / hf.cell), v = cl((z - hf.originZ) / hf.cell);
		const iu = Math.floor(u), iv = Math.floor(v), fu = u - iu, fv = v - iv;
		const at = (a, b) => hf.data[b * hf.res + a];
		return (at(iu, iv) * (1 - fu) + at(iu + 1, iv) * fu) * (1 - fv) +
			(at(iu, iv + 1) * (1 - fu) + at(iu + 1, iv + 1) * fu) * fv;
	};

	// emitter y 를 지형 위 상대 높이로 해석 — 프리셋의 y(지상고)에 지형 높이를 더한다
	HktGenesisEngine.prototype._terrainAdjust = function (g) {
		if (!this._hf) return g;
		const em = g.emitter || [0, 0.6, 0];
		return Object.assign({}, g, { emitter: [em[0], em[1] + this.terrainHeightAt(em[0], em[2]), em[2]] });
	};

	// 개체 유전자 → GPU 테이블 (wgsl.js Entity 레이아웃과 일치)
	HktGenesisEngine.prototype._packEntities = function (ents) {
		const a = new Float32Array(MAX_ENTITIES * ENTITY_STRIDE);
		ents.forEach((raw, ei) => {
			const g = this._terrainAdjust(raw); // 재생성(respawn)도 지형 위에서
			const em = g.emitter || [0, 0.6, 0];
			const o = ei * ENTITY_STRIDE;
			a.set([em[0], em[1], em[2], g.cohesion,
				g.volatility, g.updraft, g.damping, g.lifeBase,
				g.emitRadius, g.flowFreq, g.flowSpeed, g.gravity,
				g.mortality, g.binding, g.restDist, g.viscosity,
				Math.min(g.reach, GRID_CELL), g.rigid, g.toughness, g.bondK,
				g.growRate, g.flamm, g.heatEmit || 0, g.fleshK || 0], o);
			a.set(g.colorA, o + 24);
			a.set(g.colorB, o + 28);
			a.set([g.size, g.stretch, g.opacity, g.luminosity], o + 32);
		});
		return a;
	};

	// 빈 클러스터 테이블 (form 0 — 클러스터 패스 미사용, 렌더 strain 참조용 0 초기화)
	HktGenesisEngine.prototype._emptyClusters = function (n) {
		const c = new Float32Array((n / CLUSTER_K) * CLUSTER_STRIDE);
		const cu = new Uint32Array(c.buffer);
		for (let ci = 0; ci < n / CLUSTER_K; ci++) {
			c[ci * CLUSTER_STRIDE + 3] = 1; // quat = identity
			for (let b = 0; b < 8; b++) cu[ci * CLUSTER_STRIDE + 16 + b] = 0xffffffff;
		}
		return c;
	};

	// form 0 — 코어(emitter) 주변 랜덤 구름, 수명 위상 분산 (세대 교대가 자연히 이어지도록)
	HktGenesisEngine.prototype._initCloud = function (n, genes) {
		const em = genes.emitter || [0, 0.6, 0];
		const a = new Float32Array(n * SPLAT_STRIDE);
		for (let i = 0; i < n; i++) {
			const o = i * SPLAT_STRIDE;
			const life = genes.lifeBase * (0.5 + Math.random());
			a[o + 0] = em[0] + (Math.random() * 2 - 1) * genes.emitRadius;
			a[o + 1] = em[1] + (Math.random() * 2 - 1) * genes.emitRadius;
			a[o + 2] = em[2] + (Math.random() * 2 - 1) * genes.emitRadius;
			a[o + 3] = Math.random() * life;   // age
			// vel = 0 (o+4..6)
			a[o + 7] = life;                    // life
			// misc: energy=0, seed, heat=0, fuel=1
			a[o + 9] = Math.random() * 100;
			a[o + 11] = 1;
		}
		return { splat: a, rest: new Float32Array(n * 4), cluster: this._emptyClusters(n) };
	};

	// form 1 — 돌골렘: 신체 파트에 클러스터(돌덩이)를 배치하고 근접 클러스터끼리 본드 연결
	HktGenesisEngine.prototype._initGolem = function (n, genes) {
		const em = genes.emitter || [0, 0, 0];
		const C = n / CLUSTER_K;
		// 파트: [cx, cy, cz, rx, ry, rz] 타원체 — 다리 2, 몸통, 팔 2, 머리
		const parts = [
			[-0.26, 0.48, 0, 0.18, 0.46, 0.18],
			[0.26, 0.48, 0, 0.18, 0.46, 0.18],
			[0, 1.18, 0, 0.44, 0.38, 0.3],
			[-0.68, 0.98, 0, 0.14, 0.42, 0.14],
			[0.68, 0.98, 0, 0.14, 0.42, 0.14],
			[0, 1.76, 0, 0.2, 0.2, 0.2],
		];
		const weights = parts.map((p) => p[3] * p[4] * p[5]);
		const wTotal = weights.reduce((s, w) => s + w, 0);

		// 타원체 내부 균등 샘플 (rejection)
		const samplePart = (p) => {
			for (;;) {
				const x = Math.random() * 2 - 1, y = Math.random() * 2 - 1, z = Math.random() * 2 - 1;
				if (x * x + y * y + z * z <= 1) return [p[0] + x * p[3], p[1] + y * p[4], p[2] + z * p[5]];
			}
		};

		// 클러스터 중심 배치 (파트 부피 비례)
		const centers = [];
		for (let ci = 0; ci < C; ci++) {
			let r = Math.random() * wTotal, pi = 0;
			while (r > weights[pi] && pi < parts.length - 1) { r -= weights[pi]; pi++; }
			const c0 = samplePart(parts[pi]);
			centers.push([c0[0] + em[0], c0[1], c0[2] + em[2]]);
		}

		// 본드: 전역 간선 삽입(거리 오름차순) — 대칭 보장. 비대칭 본드는 운동량을 주입해
		// 골격을 서서히 무너뜨린다 (한쪽만 당기는 스프링).
		const CUTOFF = 0.5;
		const edges = [];
		for (let ci = 0; ci < C; ci++)
			for (let cj = ci + 1; cj < C; cj++) {
				const d = Math.hypot(centers[ci][0] - centers[cj][0], centers[ci][1] - centers[cj][1], centers[ci][2] - centers[cj][2]);
				if (d < CUTOFF) edges.push([d, ci, cj]);
			}
		edges.sort((a, b) => a[0] - b[0]);
		// 엔트리 = (역참조 슬롯 << 28) | 이웃 인덱스 — 셰이더가 상대 생존 비트를 확인한다
		const bonds = Array.from({ length: C }, () => []);
		for (const [, ci, cj] of edges)
			if (bonds[ci].length < 8 && bonds[cj].length < 8) {
				bonds[ci].push((bonds[cj].length << 28) | cj);
				bonds[cj].push(((bonds[ci].length - 1) << 28) | ci);
			}

		const splat = new Float32Array(n * SPLAT_STRIDE);
		const restA = new Float32Array(n * 4);
		const cluster = new Float32Array(C * CLUSTER_STRIDE);
		const cu = new Uint32Array(cluster.buffer);
		for (let ci = 0; ci < C; ci++) {
			const co = ci * CLUSTER_STRIDE;
			const boulderR = 0.12 + Math.random() * 0.06;
			cluster[co + 3] = 1; // quat identity
			cluster[co + 4] = centers[ci][0]; cluster[co + 5] = centers[ci][1]; cluster[co + 6] = centers[ci][2]; // com
			cluster[co + 8] = centers[ci][0]; cluster[co + 9] = centers[ci][1]; cluster[co + 10] = centers[ci][2]; // restCom
			let flags = 0;
			for (let b = 0; b < 8; b++) {
				if (b < bonds[ci].length) { cu[co + 16 + b] = bonds[ci][b]; flags |= 1 << b; }
				else cu[co + 16 + b] = 0xffffffff;
			}
			cu[co + 11] = flags;

			for (let k = 0; k < CLUSTER_K; k++) {
				const i = ci * CLUSTER_K + k;
				// 돌덩이: 구 내부 균등 샘플 오프셋
				let ox, oy, oz;
				for (;;) {
					ox = Math.random() * 2 - 1; oy = Math.random() * 2 - 1; oz = Math.random() * 2 - 1;
					if (ox * ox + oy * oy + oz * oz <= 1) break;
				}
				ox *= boulderR; oy *= boulderR; oz *= boulderR;
				const o = i * SPLAT_STRIDE;
				splat[o + 0] = centers[ci][0] + ox;
				splat[o + 1] = centers[ci][1] + oy;
				splat[o + 2] = centers[ci][2] + oz;
				splat[o + 7] = 1e9; // 불멸 (mortality 0 이 정석이지만 이중 안전)
				splat[o + 9] = Math.random() * 100;
				splat[o + 11] = 1; // fuel
				restA[i * 4 + 0] = ox; restA[i * 4 + 1] = oy; restA[i * 4 + 2] = oz;
			}
		}
		return { splat, rest: restA, cluster };
	};

	// form 3 — L6 살 구름: 구름 초기화에 뼈 친화(rest.w)를 부피 가중으로 부여.
	// 스플랫은 태어날 때 "어느 뼈의 살이 될지"만 정해지고(시드), 위치는 구름 —
	// SIM 의 fleshK 규칙이 제 뼈로 끌어당겨 살이 자라난다. 친화가 없으면 전 스플랫이
	// 전역 최근접 표면점으로 몰려 몇 개 방울로 뭉친다 (온몸 분포 보장 장치).
	HktGenesisEngine.prototype._initFleshCloud = function (n, genes) {
		const init = this._initCloud(n, genes);
		// MAX_BONES 초과분은 업로드에서 잘리므로 친화도 같은 범위로 제한
		const segs = (genes.bindBones || []).slice(0, MAX_BONES);
		if (segs.length) {
			// 세그먼트 부피 가중 (원뿔대 부피 ∝ len·(ra²+ra·rb+rb²))
			const w = segs.map((s) => {
				const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]);
				return len * (s.ra * s.ra + s.ra * s.rb + s.rb * s.rb);
			});
			const total = w.reduce((x, y) => x + y, 0);
			for (let i = 0; i < n; i++) {
				let r = Math.random() * total, si = 0;
				while (r > w[si] && si < segs.length - 1) { r -= w[si]; si++; }
				init.rest[i * 4 + 3] = si;
			}
		}
		return init;
	};

	// form 2 — 나무: 재귀 가지 골격을 절차 생성하고 스플랫마다 (부착점, 성장 시점) 부여.
	// "증식"은 실제 할당이 아니라 휴면 스플랫의 활성화 — birth(뿌리로부터의 그래프 거리)
	// 순서로 깨어나므로 뿌리→가지끝으로 자라 보인다.
	HktGenesisEngine.prototype._initTree = function (n, genes) {
		const segs = [];   // {a, b, r, birthA, birthB}
		const leaves = []; // {c, r, birth}
		const rot = (v, axis, ang) => { // 로드리게스 회전
			const [ax, ay, az] = axis, ca = Math.cos(ang), sa = Math.sin(ang);
			const dot = ax * v[0] + ay * v[1] + az * v[2];
			return [
				v[0] * ca + (ay * v[2] - az * v[1]) * sa + ax * dot * (1 - ca),
				v[1] * ca + (az * v[0] - ax * v[2]) * sa + ay * dot * (1 - ca),
				v[2] * ca + (ax * v[1] - ay * v[0]) * sa + az * dot * (1 - ca),
			];
		};
		let maxBirth = 0;
		const branch = (a, dir, len, r, birth, depth) => {
			const b = [a[0] + dir[0] * len, a[1] + dir[1] * len, a[2] + dir[2] * len];
			segs.push({ a, b, r, birthA: birth, birthB: birth + len });
			maxBirth = Math.max(maxBirth, birth + len);
			if (depth >= 4) { leaves.push({ c: b, r: 0.16 + Math.random() * 0.08, birth: birth + len }); return; }
			const kids = depth === 0 ? 3 : 2 + (Math.random() < 0.5 ? 1 : 0);
			for (let k = 0; k < kids; k++) {
				// 위쪽 편향 원뿔 안에서 랜덤 방향
				const axis = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
				let side = rot(dir, axis, Math.PI / 2);
				side = rot(side, dir, Math.random() * Math.PI * 2);
				const spread = 0.5 + Math.random() * 0.45;
				let nd = [dir[0] + side[0] * spread, dir[1] + side[1] * spread + 0.35, dir[2] + side[2] * spread];
				const nl = Math.hypot(...nd); nd = nd.map((v) => v / nl);
				branch(b, nd, len * (0.62 + Math.random() * 0.12), r * 0.55, birth + len, depth + 1);
			}
		};
		const em = genes.emitter || [0, 0, 0];
		branch([em[0], 0, em[2]], [0, 1, 0], 0.85, 0.13, 0, 0);

		// 스플랫 배분: 줄기(세그 부피 비례) 60% / 잎 40%
		const segW = segs.map((s) => s.r * Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]));
		const segTotal = segW.reduce((x, y) => x + y, 0);
		const nTrunk = Math.floor(n * 0.6);
		const splat = new Float32Array(n * SPLAT_STRIDE);
		const restA = new Float32Array(n * 4);
		const put = (i, p, birth) => {
			const o = i * SPLAT_STRIDE;
			splat[o + 0] = p[0]; splat[o + 1] = p[1]; splat[o + 2] = p[2];
			splat[o + 7] = 1e9;
			splat[o + 9] = Math.random() * 100;
			splat[o + 11] = 1; // fuel
			restA[i * 4 + 0] = p[0]; restA[i * 4 + 1] = p[1]; restA[i * 4 + 2] = p[2];
			restA[i * 4 + 3] = birth / maxBirth;
		};
		for (let i = 0; i < nTrunk; i++) {
			let w = Math.random() * segTotal, si = 0;
			while (w > segW[si] && si < segs.length - 1) { w -= segW[si]; si++; }
			const s = segs[si], t = Math.random();
			const jr = s.r * Math.sqrt(Math.random());
			const th = Math.random() * Math.PI * 2;
			put(i, [
				s.a[0] + (s.b[0] - s.a[0]) * t + Math.cos(th) * jr,
				s.a[1] + (s.b[1] - s.a[1]) * t + Math.sin(th) * jr * 0.4,
				s.a[2] + (s.b[2] - s.a[2]) * t + Math.sin(th) * jr,
			], s.birthA + (s.birthB - s.birthA) * t);
		}
		for (let i = nTrunk; i < n; i++) {
			const lf = leaves[Math.floor(Math.random() * leaves.length)];
			let ox, oy, oz;
			for (;;) {
				ox = Math.random() * 2 - 1; oy = Math.random() * 2 - 1; oz = Math.random() * 2 - 1;
				if (ox * ox + oy * oy + oz * oz <= 1) break;
			}
			put(i, [lf.c[0] + ox * lf.r, lf.c[1] + oy * lf.r * 0.8, lf.c[2] + oz * lf.r], lf.birth + 0.06);
		}
		return { splat, rest: restA, cluster: this._emptyClusters(n) };
	};

	// 유전자 + 카메라 → 유니폼 기록 + 한 프레임 인코드/제출
	HktGenesisEngine.prototype.frame = function (opts) {
		const d = this.device;
		const n = this.count;
		const g = opts.genes;

		// SimParams (64B) — wgsl.js SimParams 레이아웃과 일치. 유전자는 entity 테이블로.
		const ents = opts.entities || [g];
		const pull = opts.pull || [0, 0, 0, 0];
		const sim = new ArrayBuffer(64);
		const sf = new Float32Array(sim);
		const su = new Uint32Array(sim);
		sf.set(pull, 0);
		sf.set([GRID_ORIGIN[0], GRID_ORIGIN[1], GRID_ORIGIN[2], GRID_CELL, opts.dt, opts.time], 4);
		su[10] = n;
		su[11] = this.sliceSize;
		sf[12] = 0; // floorY
		// L6 뼈대: FK 결과 세그먼트를 테이블에 올린다 — 살(fleshK)의 유일한 형태 입력
		const bones = opts.bones || [];
		const nb = Math.min(bones.length, MAX_BONES);
		if (nb > 0) {
			const ba = new Float32Array(nb * 8);
			for (let i = 0; i < nb; i++) {
				const s = bones[i];
				ba.set([s.a[0], s.a[1], s.a[2], s.ra, s.b[0], s.b[1], s.b[2], s.rb], i * 8);
			}
			d.queue.writeBuffer(this.boneBuf, 0, ba);
		}
		sf[13] = nb;                       // boneCount
		this._boneCount = nb;
		d.queue.writeBuffer(this.simUB, 0, sim);
		d.queue.writeBuffer(this.entityBuf, 0, this._packEntities(ents));

		// KeyParams (32B) — view 의 z-행
		const v = opts.view;
		const key = new ArrayBuffer(32);
		new Float32Array(key).set([v[2], v[6], v[10], v[14]], 0);
		new Uint32Array(key)[4] = n;
		d.queue.writeBuffer(this.keyUB, 0, key);

		// CamParams (160B)
		const cam = new ArrayBuffer(160);
		const cf = new Float32Array(cam);
		cf.set(v, 0);
		cf.set(opts.proj, 16);
		cf.set([opts.viewport[0], opts.viewport[1], opts.focal[0], opts.focal[1]], 32);
		new Uint32Array(cam)[36] = this.sliceSize;
		d.queue.writeBuffer(this.camUB, 0, cam);

		const wgs = Math.ceil(n / WG);
		const enc = d.createCommandEncoder();

		const cp = enc.beginComputePass();
		if (!opts.paused) {
			// 격자 클리어 → 빌드 → 시뮬 (이웃은 프레임 시작 시점 위치 기준)
			cp.setPipeline(this.gridClearPipe);
			cp.setBindGroup(0, this.gridClearBG);
			cp.dispatchWorkgroups(GRID_CELLS / WG);
			cp.setPipeline(this.gridBuildPipe);
			cp.setBindGroup(0, this.gridBuildBG);
			cp.dispatchWorkgroups(wgs);
			cp.setPipeline(this.simPipe);
			cp.setBindGroup(0, this.simBG);
			cp.dispatchWorkgroups(wgs);
			// L3: 강성 개체가 하나라도 있으면 shape matching + 본드 골격 (셰이더가 개체별 가드)
			if (ents.some((e) => e.rigid > 0)) {
				cp.setPipeline(this.clusterPipe);
				cp.setBindGroup(0, this.clusterBG);
				cp.dispatchWorkgroups(n / CLUSTER_K);
			}
		}
		cp.setPipeline(this.keyPipe);
		cp.setBindGroup(0, this.keyBG);
		cp.dispatchWorkgroups(wgs);
		cp.setPipeline(this.sortPipe);
		for (let i = 0; i < this._passes.length; i++) {
			cp.setBindGroup(0, this.sortBG, [i * 256]);
			cp.dispatchWorkgroups(wgs);
		}
		cp.end();

		const rp = enc.beginRenderPass({
			colorAttachments: [{
				view: this.context.getCurrentTexture().createView(),
				// 무대(stage) 합성 시 a=0 투명 클리어 — premultiplied over 가 dst 알파에
				// 커버리지를 누적하므로 캔버스 알파 합성이 그대로 성립한다 (S 트랙)
				clearValue: opts.background || { r: 0.012, g: 0.014, b: 0.03, a: 1 },
				loadOp: 'clear',
				storeOp: 'store',
			}],
		});
		rp.setPipeline(this.renderPipe);
		rp.setBindGroup(0, this.renderBG);
		rp.draw(4, n);
		// L6 뼈대 오버레이 — 살 위에 라인 + 관절 점 (bones 가 있고 토글이 켜진 프레임만)
		if (opts.showBones && this._boneCount > 0) {
			rp.setPipeline(this.overlayLinePipe);
			rp.setBindGroup(0, this.overlayLineBG);
			rp.draw(this._boneCount * 2);
			rp.setPipeline(this.overlayJointPipe);
			rp.setBindGroup(0, this.overlayJointBG);
			rp.draw(4, this._boneCount * 2);
		}
		rp.end();

		d.queue.submit([enc.finish()]);
	};

	global.HktGenesisEngine = HktGenesisEngine;
})(window);
