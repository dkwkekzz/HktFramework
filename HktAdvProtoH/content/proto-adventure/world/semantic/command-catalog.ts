// World.CommandCatalog (C009 ADDED) — Implements INTENT-COMMAND-CATALOG-001
//
// 세계 밖에서 세계에 손댈 수 있는 것들의 목록.
//
// State 가 아니라 **세계의 성질**이다 (03 RATIONALE 1). State 는 세계가 굴러가며
// 달라지는 것인데 이 목록은 달라지지 않는다 — 세계마다 다른 것은 "지금 그것을
// 허용하는가"(World.DebugAuthority)이고 그것은 이미 State 로 있다.
// C007 R2 가 MUTABLE_ATTRIBUTES 에 내린 판단과 같은 판단이며, 그것을 명령 전체로 넓힌다.
//
// 세계 안의 행동(Interaction — 이동·채굴·스킬)과 다른 것이다.
// Interaction 은 몸이 세계 안에서 하는 일이고, Command 는 세계의 규칙 밖에서
// 세계에 손을 대는 일이다 (C007 R2 RULE-ATTRIBUTE-SET-001 주석의 표현 그대로).
//
// 새 명령이 세계에 생기면 이 파일의 CATALOG 에 항목이 하나 더해질 뿐이다 —
// Command / Parameter 구조도, 이것을 소비하는 쪽도 바뀌지 않는다.
// 그것이 INTENT-COMMAND-CATALOG-001 이 요구한 "항목이 하나 더해질 뿐" 이다.

import type {
  CommandDomainView,
  CommandParameterView,
  CommandView,
} from '../../protocol/gameview';
import { MUTABLE_ATTRIBUTES } from './combat';

/** 세계가 정의하는 명령 하나. available 은 State 로 판정되므로 여기에 없다. */
export interface CommandDefinition {
  id: string;
  /** 무엇을 하는가 (의미 코드 — 문구는 View 가 정한다) */
  effect: string;
  parameters: CommandParameterView[];
}

// set-attribute 의 attribute 자리 — 각 선택지가 value 자리의 Domain 을 정한다.
// 선택지 목록도 각 범위도 MUTABLE_ATTRIBUTES 가 단일 출처다 (C007 R2 REUSED).
// 여기서 목록을 다시 적지 않는다 — 두 곳에 적히면 반드시 어긋난다.
function attributeDomain(): CommandDomainView {
  return {
    kind: 'choice',
    options: MUTABLE_ATTRIBUTES.map((attribute) => ({
      name: attribute.id,
      thenDomain: attribute.values
        ? { kind: 'choice', options: attribute.values.map((value) => ({ name: value })) }
        : {
            kind: 'number',
            ...(attribute.min === undefined ? {} : { minimum: attribute.min }),
            ...(attribute.max === undefined ? {} : { maximum: attribute.max }),
          },
    })),
  };
}

export const COMMAND_CATALOG: readonly CommandDefinition[] = [
  {
    id: 'set-attribute',
    effect: 'set-attribute', // 존재의 속성 값을 바꾼다
    parameters: [
      {
        id: 'target',
        required: false,
        // 지목하지 않으면 요청한 이의 몸이다 (INTENT-ENTITY-ADDRESSABLE-001).
        // 가장 흔한 쓰임에 지목이 필요하지 않다.
        omittedMeaning: 'self',
        domain: { kind: 'entity', refers: 'character' },
      },
      {
        id: 'attribute',
        required: true,
        domain: attributeDomain(),
      },
      {
        id: 'value',
        required: true,
        // 앞 자리(attribute)의 선택이 이 자리의 Domain 을 정한다.
        domain: { kind: 'from-previous-choice' },
      },
    ],
  },
];

/**
 * 관찰되는 목록을 만든다 — 정의(성질)에 지금의 가용성(State 판정)을 얹는다.
 * available 이 거짓이어도 목록은 나간다: 무엇을 할 수 있는 세계인지는
 * 허용 여부와 별개로 알 수 있어야 한다 (04 commandCatalog.meaning).
 */
export function projectCommandCatalog(
  availabilityOf: (commandId: string) => string | null,
): CommandView[] {
  return COMMAND_CATALOG.map((command) => {
    const failure = availabilityOf(command.id);
    return {
      id: command.id,
      effect: command.effect,
      available: failure === null,
      ...(failure ? { reason: failure } : {}),
      parameters: command.parameters.map((parameter) => ({ ...parameter })),
    };
  });
}
