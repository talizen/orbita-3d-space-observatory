import * as THREE from 'three';
import { solarBodies } from './solarData';
import { solarTextures } from './solarTextures';

export function createSolarSystem(load:(url:string,srgb?:boolean)=>THREE.Texture) {
  const group=new THREE.Group(),orbits=new THREE.Group();group.add(orbits);
  const objects=new Map<string,THREE.Group>();
  const spins=new Map<string,THREE.Mesh>();
  const light=new THREE.PointLight(0xffefd9,4,0,0);group.add(light);
  group.add(new THREE.AmbientLight(0x829dc7,.3));
  let sunMaterial:THREE.ShaderMaterial|undefined;
  let corona:THREE.Mesh|undefined;
  for(const body of solarBodies){
    const pivot=new THREE.Group();pivot.name=body.id;objects.set(body.id,pivot);group.add(pivot);
    const tilted=new THREE.Group();tilted.rotation.z=THREE.MathUtils.degToRad(body.tilt);pivot.add(tilted);
    const texture=load(solarTextures[body.id]);
    let mat:THREE.Material;
    if(body.id==='sun') {
      sunMaterial=new THREE.ShaderMaterial({uniforms:{uMap:{value:texture},uTime:{value:0},uGlow:{value:1}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D uMap;uniform float uTime;uniform float uGlow;varying vec2 vUv;void main(){vec2 uv=vUv;uv.x+=sin(uv.y*35.+uTime*.18)*.002;vec3 tex=texture2D(uMap,uv).rgb;float activity=.85+.15*sin(uv.x*90.+sin(uv.y*60.)+uTime*.5);gl_FragColor=vec4(tex*vec3(2.8,1.6,.75)*activity*(.8+uGlow*.45),1.);}'});
      mat=sunMaterial;
      corona=new THREE.Mesh(new THREE.SphereGeometry(body.radius*1.2,64,48),new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false,uniforms:{uGlow:{value:1}},vertexShader:'varying vec3 vN;varying vec3 vP;void main(){vN=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);vP=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'uniform float uGlow;varying vec3 vN;varying vec3 vP;void main(){float rim=pow(1.-abs(dot(normalize(vN),normalize(vP))),3.);gl_FragColor=vec4(vec3(1.,.32,.035),rim*.55*uGlow);}'}));pivot.add(corona);
    } else {
      mat=new THREE.MeshPhongMaterial({map:texture,shininess:body.id==='earth'?22:3,specular:new THREE.Color(0x222222),...(body.id==='mercury'||body.id==='mars'?{bumpMap:texture,bumpScale:.006}:{})});
    }
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(body.radius,72,48),mat);mesh.name=body.id;tilted.add(mesh);spins.set(body.id,mesh);
    if(body.orbit){const points=[];for(let i=0;i<=256;i++){const a=i/256*Math.PI*2;points.push(new THREE.Vector3(Math.cos(a)*body.orbit,0,Math.sin(a)*body.orbit));}orbits.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:body.color,transparent:true,opacity:.16})));}
    if(body.id==='saturn') {
      const ringMat=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vP;void main(){float r=length(vP.xy);float bands=.55+.25*sin(r*120.)+.15*sin(r*251.);float gap=1.-smoothstep(.025,.055,abs(r-1.58));float edge=smoothstep(1.06,1.13,r)*(1.-smoothstep(1.94,2.05,r));vec3 c=mix(vec3(.3,.23,.15),vec3(.79,.68,.49),bands);gl_FragColor=vec4(c,edge*(1.-gap*.88)*.85);}'});
      const ring=new THREE.Mesh(new THREE.RingGeometry(1.06,2.05,192),ringMat);ring.rotation.x=-Math.PI/2;tilted.add(ring);
    }
    if(body.id==='earth') {
      const moon=new THREE.Mesh(new THREE.SphereGeometry(.105,24,16),new THREE.MeshPhongMaterial({map:load(solarTextures.moon),shininess:1}));moon.position.set(.78,.08,.15);pivot.add(moon);
      const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(.405,48,32),new THREE.MeshBasicMaterial({color:0x479fff,transparent:true,opacity:.09,side:THREE.BackSide}));tilted.add(atmosphere);
    }
  }
  const dust=[];
  for(let i=0;i<1800;i++){const a=i*2.39996,r=9.2+.65*Math.sin(i*4.713)+.2*Math.sin(i*11.39);dust.push(Math.cos(a)*r,Math.sin(i*8.12)*.11,Math.sin(a)*r);}
  const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.Float32BufferAttribute(dust,3));
  const belt=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xb6a895,size:.022,transparent:true,opacity:.45,depthWrite:false}));group.add(belt);
  return {
    group,objects,
    update(time:number,grid:boolean,glow:number){
      orbits.visible=grid;
      for(const body of solarBodies){const p=objects.get(body.id)!;const a=body.phase-time*.09/Math.pow(body.period,.48);p.position.set(Math.cos(a)*body.orbit,0,Math.sin(a)*body.orbit);spins.get(body.id)!.rotation.y=time*body.spin;}
      belt.rotation.y=time*.01;
      if(sunMaterial){sunMaterial.uniforms.uTime.value=time;sunMaterial.uniforms.uGlow.value=glow;}
      if(corona)(corona.material as THREE.ShaderMaterial).uniforms.uGlow.value=glow;
    }
  };
}
