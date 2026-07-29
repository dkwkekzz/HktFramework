// §15 종족 생존 구조의 실행 연결 (G-4).
//
// 번식은 "새 개체가 생긴다"는 뜻이고, 세계에서 새 개체를 만드는 것은 규칙(create_entity)뿐이다.
// 그래서 번식 선언을 AI 에게 다시 묻지 않고 **세계에 이미 있는 것에서 찾는다** —
// 어떤 규칙이 만드는 개체 템플릿의 species_id 가 이 종이면, 그 규칙이 이 종의 번식이다.
// 수동 세계와 생성 세계가 같은 함수를 쓴다(연결 방식이 갈라지지 않게).
import type { EntityTemplate, RuleDefinition } from "../rules/RuleTypes";
import type { SpeciesDefinition } from "./types";

export function linkReproductionRules(
  species: readonly SpeciesDefinition[],
  rules: readonly RuleDefinition[],
  templates: readonly EntityTemplate[],
): SpeciesDefinition[] {
  const speciesOfTemplate = new Map<string, string>();
  for (const template of templates) {
    const speciesId = template.states["species_id"];
    if (typeof speciesId === "string" && speciesId !== "") speciesOfTemplate.set(template.id, speciesId);
  }

  const rulesBySpecies = new Map<string, string[]>();
  for (const rule of rules) {
    for (const effect of rule.effects) {
      if (effect.type !== "create_entity") continue;
      const speciesId = speciesOfTemplate.get(effect.templateId);
      if (speciesId === undefined) continue;
      const list = rulesBySpecies.get(speciesId) ?? [];
      if (!list.includes(rule.id)) list.push(rule.id);
      rulesBySpecies.set(speciesId, list);
    }
  }

  return species.map((entry) => {
    const linked = [...new Set([...(entry.reproductionRuleIds ?? []), ...(rulesBySpecies.get(entry.id) ?? [])])];
    return linked.length === 0 ? entry : { ...entry, reproductionRuleIds: linked };
  });
}
