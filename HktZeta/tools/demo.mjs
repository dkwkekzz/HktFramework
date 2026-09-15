// 눈으로 보는 검증 — 오라클 궤적을 ASCII 지도로 굳힌다.
// 사용: node tools/demo.mjs [seed] [ticks] [count]
import { seedWorld, step, hashState, run } from '../core/world.mjs';

const seed = Number(process.argv[2] ?? 7);
const ticks = Number(process.argv[3] ?? 400);
const count = Number(process.argv[4] ?? 8);

// 궤적을 누적해 방문한 셀을 센다.
let s = seedWorld(seed, count);
const visits = new Map();
const mark = (b) => {
  const k = `${b.x},${b.y}`;
  visits.set(k, (visits.get(k) ?? 0) + 1);
};
s.beings.forEach(mark);
for (let i = 0; i < ticks; i++) { s = step(s); s.beings.forEach(mark); }

// 화면 범위 계산
let minX = 0, maxX = 0, minY = 0, maxY = 0;
for (const k of visits.keys()) {
  const [x, y] = k.split(',').map(Number);
  minX = Math.min(minX, x); maxX = Math.max(maxX, x);
  minY = Math.min(minY, y); maxY = Math.max(maxY, y);
}
const W = 78, H = 30;
const sx = (maxX - minX) || 1, sy = (maxY - minY) || 1;
const grid = Array.from({ length: H }, () => Array(W).fill(' '));
const shades = ' .:-=+*#%@';
for (const [k, v] of visits) {
  const [x, y] = k.split(',').map(Number);
  const gx = Math.floor(((x - minX) / sx) * (W - 1));
  const gy = Math.floor(((y - minY) / sy) * (H - 1));
  const idx = Math.min(shades.length - 1, Math.floor(Math.log2(v + 1)));
  grid[gy][gx] = shades[idx];
}

console.log(`HktZeta 궤적  seed=${seed} ticks=${ticks} beings0=${count}`);
console.log(`최종 개체수=${s.beings.length}  방문 셀=${visits.size}  지문=${hashState(s).toString(16)}`);
console.log('┌' + '─'.repeat(W) + '┐');
for (const row of grid) console.log('│' + row.join('') + '│');
console.log('└' + '─'.repeat(W) + '┘');
console.log('밀도: ' + shades.split('').join(' '));

// 결정론 재확인(같은 seed 두 번 → 같은 지문)
const again = hashState(run(seed, ticks, count));
console.log('결정론 재현: ' + (again === hashState(s) ? 'OK ✅' : 'FAIL ❌'));
