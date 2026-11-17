import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { starVertex, starFragment, blackHoleVertex, blackHoleFragment } from './shaders';
import { createSolarSystem } from './SolarSystem';
import { solarBodies } from './solarData';
import type { WorldId } from './catalog';

export interface SceneSettings { playing: boolean; autoRotate: boolean; grid: boolean; labels: boolean; glow: number; speed: number; pan: boolean; }
export interface SceneAPI { zoom: (factor:number)=>void; reset: ()=>void; top: ()=>void; capture: ()=>void; focusSolar: (id:string|null)=>void; }
interface Props { world: WorldId; settings: SceneSettings; apiRef: React.MutableRefObject<SceneAPI | null>; onStatus: (status:string)=>void; onZoom: (value:number)=>void; onInspect: ()=>void; onSolarFocus: (id:string|null)=>void; }
const TEX = {
  earth: '/assets/earth.jpg',
  clouds: '/assets/clouds.jpg',
  night: '/assets/night.jpg',
  moon: '/assets/moon_8k.jpg',
  normal: '/assets/normal.png',
};
function random(seed:number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function makePoints(positions:number[], colors:number[], sizes:number[], rand:()=>number, pixel:number) {
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setAttribute('aSize',new THREE.Float32BufferAttribute(sizes,1));
  geo.setAttribute('aPhase',new THREE.Float32BufferAttribute(sizes.map(()=>rand()*6.28),1));
  const mat=new THREE.ShaderMaterial({vertexShader:starVertex,fragmentShader:starFragment,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:{value:0},uPixel:{value:pixel},uGlow:{value:1}}});
  return new THREE.Points(geo,mat);
}
export function makeGalaxy(andromeda:boolean,pixel:number,density=1) {
  const group=new THREE.Group(); const rand=random(andromeda?130:42);
  const positions:number[]=[],colors:number[]=[],sizes:number[]=[];
  const core=new THREE.Color('#ffe4bb'),blue=new THREE.Color(andromeda?'#aaa4e8':'#99bdec'),violet=new THREE.Color('#b192db');
  for(let i=0;i<108000*density;i++) {
    const bulge=i<20000*density;
    const r=bulge?Math.pow(rand(),1.6)*3.8:Math.pow(rand(),.65)*15.5;
    const arm=(i% (andromeda?2:4))*Math.PI*2/(andromeda?2:4);
    const angle=bulge?rand()*Math.PI*2:arm+2.9*Math.log(r+.8)+Math.pow(rand(),2)*(rand()<.5?-1:1)*(.85+1.5/(r+1));
    const scatter=bulge?.6:.25+Math.pow(r/15,2)*.8;
    let x=Math.cos(angle)*r+(rand()-.5)*scatter;
    let z=Math.sin(angle)*r+(rand()-.5)*scatter;
    if(bulge&&!andromeda) x*=1.65;
    const y=(rand()+rand()+rand()-1.5)*(bulge?2.1*Math.exp(-r*.3):.45+.2*r/15);
    positions.push(x,y,z*(andromeda?.86:1));
    const col=core.clone().lerp(rand()>.72?violet:blue,Math.min(1,r/8));
    const intensity=.3+rand()*.7; col.multiplyScalar(intensity);
    colors.push(col.r,col.g,col.b);
    sizes.push((.1+Math.pow(rand(),5)*.9)*(bulge?.8:1));
  }
  group.add(makePoints(positions,colors,sizes,rand,pixel));
  const dp:number[]=[],dc:number[]=[],ds:number[]=[];
  for(let i=0;i<9500*density;i++) {
    const r=1.5+Math.pow(rand(),.75)*13.8;
    const arms=andromeda?2:4;
    const a=(i%arms)*Math.PI*2/arms+2.9*Math.log(r+.8)+(rand()-.5)*(.27+.24*rand());
    dp.push(Math.cos(a)*r,(rand()-.5)*.5,Math.sin(a)*r*(andromeda?.86:1));
    const c=new THREE.Color(andromeda?'#8873ae':'#5273a3').lerp(new THREE.Color('#baa399'),Math.max(0,1-r/6)).multiplyScalar((.02+rand()*.065)*(.45+.55*Math.pow(Math.sin(r*1.9+(i%arms)*1.3),2)));
    dc.push(c.r,c.g,c.b);ds.push(3+rand()*5);
  }
  group.add(makePoints(dp,dc,ds,rand,pixel));
  return group;
}
function makeStars(pixel:number) {
  const rand=random(519),p:number[]=[],c:number[]=[],s:number[]=[];
  for(let i=0;i<2600;i++) {
    const a=rand()*6.28,z=rand()*2-1,r=95+rand()*90,v=Math.sqrt(1-z*z);
    p.push(r*v*Math.cos(a),r*z,r*v*Math.sin(a));
    const brightness=.35+rand()*.8;c.push(brightness*.7,brightness*.8,brightness);
    s.push(.18+Math.pow(rand(),5)*1.1);
  }
  return makePoints(p,c,s,rand,pixel);
}
function makeGrid(radius:number) {
  const group=new THREE.Group();
  const mat=new THREE.LineBasicMaterial({color:0x557786,transparent:true,opacity:.055});
  for(let r=radius/4;r<=radius;r+=radius/4){
    const points=[];for(let i=0;i<=180;i++)points.push(new THREE.Vector3(Math.cos(i/180*Math.PI*2)*r,-1.8,Math.sin(i/180*Math.PI*2)*r));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),mat));
  }
  for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2;
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-1.8,0),new THREE.Vector3(Math.cos(a)*radius,-1.8,Math.sin(a)*radius)]),mat));
  }
  return group;
}
export default function Universe({world,settings,apiRef,onStatus,onZoom,onInspect,onSolarFocus}:Props){
  const host=useRef<HTMLDivElement>(null); const label=useRef<HTMLButtonElement>(null);
  const solarLabels=useRef<Record<string,HTMLButtonElement|null>>({});
  const state=useRef(settings); state.current=settings;
  const callbacks=useRef({onStatus,onZoom,onSolarFocus});callbacks.current={onStatus,onZoom,onSolarFocus};
  const [error,setError]=useState('');const [loading,setLoading]=useState('');
  useEffect(()=>{
    if(!host.current)return;
    const mount=host.current;let disposed=false;let raf=0;let time=0;let frames=0;let lastPerf=performance.now();
    setError('');setLoading('');callbacks.current.onStatus('Establishing observation link');
    let renderer:THREE.WebGLRenderer;
    try {renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});}
    catch {setError('This browser cannot start 3D. Please enable hardware acceleration and reload.');callbacks.current.onStatus('3D unavailable');return;}
    const pixel=Math.min(window.devicePixelRatio,world==='blackhole'?1.25:1.7);
    renderer.setPixelRatio(pixel);renderer.setClearColor(0x000000,1);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.domElement.className='h-full w-full touch-none outline-none';renderer.domElement.setAttribute('aria-label','Interactive 3D object: drag to rotate, scroll to zoom, right-drag to pan');
    mount.appendChild(renderer.domElement);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(42,1,.05,600);
    const planetary=world==='earth'||world==='moon';
    const initial=world==='solar'?new THREE.Vector3(0,33,47):world==='blackhole'?new THREE.Vector3(0,2.8,29):planetary?new THREE.Vector3(0,2,10):new THREE.Vector3(0,26,37);
    if(mount.clientWidth/mount.clientHeight<.85)initial.multiplyScalar(world==='solar'?2.2:1.55);
    camera.position.copy(initial);
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=planetary?3.1:world==='blackhole'?5:3;
    controls.maxDistance=world==='solar'?160:planetary?28:75;controls.rotateSpeed=.55;controls.zoomSpeed=.7;controls.panSpeed=.6;
    controls.autoRotateSpeed=.22;controls.target.set(0,0,0);controls.update();
    const starfield=makeStars(pixel);scene.add(starfield);
    const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
    const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.45,.65,.65);composer.addPass(bloom);composer.addPass(new OutputPass());
    const object=new THREE.Group();scene.add(object);
    const grid=makeGrid(planetary?6:18);scene.add(grid);
    const textures:THREE.Texture[]=[];
    const manager=new THREE.LoadingManager();
    manager.onStart=()=>{if(!disposed)setLoading('Loading HD surface textures');};
    manager.onProgress=(_url,loaded,total)=>{if(!disposed)setLoading(loaded===total?'':`HD textures ${loaded} / ${total}`);};
    manager.onLoad=()=>{if(!disposed)setLoading('');};
    let cloud:THREE.Mesh|undefined;let moon:THREE.Mesh|undefined;let blackMat:THREE.ShaderMaterial|undefined;
    const markerPosition=world==='milkyway'?new THREE.Vector3(6.5,.2,5.5):world==='earth'?new THREE.Vector3(4.1,.4,-1.8):world==='blackhole'?new THREE.Vector3(2,1.2,0):world==='moon'?new THREE.Vector3(1.2,.8,1):new THREE.Vector3(0,.4,0);
    const load=(url:string,srgb=true)=>{const t=new THREE.TextureLoader(manager).load(url,()=>{if(disposed)t.dispose();},undefined,()=>{if(!disposed){setError('Some HD textures failed to load. Reload to restore full detail.');callbacks.current.onStatus('Textures incomplete');}});if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);textures.push(t);return t;};
    let solar:ReturnType<typeof createSolarSystem>|undefined;let focused:string|null=null;const previousTarget=new THREE.Vector3();
    if(world==='solar'){solar=createSolarSystem(load);scene.add(solar.group);solar.update(0,settings.grid,settings.glow);}
    else if(world==='milkyway'||world==='andromeda') {
      const galaxy=makeGalaxy(world==='andromeda',pixel);object.add(galaxy);
      object.rotation.y=world==='andromeda'?.9:-.3;
    } else if(world==='blackhole') {
      grid.visible=false;starfield.visible=false;
      blackMat=new THREE.ShaderMaterial({vertexShader:blackHoleVertex,fragmentShader:blackHoleFragment,depthTest:false,depthWrite:false,uniforms:{uCamera:{value:camera.position.clone()},uRotation:{value:new THREE.Matrix3()},uResolution:{value:new THREE.Vector2(1,1)},uTime:{value:0},uGlow:{value:1},uTarget:{value:new THREE.Vector3()}}});
      const screen=new THREE.Mesh(new THREE.PlaneGeometry(2,2),blackMat);screen.frustumCulled=false;scene.add(screen);
    } else {
      scene.add(new THREE.AmbientLight(0x8d9bbd,.3));
      const sun=new THREE.DirectionalLight(0xfff0da,3.2);sun.position.set(-7,4,7);scene.add(sun);
      const sphere=new THREE.SphereGeometry(world==='earth'?2.15:2,128,96);
      if(world==='earth') {
        const day=load(TEX.earth),normal=load(TEX.normal,false),night=load(TEX.night);
        const mat=new THREE.MeshPhongMaterial({map:day,normalMap:normal,normalScale:new THREE.Vector2(.45,.45),specular:new THREE.Color(0x334b60),shininess:18});
        mat.onBeforeCompile=(shader)=>{shader.uniforms.nightMap={value:night};shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWorldNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWorldNormal = normalize(mat3(modelMatrix) * normal);');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D nightMap;\nvarying vec3 vWorldNormal;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nfloat nightFactor = 1.0 - smoothstep(-0.15, 0.22, dot(normalize(vWorldNormal), normalize(vec3(-7.0,4.0,7.0))));\ntotalEmissiveRadiance += texture2D(nightMap,vMapUv).rgb * nightFactor * 1.6;');};
        object.add(new THREE.Mesh(sphere,mat));object.rotation.z=.12;object.rotation.y=3.8;
        const clouds=load(TEX.clouds,false);
        cloud=new THREE.Mesh(new THREE.SphereGeometry(2.172,96,64),new THREE.MeshPhongMaterial({map:clouds,alphaMap:clouds,transparent:true,opacity:.7,depthWrite:false}));object.add(cloud);
        const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(2.24,96,64),new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false,vertexShader:'varying vec3 vN; varying vec3 vP; void main(){vN=normalize(normalMatrix*normal); vec4 p=modelViewMatrix*vec4(position,1.); vP=normalize(-p.xyz); gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 vN; varying vec3 vP; void main(){float f=pow(max(0.,1.-abs(dot(normalize(vN),normalize(vP)))),3.5); gl_FragColor=vec4(vec3(.12,.48,1.),f*.65);}'}));object.add(atmosphere);
        const mt=load(TEX.moon);moon=new THREE.Mesh(new THREE.SphereGeometry(.586,64,48),new THREE.MeshPhongMaterial({map:mt,bumpMap:mt,bumpScale:.018,shininess:1}));moon.position.set(4.1,.4,-1.8);scene.add(moon);
      } else {const mt=load(TEX.moon);object.add(new THREE.Mesh(sphere,new THREE.MeshPhongMaterial({map:mt,bumpMap:mt,bumpScale:.035,shininess:1})));object.rotation.y=2.2;}
    }
    const resize=()=>{const w=mount.clientWidth,h=mount.clientHeight;renderer.setSize(w,h);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(blackMat)blackMat.uniforms.uResolution.value.set(w,h);};
    const observer=new ResizeObserver(resize);observer.observe(mount);resize();
    const api:SceneAPI={
      zoom(factor){const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(factor).clampLength(controls.minDistance,controls.maxDistance);camera.position.copy(controls.target).add(offset);controls.update();},
      reset(){focused=null;callbacks.current.onSolarFocus(null);controls.minDistance=planetary?3.1:world==='blackhole'?5:3;camera.position.copy(initial);controls.target.set(0,0,0);controls.update();},
      top(){const distance=camera.position.distanceTo(controls.target);camera.position.copy(controls.target).add(new THREE.Vector3(0,distance,.02));controls.update();},
      focusSolar(id){if(!solar)return;if(!id){api.reset();return;}const body=solarBodies.find(b=>b.id===id);const target=solar.objects.get(id);if(!body||!target)return;focused=id;target.getWorldPosition(previousTarget);controls.target.copy(previousTarget);const distance=Math.max(body.radius*6,2.3)*(mount.clientWidth/mount.clientHeight<.85?1.5:1);camera.position.copy(previousTarget).add(new THREE.Vector3(0,distance*.4,distance));controls.minDistance=body.radius*1.7;controls.update();callbacks.current.onSolarFocus(id);},
      capture(){composer.render();const a=document.createElement('a');a.download=`ORBITA-${world}.png`;a.href=renderer.domElement.toDataURL('image/png');a.click();}
    };apiRef.current=api;
    const onLost=(e:Event)=>{e.preventDefault();cancelAnimationFrame(raf);setError('The 3D view was interrupted. Reload to resume observing.');callbacks.current.onStatus('Observation interrupted');};renderer.domElement.addEventListener('webglcontextlost',onLost);
    const clock=new THREE.Clock();
    function animate(){
      if(disposed)return;raf=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05),s=state.current;
      if(document.hidden)return;
      if(s.playing)time+=dt*s.speed;
      controls.autoRotate=s.autoRotate&&s.playing;controls.autoRotateSpeed=.22*s.speed;
      controls.mouseButtons.LEFT=s.pan?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;
      controls.touches.ONE=s.pan?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;controls.update();
      grid.visible=s.grid&&world!=='blackhole'&&world!=='solar';
      if(solar){solar.update(time,s.grid,s.glow);solar.group.updateMatrixWorld(true);if(focused){const next=solar.objects.get(focused)!.getWorldPosition(new THREE.Vector3());const delta=next.clone().sub(previousTarget);camera.position.add(delta);controls.target.add(delta);previousTarget.copy(next);controls.update();}
        for(const body of solarBodies){const el=solarLabels.current[body.id];if(!el)continue;const p=solar.objects.get(body.id)!.getWorldPosition(new THREE.Vector3());p.y+=body.radius+.18;p.project(camera);el.hidden=!s.labels||p.z>1||Math.abs(p.x)>.98||Math.abs(p.y)>.94;el.style.transform=`translate(${(p.x*.5+.5)*mount.clientWidth}px,${(-p.y*.5+.5)*mount.clientHeight}px) translate(-50%,-100%)`;}
      }
      if(!planetary&&world!=='blackhole'&&world!=='solar'&&s.playing)object.rotation.y+=dt*.012*s.speed;
      if(planetary&&s.playing)object.rotation.y+=dt*.035*s.speed;
      if(cloud&&s.playing)cloud.rotation.y+=dt*.008*s.speed;
      scene.traverse((o)=>{if(o instanceof THREE.Points&&o.material instanceof THREE.ShaderMaterial){o.material.uniforms.uTime.value=time;o.material.uniforms.uGlow.value=s.glow;}});
      if(blackMat){blackMat.uniforms.uTime.value=time;blackMat.uniforms.uCamera.value.copy(camera.position);blackMat.uniforms.uRotation.value.setFromMatrix4(camera.matrixWorld);blackMat.uniforms.uGlow.value=s.glow;}
      if(label.current){
        label.current.hidden=!s.labels||world==='solar';
        const p=markerPosition.clone();if(world==='milkyway'||world==='andromeda')p.applyMatrix4(object.matrixWorld);p.project(camera);
        label.current.style.transform=`translate(${(p.x*.5+.5)*mount.clientWidth}px,${(-p.y*.5+.5)*mount.clientHeight}px)`;
        label.current.style.opacity=p.z<1&&Math.abs(p.x)<.9&&Math.abs(p.y)<.9?'1':'0';
      }
      bloom.strength=(world==='blackhole'?.08:planetary?.1:.45)*s.glow;bloom.radius=world==='blackhole'?.05:.45;composer.render();frames++;
      if(performance.now()-lastPerf>1200){callbacks.current.onStatus(`${Math.round(frames*1000/(performance.now()-lastPerf))} FPS`);callbacks.current.onZoom(Math.round(initial.length()/camera.position.distanceTo(controls.target)*100));frames=0;lastPerf=performance.now();}
    }
    animate();callbacks.current.onStatus('Observation link stable');
    return ()=>{disposed=true;cancelAnimationFrame(raf);observer.disconnect();controls.dispose();apiRef.current=null;renderer.domElement.removeEventListener('webglcontextlost',onLost);const geos=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>();scene.traverse((o)=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points||o instanceof THREE.Line){geos.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));}});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());composer.passes.forEach(p=>p.dispose());composer.dispose();renderer.dispose();renderer.domElement.remove();};
  },[world]);
  return <>{loading&&<div role="status" className="pointer-events-none absolute left-1/2 top-[45%] z-20 -translate-x-1/2 rounded-full border border-teal-200/20 bg-black/70 px-4 py-2 text-[10px] tracking-widest text-teal-100">{loading}</div>}<div ref={host} className="absolute inset-0" />
    <button ref={label} data-celestial-label hidden onClick={onInspect} className="absolute left-0 top-0 z-10 flex items-center gap-2 text-left text-[10px] text-cyan-100 transition-opacity" aria-label={world==='milkyway'?'Enter the Solar System':world==='earth'?'Take a closer look at the Moon':'Read the field notes'}><span className="relative flex h-3 w-3 items-center justify-center rounded-full border border-cyan-100/70"><span className="h-1 w-1 rounded-full bg-cyan-100" /></span><span className="border-b border-cyan-200/30 bg-[#080d15]/70 px-2 py-1">{world==='milkyway'?'Solar System':world==='earth'?'Moon':world==='moon'?'Lunar surface':world==='blackhole'?'Bent light':'Central bulge'} <span className="ml-2 text-[8px] tracking-wider text-cyan-200/60 max-md:hidden">{world==='milkyway'?'YOU ARE HERE':world==='earth'?'EXPLORE MOON':'EXPLORE'} ↗</span></span></button>
    {world==='solar'&&solarBodies.map(body=><button key={body.id} ref={el=>{solarLabels.current[body.id]=el;}} data-celestial-label hidden aria-label={`Focus on ${body.name}`} onClick={()=>apiRef.current?.focusSolar(body.id)} className="absolute left-0 top-0 z-10 rounded border border-white/10 bg-[#071018]/80 px-2 py-1 text-[10px] text-slate-300 hover:border-teal-200/50 hover:text-teal-100">{body.name}</button>)}
    {error&&<div role="alert" className="panel absolute left-1/2 top-1/2 z-30 w-72 -translate-x-1/2 -translate-y-1/2 rounded-xl p-6 text-center text-sm leading-7">{error}<button className="mt-4 block w-full rounded-lg bg-teal-200 py-2 text-black" onClick={()=>window.location.reload()}>Reload</button></div>}
  </>;
}
