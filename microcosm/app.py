"""app.py - pygame 실시간 인터랙티브 앱.

조작:
  좌클릭/드래그 = 물 붓기
  R = 바위   T = 나무   C = 개체   F = 파이어볼(점화)   N = 리셋   ESC = 종료

실행:  python app.py
"""
import os
import math
import numpy as np
import pygame
from microcosm import World, standard_fields
from microcosm.core import KIND

W, H = 240.0, 120.0
SCALE = 3.6
PXW, PXH = int(W * SCALE), int(H * SCALE)
MAXN = 1400

COL = {KIND['ROCK']: (139, 133, 118), KIND['WOOD']: (122, 86, 48),
       KIND['LEAF']: (79, 154, 62), KIND['CHARACTER']: (70, 208, 138),
       KIND['CREATURE']: (224, 145, 58)}


def sx(x): return int(x * SCALE)
def sy(y): return int(PXH - y * SCALE)


def make_world():
    w = World(W=W, H=H, gravity=16.0); standard_fields(w)
    w.spawn_form('terrain')
    for cx in (70, 100, 130):
        w.spawn_form('water', cx=cx, count=55, spreadX=26, topY=112)
    for bx in (44, 92, 198):
        w.spawn_form('tree', baseX=bx)
    w.spawn_form('rock', cx=150, cy=0, r=5)
    w.spawn_form('creature', cx=116, cy=100); w.spawn_form('creature', cx=175, cy=100)
    w.spawn_form('character', cx=224, cy=95)
    return w


def fire_color(T):
    t = max(0.0, min(1.0, T / 2))
    return (255, int(90 + t * 150), int(t * 60))


def pour(w, x, y):
    if w.n < MAXN:
        for _ in range(6):
            w.spawn(x + (np.random.rand() - 0.5) * 6, y + np.random.rand() * 5,
                    vy=-3, M=0.5, kind=KIND['WATER'], g_scale=1)


def draw(screen, w, font=None):
    screen.fill((16, 19, 28))
    # 지형
    pts = [(sx(x), sy(w.ground(x))) for x in range(0, int(W) + 1, 2)]
    pygame.draw.polygon(screen, (58, 53, 38), [(0, PXH)] + pts + [(PXW, PXH)])
    pygame.draw.lines(screen, (90, 143, 60), False, pts, 3)
    n = w.n
    # 물
    for i in range(n):
        if w.alive[i] and w.kind[i] == KIND['WATER']:
            pygame.draw.circle(screen, (60, 130, 220), (sx(w.P[i, 0]), sy(w.P[i, 1])), 4)
    # 결합
    for (i, j, rest, k, melt) in w.bonds:
        if not (w.alive[i] and w.alive[j]):
            continue
        wood = w.kind[i] in (KIND['WOOD'], KIND['LEAF'])
        pygame.draw.line(screen, (122, 86, 48) if wood else (90, 92, 110),
                         (sx(w.P[i, 0]), sy(w.P[i, 1])), (sx(w.P[j, 0]), sy(w.P[j, 1])),
                         2 if wood else 1)
    # 단위 + 글로우
    for i in range(n):
        if not w.alive[i]:
            continue
        k = w.kind[i]; x, y = sx(w.P[i, 0]), sy(w.P[i, 1])
        if k == KIND['WATER']:
            continue
        if k == KIND['FIRE']:
            pygame.draw.circle(screen, fire_color(w.T[i]), (x, y), 5)
            continue
        c = COL.get(k, (120, 120, 120))
        pygame.draw.circle(screen, c, (x, y), 3)
        if w.T[i] > 0.45:
            pygame.draw.circle(screen, fire_color(w.T[i]), (x, y), 4)
    if font:
        nW = int(np.sum(w.alive[:n] & (w.kind[:n] == KIND['WATER'])))
        txt = font.render('left-drag=water  R rock  T tree  C creature  F fire  N reset   |  '
                          'units %d  water %d' % (w.n, nW), True, (200, 198, 188))
        screen.blit(txt, (10, 8))


def main():
    pygame.init()
    screen = pygame.display.set_mode((PXW, PXH))
    pygame.display.set_caption('microcosm world (python)')
    font = pygame.font.SysFont(None, 22)
    clock = pygame.time.Clock()
    w = make_world()
    pouring = False
    running = True
    while running:
        mx, my = pygame.mouse.get_pos()
        wx, wy = mx / SCALE, (PXH - my) / SCALE
        for e in pygame.event.get():
            if e.type == pygame.QUIT:
                running = False
            elif e.type == pygame.MOUSEBUTTONDOWN and e.button == 1:
                pouring = True
            elif e.type == pygame.MOUSEBUTTONUP and e.button == 1:
                pouring = False
            elif e.type == pygame.KEYDOWN:
                if e.key == pygame.K_r:
                    w.spawn_form('rock', cx=wx, cy=0, r=4.5)
                elif e.key == pygame.K_t:
                    w.spawn_form('tree', baseX=wx)
                elif e.key == pygame.K_c:
                    w.spawn_form('creature', cx=wx, cy=wy)
                elif e.key == pygame.K_f:
                    w.spawn_form('fireball', cx=wx, cy=wy, count=44, temp=2.2)
                elif e.key == pygame.K_n:
                    w = make_world()
                elif e.key == pygame.K_ESCAPE:
                    running = False
        if pouring:
            pour(w, wx, wy)
        for _ in range(3):
            w.step(0.02)
        draw(screen, w, font)
        pygame.display.flip()
        clock.tick(30)
    pygame.quit()


if __name__ == '__main__':
    main()
