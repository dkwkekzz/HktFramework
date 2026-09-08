import { REGION_SPECS, REGION_GRAPH, COMPILE_RULES, TRACE_LAYER } from './content/regions';
import { compileRegion } from './engine/world-authoring/compile';
import { descriptionHash } from './engine/world-authoring/description';
const out: Record<string, unknown> = {};
for (const spec of [...REGION_SPECS].sort((a, b) => a.id.localeCompare(b.id))) {
  const w = compileRegion(spec.space, COMPILE_RULES).world;
  const surface: Record<string, number> = {};
  for (const s of w.surface as unknown as string[]) surface[s] = (surface[s] ?? 0) + 1;
  out[spec.id] = {
    hash: descriptionHash(spec.space),
    surface,
    traversable: (w.traversable as unknown as boolean[]).filter(Boolean).length,
    exits: REGION_GRAPH.connectors.filter((c) => c.from.region === spec.id).map((c) => c.id),
    traceOps: spec.space.ops.filter((o) => o.layer === TRACE_LAYER).map((o) => o.tag ?? o.id),
    sources: (spec.resourceEcology?.sources ?? []).map((s) => s.id),
  };
}
process.stdout.write(JSON.stringify(out, null, 1));
