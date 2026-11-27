import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export function mountTraderBird(host: HTMLElement, ready: () => void) {
  const abort = new AbortController();
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.setSize(80, 80, false);
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0.28, 5.9);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x344657, 2.65));
  const key = new THREE.DirectionalLight(0xffedcf, 3);
  key.position.set(3, 4, 6);
  scene.add(key);
  const flight = new THREE.Group();
  scene.add(flight);

  function disposeModel(model: THREE.Object3D) {
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) {
            if (typeof ImageBitmap !== "undefined" && value.image instanceof ImageBitmap) value.image.close();
            value.dispose();
          }
        }
        material.dispose();
      }
    });
  }

  let model: THREE.Group | undefined;
  let mixer: THREE.AnimationMixer | undefined;
  let frame = 0;
  let last = 0;
  let elapsed = 0;
  function draw(time: number) {
    const delta = last ? Math.min((time - last) / 1000, 0.1) : 0;
    last = time;
    if (!document.hidden && host.parentElement?.dataset.stationary !== "true") {
      elapsed += delta;
      mixer?.update(delta);
      flight.rotation.set(0.02, -0.65 + Math.sin(elapsed * 0.7) * 0.24, 0.04);
    }
    renderer.render(scene, camera);
    frame = requestAnimationFrame(draw);
  }

  void (async () => {
    const response = await fetch("/api/private/assistant/bird", { credentials: "same-origin", signal: abort.signal });
    if (!response.ok) return;
    const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), "");
    if (abort.signal.aborted) { disposeModel(gltf.scene); return; }
    model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(span) || span <= 0 || !gltf.animations.length) return;
    const scale = 2.75 / span;
    model.position.sub(bounds.getCenter(new THREE.Vector3())).multiplyScalar(scale);
    model.scale.setScalar(scale);
    flight.add(model);
    flight.rotation.y = -0.65;
    mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(gltf.animations[0]).play();
    renderer.render(scene, camera);
    ready();
    frame = requestAnimationFrame(draw);
  })().catch(() => { /* Original bird portrait remains as the fallback. */ });

  return () => {
    abort.abort();
    cancelAnimationFrame(frame);
    mixer?.stopAllAction();
    if (model) disposeModel(model);
    renderer.dispose();
    renderer.domElement.remove();
  };
}
