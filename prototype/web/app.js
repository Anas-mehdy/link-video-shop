import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";

const host=document.querySelector("#scene"), loading=document.querySelector("#loading");
const button=document.querySelector("#case-toggle");
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(33,1,.1,100);
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
host.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0x9871ba,2.3));
const key=new THREE.DirectionalLight(0xffffff,3.3);key.position.set(3,5,5);scene.add(key);
const fill=new THREE.DirectionalLight(0x6edfff,2.0);fill.position.set(-3,1,-3);scene.add(fill);
let character,caseMesh,lens,selected=false,progress=0,rearSign=1,dragging=false,spin=0;
let caseStyle="clear";
const styles={
  clear:{edge:0xd5f3ff,back:0xecf8ff,edgeOpacity:.48,backOpacity:.08},
  smoke:{edge:0x485266,back:0x465066,edgeOpacity:.78,backOpacity:.35},
  violet:{edge:0x672380,back:0x75338e,edgeOpacity:.82,backOpacity:.42}
};
function paintCase(){
  if(!caseMesh)return;
  const style=styles[caseStyle];
  caseMesh.traverse(o=>{
    if(!o.isMesh)return;
    const material=o.material;
    if(!material)return;
    const back=material.name==="Clear case back";
    material.color.setHex(back?style.back:style.edge);
    material.transparent=true;
    material.opacity=back?style.backOpacity:style.edgeOpacity;
    material.depthWrite=!back;
    material.needsUpdate=true;
  });
}
document.querySelectorAll("[data-case-style]").forEach(el=>el.addEventListener("click",()=>{
  caseStyle=el.dataset.caseStyle;
  document.querySelectorAll("[data-case-style]").forEach(chip=>chip.setAttribute("aria-pressed",String(chip===el)));
  paintCase();
}));
function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(host);resize();
function expression(){
  if(!character)return;
  character.traverse(o=>{
    if(o.name.startsWith("MouthWorried"))o.visible=!selected;
    if(o.name.startsWith("MouthNeutral"))o.visible=selected;
    if(o.name.startsWith("MouthHappy"))o.visible=false;
  });
}
Promise.all([
  new GLTFLoader().loadAsync("/protection-lab/phone-mascot.glb"),
  fetch("/protection-lab/character-report.json").then(r=>r.json())
]).then(([gltf,report])=>{
  rearSign=report.rear_sign||1;
  character=gltf.scene;scene.add(character);
  caseMesh=character.getObjectByName("Case");
  lens=character.getObjectByName("Lens");
  if(lens)lens.visible=false;
  paintCase();
  camera.position.set(1.9,1.35,-rearSign*5.7);camera.lookAt(0,0,0);
  expression();loading.classList.add("hidden");
}).catch(e=>{loading.textContent="تعذر تحميل المجسم. أعد فتح الصفحة.";console.error(e)});
button.addEventListener("click",()=>{
  selected=!selected;
  button.classList.toggle("selected",selected);
  button.setAttribute("aria-pressed",String(selected));
  document.querySelector("#case-check").textContent=selected?"✓":"";
  document.querySelector("#case-desc").textContent=selected?"تمت معاينة تركيب الكفر • اضغط لإزالته":"المسه وشاهد الكفر يلبس الهاتف";
  document.querySelector("#mood").textContent=selected?"أحسن! بقيت الشاشة ومسطح الكاميرا":"ينتظر حماية الظهر";
  document.querySelector("#count").textContent=selected?"2":"1";
  document.querySelector("#summary").textContent=selected?"بقيت الشاشة ومسطح الكاميرا":"ينقصه الكفر والشاشة ومسطح الكاميرا";
  expression();
});
let prevX=0;
host.addEventListener("pointerdown",e=>{dragging=true;prevX=e.clientX;host.setPointerCapture(e.pointerId)});
host.addEventListener("pointerup",()=>dragging=false);
host.addEventListener("pointermove",e=>{if(dragging){spin+=(e.clientX-prevX)*.008;prevX=e.clientX}});
const clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const t=clock.getElapsedTime();
  if(character){
    progress+=(Number(selected)-progress)*.075;
    if(caseMesh){
      caseMesh.position.set(-1.42*(1-progress),.10*(1-progress),-.25*(1-progress));
      caseMesh.rotation.y=-.25*(1-progress);
      caseMesh.rotation.z=-.12*(1-progress);
      caseMesh.scale.setScalar(.78+.22*progress);
    }
    character.rotation.y=spin+Math.sin(t*.7)*.045;
    character.position.y=Math.sin(t*1.8)*.025;
    if(lens)lens.rotation.y=Math.sin(t)*.06;
  }
  renderer.render(scene,camera);
}
animate();
