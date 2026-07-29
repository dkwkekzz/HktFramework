// three.js 미리보기 — 회색 스튜디오 3점 조명. GPU 는 미리보기 전용 (원칙 6).

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { VertexNormalsHelper } from "three/addons/helpers/VertexNormalsHelper.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createThreeGeometry } from "../export/glb.js";

export function createViewer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2c31);
  // 금속 미리보기용 중립 환경맵 — 미리보기 전용 GPU 경로 (원칙 6 위반 아님)
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 50);
  camera.position.set(0.35, 0.6, 0.95);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.45, 0);

  // 키/필/림 3점 조명 (03-phase1 §1.7)
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 3, 2);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.7);
  fill.position.set(-2, 1, -1);
  const rim = new THREE.DirectionalLight(0xfff2cc, 1.0);
  rim.position.set(0, -1, -3);
  scene.add(key, fill, rim, new THREE.AmbientLight(0x404040, 0.6));
  scene.add(new THREE.GridHelper(2, 20, 0x444444, 0x333333));

  const material = new THREE.MeshStandardMaterial({
    metalness: 0.9, roughness: 0.35, color: 0xcfd2d6, side: THREE.FrontSide,
  });
  const wireMaterial = new THREE.MeshBasicMaterial({ wireframe: true, color: 0x33ff88 });

  let bladeObject = null;
  let wireObject = null;
  let normalsHelper = null;
  const options = { wireframe: false, normals: false };

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  function rebuildHelpers() {
    if (wireObject) { scene.remove(wireObject); wireObject = null; }
    if (normalsHelper) { scene.remove(normalsHelper); normalsHelper.dispose?.(); normalsHelper = null; }
    if (!bladeObject) return;
    if (options.wireframe) {
      wireObject = new THREE.Mesh(bladeObject.geometry, wireMaterial);
      scene.add(wireObject);
    }
    if (options.normals) {
      normalsHelper = new VertexNormalsHelper(bladeObject, 0.01, 0xff5566);
      scene.add(normalsHelper);
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return {
    setMesh(generatedMesh) {
      if (bladeObject) {
        scene.remove(bladeObject);
        bladeObject.geometry.dispose();
      }
      bladeObject = new THREE.Mesh(createThreeGeometry(generatedMesh), material);
      bladeObject.name = "Blade";
      scene.add(bladeObject);
      // 바운드 기준 자동 프레이밍
      const { min, max } = generatedMesh.bounds;
      const center = new THREE.Vector3(
        (min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
      const radius = 0.5 * Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
      controls.target.copy(center);
      // FOV 에 맞춰 전체가 들어오는 거리 (+15% 여유)
      const dist = (radius * 1.15) / Math.tan((camera.fov * Math.PI) / 360);
      const dir = new THREE.Vector3(0.5, 0.2, 1).normalize();
      camera.position.copy(center).addScaledVector(dir, Math.max(dist, 0.2));
      rebuildHelpers();
    },
    setOption(name, value) {
      options[name] = value;
      rebuildHelpers();
    },
  };
}
