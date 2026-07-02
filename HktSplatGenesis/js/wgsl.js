// HktSplatGenesis — WGSL 셰이더 모음 (classic script, 전역 HktGenesisWGSL)
//
// 설계 원칙: 스플랫 = 세포. 시뮬 상태(pos/vel/age/energy)가 유일한 원본이고
// 렌더 속성(공분산·색·불투명도)은 매 프레임 셰이더에서 *유도*된다.
// 렌더 속성을 직접 만드는 코드는 어디에도 없어야 한다.

(function (global) {
	'use strict';

	// 시뮬 상태 48B/스플랫 — JS 초기화 코드(engine.js)와 바이트 일치 필수
	const SPLAT_STRUCT = /* wgsl */`
struct Splat {
	pos : vec3f,  age : f32,
	vel : vec3f,  life : f32,
	misc : vec4f, // x=energy(0..1), y=seed, z/w 예약
};
`;

	// 시뮬 유니폼 128B — engine.js frame() 의 패킹과 바이트 일치 필수
	const SIM_PARAMS = /* wgsl */`
struct SimParams {
	emitter : vec3f,    dt : f32,
	time : f32,         cohesion : f32,  volatility : f32, updraft : f32,
	damping : f32,      lifeBase : f32,  emitRadius : f32, flowFreq : f32,
	flowSpeed : f32,    count : u32,     gravity : f32,    mortality : f32,
	pull : vec4f,       // xyz = 인력점, w = 강도 (포인터 상호작용)
	gridOrigin : vec3f, cellSize : f32,
	binding : f32,      restDist : f32,  viscosity : f32,  floorY : f32,
	_pad : vec4f,
};
`;

	// 고정 격자 상수 — L2 이웃 탐색 (해시 충돌 없는 유계 dense grid + 셀당 고정 슬롯)
	const GRID_CONST = /* wgsl */`
const GD : i32 = 64;           // 격자 한 변 셀 수
const GDU : u32 = 64u;
const CELLS : u32 = 262144u;   // 64³
const SLOTS : u32 = 16u;       // 셀당 최대 기록 수 (초과분은 이웃 힘에서 누락 — 우아한 저하)
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

	// ── 시뮬 패스: per-splat 자율 규칙 (L1) + 이웃 규칙 (L2) ────────────────
	const SIM = SPLAT_STRUCT + SIM_PARAMS + GRID_CONST + /* wgsl */`
@group(0) @binding(0) var<storage, read_write> splats : array<Splat>;
@group(0) @binding(1) var<uniform> P : SimParams;
@group(0) @binding(2) var<storage, read_write> gridCount : array<atomic<u32>>;
@group(0) @binding(3) var<storage, read> gridSlots : array<u32>;

// 1D → 3D 해시 (Hoskins)
fn hash31(p : f32) -> vec3f {
	var q = fract(vec3f(p) * vec3f(0.1031, 0.1030, 0.0973));
	q += dot(q, q.yzx + 33.33);
	return fract((q.xxy + q.yzz) * q.zyx);
}

// 사인 합성 난류장 — L1 용 저비용 근사 (발산 없는 진짜 curl noise 는 L2 로드맵)
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
	var s = splats[i];

	if (P.mortality > 0.5) {
		// 필멸 개체(불꽃 등): 세대 교대 + 에너지 곡선
		s.age += P.dt;
		if (s.age >= s.life) {
			// 수명 종료 → 코어 주변에서 재생성
			let r = hash31(f32(i) * 0.719 + fract(P.time) * 113.1) * 2.0 - 1.0;
			s.pos = P.emitter + r * P.emitRadius;
			s.vel = vec3f(0.0);
			s.age = 0.0;
			s.life = P.lifeBase * (0.5 + hash31(f32(i) * 1.37 + s.misc.y).x);
		}
		let u = s.age / s.life;
		s.misc.x = smoothstep(0.0, 0.15, u) * (1.0 - smoothstep(0.65, 1.0, u));
	} else {
		// 불멸 개체(슬라임·액체): 물질 보존 — 죽지 않고 에너지 일정
		s.misc.x = 1.0;
	}

	// L1 규칙: 구심(응집) + 난류(휘발) + 부력(상승) + 중력
	let toCore = P.emitter - s.pos;
	var acc = toCore * P.cohesion;
	acc += flow(s.pos * P.flowFreq, P.time * P.flowSpeed) * P.volatility;
	acc.y += P.updraft - P.gravity;

	// 포인터 인력 (Alt+드래그): 국소 가우시안 감쇠 — 슬라임을 찢고 당기는 손
	if (P.pull.w > 0.0) {
		let d = P.pull.xyz - s.pos;
		acc += d * P.pull.w * exp(-dot(d, d) * 0.8);
	}

	// L2 규칙: 이웃 응집/분리/점성 — 형태(방울·젤리)가 여기서 창발한다
	if (P.binding > 0.0) {
		let ci = vec3i(floor((s.pos - P.gridOrigin) / P.cellSize));
		if (all(ci >= vec3i(1)) && all(ci <= vec3i(GD - 2))) {
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
							if (r < P.cellSize && r > 1e-5) {
								// 휴지 간격보다 가까우면 반발(비압축), 멀면 인력(표면장력)
								var m = r / P.cellSize - P.restDist;
								if (m < 0.0) { m *= 4.0; }
								fsum += (d / r) * m;
								vsum += splats[j].vel;
								wsum += 1.0;
							}
						}
					}
				}
			}
			acc += fsum * P.binding;
			if (wsum > 0.0) {
				// 점성: 이웃 평균 속도로 이완
				s.vel += ((vsum / wsum) - s.vel) * min(P.viscosity * P.dt, 1.0);
			}
		}
	}

	s.vel = (s.vel + acc * P.dt) * exp(-P.damping * P.dt);
	s.pos += s.vel * P.dt;

	// 바닥 (y = floorY): 감쇠 반사 + 마찰
	if (s.pos.y < P.floorY) {
		s.pos.y = P.floorY;
		if (s.vel.y < 0.0) { s.vel.y *= -0.25; }
		let fr = exp(-6.0 * P.dt);
		s.vel = vec3f(s.vel.x * fr, s.vel.y, s.vel.z * fr);
	}

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
	const RENDER = SPLAT_STRUCT + /* wgsl */`
struct CamParams {
	view : mat4x4f,
	proj : mat4x4f,
	viewport : vec2f, focal : vec2f,
	colorA : vec4f,   // 유전자 팔레트: 몸통(저속)
	colorB : vec4f,   // 유전자 팔레트: 끝(고속·고열)
	size : f32, stretch : f32, opacity : f32, luminosity : f32,
};
@group(0) @binding(0) var<storage, read> splats : array<Splat>;
@group(0) @binding(1) var<storage, read> pairs : array<vec2u>;
@group(0) @binding(2) var<uniform> C : CamParams;

struct VOut {
	@builtin(position) pos : vec4f,
	@location(0) col : vec4f,   // premultiplied 전 단계 (rgb, alpha)
	@location(1) quad : vec2f,  // 가우시안 로컬 좌표 [-2, 2]
};

@vertex
fn vs(@builtin(vertex_index) vi : u32, @builtin(instance_index) ii : u32) -> VOut {
	var o : VOut;
	o.pos = vec4f(0.0, 0.0, 2.0, 1.0); // 퇴화 기본값 (네 꼭짓점 동일 → 래스터 없음)
	o.col = vec4f(0.0);
	o.quad = vec2f(0.0);

	let idx = pairs[ii].y;
	let s = splats[idx];
	let energy = s.misc.x;
	let alpha = energy * C.opacity;
	if (alpha < 0.004) { return o; }

	let t4 = C.view * vec4f(s.pos, 1.0);
	let t = t4.xyz;
	if (t.z > -0.05) { return o; } // 카메라 뒤/근접 컬

	// ── 시뮬 상태 → 3D 공분산 유도 ──
	// 속도 방향 정렬 이방성: 빠를수록 진행 방향으로 늘어난다 (질감의 원천)
	let speed = length(s.vel);
	var e0 = vec3f(0.0, 1.0, 0.0);
	if (speed > 1e-4) { e0 = s.vel / speed; }
	let elong = 1.0 + C.stretch * speed;
	let base = C.size * (0.35 + 0.65 * energy); // 에너지로 크기 맥동
	let sAlong = base * elong;
	let sPerp = base * inverseSqrt(elong); // 부피 근사 보존
	var upv = vec3f(0.0, 1.0, 0.0);
	if (abs(e0.y) > 0.9) { upv = vec3f(1.0, 0.0, 0.0); }
	let e1 = normalize(cross(e0, upv));
	let e2 = cross(e0, e1);
	let M = mat3x3f(e0 * sAlong, e1 * sPerp, e2 * sPerp);
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

	// ── 시뮬 상태 → 색 유도: 속도가 열(팔레트 보간), 에너지가 발광 ──
	let heat = 1.0 - exp(-0.5 * speed);
	var rgb = mix(C.colorA.rgb, C.colorB.rgb, heat);
	rgb *= 1.0 + C.luminosity * energy;
	o.col = vec4f(rgb, alpha);
	return o;
}

@fragment
fn fs(in : VOut) -> @location(0) vec4f {
	let a = -dot(in.quad, in.quad);
	if (a < -4.0) { discard; }
	let b = exp(a) * in.col.a;
	return vec4f(in.col.rgb * b, b); // premultiplied over
}
`;

	global.HktGenesisWGSL = { SIM, KEY, SORT, RENDER, GRID_CLEAR, GRID_BUILD };
})(window);
