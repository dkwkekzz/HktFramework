"""fields.py - 장(Field) = 보편 규칙의 항. apply(world)에서 F·dT에 기여.

PairField  : 열 확산 + 근거리 반발 + 물-물 응집(표면장력)  [벡터화]
EnvField   : 부력·중력·복사냉각·항상성(피드백)·소산(점성)
BondField  : 결합 스프링 + 재질별 융점/과신장 파괴
TerrainField: 높이함수 법선 지지력 + 마찰 (지형)
"""
import numpy as np
from .core import KIND, STRETCH

# 상수 (JS 월드 검증본과 동일)
R_TH2 = 49.0; DIFF = 0.2
R_REP = 3.0; R_REP2 = 9.0; REP_K = 120.0
R_COH = 6.5; R_COH2 = 42.25; COH_K = 16.0
BUOY = 5.0; BUOY_THR = 0.3; COOL = 0.5; DRAG_C = 0.85; HOMEO_G = 2.5
DAMP_B = 1.4
K_SUP = 360.0; N_DAMP = 13.0; FRIC = 6.0
WATER = KIND["WATER"]


class Field:
    def apply(self, w):
        raise NotImplementedError


class PairField(Field):
    """O(n^2) 쌍 상호작용을 numpy로 벡터화."""
    def apply(self, w):
        n = w.n
        P = w.P[:n]
        al = w.alive[:n]
        dv = P[None, :, :] - P[:, None, :]          # (n,n,2) = P_j - P_i
        D2 = (dv * dv).sum(2)
        D = np.sqrt(D2) + 1e-9
        pair = al[:, None] & al[None, :]
        np.fill_diagonal(pair, False)
        T = w.T[:n]
        # 열 확산
        mTh = pair & (D2 <= R_TH2)
        w.dT[:n] += DIFF * (mTh * (T[None, :] - T[:, None])).sum(1)
        # 반발 (i를 j로부터 밀어냄)
        mRep = pair & (D2 < R_REP2)
        over = np.where(mRep, REP_K * (R_REP - D) / R_REP / D, 0.0)
        w.F[:n] += (-over[:, :, None] * dv).sum(1)
        # 물-물 응집 (i를 j로 끌어당김)
        water = (w.kind[:n] == WATER)
        mCoh = pair & water[:, None] & water[None, :] & (D2 < R_COH2) & (D > R_REP)
        coh = np.where(mCoh, COH_K * (R_COH - D) / R_COH / D, 0.0)
        w.F[:n] += (coh[:, :, None] * dv).sum(1)


class EnvField(Field):
    def apply(self, w):
        n = w.n; al = w.alive[:n]
        w.F[:n, 1] += np.where(al, BUOY * np.maximum(w.T[:n] - BUOY_THR, 0.0), 0.0)
        w.F[:n, 1] -= np.where(al, w.gravity * w.g_scale[:n] * w.M[:n], 0.0)
        w.dT[:n] -= np.where(al, COOL * w.T[:n], 0.0)
        m = w.homeo[:n] & al
        w.dT[:n] += HOMEO_G * m * (w.homeoT[:n] - w.T[:n])
        w.F[:n] -= DRAG_C * w.V[:n] * al[:, None]


class BondField(Field):
    """스프링 + 파괴(융해 또는 과신장). 파괴된 결합은 제거."""
    def apply(self, w):
        keep = []
        for (i, j, rest, k, melt) in w.bonds:
            d = w.P[j] - w.P[i]
            L = float(np.hypot(d[0], d[1])) + 1e-9
            ux, uy = d[0] / L, d[1] / L
            if 0.5 * (w.T[i] + w.T[j]) > melt or L > rest * STRETCH:
                continue
            f = k * (L - rest)
            f += DAMP_B * ((w.V[j, 0] - w.V[i, 0]) * ux + (w.V[j, 1] - w.V[i, 1]) * uy)
            w.F[i, 0] += f * ux; w.F[i, 1] += f * uy
            w.F[j, 0] -= f * ux; w.F[j, 1] -= f * uy
            keep.append((i, j, rest, k, melt))
        w.bonds = keep


class TerrainField(Field):
    """높이함수 위로 떠받침 + 법선 감쇠 + 접선 마찰."""
    def apply(self, w):
        n = w.n
        for i in range(n):
            if not w.alive[i] or w.fixed[i]:
                continue
            x = w.P[i, 0]; h = w.ground(x); pen = h - w.P[i, 1]
            if pen <= 0:
                continue
            s = w.ground_slope(x); nl = np.hypot(-s, 1.0)
            nx, ny = -s / nl, 1.0 / nl
            w.F[i, 0] += K_SUP * pen * nx; w.F[i, 1] += K_SUP * pen * ny
            vn = w.V[i, 0] * nx + w.V[i, 1] * ny
            w.F[i, 0] -= N_DAMP * vn * nx; w.F[i, 1] -= N_DAMP * vn * ny
            tx, ty = ny, -nx
            vt = w.V[i, 0] * tx + w.V[i, 1] * ty
            w.F[i, 0] -= FRIC * vt * tx; w.F[i, 1] -= FRIC * vt * ty


def standard_fields(world):
    """규칙의 항들을 올바른 순서로 장착."""
    world.fields = [PairField(), EnvField(), BondField(), TerrainField()]
    return world
