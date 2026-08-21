// C020 통합 실측 — 진짜 World 를 굴린 관찰 결과를 진짜 View 결정 Layer 에 통과시킨다.
// Fixture 가 아니다: 세계 → 계약 → 화면 결정 → 요청 → 세계 가 한 줄로 이어지는지 본다
// (08 PLAYABLE 근거).

import { describe, expect, it } from 'vitest';
import type { ActionRequest } from '../../protocol/actions';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { KEY_BINDINGS } from '../../view/bindings';
import { resolvePresentation } from '../../view/resolve';
import { TICK_INTERVAL } from '../semantic/world-state';
import { driveWorld, selectTarget, type WorldDriver } from './drive';

const AT_DEPOSIT = { x: 8, z: -5 };
const solo = { npcs: [] };

const screen = (view: GameViewSnapshot) => resolvePresentation(view, undefined, {});
const line = (view: GameViewSnapshot, id: string) =>
  screen(view).hud.find((h) => h.id === id)?.value;
const minePrompt = (view: GameViewSnapshot) =>
  screen(view).interactions.find((i) => i.id === 'mine')?.unavailableText;

/** 화면에서 덜어내기 키를 누른다 — 조립 루트가 하는 일을 그대로 한다 */
function pressLetGo(world: WorldDriver): ActionRequest | null {
  const binding = KEY_BINDINGS.find((b) => b.code === 'KeyB')!;
  let sent: ActionRequest | null = null;
  binding.invoke({ hud: screen(world.observe()).hud } as never, (action) => {
    sent = action as ActionRequest;
    return true;
  });
  if (sent) world.dispatch(sent);
  return sent;
}

function mineOnce(world: WorldDriver): void {
  world.dispatch({ interactionId: 'mine' });
  for (let t = 0; t < 45; t += 1) world.tick(TICK_INTERVAL);
}

describe('C020 통합 — 세계에서 나온 값이 화면 결정까지 이어진다', () => {
  it('시작 화면에 가방과 지닌 것이 보인다 — 세계가 보낸 목록 그대로', () => {
    const world = driveWorld({ ...solo });
    expect(line(world.observe(), 'carried.room')).toBe('1/3');
    expect(line(world.observe(), 'carried.0')).toContain('곡괭이');
    expect(line(world.observe(), 'carried.0')).toContain('다시 캘 수 없다');
  });

  it('캐면 화면의 가방이 함께 찬다', () => {
    const world = driveWorld({ ...solo, actorPosition: AT_DEPOSIT });
    selectTarget(world, 'deposit-1');

    mineOnce(world);
    expect(line(world.observe(), 'carried.room')).toBe('2/3');
    expect(line(world.observe(), 'carried.1')).toBe('돌 ×1 (1/2)');

    mineOnce(world);
    expect(line(world.observe(), 'carried.1')).toBe('돌 ×2 (2/2)');
  });

  it('가득 차면 화면이 그 사실과 사유를 말한다', () => {
    const world = driveWorld({ ...solo, actorPosition: AT_DEPOSIT });
    selectTarget(world, 'deposit-1');
    for (let i = 0; i < 4; i += 1) mineOnce(world);

    expect(line(world.observe(), 'carried.room')).toBe('3/3 — 가득 찼다');
    expect(minePrompt(world.observe())).toContain('자리가 없다');
  });

  it('화면에서 덜어내기 키를 누르면 세계가 실제로 그 자리를 비운다 — 그리고 다시 캘 수 있다', () => {
    const world = driveWorld({ ...solo, actorPosition: AT_DEPOSIT });
    selectTarget(world, 'deposit-1');
    for (let i = 0; i < 4; i += 1) mineOnce(world);

    const sent = pressLetGo(world);
    expect(sent).toEqual({ interactionId: 'let-go', carriedSlot: 1 });

    expect(line(world.observe(), 'carried.room')).toBe('2/3');
    expect(minePrompt(world.observe())).toBeUndefined(); // 다시 캘 수 있다

    mineOnce(world);
    expect(line(world.observe(), 'carried.room')).toBe('3/3 — 가득 찼다');
  });

  it('화면이 겨누는 자리는 세계가 허락한 자리다 — 곡괭이는 눌러도 나가지 않는다', () => {
    const world = driveWorld({ ...solo }); // 곡괭이 하나만 지닌 몸

    const sent = pressLetGo(world);
    expect(sent).toBeNull(); // 보낼 자리가 없다
    expect(line(world.observe(), 'carried.0')).toContain('곡괭이'); // 그대로다
  });

  it('돌 전용 칸과 도구 깃발이 세계에서도 화면에서도 사라졌다', () => {
    const view = driveWorld({ ...solo }).observe();
    expect(view.hud.find((h) => h.id === 'inventory.stone')).toBeUndefined();
    expect(screen(view).hud.find((h) => h.id === 'inventory.stone')).toBeUndefined();
    expect(screen(view).hud.find((h) => h.id === 'tool.hasMiningTool')).toBeUndefined();
  });

  it('C001 REGRESSION — 채굴로 무언가를 얻는 길은 그대로 선다', () => {
    const world = driveWorld({ ...solo, actorPosition: AT_DEPOSIT });
    selectTarget(world, 'deposit-1');
    mineOnce(world);

    const view = world.observe();
    expect(view.carried.some((c) => c.kind === 'stone')).toBe(true);
    expect(view.entities.find((e) => e.id === 'deposit-1')?.labelValue).toBe(4);
  });
});
