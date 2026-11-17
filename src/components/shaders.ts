export const starVertex = `
attribute float aSize;
attribute float aPhase;
varying vec3 vColor;
uniform float uTime;
uniform float uPixel;
uniform float uGlow;
varying float vAlpha;
void main() {
  vColor = color;
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  float pulse = .82 + .18 * sin(uTime * .7 + aPhase);
  gl_PointSize = clamp(aSize * uPixel * (230.0 / -p.z) * (0.8 + uGlow * .2), 1.0, 80.0);
  vAlpha = pulse;
}`;
export const starFragment = `
varying vec3 vColor;
varying float vAlpha;
uniform float uGlow;
void main() {
  float d = length(gl_PointCoord - .5) * 2.0;
  if(d > 1.0) discard;
  float a = exp(-d*d*5.0) * .5 + exp(-d*d*55.0) * .65;
  gl_FragColor = vec4(vColor * (1.0 + uGlow * .35), a * vAlpha);
}`;
export const blackHoleVertex = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`;
export const blackHoleFragment = `
precision highp float;
varying vec2 vUv;
uniform vec3 uCamera;
uniform mat3 uRotation;
uniform vec2 uResolution;
uniform float uTime;
uniform float uGlow;
uniform vec3 uTarget;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float bands(float r,float angle) {
  float s = sin(r*32. + sin(angle*7.+r*2.-uTime*.35)*1.3)*.5+.5;
  float n = noise(vec2(r*5.,angle*8.-uTime*.6/r));
  float m = noise(vec2(r*15.,angle*27.-uTime*.8/r));
  return (.28+.72*n)*(.55+.45*s)*(.7+.3*m);
}
vec3 disk(vec3 p) {
  float r=length(p.xz);
  float a=atan(p.z,p.x);
  float edge=smoothstep(2.7,3.15,r)*(1.-smoothstep(8.,11.,r));
  float temp=pow(3./max(r,3.),1.7);
  vec3 color=mix(vec3(1.,.19,.035),vec3(1.,.86,.59),temp);
  float doppler=clamp(1.+.45*sin(a+.6),.45,1.6);
  return color * edge * bands(r,a) * temp * doppler * 2.7;
}
void main(){
  vec2 uv=(vUv-.5)*2.; uv.x*=uResolution.x/uResolution.y;
  vec3 ro=uCamera;
  vec3 rd=normalize(uRotation*vec3(uv*tan(radians(42.)*.5),-1.));
  vec3 p=ro;
  vec3 col=vec3(0.);
  float trans=1.;
  float minR=100.;
  bool captured=false;
  for(int i=0;i<140;i++){
    float r=length(p);
    minR=min(minR,r);
    if(r<1.03){captured=true;break;}
    if(r>65.)break;
    float stepSize=clamp(r*.085,.095,1.7);
    vec3 old=p;
    float force=1.48/(r*r);
    rd=normalize(rd-normalize(p)*force*stepSize);
    p+=rd*stepSize;
    if(old.y*p.y<0.){
      float f=abs(old.y)/(abs(old.y)+abs(p.y));
      vec3 hit=mix(old,p,f);
      float rad=length(hit.xz);
      if(rad>2.7&&rad<11.){
        vec3 d=disk(hit);
        col+=d*trans;
        trans*=.38;
      }
    }
    float radial=length(p.xz);
    if(radial>2.7&&radial<11.){
      float haze=exp(-abs(p.y)*15.)*stepSize;
      col+=disk(p)*haze*trans*.38;
    }
  }
  float ring=exp(-pow((minR-1.48)*12.,2.));
  col+=vec3(1.,.64,.27)*ring*.32;
  if(!captured){
    vec2 sp=vec2(atan(rd.z,rd.x),asin(rd.y))*280.;
    vec2 cell=floor(sp); float s=hash(cell);
    float star=pow(max(0.,1.-length(fract(sp)-.5)*2.),18.)*step(.995,s);
    col+=vec3(.55,.65,.85)*star*trans*.5;
  }
  col*=.9+uGlow*.65;
  col=vec3(1.)-exp(-col*1.5);
  gl_FragColor=vec4(col,1.);
}`;
