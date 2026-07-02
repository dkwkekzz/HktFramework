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
	const ENTITY_STRIDE = 40;    // f32 40개 = 160B (wgsl.js Entity 와 일치)
	const MAX_ENTITIES = 8;
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

		if (this.splatBuf) { this.splatBuf.destroy(); this.pairBuf.destroy(); this.sortUB.destroy(); this.restBuf.destroy(); this.clusterBuf.destroy(); this.memColorBuf.destroy(); }
		this.splatBuf = d.createBuffer({ size: n * SPLAT_STRIDE * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
		this.pairBuf = d.createBuffer({ size: n * 8, usage: GPUBufferUsage.STORAGE });
		this.restBuf = d.createBuffer({ size: n * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
		this.clusterBuf = d.createBuffer({ size: (n / CLUSTER_K) * CLUSTER_STRIDE * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
		this.memColorBuf = d.createBuffer({ size: n * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
		// 슬라이스별 초기화 조립 — 골렘 본드의 클러스터 인덱스는 전역 기준으로 보정
		const splatAll = new Float32Array(n * SPLAT_STRIDE);
		const restAll = new Float32Array(n * 4);
		const memAll = new Uint32Array(n);
		const clusterAll = new Float32Array((n / CLUSTER_K) * CLUSTER_STRIDE);
		const clusterAllU = new Uint32Array(clusterAll.buffer);
		ents.forEach((genes, ei) => {
			const init = (genes.form === 1) ? this._initGolem(slice, genes)
				: (genes.form === 2) ? this._initTree(slice, genes)
				: (genes.form === 3) ? this._initMemory(slice, genes)
				: this._initCloud(slice, genes);
			splatAll.set(init.splat, ei * slice * SPLAT_STRIDE);
			restAll.set(init.rest, ei * slice * 4);
			if (init.mem) memAll.set(init.mem, ei * slice);
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
		d.queue.writeBuffer(this.memColorBuf, 0, memAll);
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
		this.simBG = d.createBindGroup({
			layout: this.simPipe.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: this.splatBuf } },
				{ binding: 1, resource: { buffer: this.simUB } },
				{ binding: 2, resource: { buffer: this.gridCountBuf } },
				{ binding: 3, resource: { buffer: this.gridSlotsBuf } },
				{ binding: 4, resource: { buffer: this.restBuf } },
				{ binding: 5, resource: { buffer: this.entityBuf } },
			],
		});
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
				{ binding: 5, resource: { buffer: this.restBuf } },
				{ binding: 6, resource: { buffer: this.memColorBuf } },
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

	// 개체 유전자 → GPU 테이블 (wgsl.js Entity 레이아웃과 일치)
	HktGenesisEngine.prototype._packEntities = function (ents) {
		const a = new Float32Array(MAX_ENTITIES * ENTITY_STRIDE);
		ents.forEach((g, ei) => {
			const em = g.emitter || [0, 0.6, 0];
			const o = ei * ENTITY_STRIDE;
			a.set([em[0], em[1], em[2], g.cohesion,
				g.volatility, g.updraft, g.damping, g.lifeBase,
				g.emitRadius, g.flowFreq, g.flowSpeed, g.gravity,
				g.mortality, g.binding, g.restDist, g.viscosity,
				Math.min(g.reach, GRID_CELL), g.rigid, g.toughness, g.bondK,
				g.growRate, g.flamm, g.heatEmit || 0, 0], o);
			a.set(g.colorA, o + 24);
			a.set(g.colorB, o + 28);
			a.set([g.size, g.stretch, g.opacity, g.luminosity], o + 32);
			a.set([g.memory || 0, g.memRate || 0, g.memColor || 0, 0], o + 36);
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

	// form 3 — 기억의 정령: 이미지 중요도 샘플링 → 스플랫별 기억 앵커(rest)와 앵커 픽셀색.
	// 이미지는 세워진 부조 평면으로 해석한다 — 휘도가 샘플 밀도와 릴리프(z)를 함께 결정.
	// 시작 상태는 emitter 구름(_initCloud) — 스플랫이 앵커로 *여행해 와서* 형태가 떠오른다.
	HktGenesisEngine.prototype._initMemory = function (n, genes) {
		const img = genes.image;
		if (!img) return this._initCloud(n, genes); // 이미지 없으면 구름 (rest 0 → memory 무해)
		const em = genes.emitter || [0, 0.6, 0];
		const { data, w, h } = img;

		// 픽셀 중요도 CDF — 알파 × (바닥 + 휘도): 어두운 영역도 옅게나마 살아남는다
		const cdf = new Float32Array(w * h);
		let total = 0;
		for (let p = 0; p < w * h; p++) {
			const lum = (0.2126 * data[p * 4] + 0.7152 * data[p * 4 + 1] + 0.0722 * data[p * 4 + 2]) / 255;
			total += (data[p * 4 + 3] / 255) * (0.15 + 0.85 * lum);
			cdf[p] = total;
		}
		if (total <= 0) return this._initCloud(n, genes);

		// 월드 배치: 가로세로비 유지, 최장변 ≈ 2.2, 바닥 여유 0.15 (floorY 와의 경합 방지)
		const scale = 2.2 / Math.max(w, h);
		const W = w * scale, H = h * scale;
		const gauss = (s) => (Math.random() + Math.random() + Math.random() - 1.5) * 2 * s;

		const cloud = this._initCloud(n, genes);
		const restA = new Float32Array(n * 4);
		const mem = new Uint32Array(n);
		let cx = 0, cy = 0;
		for (let i = 0; i < n; i++) {
			// CDF 이분탐색 — 밝은 픽셀일수록 앵커가 많이 배정된다 (밀도 = 이미지)
			const t = Math.random() * total;
			let lo = 0, hi = w * h - 1;
			while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < t) lo = mid + 1; else hi = mid; }
			const px = lo % w, py = (lo / w) | 0;
			const u = (px + Math.random()) / w, v = (py + Math.random()) / h;
			const lum = (0.2126 * data[lo * 4] + 0.7152 * data[lo * 4 + 1] + 0.0722 * data[lo * 4 + 2]) / 255;
			restA[i * 4 + 0] = em[0] + (u - 0.5) * W;
			restA[i * 4 + 1] = 0.15 + (1 - v) * H;
			restA[i * 4 + 2] = em[2] + (lum - 0.5) * 0.25 + gauss(0.05);
			cx += restA[i * 4 + 0]; cy += restA[i * 4 + 1];
			mem[i] = data[lo * 4] | (data[lo * 4 + 1] << 8) | (data[lo * 4 + 2] << 16) | (255 << 24);
		}
		// 개화 시점(birth) = 앵커 무게중심으로부터의 정규화 거리 — 중심→바깥으로 응결
		cx /= n; cy /= n;
		let maxD = 1e-6;
		for (let i = 0; i < n; i++)
			maxD = Math.max(maxD, Math.hypot(restA[i * 4] - cx, restA[i * 4 + 1] - cy));
		for (let i = 0; i < n; i++)
			restA[i * 4 + 3] = Math.min(
				Math.hypot(restA[i * 4] - cx, restA[i * 4 + 1] - cy) / maxD + Math.random() * 0.1, 1);
		return { splat: cloud.splat, rest: restA, cluster: cloud.cluster, mem };
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
				clearValue: { r: 0.012, g: 0.014, b: 0.03, a: 1 },
				loadOp: 'clear',
				storeOp: 'store',
			}],
		});
		rp.setPipeline(this.renderPipe);
		rp.setBindGroup(0, this.renderBG);
		rp.draw(4, n);
		rp.end();

		d.queue.submit([enc.finish()]);
	};

	global.HktGenesisEngine = HktGenesisEngine;
})(window);
