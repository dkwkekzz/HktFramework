// HktSplatGenesis — WGSL 셰이더 모음 (classic script, 전역 HktGenesisWGSL)
//
// 설계 원칙: 스플랫 = 세포. 시뮬 상태(pos/vel/age/energy/heat/fuel)가 유일한 원본이고
// 렌더 속성(공분산·색·불투명도)은 매 프레임 셰이더에서 *유도*된다.
// 렌더 속성을 직접 만드는 코드는 어디에도 없어야 한다.
//
// L5: 유전자는 유니폼이 아니라 개체(Entity) 테이블 — 스플랫 풀을 균등 슬라이스로
// 개체에 배정한다 (eid = i / sliceSize). 격자는 전 개체 공유이므로 서로 다른
// 개체의 스플랫이 서로의 이웃으로 잡힌다 — 개체 간 상호작용(발열→점화)의 통로.

(function (global) {
	'use strict';

	// 시뮬 상태 48B/스플랫 — engine.js SPLAT_STRIDE 와 바이트 일치 필수
	// misc = (energy, seed, heat, fuel)
	const SPLAT_STRUCT = /* wgsl */`
struct Splat {
	pos : vec3f,  age : f32,
	vel : vec3f,  life : f32,
	misc : vec4f, // x=energy(0..1), y=seed, z=열(연소), w=연료(0=재)
};
`;

	// 전역 시뮬 유니폼 64B — engine.js frame() 패킹과 바이트 일치 필수
	const SIM_PARAMS = /* wgsl */`
struct SimParams {
	pull : vec4f,       // xyz = 인력점, w = 강도 (포인터 — 구름엔 인력, 나무엔 불씨)
	gridOrigin : vec3f, cellSize : f32,
	dt : f32, time : f32, count : u32, sliceSize : u32,
	floorY : f32, boneCount : f32, _s1 : f32, _s2 : f32, // L6: 뼈 세그먼트 수
};
`;

	// 개체 유전자 160B — engine.js ENTITY_STRIDE(40 float) 와 바이트 일치 필수
	const ENTITY_STRUCT = /* wgsl */`
struct Entity {
	emitter : vec3f,   cohesion : f32,
	volatility : f32,  updraft : f32,   damping : f32,   lifeBase : f32,
	emitRadius : f32,  flowFreq : f32,  flowSpeed : f32, gravity : f32,
	mortality : f32,   binding : f32,   restDist : f32,  viscosity : f32,
	reach : f32,       rigid : f32,     toughness : f32, bondK : f32,
	growRate : f32,    flamm : f32,     heatEmit : f32,  fleshK : f32, // fleshK: L6 살 자리 스프링 강도
	colorA : vec4f,    colorB : vec4f,
	size : f32,        stretch : f32,   opacity : f32,   luminosity : f32,
	spec : f32,        specPow : f32,   rim : f32,       wrap : f32,   // R1 재질: 스펙큘러·광택·림·랩 확산
};
`;

	// 고정 격자 상수 — L2/L4/L5 이웃 탐색 (전 개체 공유 dense grid + 셀당 고정 슬롯)
	const GRID_CONST = /* wgsl */`
const GD : i32 = 64;           // 격자 한 변 셀 수
const GDU : u32 = 64u;
const CELLS : u32 = 262144u;   // 64³
const SLOTS : u32 = 16u;       // 셀당 최대 기록 수 (초과분은 이웃 힘에서 누락 — 우아한 저하)
`;

	// L3 클러스터(돌덩이) 상태 — 워크그룹 1개 = 클러스터 1개 = 스플랫 256개
	const CLUSTER_STRUCT = /* wgsl */`
const K = 256u; // 클러스터 크기 (engine.js CLUSTER_K 와 일치)
struct Cluster {
	quat : vec4f,                  // 현재 회전 (shape matching 결과)
	com : vec3f,    strain : f32,  // 무게중심, 최대 본드 변형률 (렌더 발광용)
	restCom : vec3f, flags : u32,  // 휴지 무게중심, 본드 생존 비트마스크(하위 8)
	vel : vec3f,    _p : f32,      // 무게중심 속도 (본드 감쇠용)
	bonds : array<u32, 8>,         // (역참조 슬롯 << 28) | 이웃 인덱스. 0xffffffff = 빈 슬롯
};
`;

	// ── 격자 클리어: 셀 카운터 0 초기화 ─────────────────────────────────────
	const GRID_CLEAR = GRID_CONST + /* wgsl */`
@group(0) @binding(0) var<storage, read_write> gridCount : array<atomic<u32>>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid : vec3u) {
	if (gid.x < CELLS) { atomicStore(&gridCount[gid.x], 0u); }
}
`;

	// ── 격자 빌드: 스플랫 → 셀 슬롯 등록 ───────────────────────────────────
	const GRID_BUILD = SPLAT_STRUCT + SIM_PARAMS + GRID_CONST + /* wgsl */`
@group(0) @binding(0) var<storage, read> splats : array<Splat>;
@group(0) @binding(1) var<uniform> P : SimParams;
@group(0) @binding(2) var<storage, read_write> gridCount : array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> gridSlots : array<u32>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid : vec3u) {
	let i = gid.x;
	if (i >= P.count) { return; }
	let c = vec3i(floor((splats[i].pos - P.gridOrigin) / P.cellSize));
	if (all(c >= vec3i(0)) && all(c < vec3i(GD))) {
		let cidx = u32(c.x) + u32(c.y) * GDU + u32(c.z) * GDU * GDU;
		let slot = atomicAdd(&gridCount[cidx], 1u);
		if (slot < SLOTS) { gridSlots[cidx * SLOTS + slot] = i; }
	}
}
`;

	// ── 시뮬 패스: L1 자율 + L2 이웃 + L4 성장/연소 + L5 개체 간 열 전달 + L6 뼈대 SDF 살 ──
	const SIM = SPLAT_STRUCT + SIM_PARAMS + ENTITY_STRUCT + GRID_CONST + /* wgsl */`
@group(0) @binding(0) var<storage, read_write> splats : array<Splat>;
@group(0) @binding(1) var<uniform> P : SimParams;
@group(0) @binding(2) var<storage, read_write> gridCount : array<atomic<u32>>;
@group(0) @binding(3) var<storage, read> gridSlots : array<u32>;
@group(0) @binding(4) var<storage, read> rest : array<vec4f>; // L4: xyz=부착점, w=성장 시점
@group(0) @binding(5) var<storage, read> entities : array<Entity>;
@group(0) @binding(6) var<storage, read> bones : array<vec4f>; // L6: [2i]=(a.xyz, r1), [2i+1]=(b.xyz, r2)
// S2 지형: collider 메시에서 CPU 베이크한 heightfield (r32float) — 무대와의 유일한 접점.
// 없으면 1×1 더미 + on=0 → 평면 바닥(floorY) 폴백 (engine.js setHeightfield)
@group(0) @binding(7) var hfTex : texture_2d<f32>;
@group(0) @binding(8) var<uniform> HF : HfParams;

struct HfParams {
	origin : vec2f, cell : f32, res : f32, // 월드 xz 원점, 텍셀 크기, 한 변 텍셀 수
	on : f32, _h1 : f32, _h2 : f32, _h3 : f32,
};

// 지형 높이 — r32float 는 필터 불가라 수동 bilinear (가장자리는 clamp = 지형 연장)
fn terrainH(xz : vec2f) -> f32 {
	if (HF.on < 0.5) { return P.floorY; }
	let uv = clamp((xz - HF.origin) / HF.cell, vec2f(0.0), vec2f(HF.res - 2.0));
	let i0 = vec2i(floor(uv));
	let f = uv - floor(uv);
	let h00 = textureLoad(hfTex, i0, 0).r;
	let h10 = textureLoad(hfTex, i0 + vec2i(1, 0), 0).r;
	let h01 = textureLoad(hfTex, i0 + vec2i(0, 1), 0).r;
	let h11 = textureLoad(hfTex, i0 + vec2i(1, 1), 0).r;
	return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
}

// 1D → 3D 해시 (Hoskins)
fn hash31(p : f32) -> vec3f {
	var q = fract(vec3f(p) * vec3f(0.1031, 0.1030, 0.0973));
	q += dot(q, q.yzx + 33.33);
	return fract((q.xxy + q.yzz) * q.zyx);
}

// 사인 합성 난류장 — 저비용 근사 (발산 없는 진짜 curl noise 는 로드맵)
fn flow(p : vec3f, t : f32) -> vec3f {
	var v = sin(p.yzx + vec3f(t * 0.9, t * 0.7, t * 1.1));
	v += 0.5 * sin(p.zxy * 2.3 + vec3f(1.3 + t * 1.6, 4.1 + t * 1.2, 2.2 + t * 0.8));
	v += 0.25 * sin(p * 4.9 + vec3f(t * 2.1, 1.7 + t * 1.9, 3.9 + t * 1.4));
	return v;
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid : vec3u) {
	let i = gid.x;
	if (i >= P.count) { return; }
	let E = entities[i / P.sliceSize];
	var s = splats[i];

	// ── L4 나무 경로: 성장(휴면 스플랫 활성화) + 연소 전파 + 재생 ──
	// 형태는 rest 골격, 시점은 birth 가 결정한다.
	if (E.growRate > 0.0) {
		let attach = rest[i].xyz;
		let birth = rest[i].w;
		var heat = s.misc.z;
		var fuel = s.misc.w;
		// 전역 성장 시계 — birth(뿌리로부터의 그래프 거리)를 지나면 깨어난다
		let myGrow = clamp((P.time * E.growRate - birth) * 4.0, 0.0, 1.0);
		if (myGrow <= 0.001) {
			s.pos = attach;
			s.vel = vec3f(0.0);
			s.misc.x = 0.0;
			splats[i] = s;
			return;
		}
		// 점화: 포인터 = 불씨 (좁은 가우시안)
		if (P.pull.w > 0.0) {
			let dv = P.pull.xyz - s.pos;
			heat += exp(-dot(dv, dv) * 8.0) * P.dt * 40.0;
		}
		// 이웃 연소 전파: 불타는 이웃(자기 개체든 불 정령이든)에 비례해 가열 — L5 통로
		if (E.flamm > 0.0 && fuel > 0.0 && heat < 1.5) {
			let ci = vec3i(floor((s.pos - P.gridOrigin) / P.cellSize));
			if (all(ci >= vec3i(1)) && all(ci <= vec3i(GD - 2))) {
				var burnN = 0.0;
				for (var dz = -1; dz <= 1; dz++) {
					for (var dy = -1; dy <= 1; dy++) {
						for (var dx = -1; dx <= 1; dx++) {
							let c = ci + vec3i(dx, dy, dz);
							let cidx = u32(c.x) + u32(c.y) * GDU + u32(c.z) * GDU * GDU;
							let cnt = min(atomicLoad(&gridCount[cidx]), SLOTS);
							for (var k = 0u; k < cnt; k++) {
								let j = gridSlots[cidx * SLOTS + k];
								if (j == i) { continue; }
								let m = splats[j].misc;
								if (m.z > 1.0 && m.w > 0.0) { burnN += 1.0; }
							}
						}
					}
				}
				heat += burnN * E.flamm * P.dt * 0.35;
			}
		}
		heat = max(heat - 0.5 * P.dt, 0.0); // 냉각
		let burning = heat > 1.0 && fuel > 0.0;
		if (burning) {
			fuel = max(fuel - P.dt * 0.35, 0.0);
			// S5 낙재: 다 타는 순간 일부(시드 확률)가 가지에서 떨어진다 — life 음수를
			// 분리 플래그로 쓴다 (나무 초기값 1e9, 나무 경로에서 달리 미사용).
			if (fuel <= 0.0 && hash31(s.misc.y * 0.173).x < 0.55) { s.life = -1.0; }
		}
		// 재생: 재가 다 식으면 시간이 흐른 뒤 새잎이 돋는다 — 낙재는 가지로 복귀
		if (fuel <= 0.0 && heat < 0.5) {
			s.age += P.dt;
			if (s.age > E.lifeBase) {
				fuel = 1.0; heat = 0.0; s.age = 0.0;
				if (s.life < 0.0) { s.life = 1e9; s.pos = attach; s.vel = vec3f(0.0); }
			}
		}
		if (s.life < 0.0) {
			// 낙재 운동: 부착 스프링 없음 — 불씨로 떨어져(초기엔 heat 잔광) 지면에 붙는다.
			// L4 는 조기 return 이라 공통 바닥 코드를 안 지나므로 지면 부착을 여기서 처리.
			s.vel = (s.vel + vec3f(0.0, -3.0, 0.0) * P.dt) * exp(-1.5 * P.dt);
			s.pos += s.vel * P.dt;
			let g4 = terrainH(s.pos.xz);
			if (s.pos.y < g4 + 0.01) { s.pos.y = g4 + 0.01; s.vel = vec3f(0.0); }
		} else {
			// 운동: 부착 스프링 + 바람 — 가지끝(birth 큼)일수록 스프링이 유연해 크게 흔들린다.
			// 이 유연성 차이가 속도 팔레트를 통해 잎/줄기 색 분화를 만든다 (창발 색).
			var acc = (attach - s.pos) * (50.0 - 35.0 * birth);
			acc += flow(s.pos * E.flowFreq, P.time * E.flowSpeed) * E.volatility * (0.2 + 1.3 * birth);
			if (burning) {
				// 불길: 상승 + 거센 난류 (부착은 유지 — 나무가 무너지지는 않는다)
				acc += vec3f(0.0, 2.5, 0.0) + flow(s.pos * 3.0, P.time * 2.5) * 4.0;
			}
			s.vel = (s.vel + acc * P.dt) * exp(-E.damping * P.dt);
			let spd = length(s.vel);
			if (spd > 10.0) { s.vel *= 10.0 / spd; }
			s.pos += s.vel * P.dt;
		}
		// 재(fuel 0)는 어둡고 작게 남는다 — 검게 탄 가지
		s.misc = vec4f(myGrow * (0.35 + 0.65 * step(0.01, fuel)), s.misc.y, heat, fuel);
		splats[i] = s;
		return;
	}

	if (E.mortality > 0.5) {
		// 필멸 개체(불꽃 등): 세대 교대 + 에너지 곡선
		s.age += P.dt;
		if (s.age >= s.life) {
			// 수명 종료 → 코어 주변에서 재생성
			let r = hash31(f32(i) * 0.719 + fract(P.time) * 113.1) * 2.0 - 1.0;
			s.pos = E.emitter + r * E.emitRadius;
			s.vel = vec3f(0.0);
			s.age = 0.0;
			s.life = E.lifeBase * (0.5 + hash31(f32(i) * 1.37 + s.misc.y).x);
		}
		let u = s.age / s.life;
		s.misc.x = smoothstep(0.0, 0.15, u) * (1.0 - smoothstep(0.65, 1.0, u));
	} else {
		// 불멸 개체(슬라임·액체): 물질 보존 — 죽지 않고 에너지 일정
		s.misc.x = 1.0;
	}

	// L5 발열원: 불 정령 등 — 자기 스플랫이 열을 띠어 이웃 개체(나무)를 점화한다
	if (E.heatEmit > 0.0) { s.misc.z = E.heatEmit * s.misc.x; }

	// L1 규칙: 구심(응집) + 난류(휘발) + 부력(상승) + 중력
	let toCore = E.emitter - s.pos;
	var acc = toCore * E.cohesion;
	acc += flow(s.pos * E.flowFreq, P.time * E.flowSpeed) * E.volatility;
	acc.y += E.updraft - E.gravity;

	// 포인터 인력 (Alt+드래그): 좁은 가우시안 감쇠(σ≈0.4) — 덩어리 일부만 집어 뜯는 손
	if (P.pull.w > 0.0) {
		let d = P.pull.xyz - s.pos;
		acc += d * P.pull.w * exp(-dot(d, d) * 3.0);
	}

	// L6 규칙: 뼈대 살 — 스플랫은 *제 뼈*(rest.w, 부피 가중 친화) 위의 개인 성장 자리로
	// 끌려간다. 자리는 시드가 정하는 (축 위치 t, 방위각 θ, 깊이 u) — hikito-flesh 가 SDF 로
	// 그리는 taper 캡슐 부피를 매개변수로 샘플한 것과 동치이고, L4 나무의 rest 부착점과
	// 같은 원리를 *현재 뼈 포즈에서 매 프레임 유도*한다 (바인드 포즈 저장 없음 = 스키닝 없음).
	// 전역 SDF 최근접만 쓰면 축 방향 힘이 0 이라 중력에 뼈 끝으로 흘러 방울로 뭉친다 —
	// 개인 자리가 온몸 분포를 보장하고, 뼈가 움직이면 그 뼈의 살이 지연 추종한다(출렁임).
	let nb = u32(P.boneCount);
	if (E.fleshK > 0.0 && nb > 0u) {
		let bi = min(u32(rest[i].w), nb - 1u);
		let A = bones[bi * 2u];
		let B = bones[bi * 2u + 1u];
		let ba = B.xyz - A.xyz;
		let bl = max(length(ba), 1e-5);
		let axis = ba / bl;
		// 시드 → 성장 자리 (스플랫마다 고정): 축 t 균등, 방위 θ 균등, 단면 원판 균등(√u).
		// 축 구간을 [-r1, bl+r2] 로 확장해 양끝 *반구 캡*까지 샘플한다 (진짜 캡슐) —
		// 캡이 없으면 머리·손끝이 뭉툭한 원기둥으로 잘려 얼굴이 공 모양이 되지 않는다.
		let h = hash31(s.misc.y + f32(bi) * 0.317);
		let tx = h.x * (bl + A.w + B.w) - A.w; // 축 좌표 ∈ [-r1, bl+r2]
		var Rt : f32;
		if (tx < 0.0) { Rt = sqrt(max(A.w * A.w - tx * tx, 0.0)); }               // 캡 A: 구 단면
		else if (tx > bl) { let e = tx - bl; Rt = sqrt(max(B.w * B.w - e * e, 0.0)); } // 캡 B
		else { Rt = mix(A.w, B.w, tx / bl); }                                     // 몸통: taper
		let rr = Rt * sqrt(h.y);
		// 뼈 축 수직 기저 — 상수 기준축(어느 뼈와도 평행하지 않게 기울임)이라 포즈 변화에 연속
		let e1 = normalize(cross(axis, vec3f(0.402, 0.618, 0.675)));
		let e2 = cross(axis, e1);
		let th = h.z * 6.2831853;
		let site = A.xyz + axis * tx + (e1 * cos(th) + e2 * sin(th)) * rr;
		// 자리 스프링 — 오차 클램프로 원거리 응축(성장) 시 힘 폭주 방지
		var dv = site - s.pos;
		let dl = length(dv);
		if (dl > 0.9) { dv *= 0.9 / dl; }
		acc += dv * E.fleshK;
	}

	// L2 규칙: 이웃 응집/분리/점성 — 형태(방울·젤리)가 여기서 창발한다
	if (E.binding > 0.0) {
		let ci = vec3i(floor((s.pos - P.gridOrigin) / P.cellSize));
		if (all(ci >= vec3i(1)) && all(ci <= vec3i(GD - 2))) {
			let reach = min(E.reach, P.cellSize);
			var fsum = vec3f(0.0);
			var vsum = vec3f(0.0);
			var wsum = 0.0;
			for (var dz = -1; dz <= 1; dz++) {
				for (var dy = -1; dy <= 1; dy++) {
					for (var dx = -1; dx <= 1; dx++) {
						let c = ci + vec3i(dx, dy, dz);
						let cidx = u32(c.x) + u32(c.y) * GDU + u32(c.z) * GDU * GDU;
						let cnt = min(atomicLoad(&gridCount[cidx]), SLOTS);
						for (var k = 0u; k < cnt; k++) {
							let j = gridSlots[cidx * SLOTS + k];
							if (j == i) { continue; }
							let d = splats[j].pos - s.pos;
							let r = length(d);
							if (r < reach && r > 1e-5) {
								// 휴지 간격보다 가까우면 반발(비압축), 멀면 인력(표면장력)
								var m = r / reach - E.restDist;
								if (m < 0.0) { m *= 4.0; }
								fsum += (d / r) * m;
								vsum += splats[j].vel;
								wsum += 1.0;
							}
						}
					}
				}
			}
			// 이웃 힘 크기 캡 — 초기 과밀(수십 개 중첩 반발)에서도 폭발하지 않게
			var fn2 = fsum * E.binding;
			let fl = length(fn2);
			if (fl > 80.0) { fn2 *= 80.0 / fl; }
			acc += fn2;
			if (wsum > 0.0) {
				// 점성: 이웃 평균 속도로 이완
				s.vel += ((vsum / wsum) - s.vel) * min(E.viscosity * P.dt, 1.0);
			}
		}
	}

	s.vel = (s.vel + acc * P.dt) * exp(-E.damping * P.dt);
	// 속도 상한 — 수치 안정 가드 (셀 크기 대비 과속 이동은 이웃 탐색도 깨뜨림)
	let sp = length(s.vel);
	if (sp > 10.0) { s.vel *= 10.0 / sp; }
	s.pos += s.vel * P.dt;

	// 바닥: 평면(floorY) 또는 S2 지형 heightfield — 법선 기준 감쇠 반사 + 접선 마찰
	// (평면일 때 법선 (0,1,0) 이라 기존 거동과 정확히 일치: y 반사 -0.25, xz 마찰 exp(-6dt))
	let ground = terrainH(s.pos.xz);
	if (s.pos.y < ground) {
		s.pos.y = ground;
		var nrm = vec3f(0.0, 1.0, 0.0);
		if (HF.on > 0.5) {
			// 중앙 차분 기울기 → 표면 법선: 경사면에서 반사·마찰이 비탈을 따르게 (흘러내림)
			let e = HF.cell;
			let hx = terrainH(s.pos.xz + vec2f(e, 0.0)) - terrainH(s.pos.xz - vec2f(e, 0.0));
			let hz = terrainH(s.pos.xz + vec2f(0.0, e)) - terrainH(s.pos.xz - vec2f(0.0, e));
			nrm = normalize(vec3f(-hx, 2.0 * e, -hz));
		}
		let vn = dot(s.vel, nrm);
		let vt = s.vel - nrm * vn;
		s.vel = vt * exp(-6.0 * P.dt) + nrm * select(vn, vn * -0.25, vn < 0.0);
	}

	splats[i] = s;
}
`;

	// ── 클러스터 패스 (L3): shape matching + 본드 골격 — 골렘의 뼈대 ────────
	// 워크그룹 하나가 클러스터(스플랫 256개) 하나를 담당. 공유 메모리 리덕션으로
	// 무게중심과 변형 행렬 A 를 구하고, 회전을 추출해 강체 목표 자세로 복원한다.
	// 본드는 클러스터 무게중심 간 스프링+감쇠 — 변형률 > 인성이면 파단,
	// 거리+방향이 휴지 배치와 일치하면 재결합. 힘은 양측 생존 시에만 발생.
	const CLUSTER = SPLAT_STRUCT + SIM_PARAMS + ENTITY_STRUCT + CLUSTER_STRUCT + /* wgsl */`
@group(0) @binding(0) var<storage, read_write> splats : array<Splat>;
@group(0) @binding(1) var<uniform> P : SimParams;
@group(0) @binding(2) var<storage, read> rest : array<vec4f>; // 휴지 오프셋 q0 (클러스터 restCom 기준)
@group(0) @binding(3) var<storage, read_write> clusters : array<Cluster>;
@group(0) @binding(4) var<storage, read> entities : array<Entity>;

var<workgroup> sh : array<vec4f, K>; // 리덕션 작업 공간 (com, A 열 3개 순차 재사용)
var<workgroup> shCom : vec3f;
var<workgroup> shR : mat3x3f;        // 추출된 회전
var<workgroup> shBondAcc : vec3f;    // 본드 스프링 가속 (클러스터 전체 공유)

fn quatMul(a : vec4f, b : vec4f) -> vec4f {
	return vec4f(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz));
}
fn quatMat(q : vec4f) -> mat3x3f {
	let x = q.x; let y = q.y; let z = q.z; let w = q.w;
	return mat3x3f(
		vec3f(1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y + w * z), 2.0 * (x * z - w * y)),
		vec3f(2.0 * (x * y - w * z), 1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z + w * x)),
		vec3f(2.0 * (x * z + w * y), 2.0 * (y * z - w * x), 1.0 - 2.0 * (x * x + y * y)));
}

@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wid : vec3u, @builtin(local_invocation_id) lid : vec3u) {
	let ci = wid.x;
	let i = ci * K + lid.x;
	// eid 는 lid 와 무관하게 계산 — 조기 return 이 워크그룹 균일해야 barrier 가 성립
	// (sliceSize 는 K 의 배수를 engine 이 보장)
	let E = entities[(ci * K) / P.sliceSize];
	if (E.rigid <= 0.0) { return; } // 강성 없는 개체는 클러스터 규칙 없음
	let p = splats[i].pos;
	let q0 = rest[i].xyz;

	// 1) 무게중심 리덕션
	sh[lid.x] = vec4f(p, 0.0);
	workgroupBarrier();
	for (var st = K / 2u; st > 0u; st >>= 1u) {
		if (lid.x < st) { sh[lid.x] += sh[lid.x + st]; }
		workgroupBarrier();
	}
	if (lid.x == 0u) { shCom = sh[0].xyz / f32(K); }
	workgroupBarrier();
	let d = p - shCom;

	// 2) 변형 행렬 A = Σ d·q0ᵀ — 열 단위 3회 리덕션
	var A : mat3x3f;
	for (var j = 0u; j < 3u; j++) {
		sh[lid.x] = vec4f(d * q0[j], 0.0);
		workgroupBarrier();
		for (var st = K / 2u; st > 0u; st >>= 1u) {
			if (lid.x < st) { sh[lid.x] += sh[lid.x + st]; }
			workgroupBarrier();
		}
		if (lid.x == 0u) { A[j] = sh[0].xyz; }
		workgroupBarrier();
	}

	// 3) 회전 추출 + 본드 처리 — thread 0 단독 (클러스터당 스칼라 작업)
	if (lid.x == 0u) {
		var cl = clusters[ci];
		// Müller 회전 추출: 이전 프레임 쿼터니언에서 반복 수렴
		var q = cl.quat;
		for (var it = 0; it < 8; it++) {
			let R = quatMat(q);
			let denom = abs(dot(R[0], A[0]) + dot(R[1], A[1]) + dot(R[2], A[2])) + 1e-9;
			let omega = (cross(R[0], A[0]) + cross(R[1], A[1]) + cross(R[2], A[2])) / denom;
			let w = length(omega);
			if (w < 1e-6) { break; }
			q = normalize(quatMul(vec4f(omega / w * sin(0.5 * w), cos(0.5 * w)), q));
		}
		shR = quatMat(q);

		// 본드: 스프링 + 감쇠 + 파단 + 재결합. 이웃 com/vel 은 프레임 혼재(Jacobi 근사) 허용.
		let myVel = (shCom - cl.com) / max(P.dt, 1e-4);
		let bondDamp = 0.4 * sqrt(max(E.bondK, 0.0)); // 본드당 감쇠 — 6~8개 합산 시 임계 감쇠 근방
		var acc = vec3f(0.0);
		var maxStrain = 0.0;
		var flags = cl.flags;
		for (var b = 0u; b < 8u; b++) {
			let entry = cl.bonds[b];
			if (entry == 0xffffffffu) { continue; }
			let nIdx = entry & 0x0fffffffu;
			let revBit = 1u << (entry >> 28u); // 상대 쪽에서 나를 가리키는 본드 비트
			let restOff = clusters[nIdx].restCom - cl.restCom;
			let restLen = length(restOff) + 1e-6;
			let actual = clusters[nIdx].com - shCom;
			if ((flags & (1u << b)) != 0u) {
				let err = actual - shR * restOff;
				let strain = length(err) / restLen;
				if (strain > E.toughness) {
					flags &= ~(1u << b); // 파단 — 균열이 생긴다
				} else if ((clusters[nIdx].flags & revBit) != 0u) {
					// 양측 생존 시에만 힘 발생 — 한쪽 스프링은 쌍에 운동량을 주입한다
					acc += err * E.bondK + (clusters[nIdx].vel - myVel) * bondDamp;
					maxStrain = max(maxStrain, strain);
				}
			} else {
				// 재흡수: 거리 + *방향* 이 휴지 배치와 일치할 때만 재결합
				// (방향 없이 거리만 보면 무너진 더미도 안정 구조로 재용접된다)
				let al = length(actual) + 1e-6;
				let restDir = shR * restOff / restLen;
				if (abs(al - restLen) < 0.12 * restLen + 0.04 &&
					dot(actual / al, restDir) > 0.85) {
					flags |= (1u << b);
				}
			}
		}
		shBondAcc = acc;
		cl.quat = q;
		cl.com = shCom;
		cl.vel = myVel;
		cl.strain = maxStrain;
		cl.flags = flags;
		clusters[ci] = cl;
	}
	workgroupBarrier();

	// 4) 전 스레드: 강체 목표 자세로 복원 + 본드 가속 적용
	var s = splats[i];
	let goal = shCom + shR * q0;
	let corr = (goal - s.pos) * E.rigid;
	s.pos += corr;
	// 속도 킥은 약하게 — 강한 킥은 본드 스프링과 공진해 골격을 무너뜨린다
	s.vel += corr * (0.15 / max(P.dt, 1e-4));
	s.vel += shBondAcc * P.dt;
	splats[i] = s;
}
`;

	// ── 키 패스: 뷰 깊이 → 정렬 가능 uint 키 ────────────────────────────────
	const KEY = SPLAT_STRUCT + /* wgsl */`
struct KeyParams {
	viewRowZ : vec4f, // view 행렬의 z-행 (column-major 의 m[2],m[6],m[10],m[14])
	count : u32, _p0 : u32, _p1 : u32, _p2 : u32,
};
@group(0) @binding(0) var<storage, read> splats : array<Splat>;
@group(0) @binding(1) var<storage, read_write> pairs : array<vec2u>;
@group(0) @binding(2) var<uniform> P : KeyParams;

// IEEE754 float → 단조 증가 uint (음수 구간 반전)
fn orderable(f : f32) -> u32 {
	let b = bitcast<u32>(f);
	return select(b ^ 0x80000000u, ~b, (b & 0x80000000u) != 0u);
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid : vec3u) {
	let i = gid.x;
	if (i >= P.count) { return; }
	// 카메라 앞 = 음수 z. 오름차순 정렬 = far → near (back-to-front)
	let z = dot(P.viewRowZ, vec4f(splats[i].pos, 1.0));
	pairs[i] = vec2u(orderable(z), i);
}
`;

	// ── 정렬 패스: 바이토닉 compare-exchange 한 단계 (k, j 는 동적 오프셋 유니폼) ──
	const SORT = /* wgsl */`
struct SortParams { k : u32, j : u32, _p0 : u32, _p1 : u32 };
@group(0) @binding(0) var<storage, read_write> pairs : array<vec2u>;
@group(0) @binding(1) var<uniform> P : SortParams;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid : vec3u) {
	let i = gid.x;
	let ixj = i ^ P.j;
	if (ixj <= i || ixj >= arrayLength(&pairs)) { return; }
	let a = pairs[i];
	let b = pairs[ixj];
	// (i & k) == 0 구간은 오름차순, 아니면 내림차순
	if ((a.x > b.x) == ((i & P.k) == 0u)) {
		pairs[i] = b;
		pairs[ixj] = a;
	}
}
`;

	// ── 렌더 패스: 시뮬 상태 → 스플랫 유도 → EWA 투영 래스터 ────────────────
	// R1 조명: 살(fleshK>0)은 제 뼈 축에서 법선을 *매 프레임 유도*해(저장 없음 — 스키닝 없음
	// 원칙과 동형) linear 공간에서 셰이딩하고 톤맵한다. 빛은 뼈대·heightfield 처럼 환경 *입력*.
	// R2 형상: 살 스플랫은 법선으로 납작한 디스크(surfel) — 표면이 서고 실루엣이 조여진다.
	// 비-살 개체(fleshK=0)는 기존 발광 경로 그대로 (회귀 0).
	const RENDER = SPLAT_STRUCT + ENTITY_STRUCT + CLUSTER_STRUCT + /* wgsl */`
struct CamParams {
	view : mat4x4f,
	proj : mat4x4f,
	viewport : vec2f, focal : vec2f,
	sliceSize : u32, boneCount : u32, _c1 : u32, _c2 : u32,
	fog : vec4f,      // T5: rgb=fogColor, a=fogAmount(0=off)
	fogRange : vec4f, // x=start(거리), y=end(완전 fog)
	light : vec4f,       // R1: xyz=키 라이트 방향(월드), w=강도(0=조명 끔 → 발광 폴백)
	lightColor : vec4f,  // R1: rgb=키 라이트 색
	skyColor : vec4f,    // R1: rgb=하늘 앰비언트, a=앰비언트 강도
	groundColor : vec4f, // R1: rgb=지면 앰비언트
};
@group(0) @binding(0) var<storage, read> splats : array<Splat>;
@group(0) @binding(1) var<storage, read> pairs : array<vec2u>;
@group(0) @binding(2) var<uniform> C : CamParams;
@group(0) @binding(3) var<storage, read> clusters : array<Cluster>;
@group(0) @binding(4) var<storage, read> entities : array<Entity>;
// S3 오클루전: collider depth prepass 결과 — 생명이 지형 뒤에 있으면 soft fade.
// occluder 미설치 프레임도 prepass 가 1.0 으로 클리어하므로 자연히 무효과.
@group(0) @binding(5) var occDepth : texture_depth_2d;
// C3 부위 채색: 살(fleshK>0) 스플랫의 그룹 램프. rest.w=뼈 친화 → boneGroup=그룹 id →
// groupColors 램프 양 끝. 보간 factor 는 유도값 — 살은 뼈 축 위치(tAx), 비-살은 속도·변형률(heat).
@group(0) @binding(6) var<storage, read> rest : array<vec4f>;        // L6 살 뼈 친화(.w)
@group(0) @binding(7) var<storage, read> boneGroup : array<u32>;     // 뼈 인덱스 → 부위 그룹 id
@group(0) @binding(8) var<storage, read> groupColors : array<vec4f>; // 그룹 램프 [2g]=A, [2g+1]=B
// R1: 뼈 세그먼트 — 살 법선·접선의 유일한 형태 근거 (SIM 과 같은 테이블)
@group(0) @binding(9) var<storage, read> bones : array<vec4f>;       // [2i]=(a.xyz,r1), [2i+1]=(b.xyz,r2)

// 1D → 3D 해시 (Hoskins) — SIM 과 동일 정식. 자리 깊이 시드(h.y) 재유도(유사 AO)용.
fn hash31(p : f32) -> vec3f {
	var q = fract(vec3f(p) * vec3f(0.1031, 0.1030, 0.0973));
	q += dot(q, q.yzx + 33.33);
	return fract((q.xxy + q.yzz) * q.zyx);
}

struct VOut {
	@builtin(position) pos : vec4f,
	@location(0) col : vec4f,   // premultiplied 전 단계 (rgb, alpha)
	@location(1) quad : vec2f,  // 가우시안 로컬 좌표 [-2, 2]
	@location(2) viewZ : f32,   // 뷰 공간 거리 — VS 가 NDC z 를 0 고정하므로 별도 전달
};

@vertex
fn vs(@builtin(vertex_index) vi : u32, @builtin(instance_index) ii : u32) -> VOut {
	var o : VOut;
	o.pos = vec4f(0.0, 0.0, 2.0, 1.0); // 퇴화 기본값 (네 꼭짓점 동일 → 래스터 없음)
	o.col = vec4f(0.0);
	o.quad = vec2f(0.0);
	o.viewZ = 0.0;

	let idx = pairs[ii].y;
	let s = splats[idx];
	let E = entities[idx / C.sliceSize];
	let energy = s.misc.x;
	let alpha = energy * E.opacity;
	if (alpha < 0.004) { return o; }

	let t4 = C.view * vec4f(s.pos, 1.0);
	let t = t4.xyz;
	if (t.z > -0.05) { return o; } // 카메라 뒤/근접 컬

	// ── 시뮬 상태 → 3D 공분산 유도 ──
	let speed = length(s.vel);
	let elong = 1.0 + E.stretch * speed;
	let base = E.size * (0.35 + 0.65 * energy); // 에너지로 크기 맥동
	let isFlesh = E.fleshK > 0.0 && C.boneCount > 0u;
	let lit = isFlesh && C.light.w > 0.0;

	// R1 살 법선: 제 뼈(rest.w) 축 위 최근접점에서의 방사 방향 — 현재 위치 기준이라
	// 지연 추종(출렁임)까지 법선에 실린다. 캡슐 끝단(t 클램프)은 구면 법선으로 자연 연속.
	var nrm = vec3f(0.0, 1.0, 0.0);
	var axis = vec3f(0.0, 1.0, 0.0);
	var bi = 0u;
	var tAx = 0.0; // 뼈 축 위 위치 (0=부모 관절, 1=자식 관절) — 살 램프의 보간 인자
	if (isFlesh) {
		bi = min(min(u32(rest[idx].w), C.boneCount - 1u), 511u); // 511 = MAX_BONES-1 동기
		let A = bones[bi * 2u].xyz;
		let ba = bones[bi * 2u + 1u].xyz - A;
		let bl2 = max(dot(ba, ba), 1e-9);
		axis = ba * inverseSqrt(bl2);
		tAx = clamp(dot(s.pos - A, ba) / bl2, 0.0, 1.0);
		let dv = s.pos - (A + ba * tAx);
		let dl = length(dv);
		if (dl > 1e-5) { nrm = dv / dl; }
	}

	var M : mat3x3f;
	if (isFlesh) {
		// R2 surfel: 법선으로 납작(두께 0.55 — 더 얇으면 실루엣에서 edge-on 디스크가 보풀로
		// 곤두선다), 접선1 = 뼈 축의 접평면 사영(해부학적 결), 접선2 = 원주 방향.
		// 속도 신축은 접평면 안에서 유지하되 클램프 — 출렁임 속도가 살을 털처럼 세우지 않게.
		let elongF = min(elong, 1.6);
		var t1 = axis - nrm * dot(axis, nrm);
		let t1l = length(t1);
		if (t1l > 1e-4) { t1 /= t1l; } else { t1 = normalize(cross(nrm, vec3f(0.402, 0.618, 0.675))); }
		let t2 = cross(nrm, t1);
		M = mat3x3f(t1 * (base * elongF), t2 * (base * inverseSqrt(elongF)), nrm * (base * 0.55));
	} else {
		// 기존 속도 방향 정렬 이방성 (비-살 회귀 0): 빠를수록 진행 방향으로 늘어난다
		var e0 = vec3f(0.0, 1.0, 0.0);
		if (speed > 1e-4) { e0 = s.vel / speed; }
		var upv = vec3f(0.0, 1.0, 0.0);
		if (abs(e0.y) > 0.9) { upv = vec3f(1.0, 0.0, 0.0); }
		let e1 = normalize(cross(e0, upv));
		let e2 = cross(e0, e1);
		M = mat3x3f(e0 * (base * elong), e1 * (base * inverseSqrt(elong)), e2 * (base * inverseSqrt(elong)));
	}
	let Vrk = M * transpose(M); // Σ = M·Mᵀ

	// ── EWA 2D 투영 (HktGaussianSplat/Web 과 동일 정식) ──
	let J = mat3x3f(
		vec3f(C.focal.x / t.z, 0.0, -(C.focal.x * t.x) / (t.z * t.z)),
		vec3f(0.0, -C.focal.y / t.z, (C.focal.y * t.y) / (t.z * t.z)),
		vec3f(0.0, 0.0, 0.0));
	let W = mat3x3f(C.view[0].xyz, C.view[1].xyz, C.view[2].xyz);
	let T = transpose(W) * J;
	var cov = transpose(T) * Vrk * T;
	cov[0][0] += 0.3; // 픽셀 저역 필터
	cov[1][1] += 0.3;

	let mid = 0.5 * (cov[0][0] + cov[1][1]);
	let dif = 0.5 * (cov[0][0] - cov[1][1]);
	let radius = sqrt(dif * dif + cov[0][1] * cov[0][1]);
	let l1 = mid + radius;
	let l2 = max(mid - radius, 0.0);
	if (l1 < 0.02) { return o; } // 서브픽셀 컬

	var diag = vec2f(cov[0][1], l1 - cov[0][0]);
	let dl = length(diag);
	if (dl < 1e-6) { diag = vec2f(1.0, 0.0); } else { diag /= dl; }
	let major = min(sqrt(2.0 * l1), 1024.0) * diag;
	let minor = min(sqrt(2.0 * l2), 1024.0) * vec2f(diag.y, -diag.x);

	let clip = C.proj * t4;
	let cNdc = clip.xy / clip.w;
	let corner = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 4.0 - 2.0; // {-2,+2} 쿼드
	o.pos = vec4f(cNdc + corner.x * major / C.viewport + corner.y * minor / C.viewport, 0.0, 1.0);
	o.quad = corner;
	o.viewZ = -t.z; // 카메라 앞 = 음수 뷰 z → 양수 거리

	// ── 시뮬 상태 → 색 유도: 속도·본드 변형률이 열(팔레트 보간), 에너지가 발광 ──
	// 변형률 발광: 골렘의 균열(스트레스 받는 본드)이 뜨겁게 빛난다
	let strain = clusters[idx / K].strain;
	let heat = clamp(1.0 - exp(-0.5 * speed) + max(strain - 0.25, 0.0) * 1.4, 0.0, 1.0);
	// C3: 살은 뼈 그룹 램프의 양 끝(게놈)으로 채색, 비-살은 개체 팔레트 그대로.
	// 램프 양 끝만 게놈이 정하고 보간 factor(heat)는 유도 → 속도 팔레트 유도 회귀 없음.
	var cA = E.colorA.rgb;
	var cB = E.colorB.rgb;
	if (E.fleshK > 0.0) {
		let g = boneGroup[min(u32(rest[idx].w), 511u)]; // 511 = engine.js MAX_BONES-1 과 동기
		cA = groupColors[g * 2u].rgb;
		cB = groupColors[g * 2u + 1u].rgb;
	}
	// 램프 보간 인자 — 비-살: 속도·변형률(heat). 살: 뼈 축 위 위치(tAx, 부모→자식) —
	// 소매 끝·반바지 밑단 같은 *의상 경계*가 축 그라데이션으로 생긴다 (여전히 유도값, 원칙 1).
	var f = heat;
	if (isFlesh) { f = tAx; }
	var rgb = mix(cA, cB, f);
	if (lit) {
		// R1 조명 합성 (linear 공간): 램프는 albedo — sRGB→linear 근사(γ2).
		let albedo = rgb * rgb;
		// 유사 AO: 자리 깊이 시드(h.y, SIM 과 동일 해시) — 살 내부 스플랫이 어둡다(오목부 음영).
		// 대비를 세게 주면 표면 틈으로 내부 스플랫이 점박이로 비친다 — 완만하게.
		let h = hash31(s.misc.y + f32(bi) * 0.317);
		let ao = 0.62 + 0.38 * sqrt(h.y);
		let L = normalize(C.light.xyz);
		// half-Lambert wrap: 명암 경계를 부드럽게 (피부) — wrap 은 재질 유전자
		let ndl = clamp((dot(nrm, L) + E.wrap) / (1.0 + E.wrap), 0.0, 1.0);
		// 반구 앰비언트: 위=하늘, 아래=지면 — 기본 부피감의 바탕
		let hemi = mix(C.groundColor.rgb, C.skyColor.rgb, nrm.y * 0.5 + 0.5) * C.skyColor.a;
		// 카메라 위치 = -Rᵀt (world→view 역산) — 스펙큘러·림의 시선
		let R3 = mat3x3f(C.view[0].xyz, C.view[1].xyz, C.view[2].xyz);
		let Vv = normalize(-(transpose(R3) * C.view[3].xyz) - s.pos);
		let spec = pow(clamp(dot(nrm, normalize(Vv + L)), 0.0, 1.0), max(E.specPow, 1.0)) * E.spec * ndl;
		let fres = pow(1.0 - clamp(dot(nrm, Vv), 0.0, 1.0), 3.0) * E.rim;
		var lin = albedo * (hemi + C.lightColor.rgb * (C.light.w * ndl)) * ao
			+ C.lightColor.rgb * spec + C.skyColor.rgb * fres
			+ albedo * (E.luminosity * energy); // 자가 발광 잔여 (발광 개체용, 기본 0)
		// ACES 근사 톤맵 → sRGB 근사(√) — halo 억제의 1차 방어선
		lin = clamp((lin * (2.51 * lin + 0.03)) / (lin * (2.43 * lin + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
		rgb = sqrt(lin);
	} else {
		rgb *= 1.0 + E.luminosity * energy; // 기존 발광 경로 (비-살 개체 회귀 0)
	}
	// L4/L5 연소 채널: misc.z = 열(불 오버라이드), misc.w = 연료(0 = 재 → 어둡게)
	let fireHeat = clamp(s.misc.z * 0.8, 0.0, 1.3);
	if (fireHeat > 0.02) {
		rgb = mix(rgb, vec3f(1.1, 0.5, 0.15), min(fireHeat, 1.0)) * (1.0 + fireHeat);
	}
	rgb *= 0.15 + 0.85 * clamp(s.misc.w, 0.0, 1.0);
	o.col = vec4f(rgb, alpha);
	return o;
}

@fragment
fn fs(in : VOut) -> @location(0) vec4f {
	let a = -dot(in.quad, in.quad);
	if (a < -4.0) { discard; }
	// S3: collider depth 와 뷰 거리 비교 — 지형 뒤면 soft fade (경계 팝 방지 마진 0.15)
	// 깊이 선형화: viewDist = proj[3].z / (d + proj[2].z) (WebGPU z∈[0,1] 원근, math.js 참조)
	let od = textureLoad(occDepth, vec2i(in.pos.xy), 0);
	let occDist = C.proj[3].z / (od + C.proj[2].z);
	let fade = clamp(1.0 + (occDist - in.viewZ) / 0.15, 0.0, 1.0);
	// T5 원거리 fog — viewZ(양수 거리)로 fogColor 로 페이드. 무대 clear(=sky/fog 톤)와 같은
	// 색이라 두 층이 지평선에서 같은 톤으로 만난다. fogAmount 0 = off(기존 거동 불변).
	var rgb = in.col.rgb;
	if (C.fog.a > 0.0) {
		let f = clamp((in.viewZ - C.fogRange.x) / max(C.fogRange.y - C.fogRange.x, 1e-3), 0.0, 1.0) * C.fog.a;
		rgb = mix(rgb, C.fog.rgb, f);
	}
	let b = exp(a) * in.col.a * fade;
	return vec4f(rgb * b, b); // premultiplied over
}
`;

	// ── S3 오클루전 prepass: collider 메시 depth-only — 생명 가림의 유일한 근거 ──
	// 무대(Spark) 스플랫이 아니라 collider 근사를 쓰는 이유: 스플랫엔 정확한 깊이가 없다 (PLAN S3).
	const OCC = /* wgsl */`
struct CamParams {
	view : mat4x4f, proj : mat4x4f,
	viewport : vec2f, focal : vec2f,
	sliceSize : u32, _c0 : u32, _c1 : u32, _c2 : u32,
};
@group(0) @binding(0) var<storage, read> pos : array<f32>; // 삼각형 수프 (collider 원본 좌표)
@group(0) @binding(1) var<uniform> C : CamParams;
@group(0) @binding(2) var<uniform> M : mat4x4f; // 무대 정합 변환 (offset·yaw·scale·flip)
@vertex
fn vs(@builtin(vertex_index) vi : u32) -> @builtin(position) vec4f {
	let p = vec4f(pos[vi * 3u], pos[vi * 3u + 1u], pos[vi * 3u + 2u], 1.0);
	return C.proj * C.view * (M * p);
}
`;

	// ── 뼈대 오버레이: L6 디버그 시각화 — 뼈 라인 + 관절 점 (hikito-flesh 의 본 오버레이 대응) ──
	// 스플랫이 아니라 *입력*(뼈대)의 표시이므로 절대 원칙 1 과 무관. 살 위에 겹쳐 그린다.
	const OVERLAY = /* wgsl */`
struct CamParams {
	view : mat4x4f, proj : mat4x4f,
	viewport : vec2f, focal : vec2f,
	sliceSize : u32, _c0 : u32, _c1 : u32, _c2 : u32,
};
@group(0) @binding(0) var<storage, read> bones : array<vec4f>;
@group(0) @binding(1) var<uniform> C : CamParams;

// 뼈 라인: bones 는 [2i]=(a,r1), [2i+1]=(b,r2) — line-list 정점 인덱스가 그대로 끝점
@vertex
fn vsLine(@builtin(vertex_index) vi : u32) -> @builtin(position) vec4f {
	return C.proj * (C.view * vec4f(bones[vi].xyz, 1.0));
}
@fragment
fn fsLine() -> @location(0) vec4f {
	return vec4f(0.98, 0.82, 0.45, 1.0) * 0.9; // premultiplied over
}

// 관절 점: 끝점당 화면 고정 크기(±5px) 쿼드
@vertex
fn vsJoint(@builtin(vertex_index) vi : u32, @builtin(instance_index) ii : u32) -> @builtin(position) vec4f {
	var clip = C.proj * (C.view * vec4f(bones[ii].xyz, 1.0));
	if (clip.w <= 0.0) { return vec4f(0.0, 0.0, 2.0, 1.0); } // 카메라 뒤 퇴화
	let corner = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2.0 - 1.0;
	return vec4f(clip.xy + corner * (5.0 / C.viewport) * clip.w, clip.z, clip.w);
}
@fragment
fn fsJoint() -> @location(0) vec4f {
	return vec4f(1.0, 1.0, 1.0, 1.0) * 0.95;
}
`;

	global.HktGenesisWGSL = { SIM, KEY, SORT, RENDER, GRID_CLEAR, GRID_BUILD, CLUSTER, OVERLAY, OCC };
})(window);
