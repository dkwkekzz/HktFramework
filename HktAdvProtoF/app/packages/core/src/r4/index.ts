// R4 믿는 세계 — 읽은 것에서 무엇이 있었는지를 짐작한다. 실제와 믿음이 갈린 채로 남는다.

export {
  CHANNEL_GUESSES,
  candidatesOf,
  checkCandidateCoverage,
  checkGuessFloor,
  checkGuesses,
  coversAtom,
  guessFor,
  guessLine,
  guessOf,
  guessVerdict,
  spreadOf,
  type ChannelGuess,
  type GuessReport,
} from './guess.ts';

export {
  auditBeliefs,
  beliefGraphVerdict,
  beliefsFor,
  believersOf,
  compareToTruth,
  interpret,
  openBeliefGraph,
  readingTable,
  recordBeliefs,
  staleBeliefs,
  unbelieved,
  type BeliefAudit,
  type BeliefCheck,
  type BeliefGraph,
  type Believer,
  type Reading,
  type ReadingRow,
} from './graph.ts';

export {
  BELIEF_TRUTH_FIELDS,
  CONFIDENCE_WEIGHTS,
  assertionOf,
  atomsOutsideGuessing,
  beliefIdOf,
  beliefLine,
  checkBelief,
  confidenceCap,
  confidenceFactors,
  confidenceOf,
  confidenceTrace,
  formBelief,
  narrowByGrammar,
  orderBeliefs,
  reinforce,
  scoreOf,
  type Belief,
  type BeliefResult,
  type ConfidenceFactor,
} from './belief.ts';

export {
  beliefViolationVerdict,
  violateBelief,
  type BeliefViolation,
  type BeliefViolationRule,
} from './violation.ts';
