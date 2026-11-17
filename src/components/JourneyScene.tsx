import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { makeGalaxy } from './Universe';
import { createSolarSystem } from './SolarSystem';
import { solarTextures } from './solarTextures';

function material(color:string){return new THREE.MeshStandardMaterial({color,roughness:.83});}
function box(w:number,h:number,d:number,color:string,x=0,y=0,z=0){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));mesh.position.set(x,y,z);return mesh;}
function house(color='#f5e4c8',roof='#da796a'){
  const group=new THREE.Group();group.add(box(2.6,1.9,2.3,color,0,.95,0));
  const triangle=new THREE.Shape();triangle.moveTo(-1.6,1.85);triangle.lineTo(0,3.05);triangle.lineTo(1.6,1.85);triangle.closePath();
  const top=new THREE.Mesh(new THREE.ExtrudeGeometry(triangle,{depth:2.8,bevelEnabled:false}),material(roof));top.position.z=-1.4;group.add(top);
  group.add(box(.56,1.2,.09,'#568b8c',.35,.6,1.19));
  for(const x of [-.73,.8]){const win=box(.5,.52,.08,'#ffeac0',x,1.27,1.19);(win.material as THREE.MeshStandardMaterial).emissive.set('#ffbf63');(win.material as THREE.MeshStandardMaterial).emissiveIntensity=.15;group.add(win);group.add(box(.55,.045,.12,'#faf0da',x,1.27,1.23));group.add(box(.045,.55,.12,'#faf0da',x,1.27,1.23));}
  group.add(box(.34,.8,.4,'#ce7566',.75,2.7,-.4));return group;
}
function tree(x:number,z:number,size=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(size);g.add(box(.13,.9,.13,'#9e785c',0,.45,0));const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(.63,1),material('#83b8a0'));crown.position.y=1.25;g.add(crown);return g;}
export function neighborhood(){
  const root=new THREE.Group(),town=new THREE.Group();root.add(town);
  const ground=new THREE.Mesh(new THREE.CylinderGeometry(18,17.7,.5,96),material('#4b787b'));ground.position.y=-.55;town.add(ground);
  town.add(box(3,.03,34,'#708c92',0,-.28,0),box(34,.03,3,'#708c92',0,-.27,0));
  for(let i=-15;i<=15;i+=2){town.add(box(.08,.035,.65,'#dce2ce',0,-.25,i),box(.65,.035,.08,'#dce2ce',i,-.25,0));}
  const plot=new THREE.Mesh(new THREE.CylinderGeometry(3.45,3.2,.38,64),material('#a8c79b'));plot.position.y=-.04;root.add(plot);
  const home=house();home.position.y=.16;root.add(home);
  root.add(box(.7,.035,1.6,'#e6d7bb',.35,.18,2.1));
  for(const [x,z,size] of [[-2.4,1.1,1.1],[2.5,-.6,.85],[-1.9,-2,.8],[2.25,1.5,.6]])root.add(tree(x,z,size));
  for(let i=0;i<32;i++){
    const a=i*2.39996,r=6+(i%4)*2.8;const x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(Math.abs(x)<2||Math.abs(z)<2)continue;
    if(i%3===0){const h=2+(i%4)*.8;const building=box(1.8,h,1.6,['#c1d7d5','#b4c7da','#dcc9bd'][i%3],x,h/2-.25,z);town.add(building);for(let y=.5;y<h;y+=.65)for(let wx=-.5;wx<=.5;wx+=.5)town.add(box(.2,.28,.05,'#fae8b8',x+wx,y,z+.83));}
    else{const h=house(['#dfc6ab','#c0d5ca','#b3d3df'][i%3],['#c99a78','#849baf','#c58e8a'][i%3]);h.scale.setScalar(.62);h.position.set(x,-.28,z);h.rotation.y=a;town.add(h);}
    town.add(tree(x+1.7,z,.8));
  }
  // A friendly city park and small pond.
  const pond=new THREE.Mesh(new THREE.CylinderGeometry(2.1,2.1,.025,48),material('#80cad0'));pond.position.set(-6,-.25,3.8);pond.scale.z=.6;town.add(pond);
  const clouds=new THREE.Group();root.add(clouds);
  for(let i=0;i<5;i++){const cg=new THREE.Group();for(let j=0;j<3;j++){const c=new THREE.Mesh(new THREE.SphereGeometry(.8,16,12),new THREE.MeshStandardMaterial({color:'#dbeaf0',transparent:true,opacity:.6,roughness:1}));c.position.set(j*.7,Math.sin(j)*.3,0);c.scale.set(1,.6,.7);cg.add(c);}cg.position.set(Math.cos(i*1.6)*11,5+i*.4,Math.sin(i*1.6)*10);clouds.add(cg);}
  return {root,town,home,clouds};
}
interface Props{step:number;hint:number;moving:boolean;onReady:()=>void;onFailure:(message:string)=>void;}
export default function JourneyScene({step,hint,moving,onReady,onFailure}:Props){
  const mount=useRef<HTMLDivElement>(null),targetStep=useRef(step),hintRef=useRef(hint),movingRef=useRef(moving);
  const callbacks=useRef({onReady,onFailure});callbacks.current={onReady,onFailure};targetStep.current=step;hintRef.current=hint;movingRef.current=moving;
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!mount.current)return;const el=mount.current;let disposed=false,frame=0;
    let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});}catch{setError('3D can\'t start right now. Please turn on hardware acceleration in your browser and refresh.');callbacks.current.onFailure('3D could not start');return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.domElement.className='h-full w-full touch-none';renderer.domElement.setAttribute('aria-label','Interactive 3D scene flying from home into space');el.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.05,500);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=false;controls.minDistance=4;controls.maxDistance=120;controls.rotateSpeed=.5;controls.enableZoom=true;controls.maxPolarAngle=Math.PI*.8;
    const hemi=new THREE.HemisphereLight(0xe0f4ff,0x617557,2.2);scene.add(hemi);const key=new THREE.DirectionalLight(0xffe7c7,3);key.position.set(-8,12,10);scene.add(key);
    const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.2,.3,.8);composer.addPass(bloom);composer.addPass(new OutputPass());
    const local=neighborhood();scene.add(local.root);
    const groups=new Map<number,THREE.Group>();groups.set(0,local.root);groups.set(1,local.root);
    const textures:THREE.Texture[]=[];const loader=new THREE.TextureLoader();
    const cache=new Map<string,THREE.Texture>();
    const load=(url:string,srgb=true)=>{if(cache.has(url))return cache.get(url)!;const t=loader.load(url,()=>{if(disposed)t.dispose();},undefined,()=>{if(!disposed){callbacks.current.onFailure('A planet image didn\'t load. Refresh to try again.');}});if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);cache.set(url,t);textures.push(t);return t;};
    const starsGeo=new THREE.BufferGeometry(),positions=[];for(let i=0;i<1800;i++){const a=i*2.39996,z=1-2*(i+.5)/1800,r=80+20*Math.sin(i*72.41),v=Math.sqrt(1-z*z);positions.push(Math.cos(a)*v*r,z*r,Math.sin(a)*v*r);}starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));scene.add(new THREE.Points(starsGeo,new THREE.PointsMaterial({color:'#9ab8d9',size:.075,transparent:true,opacity:.55,depthWrite:false})));
    let solar:ReturnType<typeof createSolarSystem>|undefined;
    function ensure(s:number){
      if(groups.has(s))return groups.get(s)!;const g=new THREE.Group();scene.add(g);groups.set(s,g);
      if(s===2){const earth=new THREE.Mesh(new THREE.SphereGeometry(3,96,64),new THREE.MeshPhongMaterial({map:load(solarTextures.earth),shininess:12}));earth.rotation.y=3.75;earth.rotation.z=.12;g.add(earth);const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(3.07,64,48),new THREE.MeshBasicMaterial({color:'#70c6ff',transparent:true,opacity:.16,side:THREE.BackSide}));g.add(atmosphere);}
      if(s===3){solar=createSolarSystem(load);solar.update(0,true,.45);g.add(solar.group);}
      if(s===4){const galaxy=makeGalaxy(false,Math.min(devicePixelRatio,1.5),.65);g.add(galaxy);galaxy.rotation.y=-.4;}
      if(s===5){const template=makeGalaxy(false,Math.min(devicePixelRatio,1.5),.065);for(let i=0;i<22;i++){const galaxy=i===0?template:template.clone();const a=i*2.39996,r=i===0?0:9+Math.sqrt(i)*5;galaxy.position.set(Math.cos(a)*r,Math.sin(i*3.51)*12,Math.sin(a)*r);galaxy.scale.setScalar(i===0?.31:.09+(i%4)*.035);galaxy.rotation.set(Math.sin(i)*.7,i,Math.cos(i)*.6);g.add(galaxy);}}
      return g;
    }
    const positionsByStep=[[7,5.5,9],[21,24,30],[0,3,12],[0,34,49],[0,24,37],[0,23,67]];
    function destination(s:number){const p=new THREE.Vector3(...positionsByStep[s] as [number,number,number]);if(el.clientWidth/el.clientHeight<1)p.multiplyScalar(s===0?1.2:s===1||s===3?1.65:s===4||s===5?1.35:1.1);return p;}
    let active=0,fromStep=0,transition=1;const fromPosition=destination(0),toPosition=destination(0),fromTarget=new THREE.Vector3(),toTarget=new THREE.Vector3(0,.7,0);camera.position.copy(fromPosition);controls.target.copy(toTarget);controls.update();
    let lastHint=hintRef.current,hintTime=-100,time=0;
    const resize=()=>{renderer.setSize(el.clientWidth,el.clientHeight);composer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(el);resize();
    const lost=(e:Event)=>{e.preventDefault();setError('The stars got lost for a moment. Refresh to take off again.');callbacks.current.onFailure('3D connection lost');};renderer.domElement.addEventListener('webglcontextlost',lost);
    const clock=new THREE.Clock();function animate(){if(disposed)return;frame=requestAnimationFrame(animate);if(document.hidden)return;const dt=Math.min(clock.getDelta(),.05);time+=dt;
      const next=targetStep.current;if(next!==active){fromStep=active;active=next;ensure(active);fromPosition.copy(camera.position);fromTarget.copy(controls.target);toPosition.copy(destination(active));toTarget.set(0,active===0?.7:0,0);transition=0;}
      transition=Math.min(1,transition+dt/1.6);const ease=transition*transition*(3-2*transition);
      controls.enabled=!movingRef.current;
      if(transition<1){camera.position.lerpVectors(fromPosition,toPosition,ease);controls.target.lerpVectors(fromTarget,toTarget,ease);}
      const localActive=active<2;local.town.visible=active===1||(fromStep===1&&transition<1);local.clouds.visible=active===1;
      for(const [id,g] of groups){if(id===1)continue;const belongs=id===0?localActive:id===active;g.visible=belongs||(transition<.5&&(id===fromStep||(id===0&&fromStep===1)));if(belongs)g.scale.setScalar(id===0?1:(.75+.25*ease));else if(g.visible)g.scale.setScalar(Math.max(.02,1-transition*2));}
      if(localActive)local.root.scale.setScalar(1);
      hemi.intensity=active<2?2.2:active===2?.7:.05;key.intensity=active<2?3:active===2?2.4:0;
      bloom.strength=active<2?.06:active===2?.1:.32;
      if(solar&&active===3)solar.update(time*.35,true,.45);
      if(active===2&&transition===1)groups.get(2)!.rotation.y+=dt*.025;
      if(active===4||active===5)groups.get(active)!.rotation.y+=dt*.008;
      if(hintRef.current!==lastHint){lastHint=hintRef.current;hintTime=time;}
      const bounce=Math.max(0,1-(time-hintTime)/2);local.home.position.y=.16+Math.abs(Math.sin((time-hintTime)*5))*bounce*.35;
      local.clouds.rotation.y=time*.015;
      scene.traverse(o=>{if(o instanceof THREE.Points&&o.material instanceof THREE.ShaderMaterial){o.material.uniforms.uTime.value=time;o.material.uniforms.uGlow.value=.8;}});
      controls.update();composer.render();
    }animate();callbacks.current.onReady();
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',lost);const gs=new Set<THREE.BufferGeometry>(),ms=new Set<THREE.Material>();scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points||o instanceof THREE.Line){gs.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>ms.add(m));}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());composer.passes.forEach(p=>p.dispose());composer.dispose();renderer.dispose();renderer.domElement.remove();};
  },[]);
  return <><div ref={mount} className="absolute inset-0"/>{error&&<div role="alert" className="absolute left-1/2 top-1/2 z-20 w-72 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#152333] p-6 text-center text-sm leading-7">{error}<button onClick={()=>window.location.reload()} className="mt-3 rounded-xl bg-teal-200 px-5 py-3 text-slate-900">Take off again</button></div>}</>;
}
