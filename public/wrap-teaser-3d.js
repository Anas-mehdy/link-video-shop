import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const phone = document.getElementById('phone');
const slider = document.getElementById('progress');
const prompt = document.getElementById('prompt');
const reaction = document.getElementById('reaction');
const status = document.getElementById('model-status');
const canvas = document.getElementById('phone-canvas');

let dragging = false;
let finishTimer;
let renderer, scene, camera, rig, filmMaterials = [];
let progress = 0;

const surface = {
  '背面-背板': ['#642739', .31, .48],
  '背面-边框': ['#823e53', .55, .31],
  '背面-天线': ['#50222f', .35, .55],
  '按钮': ['#853d51', .60, .29],
  '金属2': ['#4b2335', .72, .25],
  'logo': ['#b17b91', .40, .49],
  '漫射1': ['#111522', .18, .16],
  '通用材质3': ['#171b28', .19, .17],
  '通用材质2': ['#271a28', .61, .20],
  '通用材质1': ['#6e3042', .52, .31],
  '镜头玻璃': ['#09121f', .14, .09],
  '镜面1': ['#0b1623', .72, .12],
  '光泽1': ['#102034', .48, .13],
};

function materialFor(original) {
  const name = original?.name || '';
  const entry = Object.entries(surface).find(([key]) => name.includes(key));
  const [color, metalness, roughness] = entry?.[1] || ['#713148', .46, .35];
  return new THREE.MeshStandardMaterial({
    name,
    color,
    metalness,
    roughness,
    side: THREE.DoubleSide,
  });
}

function coatMaterial() {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uReveal: { value: -430 },
      uOpacity: { value: 1 },
    },
    vertexShader: `
      varying vec3 vSurface;
      varying vec3 vNormal;
      void main() {
        vSurface = position;
        vNormal = normalize(normalMatrix * normal);
        vec3 lifted = position + normal * 1.8;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(lifted, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uReveal;
      uniform float uOpacity;
      varying vec3 vSurface;
      varying vec3 vNormal;
      void main() {
        if (vSurface.x > uReveal) discard;
        float front = exp(-abs(vSurface.x - uReveal) / 28.0);
        float ribbon = pow(max(0.0, sin(vSurface.z * 0.014 - uReveal * 0.019)), 13.0);
        float glint = pow(1.0 - abs(vNormal.z), 2.0);
        vec3 tint = mix(vec3(0.25, 0.75, 1.0), vec3(0.91, 0.98, 1.0), min(1.0, front * 1.4 + ribbon * 0.55));
        float alpha = (0.20 + front * 0.61 + ribbon * 0.14 + glint * 0.10) * uOpacity;
        gl_FragColor = vec4(tint, clamp(alpha, 0.0, 0.87));
      }
    `,
  });
  filmMaterials.push(material);
  return material;
}

function render() {
  if (!renderer) return;
  rig.rotation.y = Math.PI * 2 * progress / 100;
  for (const material of filmMaterials) {
    material.uniforms.uReveal.value = -430 + progress * 8.6;
  }
  renderer.render(scene, camera);
}

function setProgress(value) {
  progress = Math.max(0, Math.min(100, Number(value) || 0));
  slider.value = Math.round(progress);
  if (finishTimer) clearTimeout(finishTimer);
  for (const material of filmMaterials) material.uniforms.uOpacity.value = 1;
  phone.classList.remove('finished');
  reaction.classList.remove('visible');
  prompt.textContent = 'اسحب ولف الجوال وركّب التغليف ↔';
  if (progress >= 99) {
    prompt.textContent = 'لحظة… شوف النتيجة';
    finishTimer = setTimeout(() => {
      phone.classList.add('finished');
      reaction.classList.add('visible');
      prompt.textContent = 'تم تركيب التغليف';
      const started = performance.now();
      function fade(now) {
        const opacity = 1 - Math.min(1, (now - started) / 580);
        for (const material of filmMaterials) material.uniforms.uOpacity.value = opacity;
        render();
        if (opacity > 0 && progress >= 99) requestAnimationFrame(fade);
      }
      requestAnimationFrame(fade);
    }, 520);
  }
  render();
}

function fromPointer(event) {
  const rect = phone.getBoundingClientRect();
  setProgress((event.clientX - rect.left) / rect.width * 100);
}

phone.addEventListener('pointerdown', event => {
  dragging = true;
  phone.setPointerCapture(event.pointerId);
  fromPointer(event);
});
phone.addEventListener('pointermove', event => { if (dragging) fromPointer(event); });
phone.addEventListener('pointerup', () => { dragging = false; });
phone.addEventListener('pointercancel', () => { dragging = false; });
slider.addEventListener('input', () => setProgress(slider.value));

async function loadModel() {
  const paths = Array.from({length:13}, (_,i) => `/wrap-model/part-${String(i).padStart(2,'0')}.txt`);
  const chunks = await Promise.all(paths.map(async path => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Unable to load ${path}`);
    return response.text();
  }));
  const encoded = chunks.join('');
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new FBXLoader().parse(bytes.buffer, '');
}

function init(sceneModel) {
  renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.7;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 2/3, .1, 100);
  camera.position.set(0, .02, 8.5);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xd6e9ff, 0x503047, 2.5));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(-3, 4, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x68caff, 2.3);
  rim.position.set(4, 1, -4); scene.add(rim);

  sceneModel.updateMatrixWorld(true);
  const target = sceneModel.getObjectByName('_iPhone_18_2') ||
    sceneModel.getObjectByName('_iPhone_18') || sceneModel;
  const model = target.clone(true);
  if (target.parent) model.applyMatrix4(target.parent.matrixWorld);
  let meshCount = 0;
  const coating = [];
  model.traverse(child => {
    if (!child.isMesh) return;
    meshCount++;
    const original = Array.isArray(child.material) ? child.material : [child.material];
    const names = original.map(m => m?.name || '');
    child.material = Array.isArray(child.material) ? original.map(materialFor) : materialFor(original[0]);
    if (names.some(name => /背面-背板|背面-边框|漫射1|通用材质3|按钮/.test(name))) {
      const layer = child.clone(false);
      layer.material = coatMaterial();
      layer.renderOrder = 4;
      coating.push([child,layer]);
    }
  });
  if (!meshCount) throw new Error('No meshes found in the phone model');
  coating.forEach(([base,layer]) => base.parent.add(layer));

  rig = new THREE.Group();
  scene.add(rig);
  const centerHolder = new THREE.Group();
  centerHolder.add(model);
  const bounds = new THREE.Box3().setFromObject(centerHolder);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  centerHolder.position.sub(center);
  rig.add(centerHolder);
  rig.scale.setScalar(4.5 / Math.max(size.x,size.y,size.z));
  if (size.z > size.y * 1.2) rig.rotation.x = -Math.PI / 2;

  function resize() {
    const width = phone.clientWidth;
    const height = phone.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  }
  new ResizeObserver(resize).observe(phone);
  phone.classList.add('loaded');
  status.textContent = '';
  resize();
  setProgress(progress);
}

loadModel().then(init).catch(error => {
  console.error('3D phone failed to load:', error);
  status.textContent = 'تعذّر تشغيل العرض ثلاثي الأبعاد على هذا الجهاز. جرّب متصفحًا آخر.';
});
