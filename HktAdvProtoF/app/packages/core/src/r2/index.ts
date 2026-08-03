// R2 사건이 남기는 흔적 — 세계의 변화가 관찰 가능한 현상으로 나타난다.

export {
  LEAK_CHANNELS,
  PHENOMENON_CHANNELS,
  SEALED_SLOTS,
  atomsMoving,
  checkLeakChannels,
  leakOf,
  leakSummary,
  leakVerdict,
  movableSlots,
  sealedOf,
  type LeakChannel,
  type LeakReport,
  type PhenomenonChannel,
  type SealedSlot,
} from './channel.ts';

export {
  TRACE_LIFESPAN,
  ambiguityOf,
  channelLabel,
  decayOf,
  emitPhenomena,
  emitVerdict,
  leakingEffects,
  movementOf,
  orderPhenomena,
  phenomenonIdOf,
  phenomenonLine,
  placeOf,
  type EmitOptions,
  type EmitResult,
  type WorldPhenomenon,
} from './emit.ts';

export {
  phenomenonViolationVerdict,
  violatePhenomenon,
  type PhenomenonViolation,
  type PhenomenonViolationRule,
} from './violation.ts';
