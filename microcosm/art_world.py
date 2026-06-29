"""art_world.py - 하나의 렌더러로 바다·나무·지형·캐릭터를 한 씬에.

검증 질문: *하나의 SDF 아트 렌더러* 가 전혀 다른 네 자산을 통일된 아트 스타일로
전부 그려내는가? (지형 밴드 + 물 메타볼 표면 + 나무 바크/잎 + 캐릭터 스킨)
실행:  python art_world.py  ->  art_world.png
"""
import os
import math
import numpy as np
from microcosm import World, standard_fields
from microcosm.core import KIND
from microcosm.artrender import save_png

OUT = os.path.dirname(os.path.abspath(__file__))


def main():
    w = World(W=170.0, H=95.0, gravity=16.0)
    standard_fields(w)
    # 분지가 있는 지형: 왼쪽에 물웅덩이, 오른쪽은 나무·캐릭터가 서는 땅
    w.ground = lambda x: (24.0 - 13.0 * math.exp(-((x - 42.0) / 15.0) ** 2)
                          + 3.0 * math.sin(x * 0.05))

    # 바다: 분지에 물을 부어 정착시킨다
    for cx in (38, 42, 46):
        w.spawn_form('water', cx=cx, count=70, spreadX=9, topY=w.ground(cx) + 24)
    w.run(650)   # 흘러내려 웅덩이에 고임

    # 나무·캐릭터(정적 스킨) — 정착 후 배치
    w.spawn_form('art_tree', baseX=118.0, scale=1.7)
    w.spawn_form('art_tree', baseX=150.0, scale=1.2)
    w.spawn_form('skeleton', cx=88.0, scale=1.5, anchored=True)

    path = os.path.join(OUT, 'art_world.png')
    save_png(w, path, scale=5.0, smin_k=1.4, supersample=2)
    nW = int((w.alive[:w.n] & (w.kind[:w.n] == KIND['WATER'])).sum())
    print(f"units={w.n} water={nW} skins={len(w.skins)} -> {path}")


if __name__ == '__main__':
    main()
