// Client Command — contracts/commands/CMD-MOVE-V1.yaml · CMD-MINE-V1.yaml 대응.
// Client 는 행동 의도만 전달한다 (Rule 4). 결과 필드는 prohibited — validateCommand 가 거부한다.

import type { ActorId, DepositId } from './types';

export interface MoveCommand {
  id: 'CMD-MOVE-V1';
  actorId: ActorId;
  direction: { dx: number; dz: number }; // 정규화 의도 — 결과 위치가 아니다
}

export interface MineCommand {
  id: 'CMD-MINE-V1';
  actorId: ActorId;
  depositId: DepositId;
}

export type Command = MoveCommand | MineCommand;

// Contract 의 prohibited_fields — 입력에 실리면 Command 자체를 거부한다 (Authority 방어선)
const PROHIBITED_FIELDS = [
  'resulting_position',
  'teleport_target',
  'inventory_delta',
  'resulting_resource_amount',
  'any_world_state_result',
] as const;

export interface CommandRejection {
  rejected: true;
  reason: string;
}

export function validateCommand(cmd: Command): CommandRejection | null {
  for (const field of PROHIBITED_FIELDS) {
    if (field in (cmd as unknown as Record<string, unknown>)) {
      return { rejected: true, reason: `prohibited field: ${field}` };
    }
  }
  if (cmd.id !== 'CMD-MOVE-V1' && cmd.id !== 'CMD-MINE-V1') {
    return { rejected: true, reason: 'unknown command id' };
  }
  return null;
}
