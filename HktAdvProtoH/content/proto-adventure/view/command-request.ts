// 명령 한 줄 → Action Request (C009 — 04 interactions.setAttribute.composedFrom).
//
// 무엇을 모아야 하는지는 세계가 밝힌 목록이 정했다 (command-presentation).
// 여기서 하는 일은 모아 둔 값들을 그 interaction 의 요청 형태에 싣는 것뿐이다.
//
// 요청 형태는 명령마다 다르다 — 04 는 setAttribute 의 형태를
// SetAttribute(TargetActorId?, AttributeId, Value) 로 고정했다.
// 그래서 명령이 늘면 이 표에 한 줄이 는다. 세계 쪽 dispatch 의 분기와 짝을 이루며,
// 목록·안내·기록 표면은 그대로다 (07 NOTES 참조).

import type { ActionRequest } from '../protocol/actions';

type RequestBuilder = (values: Record<string, string>) => ActionRequest | null;

const BUILDERS: Record<string, RequestBuilder> = {
  'set-attribute': (values) => {
    const attribute = values.attribute;
    const raw = values.value;
    if (attribute === undefined || raw === undefined) return null;
    // 수치로 읽히면 수치로, 아니면 낱말 그대로 보낸다 (moveMode 는 낱말이다).
    // 받아들일지는 세계가 정한다 — 여기서 판정하지 않는다.
    const numeric = Number(raw);
    const value = raw.trim() !== '' && Number.isFinite(numeric) ? numeric : raw;
    return {
      interactionId: 'set-attribute',
      ...(values.target ? { targetEntityId: values.target } : {}),
      attribute: { id: attribute, value },
    };
  },
  // C014 — 되돌림. 지목하지 않으면 알고 있는 전부다 (omittedMeaning: all-known).
  // 그래서 target 이 없으면 아무것도 싣지 않는다 — 세계가 그 뜻을 안다.
  'forget-acquaintance': (values) => ({
    interactionId: 'forget-acquaintance',
    ...(values.target ? { targetEntityId: values.target } : {}),
  }),
};

/**
 * 등록되지 않은 명령은 이름만 실어 보낸다 — 세계가 "그런 것을 걸 수 없다" 고
 * 대답할 것이고, 그 대답이 화면에 보인다. 표현 누락이 게임을 멈추지 않는다.
 */
export function commandActionRequest(
  commandId: string,
  values: Record<string, string>,
): ActionRequest | null {
  const builder = BUILDERS[commandId];
  if (!builder) return { interactionId: commandId };
  return builder(values);
}
