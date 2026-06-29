"""art_gather_hunt.py - 기본 채집·사냥 데모를 아트 렌더로 굴려 GIF 생성.

R3 보행 위에 행동 레이어를 얹는다. ForagerHunterBrain(상태기계)이 *의도*(어디로/
무엇을)만 고르고, 걸음·균형·접지·추격은 모두 물리(입력항 I + 중력 + 본드 + 지형)에서
창발한다. 캐릭터가 베리 덤불로 걸어가 채집하고, 사냥감(critter)을 쫓아가 잡는다.

실행:  python art_gather_hunt.py  ->  art_gather_hunt.gif (+ _sheet.png)
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from microcosm import World, standard_fields, ForagerHunterBrain
from microcosm.artrender import render_scene

OUT = os.path.dirname(os.path.abspath(__file__))


def _font(sz):
    try:
        import matplotlib.font_manager as fm
        return ImageFont.truetype(fm.findfont('DejaVu Sans'), sz)
    except Exception:
        return ImageFont.load_default()


def _hud(arr, brain):
    """렌더 배열(uint8) 위에 채집/사냥 카운트 + 상태 HUD 를 그린다."""
    im = Image.fromarray(arr)
    d = ImageDraw.Draw(im)
    f = _font(15); fs = _font(12)
    label = {'GATHER': 'GATHERING', 'HUNT': 'HUNTING', 'DONE': 'DONE'}[brain.state]
    lines = [(f"Gathered: {brain.gathered}   Hunted: {brain.hunted}", f),
             (f"[ {label} ]", fs)]
    y = 6
    for text, fnt in lines:
        d.text((7, y + 1), text, font=fnt, fill=(0, 0, 0))      # 그림자
        d.text((6, y), text, font=fnt, fill=(250, 250, 255))
        y += 18
    return np.asarray(im)


def build():
    w = World(W=150.0, H=80.0)
    standard_fields(w)
    w.spawn_form('terrain'); w.ground = lambda x: 12.0
    walk = w.spawn_form('walker', cx=80.0, scale=1.5, period=1.0, speed=13.0)
    b1 = w.spawn_form('berry_bush', cx=38.0, scale=1.3, nberry=4)
    b2 = w.spawn_form('berry_bush', cx=55.0, scale=1.2, nberry=3)
    pr = w.spawn_form('critter', cx=120.0, speed=6.5)
    brain = ForagerHunterBrain(
        w, walk['ctrl'], walk['joints']['pelvis'], bushes=[b1, b2],
        preys=[{'core': pr['core'], 'units': pr['units'], 'ctrl': pr['ctrl']}],
        reach=7.0, act=0.7)
    w.agents.insert(0, brain)            # 브레인을 먼저 굴려 의도 결정
    return w, brain


def main():
    w, brain = build()
    dt = 0.02
    frames, sheet = [], []
    done_hold = 0
    for s in range(900):
        w.step(dt)
        if s % 4 == 0:                   # 4 스텝마다 1 프레임
            arr = (np.clip(render_scene(w, scale=3.0, smin_k=1.4, supersample=2), 0, 1) * 255).astype(np.uint8)
            arr = _hud(arr, brain)
            frames.append(Image.fromarray(arr))
            if len(sheet) < 6 and s % 32 == 0:
                sheet.append(arr)
        if brain.state == 'DONE':
            done_hold += 1
            if done_hold > 60:           # 종료 후 잠깐 정지 장면
                break
    gif = os.path.join(OUT, 'art_gather_hunt.gif')
    frames[0].save(gif, save_all=True, append_images=frames[1:], duration=70, loop=0)
    print(f"frames={len(frames)} gathered={brain.gathered} hunted={brain.hunted} -> {gif}")
    if sheet:
        # 마지막에 종료 프레임 한 장 추가
        sheet.append(np.asarray(frames[-1]))
        strip = np.concatenate(sheet, axis=1)
        Image.fromarray(strip).save(os.path.join(OUT, 'art_gather_hunt_sheet.png'))
        print(f"sheet={len(sheet)} -> art_gather_hunt_sheet.png")


if __name__ == '__main__':
    main()
