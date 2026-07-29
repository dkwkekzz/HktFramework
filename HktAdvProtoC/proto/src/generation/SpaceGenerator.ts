// 6단계-a: 세계 공간 생성 (§13)
//
// AI 는 지역의 성격(위험·접근성·안정성)과 장소 목록·연결만 만든다.
// 좌표와 희귀도는 코드가 계산한다 — "특정 자원을 직접 배치하지 않는다. 지역의 조건으로부터 결정한다"(§13).
import type { LocationDefinition, RegionDefinition, SpaceDefinition, WorldAxiom } from "../core/world/types";
import { calculateResourceRarity, placeInRegion, type RegionBounds } from "./derivations";
import type { GenerationContext } from "./GenerationTypes";
import { SPACE_DRAFT_SCHEMA } from "./OutputSchemas";
import { generateChecked } from "./TextGenerationPort";

export const SPACE_TASK = "space";

interface RegionDraft {
  id: string;
  name: string;
  bounds: RegionBounds;
  tags: string[];
  baseStates: Record<string, unknown>;
  danger: number;
  accessibility: number;
  environmentalStability: number;
  speciesSuitability?: Record<string, number>;
}

interface LocationDraft {
  id: string;
  name: string;
  regionId: string;
  tags: string[];
  baseStates: Record<string, unknown>;
  position?: { x: number; y: number; z: number };
}

interface SpaceDraft {
  regions: RegionDraft[];
  locations: LocationDraft[];
  connections: SpaceDefinition["connections"];
}

/** 지역의 성격 — 자원 희귀도·배치가 여기서 파생된다 */
export interface RegionProfile {
  id: string;
  bounds: RegionBounds;
  danger: number;
  accessibility: number;
  environmentalStability: number;
  /** §13 calculateResourceRarity 의 결과 */
  rarity: number;
  speciesSuitability: Record<string, number>;
}

export interface SpaceResult {
  space: SpaceDefinition;
  profiles: RegionProfile[];
}

const SYSTEM_PROMPT = [
  "너는 세계 생성 컴파일러의 6단계다. 세계의 공간을 만든다(§13).",
  "지역마다 위험도·접근성·환경 안정성을 매긴다. 이 세 값에서 희귀 자원의 분포가 파생되므로,",
  "'위험한 곳일수록 귀한 것이 있다'는 명제가 지도 위에서 성립하도록 값을 배분한다.",
  "장소의 좌표는 지정하지 않는다 — 고정 지형지물이 아니라면 배치는 코드가 시드로 계산한다.",
  "지역 사이 연결에는 이동 비용·위험·수용량을 준다. 연결이 없으면 주체는 그 지역에 갈 수 없다.",
  "어떤 길은 아무나 건널 수 없다 — 그런 길에는 requirements 로 통행 조건을 건다(§13). 조건을 갖추지 못한 주체에게 그 길은 없는 것과 같다.",
].join("\n");

export async function generateSpace(
  ctx: GenerationContext,
  axioms: readonly WorldAxiom[],
): Promise<SpaceResult> {
  const draft = await generateChecked<SpaceDraft>(
    ctx.port,
    {
      taskId: SPACE_TASK,
      systemPrompt: SYSTEM_PROMPT,
      input: {
        ecologyAxioms: axioms
          .filter((axiom) => axiom.category === "ecology" || axiom.category === "survival")
          .map((axiom) => ({ id: axiom.id, statement: axiom.statement })),
        regionCount: ctx.scale.regions,
        locationCount: ctx.scale.locations,
      },
      outputSchema: SPACE_DRAFT_SCHEMA,
    },
    ctx.telemetry,
  );

  if (draft.regions.length !== ctx.scale.regions) {
    throw new Error(`지역 수가 §40 규모와 다르다 — ${draft.regions.length} (목표 ${ctx.scale.regions})`);
  }
  if (draft.locations.length !== ctx.scale.locations) {
    throw new Error(`장소 수가 §40 규모와 다르다 — ${draft.locations.length} (목표 ${ctx.scale.locations})`);
  }

  const boundsOf = new Map(draft.regions.map((region) => [region.id, region.bounds]));
  const regions: RegionDefinition[] = draft.regions.map((region) => ({
    id: region.id,
    name: region.name,
    bounds: region.bounds,
    tags: region.tags,
    baseStates: region.baseStates,
  }));

  const locations: LocationDefinition[] = draft.locations.map((location) => {
    const bounds = boundsOf.get(location.regionId);
    if (bounds === undefined) throw new Error(`장소가 없는 지역에 붙었다 — ${location.id} → ${location.regionId}`);
    // 좌표는 코드 몫 (§5.1 각주). AI 가 명시한 경우에만 그 값을 존중한다.
    const position =
      location.position === undefined
        ? placeInRegion(ctx.worldSeed, location.id, location.regionId, bounds)
        : { regionId: location.regionId, ...location.position };
    return {
      id: location.id,
      name: location.name,
      regionId: location.regionId,
      position,
      tags: location.tags,
      baseStates: location.baseStates,
    };
  });

  const known = new Set([...regions.map((r) => r.id), ...locations.map((l) => l.id)]);
  for (const connection of draft.connections) {
    if (!known.has(connection.from) || !known.has(connection.to)) {
      throw new Error(`연결이 없는 곳을 가리킨다 — ${connection.from} → ${connection.to}`);
    }
  }
  // 모든 지역은 최소 한 번은 연결되어야 한다 — 갈 수 없는 지역은 세계가 아니다
  for (const region of regions) {
    const linked = draft.connections.some((c) => c.from === region.id || c.to === region.id);
    if (!linked) throw new Error(`어디에서도 갈 수 없는 지역 — ${region.id} (§13)`);
  }

  const profiles: RegionProfile[] = draft.regions.map((region) => ({
    id: region.id,
    bounds: region.bounds,
    danger: region.danger,
    accessibility: region.accessibility,
    environmentalStability: region.environmentalStability,
    rarity: Math.round(
      calculateResourceRarity(region.danger, region.accessibility, region.environmentalStability) * 10,
    ) / 10,
    speciesSuitability: region.speciesSuitability ?? {},
  }));

  ctx.symbols.declareAll("region", regions.map((region) => region.id));
  ctx.symbols.declareAll("location", locations.map((location) => location.id));
  return { space: { regions, locations, connections: draft.connections }, profiles };
}
