"""art_character.py - 스켈레톤 캐릭터를 아트 렌더(SDF/메타볼)로 그려 검증한다.

검증 질문: 입자/뼈를 *알아볼 수 있는 사람 실루엣* 으로 그릴 수 있는가? (회색 곤죽이 아니라)
실행:  python art_character.py  ->  art_character.png
"""
import os
from microcosm import World, standard_fields
from microcosm.artrender import save_png

OUT = os.path.dirname(os.path.abspath(__file__))


def main():
    w = World(W=120.0, H=80.0)
    standard_fields(w)
    w.spawn_form('terrain')
    # 지형을 평탄하게(검증용) — 캐릭터가 평지에 서도록
    w.ground = lambda x: 12.0
    w.spawn_form('skeleton', cx=60.0, scale=1.6, anchored=True)
    path = os.path.join(OUT, 'art_character.png')
    save_png(w, path, scale=6.0, smin_k=1.4, supersample=2)
    print(f"units={w.n} skins={len(w.skins)} -> {path}")


if __name__ == '__main__':
    main()
