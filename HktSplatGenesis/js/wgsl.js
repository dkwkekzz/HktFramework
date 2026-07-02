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

	// ── 시뮬 패스: per-splat 자율 규칙 (L1 — 이웃 상호작용 없음) ─────────────
	const SIM = SPLAT_STRUCT + /* wgsl */`
struct SimParams {
	emitter : vec3f,  dt : f32,
	time : f32,       cohesion : f32,  volatility : f32, updraft : f32,
	damping : f32,    lifeBase : f32,  emitRadius : f32, flowFreq : f32,
	flowSpeed : f32,  count : u32,     _p0 : f32,        _p1 : f32,
};
@group(0) @binding(0) var<storage, read_write> splats : array<Splat>;
@group(0) @binding(1) var<uniform> P : SimParams;

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

	s.age += P.dt;
	if (s.age >= s.life) {
		// 수명 종료 → 코어 주변에서 재생성 (세대 교대)
		let r = hash31(f32(i) * 0.719 + fract(P.time) * 113.1) * 2.0 - 1.0;
		s.pos = P.emitter + r * P.emitRadius;
		s.vel = vec3f(0.0);
		s.age = 0.0;
		s.life = P.lifeBase * (0.5 + hash31(f32(i) * 1.37 + s.misc.y).x);
	}

	// 규칙: 구심(응집) + 난류(휘발) + 부력(상승) — 유전자 3개가 형태를 결정
	let toCore = P.emitter - s.pos;
	var acc = toCore * P.cohesion;
	acc += flow(s.pos * P.flowFreq, P.time * P.flowSpeed) * P.volatility;
	acc.y += P.updraft;

	s.vel = (s.vel + acc * P.dt) * exp(-P.damping * P.dt);
	s.pos += s.vel * P.dt;

	// 에너지 곡선: 태어나며 점화, 죽어가며 소산 → 불투명도·발광·크기로 유도됨
	let u = s.age / s.life;
	s.misc.x = smoothstep(0.0, 0.15, u) * (1.0 - smoothstep(0.65, 1.0, u));

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

	global.HktGenesisWGSL = { SIM, KEY, SORT, RENDER };
})(window);
