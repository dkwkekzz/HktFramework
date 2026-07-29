// three.js 미리보기 — 회색 스튜디오 + 환경맵. GPU 는 미리보기 전용 (원칙 6).
// Phase 2: 조립된 검(부품 4종 + Transform) 표시, 부품 토글, 소켓 gizmo.

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
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 50);
  camera.position.set(0.35, 0.3, 0.95);

  const controls = new OrbitControls(camera, renderer.domElement);

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

  const root = new THREE.Group();
  root.name = "SwordRoot";
  scene.add(root);

  const options = {
    wireframe: false, normals: false, sockets: false,
    showBlade: true, showGuard: true, showGrip: true, showPommel: true,
  };
  const visibilityKey = { Blade: "showBlade", Guard: "showGuard", Grip: "showGrip", Pommel: "showPommel" };
  let helpers = [];
  let currentParts = [];

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
    for (const h of helpers) { scene.remove(h); h.dispose?.(); }
    helpers = [];
    for (const obj of root.children) {
      const partVisible = options[visibilityKey[obj.name]] ?? true;
      obj.visible = partVisible;
      if (!partVisible) continue;
      if (options.wireframe) {
        const wire = new THREE.Mesh(obj.geometry, wireMaterial);
        wire.position.copy(obj.position);
        scene.add(wire);
        helpers.push(wire);
      }
      if (options.normals) {
        const nh = new VertexNormalsHelper(obj, 0.008, 0xff5566);
        scene.add(nh);
        helpers.push(nh);
      }
    }
    if (options.sockets) {
      for (const part of currentParts) {
        const axes = new THREE.AxesHelper(0.03);
        axes.position.set(part.transform[0], part.transform[1], part.transform[2]);
        scene.add(axes);
        helpers.push(axes);
      }
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return {
    /** @param parts {name, mesh, transform}[] — assembleSword 결과 */
    setParts(parts) {
      currentParts = parts;
      for (const obj of [...root.children]) {
        root.remove(obj);
        obj.geometry.dispose();
      }
      const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (const part of parts) {
        const obj = new THREE.Mesh(createThreeGeometry(part.mesh), material);
        obj.name = part.name;
        obj.position.set(part.transform[0], part.transform[1], part.transform[2]);
        root.add(obj);
        for (let k = 0; k < 3; k++) {
          bounds.min[k] = Math.min(bounds.min[k], part.mesh.bounds.min[k] + part.transform[k]);
          bounds.max[k] = Math.max(bounds.max[k], part.mesh.bounds.max[k] + part.transform[k]);
        }
      }
      const center = new THREE.Vector3(
        (bounds.min[0] + bounds.max[0]) / 2,
        (bounds.min[1] + bounds.max[1]) / 2,
        (bounds.min[2] + bounds.max[2]) / 2);
      const radius = 0.5 * Math.hypot(
        bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]);
      controls.target.copy(center);
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
