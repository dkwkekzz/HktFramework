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
		this.simUB = d.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
		this.keyUB = d.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
		this.camUB = d.createBuffer({ size: 192, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

		// L2 이웃 격자 (스플랫 수와 무관 — 1회 생성)
		this.gridCountBuf = d.createBuffer({ size: GRID_CELLS * 4, usage: GPUBufferUsage.STORAGE });
		this.gridSlotsBuf = d.createBuffer({ size: GRID_CELLS * GRID_SLOTS * 4, usage: GPUBufferUsage.STORAGE });
		this.gridClearBG = d.createBindGroup({
			layout: this.gridClearPipe.getBindGroupLayout(0),
			entries: [{ binding: 0, resource: { buffer: this.gridCountBuf } }],
		});
	};

	// 스플랫 수 변경 (2의 거듭제곱 필수 — 바이토닉 정렬 전제)
	HktGenesisEngine.prototype.setCount = function (n, genes) {
		if ((n & (n - 1)) !== 0) throw new Error('count 는 2의 거듭제곱이어야 함: ' + n);
		const d = this.device;
		this.count = n;

		if (this.splatBuf) { this.splatBuf.destroy(); this.pairBuf.destroy(); this.sortUB.destroy(); this.restBuf.destroy(); this.clusterBuf.destroy(); }
		this.splatBuf = d.createBuffer({ size: n * SPLAT_STRIDE * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
		this.pairBuf = d.createBuffer({ size: n * 8, usage: GPUBufferUsage.STORAGE });
		this.restBuf = d.createBuffer({ size: n * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
		this.clusterBuf = d.createBuffer({ size: (n / CLUSTER_K) * CLUSTER_STRIDE * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
		const init = (genes.form === 1) ? this._initGolem(n, genes) : this._initCloud(n, genes);
		d.queue.writeBuffer(this.splatBuf, 0, init.splat);
		d.queue.writeBuffer(this.restBuf, 0, init.rest);
		d.queue.writeBuffer(this.clusterBuf, 0, init.cluster);

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
			],
		});
		this.clusterBG = d.createBindGroup({
			layout: this.clusterPipe.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: this.splatBuf } },
				{ binding: 1, resource: { buffer: this.simUB } },
				{ binding: 2, resource: { buffer: this.restBuf } },
				{ binding: 3, resource: { buffer: this.clusterBuf } },
			],
		});
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

	// form 0 — 코어 주변 랜덤 구름, 수명 위상 분산 (세대 교대가 자연히 이어지도록)
	HktGenesisEngine.prototype._initCloud = function (n, genes) {
		const a = new Float32Array(n * SPLAT_STRIDE);
		for (let i = 0; i < n; i++) {
			const o = i * SPLAT_STRIDE;
			const life = genes.lifeBase * (0.5 + Math.random());
			a[o + 0] = (Math.random() * 2 - 1) * genes.emitRadius;
			a[o + 1] = 0.6 + (Math.random() * 2 - 1) * genes.emitRadius; // 기본 코어 높이
			a[o + 2] = (Math.random() * 2 - 1) * genes.emitRadius;
			a[o + 3] = Math.random() * life;   // age
			// vel = 0 (o+4..6)
			a[o + 7] = life;                    // life
			// misc: energy=0, seed
			a[o + 9] = Math.random() * 100;
		}
		return { splat: a, rest: new Float32Array(n * 4), cluster: this._emptyClusters(n) };
	};

	// form 1 — 돌골렘: 신체 파트에 클러스터(돌덩이)를 배치하고 근접 클러스터끼리 본드 연결
	HktGenesisEngine.prototype._initGolem = function (n, genes) {
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
			centers.push(samplePart(parts[pi]));
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
		const bonds = Array.from({ length: C }, () => []);
		for (const [, ci, cj] of edges)
			if (bonds[ci].length < 8 && bonds[cj].length < 8) { bonds[ci].push(cj); bonds[cj].push(ci); }

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
				restA[i * 4 + 0] = ox; restA[i * 4 + 1] = oy; restA[i * 4 + 2] = oz;
			}
		}
		return { splat, rest: restA, cluster };
	};

	// 유전자 + 카메라 → 유니폼 기록 + 한 프레임 인코드/제출
	HktGenesisEngine.prototype.frame = function (opts) {
		const d = this.device;
		const n = this.count;
		const g = opts.genes;

		// SimParams (128B) — wgsl.js SimParams 레이아웃과 일치
		const em = opts.emitter || [0, 0.6, 0];
		const half = GRID_DIM * g.reach * 0.5; // 격자를 코어 중심에 배치
		const pull = opts.pull || [0, 0, 0, 0];
		const sim = new ArrayBuffer(128);
		const sf = new Float32Array(sim);
		const su = new Uint32Array(sim);
		sf.set([em[0], em[1], em[2], opts.dt, opts.time, g.cohesion, g.volatility, g.updraft,
			g.damping, g.lifeBase, g.emitRadius, g.flowFreq, g.flowSpeed, 0, g.gravity, g.mortality], 0);
		su[13] = n;
		sf.set(pull, 16);
		sf.set([em[0] - half, em[1] - half, em[2] - half, g.reach,
			g.binding, g.restDist, g.viscosity, 0 /* floorY */,
			g.rigid, g.toughness, g.bondK, 0], 20);
		d.queue.writeBuffer(this.simUB, 0, sim);

		// KeyParams (32B) — view 의 z-행
		const v = opts.view;
		const key = new ArrayBuffer(32);
		new Float32Array(key).set([v[2], v[6], v[10], v[14]], 0);
		new Uint32Array(key)[4] = n;
		d.queue.writeBuffer(this.keyUB, 0, key);

		// CamParams (192B)
		const cam = new Float32Array(48);
		cam.set(v, 0);
		cam.set(opts.proj, 16);
		cam.set([opts.viewport[0], opts.viewport[1], opts.focal[0], opts.focal[1]], 32);
		cam.set(g.colorA, 36);
		cam.set(g.colorB, 40);
		cam.set([g.size, g.stretch, g.opacity, g.luminosity], 44);
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
			// L3: 강성 유전자가 있으면 shape matching + 본드 골격 (워크그룹 1개 = 클러스터 1개)
			if (g.rigid > 0) {
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
