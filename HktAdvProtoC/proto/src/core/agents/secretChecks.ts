// §25 knownSecrets 의 실측 (G-8)
//
// 비밀은 세 경로로 산다: ① 초기 관계 선언(§41 은닉 동기의 목격자) ② 발각의 기록(record_secret)
// ③ 협박의 지렛대(known_secrets 조건). "필드가 있다"가 아니라 **같은 협박이 비밀 유무로 다르게 박히는가**를 잰다.
// verify.ts 와 테스트가 같은 함수를 쓴다.
import { buildManualWorld } from "../../content/manual-world";
import { RuleEngine } from "../rules/RuleEngine";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { WorldRuntime } from "../world/WorldRuntime";
import { recordSecret, relationshipView, secretsAbout } from "./RelationshipSystem";

export interface SecretMeasures {
  /** 초기 관계 선언에서 온 비밀 (30일 이전, 부트스트랩 직후) */
  initialSecrets: { fromId: string; toId: string; secret: string }[];
  /** 같은 거짓말 60회 — 발각된 만큼 비밀이 남는가 */
  lieAttempts: number;
  secretsFromLies: number;
  /** 같은 협박 — 비밀이 없을 때/있을 때의 공포 상승 */
  fearWithoutSecret: number;
  fearWithSecret: number;
  ok: boolean;
}

function fresh(seed: number): { runtime: WorldRuntime; engine: RuleEngine } {
  const runtime = new WorldRuntime(buildManualWorld(seed));
  bootstrapWorld(runtime);
  return { runtime, engine: new RuleEngine(runtime.definition.ruleDefinitions) };
}

export function measureSecrets(seed = 42): SecretMeasures {
  // ① 초기 비밀 — 부트스트랩 직후 관계 원장에 이미 있다
  const base = fresh(seed);
  const initialSecrets: SecretMeasures["initialSecrets"] = [];
  for (const [key, relation] of Object.entries(base.runtime.state.relationships)) {
    for (const secret of relation.knownSecrets) {
      const [fromId, toId] = key.split("|");
      initialSecrets.push({ fromId: fromId ?? "?", toId: toId ?? "?", secret });
    }
  }

  // ② 발각 → 기록 — 같은 거짓말을 60회 반복하면 확률(0.15)이 언젠가 실현되어 비밀이 남는다.
  //    같은 거짓의 비밀 문구는 같으므로 원장에는 한 번만 남는다(§25 — 기록은 사실이지 횟수가 아니다).
  const lie = fresh(seed);
  const lieAttempts = 60;
  for (let i = 0; i < lieAttempts; i++) {
    lie.engine.dispatchAction(lie.runtime, "action.lie", "agent.ren", ["agent.mar"]);
    lie.runtime.state.simulationTime += 1; // 확률 스트림이 tick 에 걸려 있다(§39)
  }
  const secretsFromLies = secretsAbout(lie.runtime, "agent.mar", "agent.ren").length;

  // ③ 지렛대 — 같은 협박, 비밀 유무만 다르다
  const plain = fresh(seed);
  const plainBefore = relationshipView(plain.runtime, "agent.mar", "agent.kael").fear;
  plain.engine.dispatchAction(plain.runtime, "action.threaten", "agent.kael", ["agent.mar"]);
  const fearWithoutSecret = relationshipView(plain.runtime, "agent.mar", "agent.kael").fear - plainBefore;

  const leveraged = fresh(seed);
  recordSecret(leveraged.runtime, "agent.kael", "agent.mar", "회관 창고의 장부가 비어 있다");
  const leveragedBefore = relationshipView(leveraged.runtime, "agent.mar", "agent.kael").fear;
  leveraged.engine.dispatchAction(leveraged.runtime, "action.threaten", "agent.kael", ["agent.mar"]);
  const fearWithSecret = relationshipView(leveraged.runtime, "agent.mar", "agent.kael").fear - leveragedBefore;

  return {
    initialSecrets,
    lieAttempts,
    secretsFromLies,
    fearWithoutSecret,
    fearWithSecret,
    ok: initialSecrets.length > 0 && secretsFromLies > 0 && fearWithSecret > fearWithoutSecret,
  };
}
