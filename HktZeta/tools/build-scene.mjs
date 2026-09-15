// Scene 를 Node 에서 굳혀 render/scene.json 으로 쓴다(core 가 권위, 브라우저는 순수 소비자).
// 사용: node tools/build-scene.mjs [seed] [ticks] [count]
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildScene } from '../render/viewmodel.mjs';

const seed = Number(process.argv[2] ?? 7);
const ticks = Number(process.argv[3] ?? 400);
const count = Number(process.argv[4] ?? 8);

const scene = buildScene(seed, ticks, count);
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'render', 'scene.json');
writeFileSync(out, JSON.stringify(scene));
console.log(`scene.json 작성: seed=${seed} ticks=${ticks} count=${count}`);
console.log(`  bodies=${scene.bodies.length} trails=${scene.trails.length}×${scene.trails[0].length} terrain=${scene.terrain.W}×${scene.terrain.H}`);
