"""
fields.py - 장(Field) 라이브러리

각 Field 는 보편 규칙의 한 항이다. 매 스텝 world.F (힘) 또는 world.dT (온도
변화율) 누적기에 기여한다. 새 물리를 추가하려면 Field 하나를 더 쓰면 된다.

    ElasticBondField  결합(스프링)  -> 구조 (캐릭터·사슬갑옷)
    ThermalField      열 확산+부력+복사냉각 -> 파이어볼·벼락 발광
    RepulsionField    근거리 반발   -> 부피/충돌
    HomeostasisField  음성 피드백   -> 항상성 (캐릭터)
    DragField         운동량 소산 γ -> 엔트로피 방출
    GravityField      중력          -> 사슬갑옷 드리움
"""
import numpy as np


class Field:
    def apply(self, w):
        raise NotImplementedError


class DragField(Field):
    """운동량 소산: F -= c·V. (식의 -γx 항)"""
    def __init__(self, c=0.8):
        self.c = c

    def apply(self, w):
        n = w.n
        w.F[:n] -= self.c * w.V[:n]


class GravityField(Field):
    """단위별 g_scale 로 선택 적용되는 중력."""
    def apply(self, w):
        n = w.n
        w.F[:n, 1] -= w.gravity * w.g_scale[:n] * w.M[:n]


class ThermalField(Field):
    """열장: 이웃과 열을 나누고(확산), 뜨거우면 떠오르고(부력),
    복사로 식는다(엔트로피 방출). 파이어볼·벼락이 여기서 창발한다."""
    def __init__(self, radius=7.0, diffuse=1.4, buoyancy=26.0,
                 buoy_threshold=0.3, cooling=0.45):
        self.r = radius
        self.diff = diffuse
        self.buoy = buoyancy
        self.thr = buoy_threshold
        self.cool = cooling

    def apply(self, w):
        n = w.n
        D, T = w.D, w.T[:n]
        mask = (D < self.r) & (D > 1e-6)
        cnt = np.maximum(mask.sum(1), 1)
        # 확산: 이웃 평균 온도로 끌림
        w.dT[:n] += self.diff * (mask * (T[None, :] - T[:, None])).sum(1) / cnt
        # 부력: 임계 온도 이상이면 상승
        w.F[:n, 1] += self.buoy * np.maximum(T - self.thr, 0.0)
        # 복사 냉각: 엔트로피를 밖으로
        w.dT[:n] -= self.cool * T


class RepulsionField(Field):
    """근거리 반발 - 단위에 부피를 준다(서로 겹치지 않게)."""
    def __init__(self, radius=3.0, strength=90.0):
        self.r = radius
        self.s = strength

    def apply(self, w):
        n = w.n
        D, Dvec = w.D, w.Dvec
        mask = (D < self.r) & (D > 1e-6)
        overlap = np.where(mask, self.r - D, 0.0)         # (n,n)
        dir_ji = -Dvec / D[:, :, None]                    # j -> i 방향
        force = (overlap[:, :, None] * dir_ji).sum(1) * self.s / self.r
        w.F[:n] += force


class ElasticBondField(Field):
    """결합(후크 법칙) + 결합방향 속도감쇠. 구조를 만든다.
    캐릭터의 응집, 사슬갑옷의 그물망이 모두 이 장에서 나온다."""
    def __init__(self, damp=0.5):
        self.damp = damp

    def apply(self, w):
        for (i, j, rest, k) in w.bonds:
            d = w.P[j] - w.P[i]
            L = np.linalg.norm(d) + 1e-9
            u = d / L
            f = k * (L - rest) * u
            relv = (w.V[j] - w.V[i]) @ u
            f += self.damp * relv * u
            w.F[i] += f
            w.F[j] -= f


class HomeostasisField(Field):
    """음성 피드백: 표시된 단위의 온도를 목표값으로 되돌린다.
    체온 유지처럼, 교란이 와도 평형으로 복귀한다."""
    def __init__(self, gain=2.5):
        self.gain = gain

    def apply(self, w):
        n = w.n
        m = w.homeo[:n]
        w.dT[:n] += self.gain * m * (w.homeoT[:n] - w.T[:n])


def standard_fields(world):
    """대부분의 장면에 충분한 기본 장 세트."""
    world.add_field(ElasticBondField())
    world.add_field(ThermalField())
    world.add_field(RepulsionField())
    world.add_field(HomeostasisField())
    world.add_field(GravityField())
    world.add_field(DragField())
    return world
