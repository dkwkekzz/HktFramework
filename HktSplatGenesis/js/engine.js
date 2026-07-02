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

		if (this.splatBuf) { this.splatBuf.destroy(); this.pairBuf.destroy(); this.sortUB.destroy(); }
		this.splatBuf = d.createBuffer({ size: n * SPLAT_STRIDE * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
		this.pairBuf = d.createBuffer({ size: n * 8, usage: GPUBufferUsage.STORAGE });
		d.queue.writeBuffer(this.splatBuf, 0, this._initData(n, genes));

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
			],
		});
	};

	// 초기 상태: 코어 주변 랜덤 분포, 수명 위상 분산 (세대 교대가 자연히 이어지도록)
	HktGenesisEngine.prototype._initData = function (n, genes) {
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
		return a;
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
			g.binding, g.restDist, g.viscosity, 0 /* floorY */], 20);
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
