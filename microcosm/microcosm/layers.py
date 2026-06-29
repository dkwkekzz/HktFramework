"""layers.py - 층위(layer) 연산: 거칠게 보기(coarse-grain)와 미세화(refine).

systems.pdf 3장(재규격화군)의 핵심을 *코드로* 옮긴다.

    L0 단위 클러스터  --promote(거칠게 보기)-->  L1 메타-단위 1개
    L1 메타-단위      --refine(미세화)        -->  L0 단위들 복원

핵심 사실(왜 거칠게 보기가 거시 행동을 보존하는가):
클러스터를 하나로 묶으면 내부 상호작용 Σ_j W_ij g 는 작용-반작용으로 상쇄되어
순힘이 0이 된다. 남는 것은 외부 항(중력·소산·흐름·지지)뿐이다.
즉 "무관한 세부(내부 진동·표면 잔물결) → 0, 보존량(질량·운동량·질량중심)만 살아남는다."
이것이 RG 의 '관련 변수만 살아남는다'를 입자계에서 본 가장 약한 버전이며,
MMO 의 LOD/관심영역 관리가 정당한 이유다 — 멀리 있는 영역은 φ(거시 상태)만 굴린다.

엔진(core/fields)은 건드리지 않는다. 메타-단위도 그냥 World 의 한 단위(kind=AGG)라
같은 step() 동역학(중력·소산·지지)을 그대로 받는다 — "층이 바뀌면 명사만 바뀐다".
"""
import numpy as np
from .core import KIND

AGG = KIND["AGG"]


class MetaUnit:
    """L1 메타-단위 1개. 승격 시점의 멤버 스냅샷(질량중심 상대좌표·속도)을 들고 있어
    미세화(refine) 때 보존량을 일관되게 되돌린다."""
    __slots__ = ("index", "layer", "members", "mass", "radius",
                 "src_kind", "com0", "vcom0")

    def __init__(self, index, layer, members, mass, radius, src_kind, com0, vcom0):
        self.index = index          # World 안에서의 메타-단위 슬롯
        self.layer = layer          # 층 번호 (L0 클러스터 → layer=1)
        self.members = members      # [(rel_pos(2,), rel_vel(2,), T, M, kind, hp, g_scale, homeo, homeoT)]
        self.mass = mass            # 보존된 총질량
        self.radius = radius        # 거시 반경(겉보기 크기, 렌더/지지 추정용)
        self.src_kind = src_kind    # 원본 단위 종류 (refine 시 복원)
        self.com0 = com0            # 승격 시점 질량중심
        self.vcom0 = vcom0          # 승격 시점 질량중심 속도


def find_clusters(w, kind, link_radius):
    """같은 종류의 살아있는 단위들을 근접(link_radius 이하)으로 연결해 클러스터(연결성분)로 묶는다.
    union-find. 반환: [[idx,...], ...] (단일 단위 클러스터도 포함)."""
    n = w.n
    idx = [i for i in range(n) if w.alive[i] and w.kind[i] == kind]
    parent = {i: i for i in idx}

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    r2 = link_radius * link_radius
    P = w.P
    m = len(idx)
    for ai in range(m):
        i = idx[ai]
        pi = P[i]
        for bi in range(ai + 1, m):
            j = idx[bi]
            dx = pi[0] - P[j, 0]
            dy = pi[1] - P[j, 1]
            if dx * dx + dy * dy <= r2:
                union(i, j)

    groups = {}
    for i in idx:
        groups.setdefault(find(i), []).append(i)
    return list(groups.values())


def order_parameter(w, kind, link_radius):
    """질서변수 φ = 최대 클러스터 질량분율 (0~1).

    창발/분기의 척도: 단위들이 흩어져 있으면(무질서) φ→0 에 가깝고,
    한 덩어리로 응집(질서)하면 φ→1. systems.pdf 식(3) 분기의 입자계 실현.
    퍼콜레이션 질서변수와 같은 정의."""
    clusters = find_clusters(w, kind, link_radius)
    if not clusters:
        return 0.0
    total = sum(float(w.M[i]) for c in clusters for i in c)
    if total <= 0:
        return 0.0
    biggest = max(sum(float(w.M[i]) for i in c) for c in clusters)
    return biggest / total


def _snapshot_member(w, i, com, vcom):
    return (
        (w.P[i] - com).copy(),
        (w.V[i] - vcom).copy(),
        float(w.T[i]), float(w.M[i]), int(w.kind[i]),
        float(w.hpMax[i]), float(w.g_scale[i]),
        bool(w.homeo[i]), float(w.homeoT[i]),
    )


def promote(w, cluster, layer=1):
    """거칠게 보기: L0 단위 묶음(cluster) → L1 메타-단위 1개.

    보존: 총질량 M=ΣM_i, 질량중심 P=Σm_i x_i/M, 질량중심 속도 V=Σm_i v_i/M,
    질량가중 평균온도 T. 멤버는 kill 되고 메타-단위 1개가 spawn 된다.
    내부 상호작용은 이 묶음 안에서만 작용했으므로 사라져도 거시 동역학은 보존된다."""
    cluster = [i for i in cluster if w.alive[i]]
    if not cluster:
        return None
    M_i = np.array([w.M[i] for i in cluster])
    Mtot = float(M_i.sum())
    P_i = np.array([w.P[i] for i in cluster])
    V_i = np.array([w.V[i] for i in cluster])
    com = (M_i[:, None] * P_i).sum(0) / Mtot
    vcom = (M_i[:, None] * V_i).sum(0) / Mtot
    Tcom = float((M_i * np.array([w.T[i] for i in cluster])).sum() / Mtot)
    src_kind = int(w.kind[cluster[0]])
    # 겉보기 반경: 질량중심에서 멤버까지 RMS 거리 + 입자 반경 여유
    rad = float(np.sqrt(((P_i - com) ** 2).sum(1).mean())) + 1.0

    members = [_snapshot_member(w, i, com, vcom) for i in cluster]
    for i in cluster:
        w.kill(i)

    idx = w.spawn(com[0], com[1], vx=vcom[0], vy=vcom[1], T=Tcom,
                  M=Mtot, kind=AGG, g_scale=1.0)
    return MetaUnit(idx, layer, members, Mtot, rad, src_kind, com.copy(), vcom.copy())


def refine(w, meta):
    """미세화: L1 메타-단위 → L0 단위들 복원.

    메타-단위가 (점으로서) 이동/가속한 만큼 멤버 전체를 강체처럼 옮겨 되돌린다.
    상대좌표·상대속도는 승격 시점 스냅샷을 그대로 쓰므로,
    메타-단위가 정지해 있었다면 라운드트립은 질량·운동량·질량중심을 정확히 보존한다.
    반환: 복원된 단위 인덱스 리스트."""
    if not w.alive[meta.index]:
        return []
    com = w.P[meta.index].copy()
    vcom = w.V[meta.index].copy()
    out = []
    for (rp, rv, T, M, kind, hpMax, g_scale, homeo, homeoT) in meta.members:
        i = w.spawn(com[0] + rp[0], com[1] + rp[1],
                    vx=vcom[0] + rv[0], vy=vcom[1] + rv[1],
                    T=T, M=M, kind=kind, g_scale=g_scale,
                    hp=hpMax, homeoT=(homeoT if homeo else None))
        out.append(i)
    w.kill(meta.index)
    return out


def total_mass(w, kinds=None):
    n = w.n
    al = w.alive[:n]
    if kinds is None:
        sel = al
    else:
        sel = al & np.isin(w.kind[:n], list(kinds))
    return float(w.M[:n][sel].sum())


def total_momentum(w, kinds=None):
    n = w.n
    al = w.alive[:n]
    if kinds is None:
        sel = al
    else:
        sel = al & np.isin(w.kind[:n], list(kinds))
    return (w.M[:n][sel, None] * w.V[:n][sel]).sum(0)


def center_of_mass(w, kinds=None):
    n = w.n
    al = w.alive[:n]
    if kinds is None:
        sel = al
    else:
        sel = al & np.isin(w.kind[:n], list(kinds))
    m = w.M[:n][sel]
    if m.sum() <= 0:
        return np.zeros(2)
    return (m[:, None] * w.P[:n][sel]).sum(0) / m.sum()
