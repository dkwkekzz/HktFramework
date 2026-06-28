"""forms.py - 요소 레시피 + 레지스트리.

'요소(Form)'는 새 물리가 아니라 같은 기질 위에 단위를 배치하는 레시피다.
새 요소: Form 상속 -> build() 작성 -> @register. 엔진은 손대지 않는다.
"""
import numpy as np

KIND = {"VOID": 0, "CHARACTER": 1, "FIRE": 2, "LIGHTNING": 3, "ARMOR": 4}
REGISTRY = {}


def register(cls):
    REGISTRY[cls.name] = cls
    return cls


class Form:
    name = "form"

    def build(self, world, **kwargs):
        raise NotImplementedError


@register
class Character(Form):
    """결합 + 항상성으로 응집을 유지하는 '몸'."""
    name = "character"

    def build(self, w, center=(28, 60), radius=6.0, n_ring=12, temp=0.12, k=16.0):
        cx, cy = center
        core = w.spawn((cx, cy), T=temp, mass=1.6, kind=KIND["CHARACTER"], homeoT=temp)
        ring = []
        for a in np.linspace(0, 2 * np.pi, n_ring, endpoint=False):
            p = (cx + radius * np.cos(a), cy + radius * np.sin(a))
            ring.append(w.spawn(p, T=temp, mass=1.0, kind=KIND["CHARACTER"], homeoT=temp))
        for i in ring:
            w.add_bond(core, i, k=k)
        for a in range(n_ring):
            w.add_bond(ring[a], ring[(a + 1) % n_ring], k=k)
        self.units = [core] + ring
        self.core = core
        return self

    def push(self, w, vel):
        v = np.asarray(vel, float)
        for i in self.units:
            w.V[i] += v


@register
class Fireball(Form):
    """고온 패킷. 열장이 퍼뜨리고 부력이 올리고 소산이 끈다."""
    name = "fireball"

    def build(self, w, origin=(36, 60), direction=(1.0, 0.15), speed=20.0,
              count=44, spread=2.4, temp=1.7, seed=None):
        rng = np.random.default_rng(seed)
        o = np.array(origin, float)
        u = np.array(direction, float)
        u /= np.linalg.norm(u)
        self.units = []
        for _ in range(count):
            off = rng.standard_normal(2) * spread
            v = u * speed + rng.standard_normal(2) * 4.0
            i = w.spawn(o + off, vel=v, T=temp * rng.uniform(0.7, 1.3),
                        mass=0.5, kind=KIND["FIRE"])
            self.units.append(i)
        return self


@register
class Lightning(Form):
    """확률적 하향 분기로 프랙탈 방전 채널을 만든다(예산 상한으로 폭발 방지)."""
    name = "lightning"

    def build(self, w, top=(82, 112), ground_y=12, step=4.0, branch=0.18,
              temp=2.4, max_points=180, max_branches=6, seed=None):
        rng = np.random.default_rng(seed)
        self.segs = []
        self.units = []
        stack = [(np.array(top, float), 0.0)]
        budget = max_points
        while stack and budget > 0:
            p, heading = stack.pop()
            while p[1] > ground_y and budget > 0:
                budget -= 1
                nh = heading + rng.uniform(-0.5, 0.5)
                nxt = p + np.array([np.sin(nh), -1.0]) * step * rng.uniform(0.7, 1.3)
                self.segs.append((p.copy(), nxt.copy()))
                i = w.spawn(p, T=temp * rng.uniform(0.8, 1.2), mass=0.3,
                            kind=KIND["LIGHTNING"], fixed=True)
                self.units.append(i)
                if (rng.random() < branch and p[1] > ground_y + step * 3
                        and len(stack) < max_branches):
                    stack.append((p.copy(),
                                  heading + rng.choice([-1, 1]) * rng.uniform(0.6, 1.2)))
                p, heading = nxt, nh * 0.6
        self.life = 0.0
        return self

    def update(self, w, dt):
        self.life += dt


@register
class ChainMail(Form):
    """격자형 결합 네트워크. 위 모서리 고정 -> 중력에 늘어지는 보호 그물."""
    name = "chainmail"

    def build(self, w, topleft=(16, 104), cols=14, rows=9, spacing=4.0,
              k=45.0, pin=("corners",)):
        ox, oy = topleft
        grid = [[None] * cols for _ in range(rows)]
        for r in range(rows):
            for c in range(cols):
                p = (ox + c * spacing, oy - r * spacing)
                fixed = (r == 0 and c in (0, cols - 1)) if "corners" in pin else False
                if "top" in pin and r == 0:
                    fixed = True
                grid[r][c] = w.spawn(p, mass=0.8, kind=KIND["ARMOR"], g_scale=1.0, fixed=fixed)
        for r in range(rows):
            for c in range(cols):
                if c + 1 < cols:
                    w.add_bond(grid[r][c], grid[r][c + 1], k=k)
                if r + 1 < rows:
                    w.add_bond(grid[r][c], grid[r + 1][c], k=k)
        self.grid = grid
        self.units = [grid[r][c] for r in range(rows) for c in range(cols)]
        return self
