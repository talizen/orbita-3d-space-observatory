import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, ChevronDown, X, Play, Pause, Music2, LoaderCircle } from 'lucide-react';

const MUSIC_URL = '/assets/orbital_drift_96s.mp3';
export default function BackgroundMusic({duck=false}:{duck?:boolean}){
  const media=useRef<HTMLAudioElement>(null);
  const host=useRef<HTMLDivElement>(null);
  const [playing,setPlaying]=useState(false);
  const [loading,setLoading]=useState(false);
  const [open,setOpen]=useState(false);
  const [volume,setVolume]=useState(.12);
  const [error,setError]=useState('');
  const volumeRef=useRef(.12),wanted=useRef(false),ticket=useRef(0),fadeFrame=useRef(0);
  const toggleRef=useRef<()=>void>(()=>{});
  const duckRef=useRef(duck);duckRef.current=duck;
  const fade=(target:number,duration:number,done?:()=>void)=>{
    cancelAnimationFrame(fadeFrame.current);const a=media.current;if(!a)return;
    const initial=a.volume,start=performance.now();
    const step=(now:number)=>{const progress=Math.max(0,Math.min(1,(now-start)/duration));a.volume=Math.max(0,Math.min(1,initial+(target-initial)*progress));if(progress<1)fadeFrame.current=requestAnimationFrame(step);else done?.();};
    fadeFrame.current=requestAnimationFrame(step);
  };
  const toggle=async()=>{
    const a=media.current;if(!a)return;const run=++ticket.current;
    wanted.current=!wanted.current;setError('');
    if(!wanted.current){setLoading(false);setPlaying(false);if(a.paused||a.readyState<3){a.pause();return;}fade(0,220,()=>{if(!wanted.current)a.pause();});return;}
    setLoading(true);if(a.error)a.load();a.volume=0;
    try{await a.play();if(run!==ticket.current)return;setLoading(false);setPlaying(true);fade(volumeRef.current*(duckRef.current?.2:1),850);}
    catch(e){if(run!==ticket.current)return;wanted.current=false;setLoading(false);setPlaying(false);setOpen(true);setError((e as Error).name==='NotAllowedError'?'Tap play to start the music.':'Music didn\'t load. Tap play to try again.');}
  };
  toggleRef.current=toggle;
  useEffect(()=>{
    const a=media.current;
    try{const value=localStorage.getItem('orbita-music-volume-v3');if(value!==null){const v=Number(value);if(Number.isFinite(v)&&v>=0&&v<=1){setVolume(v);volumeRef.current=v;}}}catch{}
    const outside=(e:PointerEvent)=>{if(host.current&&!host.current.contains(e.target as Node))setOpen(false);};
    const key=(e:KeyboardEvent)=>{if((e.target as HTMLElement).matches('input,textarea,select')||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key.toLowerCase()==='m'&&!document.querySelector('[role="dialog"]')){e.preventDefault();toggleRef.current();}if(e.key==='Escape')setOpen(false);};
    document.addEventListener('pointerdown',outside);window.addEventListener('keydown',key);
    return()=>{ticket.current++;wanted.current=false;cancelAnimationFrame(fadeFrame.current);a?.pause();document.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',key);};
  },[]);
  const changeVolume=(v:number)=>{setVolume(v);volumeRef.current=v;cancelAnimationFrame(fadeFrame.current);if(media.current&&!media.current.paused&&wanted.current)media.current.volume=v*(duckRef.current?.2:1);else if(media.current&&!wanted.current)media.current.pause();try{localStorage.setItem('orbita-music-volume-v3',String(v));}catch{}};
  useEffect(()=>{if(wanted.current&&media.current&&!media.current.paused)fade(volumeRef.current*(duck?.2:1),350);},[duck]);
  const action=loading?'Cancel music loading':playing?'Pause background music':'Play background music';
  return <div ref={host} className="relative flex items-center gap-0.5">
    <audio ref={media} src={MUSIC_URL} loop preload="none" onPause={()=>{wanted.current=false;setPlaying(false);}} aria-label="Orbital Drift background music" onError={()=>{wanted.current=false;ticket.current++;setLoading(false);setPlaying(false);setError('Music failed to load. Tap play to try again.');setOpen(true);}}/>
    <button type="button" title={`${action} (M)`} aria-label={action} aria-pressed={playing} onClick={toggle} className={`round-control ${playing?'bg-teal-200/10 text-teal-200':''}`}>
      {loading?<LoaderCircle size={16} className="animate-spin"/>:playing?<Volume2 size={16}/>:<VolumeX size={16}/>}</button>
    <button type="button" title="Music and volume" aria-label="Music and volume" aria-expanded={open} aria-controls="orbita-music-panel" onClick={()=>setOpen(v=>!v)} className="flex h-9 w-5 items-center justify-center rounded text-slate-500 hover:bg-white/5 hover:text-teal-100"><ChevronDown size={12}/></button>
    {open&&<section id="orbita-music-panel" aria-label="Background music settings" className="panel absolute right-0 top-12 z-50 w-[264px] animate-arrival rounded-xl p-4 shadow-2xl">
      <div className="mb-4 flex items-center justify-between"><span className="flex items-center gap-2 text-[11px] text-slate-200"><Music2 size={14} className="text-teal-200"/>Deep Space Radio</span><button type="button" aria-label="Close music settings" onClick={()=>setOpen(false)} className="rounded p-1 text-slate-500 hover:text-white"><X size={13}/></button></div>
      <div className="flex items-center gap-3 rounded-lg border border-white/[.07] bg-white/[.02] p-3"><button type="button" aria-label={playing?'Pause soundtrack':'Play soundtrack'} onClick={toggle} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-teal-200/20 bg-teal-200/10 text-teal-100">{loading?<LoaderCircle size={15} className="animate-spin"/>:playing?<Pause size={15}/>:<Play size={15}/>}</button><div><p className="font-display text-[13px] text-slate-100">Orbital Drift</p><p className="mt-1 text-[9px] text-slate-500">Original space ambient · 01:36 · Loop</p></div></div>
      <label className="mt-5 block"><span className="mb-3 flex justify-between text-[10px] text-slate-400"><span>Music volume</span><span className="font-display text-teal-100">{Math.round(volume*100)}%</span></span><input type="range" aria-label="Background music volume" min="0" max="100" step="1" value={Math.round(volume*100)} onChange={e=>changeVolume(Number(e.target.value)/100)} className="h-1 w-full cursor-pointer"/></label>
      <div role="status" className={`mt-4 text-[9px] leading-5 ${error?'text-amber-200':'text-slate-500'}`}>{error|| (loading?'Loading soundtrack…':playing?'Now playing · keeps playing as you switch views':'Click the speaker or press M to play')}</div>
    </section>}
  </div>;
}
