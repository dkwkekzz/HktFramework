"""interactions.py - 요소 간 상호작용을 '또 하나의 장'으로.

BondBreakField: 결합이 과열(융해)되거나 과신장되면 끊어진다.
 -> 뜨거운 파이어볼이 사슬갑옷 위를 지나면 결합이 녹아 갑옷이 뚫린다.
전체 전투(HP/피해/소멸/벼락 강타)는 웹 빌드(web/microcosm.html)에 구현·검증.
"""
import numpy as np
from .fields import Field, standard_fields


class BondBreakField(Field):
    def __init__(self, melt_T=0.85, stretch=2.3):
        self.melt_T = melt_T
        self.stretch = stretch

    def apply(self, w):
        keep = []
        for (i, j, rest, k) in w.bonds:
            L = float(np.linalg.norm(w.P[j] - w.P[i]))
            if 0.5 * (w.T[i] + w.T[j]) > self.melt_T or L > rest * self.stretch:
                continue
            keep.append([i, j, rest, k])
        w.bonds = keep


def combat_fields(world):
    standard_fields(world)
    world.add_field(BondBreakField())
    return world
