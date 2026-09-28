import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

/** A single baked Blender performance. No orbit, autoplay loop or video layer. */
export function mountMascot(host: HTMLElement, onError: () => void): () => void {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({alpha: true, antialias: true, powerPreference: 'low-power'});
  } catch {
    onError();
    return () => {};
  }
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1.2, -1.2, .1, 20);
  camera.position.set(0, .12, 4.5);
  camera.lookAt(0, .03, 0);
  scene.add(new THREE.HemisphereLight(0xe9f4ff, 0x7b8b79, 2));
  const key = new THREE.DirectionalLight(0xe7efff, 2.8);
  key.position.set(-3, 4, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff2da, 1);
  fill.position.set(3, 1, 3); scene.add(fill);
  const accent = getComputedStyle(host).getPropertyValue('--green').trim() || '#20de7c';
  const rim = new THREE.DirectionalLight(new THREE.Color(accent), 2.2);
  rim.position.set(3, 2, -3); scene.add(rim);

  let disposed = false;
  let visible = false;
  let ready = false;
  let finished = false;
  let frame = 0;
  let lastTime = 0;
  let elapsed = 0;
  let duration = 9;
  let mixer: THREE.AnimationMixer | undefined;
  let model: THREE.Group | undefined;

  function stage() {
    const value = elapsed < 2.65 ? 'enter' : elapsed < 4.7 ? 'glasses' : elapsed < 5.5 ? 'wink' : 'point';
    if (host.dataset.mascotStage !== value) host.dataset.mascotStage = value;
  }
  function draw(now: number) {
    frame = 0;
    if (disposed || !ready || !visible || document.hidden) {lastTime = 0; return;}
    const delta = lastTime ? Math.min((now - lastTime) / 1000, .05) : 0;
    lastTime = now;
    elapsed = Math.min(duration, elapsed + delta);
    mixer?.setTime(elapsed);
    stage();
    renderer.render(scene, camera);
    finished = elapsed >= duration;
    if (finished) host.dataset.mascotStage = 'complete';
    else frame = requestAnimationFrame(draw);
  }
  function wake() {
    if (disposed || !ready || !visible || document.hidden || finished || frame) return;
    lastTime = 0;
    frame = requestAnimationFrame(draw);
  }
  function resize() {
    const {width, height} = host.getBoundingClientRect();
    if (!width || !height || disposed) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth <= 620 ? 1 : 1.5));
    renderer.setSize(width, height);
    // Keep the full body and raised hand inside narrow tablet cards too.
    const aspect = width / height;
    const halfHeight = Math.max(1.2, .74 / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    if (ready) renderer.render(scene, camera);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host); resize();
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) {cancelAnimationFrame(frame); frame = 0; lastTime = 0;}
    else wake();
  }, {threshold: .01});
  visibility.observe(host);
  document.addEventListener('visibilitychange', wake);
  const contextLost = (event: Event) => {event.preventDefault(); if (!disposed) onError();};
  canvas.addEventListener('webglcontextlost', contextLost);

  function disposeModel(root: THREE.Group) {
    const textures = new Set<THREE.Texture>();
    const materials = new Set<THREE.Material>();
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    materials.forEach(material => material.dispose());
    textures.forEach(texture => {texture.dispose(); if (texture.image instanceof ImageBitmap) texture.image.close();});
  }
  new GLTFLoader().load(`${import.meta.env.BASE_URL}landing-assets/labrica-mascot.glb`, gltf => {
    if (disposed) {disposeModel(gltf.scene); return;}
    model = gltf.scene;
    // The rig starts outside the canvas. Its first-frame bounds must not cull
    // small animated parts (glasses, hands, eyes) after they enter the view.
    model.traverse(object => {if (object instanceof THREE.Mesh) object.frustumCulled = false;});
    scene.add(model);
    const clip = gltf.animations.find(animation => animation.name === 'Enter_AdjustGlasses_Wink_Point') ?? gltf.animations[0];
    if (!clip) {onError(); return;}
    mixer = new THREE.AnimationMixer(model);
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
    mixer.setTime(0);
    duration = clip.duration;
    ready = true;
    host.dataset.mascotReady = 'true';
    renderer.render(scene, camera);
    wake();
  }, undefined, () => {if (!disposed) onError();});

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    visibility.disconnect(); resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', wake);
    canvas.removeEventListener('webglcontextlost', contextLost);
    mixer?.stopAllAction();
    if (model) {mixer?.uncacheRoot(model); disposeModel(model);}
    renderer.dispose(); canvas.remove();
    delete host.dataset.mascotReady; delete host.dataset.mascotStage;
  };
}
