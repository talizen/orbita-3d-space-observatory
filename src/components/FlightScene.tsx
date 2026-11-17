import React, {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {neighborhood} from './JourneyScene';
import {solarTextures} from './solarTextures';
export interface FlightAPI { restart:()=>void; }
interface Props {running:boolean;speed:number;apiRef:React.MutableRefObject<FlightAPI|null>;onProgress:(p:number)=>void;onReady:()=>void;}
// Smoothly interpolate log altitude: one continuous camera path over one Earth.
function spline(values:number[],progress:number){const x=Math.min(.999999,progress)*(values.length-1),i=Math.floor(x),t=x-i;const p0=values[Math.max(0,i-1)],p1=values[i],p2=values[Math.min(values.length-1,i+1)],p3=values[Math.min(values.length-1,i+2)];return .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t);}
export default function FlightScene({running,speed,apiRef,onProgress,onReady}:Props){
  const mount=useRef<HTMLDivElement>(null),state=useRef({running,speed}),callbacks=useRef({onProgress,onReady});state.current={running,speed};callbacks.current={onProgress,onReady};const [error,setError]=useState('');
  useEffect(()=>{
    if(!mount.current)return;const el=mount.current;let dead=false,raf=0,progress=0,time=0,lastReport=-1;
    let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch{setError('Please turn on hardware acceleration in your browser, then come back to ride the rocket.');return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.domElement.className='h-full w-full touch-none';renderer.domElement.setAttribute('aria-label','First-person view of a continuous climb from the rocket window');el.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(58,1,.05,20000),R=1000;
    const surface=new THREE.Group();surface.position.y=-R;scene.add(surface);
    const textures:THREE.Texture[]=[];const loader=new THREE.TextureLoader();
    const load=(url:string,srgb=true)=>{const t=loader.load(url,()=>{if(dead)t.dispose();},undefined,()=>{if(!dead)setError('The Earth picture didn\'t load. Please refresh and try again.');});if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);textures.push(t);return t;};
    const earth=new THREE.Mesh(new THREE.SphereGeometry(R,160,128),new THREE.MeshPhongMaterial({map:load(solarTextures.earth),shininess:8}));earth.rotation.set(.83,3.65,.13);surface.add(earth);
    const cloudsTexture=load('/assets/clouds.jpg',false);
    const cloudShell=new THREE.Mesh(new THREE.SphereGeometry(R+5,128,96),new THREE.MeshPhongMaterial({map:cloudsTexture,alphaMap:cloudsTexture,transparent:true,opacity:.6,depthWrite:false}));cloudShell.rotation.copy(earth.rotation);surface.add(cloudShell);
    const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(R*1.022,128,96),new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uStrength:{value:0}},vertexShader:'varying vec3 vN;varying vec3 vP;void main(){vN=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);vP=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'uniform float uStrength;varying vec3 vN;varying vec3 vP;void main(){float n=abs(dot(normalize(vN),normalize(vP)));float f=pow(1.-n,3.2)*smoothstep(0.,.22,n);gl_FragColor=vec4(vec3(.15,.49,1.),f*uStrength);}'}));surface.add(atmosphere);
    const city=neighborhood();city.root.position.y=.65;city.clouds.visible=false;city.town.visible=true;scene.add(city.root);
    // Far buildings establish a horizon, instead of presenting a floating city model.
    for(let i=0;i<100;i++){const a=i*2.39996,r=28+(i%7)*6,x=Math.cos(a)*r,z=Math.sin(a)*r,h=1.5+(i%6)*.7;const b=new THREE.Mesh(new THREE.BoxGeometry(1.5,h,1.4),new THREE.MeshStandardMaterial({color:['#abc4ca','#c5c3af','#b0becf'][i%3],roughness:1}));b.position.set(x,Math.sqrt(R*R-x*x-z*z)-R+h/2,z);scene.add(b);}
    const cloudGroup=new THREE.Group();scene.add(cloudGroup);
    for(let i=0;i<30;i++){const cg=new THREE.Group();const a=i*2.39996,r=10+(i%7)*8;cg.position.set(Math.cos(a)*r,12+(i%4)*3,Math.sin(a)*r);for(let j=0;j<4;j++){const c=new THREE.Mesh(new THREE.SphereGeometry(3+(j%2),16,12),new THREE.MeshBasicMaterial({color:'#f2f9ff',transparent:true,opacity:.64,depthWrite:false}));c.position.set(j*3,Math.sin(j)*1.3,0);c.scale.set(1.4,.65,1);cg.add(c);}cloudGroup.add(cg);}
    const sun=new THREE.DirectionalLight(0xfff1d9,2.6);sun.position.set(-4000,6000,5000);scene.add(sun);const ambient=new THREE.HemisphereLight(0xd4eeff,0x687864,1.2);scene.add(ambient);
    const stars=[],sizes=2800;for(let i=0;i<sizes;i++){const a=i*2.39996,z=1-2*(i+.5)/sizes,v=Math.sqrt(1-z*z);stars.push(Math.cos(a)*v*10000,z*10000,Math.sin(a)*v*10000);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));const starsMat=new THREE.PointsMaterial({color:'#d4e6ff',size:3.6,sizeAttenuation:true,transparent:true,opacity:0,depthWrite:false,fog:false});const starfield=new THREE.Points(geo,starsMat);scene.add(starfield);
    const fog=new THREE.FogExp2('#b8dced',.006);scene.fog=fog;
    const sky=new THREE.Color(),day=new THREE.Color('#85bbd5'),night=new THREE.Color('#030913');
    const logHeights=[1.7,8,40,150,650,2300].map(Math.log),angles=[.035,.16,.36,.72,1.14,1.43];
    let pointer:number|null=null,px=0,py=0,lookX=0,lookY=0,wantX=0,wantY=0;
    const down=(e:PointerEvent)=>{pointer=e.pointerId;px=e.clientX;py=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);};
    const move=(e:PointerEvent)=>{if(pointer!==e.pointerId)return;wantX=THREE.MathUtils.clamp((e.clientX-px)*.0013,-.3,.3);wantY=THREE.MathUtils.clamp((e.clientY-py)*.001,-.13,.13);};
    const up=()=>{pointer=null;wantX=0;wantY=0;};renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);
    const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.fov=w/h<1?72:58;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(el);resize();
    apiRef.current={restart(){progress=0;lastReport=-1;lookX=lookY=wantX=wantY=0;callbacks.current.onProgress(0);}};
    const clock=new THREE.Clock();function animate(){if(dead)return;raf=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(document.hidden)return;time+=dt;if(state.current.running)progress=Math.min(1,progress+dt*state.current.speed/90);
      const altitude=Math.exp(spline(logHeights,progress));const pitch=spline(angles,progress);lookX=THREE.MathUtils.lerp(lookX,wantX,.06);lookY=THREE.MathUtils.lerp(lookY,wantY,.06);
      camera.position.set(Math.sin(progress*Math.PI)*altitude*.025,altitude,9+altitude*.14);const angle=pitch+lookY;camera.lookAt(camera.position.clone().add(new THREE.Vector3(Math.sin(lookX)*Math.cos(angle),-Math.sin(angle),-Math.cos(lookX)*Math.cos(angle)).multiplyScalar(100)));
      camera.near=Math.max(.05,altitude*.002);camera.updateProjectionMatrix();
      const darkness=THREE.MathUtils.smoothstep(progress,.28,.62);sky.copy(day).lerp(night,darkness);renderer.setClearColor(sky);fog.color.copy(sky);fog.density=.006*Math.pow(1-darkness,4);ambient.intensity=1.2-darkness*.65;starsMat.opacity=THREE.MathUtils.smoothstep(progress,.58,.86)*.8;
      (atmosphere.material as THREE.ShaderMaterial).uniforms.uStrength.value=THREE.MathUtils.smoothstep(progress,.42,.65)*.55;
      cloudGroup.rotation.y=Math.sin(time*.025)*.012;city.root.visible=altitude<160;cloudGroup.visible=altitude<400;
      renderer.render(scene,camera);const percent=Math.floor(progress*1000);if(percent!==lastReport){lastReport=percent;callbacks.current.onProgress(progress);}
    }animate();callbacks.current.onReady();
    const lost=(e:Event)=>{e.preventDefault();setError('The window view was interrupted. Please refresh to take off again.');};renderer.domElement.addEventListener('webglcontextlost',lost);
    return()=>{dead=true;cancelAnimationFrame(raf);observer.disconnect();apiRef.current=null;renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('pointercancel',up);renderer.domElement.removeEventListener('webglcontextlost',lost);const gs=new Set<THREE.BufferGeometry>(),ms=new Set<THREE.Material>();scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points||o instanceof THREE.Line){gs.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>ms.add(m));}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();};
  },[]);
  return <><div ref={mount} className="absolute inset-0"/>{error&&<div role="alert" className="absolute left-1/2 top-1/2 z-30 w-72 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#162935] p-5 text-center text-sm leading-7">{error}<button onClick={()=>window.location.reload()} className="mt-3 rounded-xl bg-teal-200 px-5 py-2 text-slate-950">Take off again</button></div>}</>;
}
