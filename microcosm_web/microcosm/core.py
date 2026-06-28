"""
core.py - 통합 기질(substrate)

모든 것은 '단위(unit)'다. 단위는 상태 벡터를 갖고, 장(Field)들이 정의하는
상호작용을 통해 갱신된다. 단 하나의 보편 규칙으로 캐릭터·파이어볼·벼락·
사슬갑옷이 모두 굴러간다:

    dx_i/dt = f(x_i) + Σ_j W_ij g(x_i, x_j) + I_i - γ x_i
              (자체동역학)   (상호작용=장)      (흐름)  (소산)

여기서 '단위'의 상태 채널은:
    P  위치(2D)      V  속도(2D)      F  누적 힘(2D, 매 스텝 리셋)
    T  온도/에너지   Q  전하          M  질량
    g_scale 중력 민감도   homeoT 항상성 목표온도   homeo 항상성 여부
    kind 종류 태그   fixed 고정 여부   age 나이

Field 들이 매 스텝 F 와 dT(온도 변화율) 누적기에 기여하고,
World.step() 이 그것을 적분한다. 이것이 전부다 — 나머지는 레시피.
"""
import numpy as np


class World:
    def __init__(self, size=(120, 120), dt=0.05, gravity=8.0, capacity=6000):
        self.size = np.asarray(size, float)
        self.dt = float(dt)
        self.gravity = float(gravity)
        self.cap = int(capacity)
        self.time = 0.0
        self.n = 0

        c = self.cap
        # (n,2) 채널
        self.P = np.zeros((c, 2))
        self.V = np.zeros((c, 2))
        self.F = np.zeros((c, 2))
        # 스칼라 채널
        self.T = np.zeros(c)
        self.Q = np.zeros(c)
        self.M = np.ones(c)
        self.g_scale = np.zeros(c)
        self.homeoT = np.zeros(c)
        self.age = np.zeros(c)
        self.dT = np.zeros(c)
        # 정수/불리언 채널
        self.kind = np.zeros(c, int)
        self.fixed = np.zeros(c, bool)
        self.homeo = np.zeros(c, bool)

        self.bonds = []   # 구조적 결합: [i, j, rest_length, k]
        self.fields = []  # 활성 장
        self.forms = []   # 활성 레시피 인스턴스(update 훅 호출용)

        # 매 스텝 캐시되는 쌍 정보
        self.D = None     # (n,n) 거리
        self.Dvec = None  # (n,n,2) = P_j - P_i

    # ---- 단위 생성 ----------------------------------------------------------
    def spawn(self, pos, vel=(0, 0), T=0.0, Q=0.0, mass=1.0, kind=0,
              fixed=False, g_scale=0.0, homeoT=None):
        i = self.n
        if i >= self.cap:
            raise RuntimeError("capacity 초과 - World(capacity=...) 를 키우세요")
        self.P[i] = pos
        self.V[i] = vel
        self.T[i] = T
        self.Q[i] = Q
        self.M[i] = mass
        self.kind[i] = kind
        self.fixed[i] = fixed
        self.g_scale[i] = g_scale
        if homeoT is not None:
            self.homeo[i] = True
            self.homeoT[i] = homeoT
        self.n += 1
        return i

    def add_bond(self, i, j, k=20.0, rest=None):
        if rest is None:
            rest = float(np.linalg.norm(self.P[i] - self.P[j]))
        self.bonds.append([int(i), int(j), float(rest), float(k)])

    def add_field(self, field):
        self.fields.append(field)
        return field

    def spawn_form(self, name, **kwargs):
        """레지스트리에 등록된 요소를 이름으로 소환한다."""
        from .forms import REGISTRY
        if name not in REGISTRY:
            raise KeyError(f"알 수 없는 요소: {name}. 등록된 것: {list(REGISTRY)}")
        form = REGISTRY[name]().build(self, **kwargs)
        self.forms.append(form)
        return form

    # ---- 시뮬레이션 한 스텝 -------------------------------------------------
    def _compute_pairs(self):
        P = self.P[:self.n]
        diff = P[None, :, :] - P[:, None, :]      # (n,n,2): Dvec[i,j] = P_j - P_i
        D = np.sqrt((diff ** 2).sum(2)) + 1e-9
        self.Dvec, self.D = diff, D

    def step(self):
        n = self.n
        if n == 0:
            return
        self.F[:n] = 0.0
        self.dT[:n] = 0.0
        self._compute_pairs()

        # 보편 규칙: 모든 장이 F, dT 에 기여
        for field in self.fields:
            field.apply(self)
        # 레시피별 피드백 훅(있으면)
        for form in self.forms:
            upd = getattr(form, "update", None)
            if upd is not None:
                upd(self, self.dt)

        # 적분
        dt = self.dt
        free = ~self.fixed[:n]
        acc = self.F[:n] / self.M[:n, None]
        self.V[:n] += acc * dt
        self.V[:n][self.fixed[:n]] = 0.0
        self.P[:n] += self.V[:n] * dt
        self.T[:n] = np.clip(self.T[:n] + self.dT[:n] * dt, 0.0, None)
        self.age[:n] += dt

        # 경계 반사
        for d in (0, 1):
            lo = self.P[:n, d] < 0
            self.P[:n, d][lo] = 0.0
            self.V[:n, d][lo] *= -0.5
            hi = self.P[:n, d] > self.size[d]
            self.P[:n, d][hi] = self.size[d]
            self.V[:n, d][hi] *= -0.5

        self.time += dt

    def run(self, steps):
        for _ in range(int(steps)):
            self.step()
