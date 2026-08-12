// 3D Terrain — mining-field Scene 의 구릉 지형.
// 높이는 순수 시각 표현이다 — World 의 게임 판정(거리·이동)은 평면 (x,z) 위에서 이루어진다.

import * as THREE from 'three';

export const TERRAIN_SIZE = 120; // 지평선까지 보이도록 World.Bounds(40) 보다 넓게 그린다

// 시각 높이 함수 — 스프라이트·트레일·라벨도 이 함수로 지면에 붙는다.
// 중앙(플레이 영역)은 완만하고 멀어질수록 언덕이 커진다.
export function heightAt(x: number, z: number): number {
  const r = Math.sqrt(x * x + z * z);
  const amp = 0.25 + Math.min(r / 30, 1) * 3.2;
  return (
    amp * (Math.sin(x * 0.11) * Math.cos(z * 0.09) * 0.7 + Math.sin(x * 0.05 + z * 0.07) * 0.5)
  );
}

export function createTerrain(): THREE.Mesh {
  const segments = 120;
  const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  const base = new THREE.Color(0x567a3f);
  const high = new THREE.Color(0x6d924d);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const t = Math.min(Math.max((h + 1) / 5, 0), 1);
    const c = base.clone().lerp(high, t);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  mesh.name = 'terrain-ground';
  return mesh;
}
