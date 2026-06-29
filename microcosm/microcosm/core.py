"""core.py - 2D 세계 기질(substrate)과 보편 규칙 step().

모든 것은 단위(unit)다. 단위는 열(column) 단위 numpy 배열로 저장되고,
장(Field)들이 누적기 F(힘)·dT(온도변화)에 기여한 뒤 한 번에 적분된다.

    dx/dt = f(x) + Σ W·g + I - γx
"""
import numpy as np

KIND = {"VOID": 0, "CHARACTER": 1, "FIRE": 2, "LIGHTNING": 3, "ARMOR": 4,
        "WATER": 5, "ROCK": 6, "WOOD": 7, "LEAF": 8, "CREATURE": 9,
        # AGG: 거칠게 보기로 솟아난 상위 층(L1) 메타-단위. 내부 상호작용은
        # 이미 상쇄되어, 외부 항(중력·소산·지지)만 받는 단순 질량점으로 행동한다.
        "AGG": 10}

# --- 적분/상호작용 상수 (JS 월드 검증본과 동일) ---
STRETCH = 2.3      # 결합 과신장 파괴 배수
BURN_K = 22.0      # 연소 피해 계수
BURN_THR = 0.5     # 연소 임계 온도
FIRE_DIE = 0.16    # 불 소멸 온도
LIGHT_DIE = 0.2    # 번개 소멸 온도


class World:
    def __init__(self, W=240.0, H=120.0, gravity=16.0, cap=9000):
        self.W, self.H, self.gravity, self.cap = W, H, gravity, cap
        c = cap
        self.P = np.zeros((c, 2)); self.V = np.zeros((c, 2)); self.F = np.zeros((c, 2))
        self.T = np.zeros(c); self.dT = np.zeros(c); self.M = np.ones(c)
        self.hp = np.zeros(c); self.hpMax = np.zeros(c)
        self.g_scale = np.zeros(c); self.homeoT = np.zeros(c)
        self.kind = np.zeros(c, np.int32); self.fixed = np.zeros(c, bool)
        self.homeo = np.zeros(c, bool); self.alive = np.zeros(c, bool)
        self.n = 0
        self.bonds = []   # (i, j, rest, k, melt)
        self.bolts = []
        self.agents = []  # 자율 개체 컨트롤러 (update(world, dt))
        self.fields = []
        self.time = 0.0
        self.ground = lambda x: 20.0   # 높이함수 h(x)

    def ground_slope(self, x):
        return self.ground(x + 0.5) - self.ground(x - 0.5)

    def spawn(self, x, y, vx=0.0, vy=0.0, T=0.0, M=1.0, kind=0, fixed=False,
              g_scale=0.0, hp=0.0, homeoT=None):
        i = self.n
        if i >= self.cap:
            raise RuntimeError("capacity 초과")
        self.P[i] = (x, y); self.V[i] = (vx, vy)
        self.T[i] = T; self.M[i] = M; self.kind[i] = kind
        self.fixed[i] = fixed; self.g_scale[i] = g_scale; self.alive[i] = True
        self.hp[i] = hp; self.hpMax[i] = hp
        if homeoT is not None:
            self.homeo[i] = True; self.homeoT[i] = homeoT
        self.n += 1
        return i

    def add_bond(self, i, j, k, rest=None, melt=0.85):
        if rest is None:
            rest = float(np.hypot(*(self.P[i] - self.P[j])))
        self.bonds.append((int(i), int(j), float(rest), float(k), float(melt)))

    def kill(self, i):
        self.alive[i] = False; self.kind[i] = KIND["VOID"]; self.V[i] = 0
        self.bonds = [b for b in self.bonds if b[0] != i and b[1] != i]

    def spawn_form(self, name, **kw):
        from .forms import REGISTRY
        return REGISTRY[name](self, **kw)

    def step(self, dt):
        n = self.n
        if n == 0:
            return
        self.F[:n] = 0.0; self.dT[:n] = 0.0
        for a in self.agents:
            a.update(self, dt)
        for f in self.fields:
            f.apply(self)

        alive = self.alive[:n]
        free = alive & ~self.fixed[:n]
        acc = self.F[:n] / self.M[:n, None]
        self.V[:n][free] += acc[free] * dt
        self.V[:n][~alive] = 0.0
        self.V[:n][self.fixed[:n]] = 0.0
        self.P[:n][free] += self.V[:n][free] * dt
        self.T[:n] = np.clip(self.T[:n] + self.dT[:n] * dt, 0.0, None)

        P, Vv = self.P[:n], self.V[:n]
        size = (self.W, self.H)
        for d in (0, 1):
            lo = P[:, d] < 0; P[lo, d] = 0.0; Vv[lo, d] *= -0.5
            hi = P[:, d] > size[d]; P[hi, d] = size[d]; Vv[hi, d] *= -0.5

        # 상호작용: 연소 피해 + 불/번개 소멸
        for i in range(n):
            if not self.alive[i]:
                continue
            k = self.kind[i]
            if k == KIND["FIRE"]:
                if self.T[i] < FIRE_DIE:
                    self.kill(i)
                continue
            if k == KIND["LIGHTNING"]:
                if self.T[i] < LIGHT_DIE:
                    self.kill(i)
                continue
            if self.hpMax[i] > 0 and self.T[i] > BURN_THR:
                self.hp[i] -= BURN_K * (self.T[i] - BURN_THR) * dt
                if self.hp[i] <= 0:
                    self.kill(i)

        for b in self.bolts:
            b["life"] -= dt
        self.bolts = [b for b in self.bolts if b["life"] > 0]
        self.time += dt

    def run(self, steps, dt=0.02):
        for _ in range(int(steps)):
            self.step(dt)
