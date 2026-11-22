// All sound is synthesized: hourly music, ambience and effects. No audio files.
import { mulberry32, clamp, Time } from './util.js';

export const Snd = {
  ctx:null, master:null, mus:null, sfx:null, rainG:null, phrase:null, phraseHour:-1, step:0, nextT:0, world:null, settings:null,
  init(settings, world){
    if (this.ctx) return; this.settings=settings; this.world=world;
    try { this.ctx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){ return; }
    const c=this.ctx;
    this.master=c.createGain(); this.master.gain.value=settings.sound?0.9:0; this.master.connect(c.destination);
    this.mus=c.createGain(); this.mus.gain.value=0.32*settings.music;
    const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=2400;
    const dl=c.createDelay(1); dl.delayTime.value=0.36; const fb=c.createGain(); fb.gain.value=0.3;
    this.mus.connect(lp); lp.connect(this.master); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(this.master);
    this.sfx=c.createGain(); this.sfx.gain.value=0.6; this.sfx.connect(this.master);
    const len=c.sampleRate*2, buf=c.createBuffer(1,len,c.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
    this.noise=buf;
    const ns=c.createBufferSource(); ns.buffer=buf; ns.loop=true;
    const olp=c.createBiquadFilter(); olp.type='lowpass'; olp.frequency.value=420;
    this.oceanG=c.createGain(); this.oceanG.gain.value=0.05;
    const lfo=c.createOscillator(); lfo.frequency.value=0.09; const lg=c.createGain(); lg.gain.value=0.035; lfo.connect(lg); lg.connect(this.oceanG.gain); lfo.start();
    ns.connect(olp); olp.connect(this.oceanG); this.oceanG.connect(this.master); ns.start();
    const rs=c.createBufferSource(); rs.buffer=buf; rs.loop=true;
    const rbp=c.createBiquadFilter(); rbp.type='bandpass'; rbp.frequency.value=2600; rbp.Q.value=0.4;
    this.rainG=c.createGain(); this.rainG.gain.value=0; rs.connect(rbp); rbp.connect(this.rainG); this.rainG.connect(this.master); rs.start();
    this.nextT=c.currentTime+0.3;
    setInterval(()=>this.tick(), 90);
  },
  setOn(on){ this.settings.sound=on; if(this.master) this.master.gain.value=on?0.9:0; },
  setMusic(v){ this.settings.music=v; if(this.mus) this.mus.gain.value=0.32*v; },
  env(node, t, a, peak, dec){ node.gain.setValueAtTime(0.0001,t); node.gain.exponentialRampToValueAtTime(peak,t+a); node.gain.exponentialRampToValueAtTime(0.0001,t+a+dec); },
  tone(f, t, dec, vol, type='triangle', dest, f2){
    if(!this.ctx) return; const c=this.ctx; const o=c.createOscillator(); o.type=type; o.frequency.setValueAtTime(f,t);
    if(f2) o.frequency.exponentialRampToValueAtTime(f2,t+dec); const g=c.createGain(); this.env(g,t,0.008,vol,dec);
    o.connect(g); g.connect(dest||this.sfx); o.start(t); o.stop(t+dec+0.05);
  },
  burst(t, dec, vol, type, freq, q=0.8){
    if(!this.ctx) return; const c=this.ctx; const s=c.createBufferSource(); s.buffer=this.noise;
    const f=c.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q; const g=c.createGain(); this.env(g,t,0.01,vol,dec);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t+dec+0.05);
  },
  get t(){ return this.ctx ? this.ctx.currentTime : 0; },
  pop(){ this.tone(520,this.t,0.12,0.35,'sine',null,900); },
  rustle(){ this.burst(this.t,0.35,0.35,'bandpass',1800,0.6); this.burst(this.t+0.12,0.25,0.25,'bandpass',2400,0.6); },
  thunk(){ this.tone(200,this.t,0.18,0.5,'sine',null,80); this.burst(this.t,0.06,0.3,'highpass',3000); },
  chop(){ this.tone(160,this.t,0.12,0.5,'square',null,70); this.burst(this.t,0.1,0.4,'bandpass',900,1.5); },
  timber(){ const t=this.t; this.burst(t,0.8,0.4,'lowpass',600,0.5); this.tone(120,t+0.3,0.6,0.4,'sine',null,40); },
  dig(){ this.burst(this.t,0.22,0.45,'lowpass',500); },
  water(){ this.burst(this.t,0.5,0.25,'bandpass',3200,0.7); },
  splash(){ this.burst(this.t,0.45,0.4,'lowpass',1400,0.5); this.tone(700,this.t,0.15,0.08,'sine',null,300); },
  plip(){ this.tone(1100,this.t,0.06,0.18,'sine',null,700); },
  coin(){ const t=this.t; this.tone(988,t,0.08,0.18,'square'); this.tone(1319,t+0.07,0.22,0.18,'square'); },
  jingle(){ const t=this.t; [523,659,784,1047].forEach((f,i)=>this.tone(f,t+i*0.09,0.35,0.25,'triangle')); },
  fanfare(){ const t=this.t; [523,659,784,1047,784,1047].forEach((f,i)=>this.tone(f,t+i*0.1,0.4,0.24,'triangle')); },
  fail(){ const t=this.t; this.tone(420,t,0.15,0.2,'triangle',null,300); this.tone(300,t+0.12,0.25,0.2,'triangle',null,200); },
  breakTool(){ const t=this.t; this.burst(t,0.3,0.5,'highpass',2500); this.tone(600,t,0.3,0.2,'square',null,150); },
  door(){ const t=this.t; this.tone(300,t,0.12,0.25,'triangle',null,220); this.burst(t+0.05,0.15,0.2,'lowpass',800); },
  click(){ this.tone(760,this.t,0.04,0.12,'sine'); },
  blip(p){ this.tone(p*(0.9+Math.random()*0.3),this.t,0.05,0.07,'triangle'); },
  swoosh(){ this.burst(this.t,0.25,0.2,'bandpass',900,1.2); },
  makePhrase(h, inside){
    const r=mulberry32(h*7919+13+(inside?77:0)), night=(h>=20||h<5), eve=(h>=17&&h<20), morn=(h>=5&&h<10);
    const scale = night ? [0,3,5,7,10] : [0,2,4,7,9];
    const roots=[0,2,5,7,-3,-5]; const root=57+roots[h%roots.length]+(night?-2:0);
    const prog = night ? [0,-4,-7,-2] : (eve ? [0,-3,5,-5] : [0,9,5,7]);
    const mel=[]; let deg=2+Math.floor(r()*3);
    for(let i=0;i<32;i++){ const rest = r() < (night?0.6:0.42) || (i%8===7); if(rest){mel.push(null);continue;} deg=clamp(deg+Math.round((r()-0.5)*3),0,9); mel.push(deg); }
    const bpm = (night?64:(eve?76:(morn?86:96))) - (inside?8:0);
    return {scale,root,prog,mel,bpm,night};
  },
  tick(){
    if(!this.ctx || this.ctx.state!=='running') return;
    const W=this.world, h=Math.floor(Time.hour()), key=h+(W.inside?100:0);
    if(key!==this.phraseHour){ this.phrase=this.makePhrase(h, !!W.inside); this.phraseHour=key; }
    const P=this.phrase, c=this.ctx;
    while(this.nextT < c.currentTime+0.35){
      const t=this.nextT, i=this.step%32, bar=Math.floor(i/8), chord=P.root+P.prog[bar];
      const d=P.mel[i];
      if(d!==null){ const n=P.root+12+P.scale[d%5]+12*Math.floor(d/5); const f=440*Math.pow(2,(n-69)/12);
        this.tone(f,t,P.night?0.9:0.55,P.night?0.11:0.13,'sine',this.mus); this.tone(f*2,t,0.18,0.025,'sine',this.mus); }
      if(i%8===0){ const f=440*Math.pow(2,(chord-12-69)/12); this.tone(f,t,1.6,0.16,'sine',this.mus);
        [0,4,7].forEach((iv,k)=>{ const ff=440*Math.pow(2,(chord+iv+(P.night&&iv===4?-1:0)-69)/12); this.tone(ff,t+k*0.04,1.2,0.035,'triangle',this.mus); }); }
      if(i%8===4 && !P.night){ const f=440*Math.pow(2,(chord-12+7-69)/12); this.tone(f,t,0.7,0.08,'sine',this.mus); }
      this.nextT += 60/P.bpm/2; this.step++;
    }
    const hr=Time.hour(), out=!W.inside;
    if(out && Math.random()<0.012 && hr>5.5 && hr<18.5 && W.weather==='sunny'){ const t=c.currentTime; const b=2400+Math.random()*1400; for(let k=0;k<2+(Math.random()*3|0);k++) this.tone(b,t+k*0.11,0.08,0.05,'sine',null,b*1.25); }
    if(out && Math.random()<0.02 && (hr>20||hr<5) && W.season!=='winter'){ const t=c.currentTime; for(let k=0;k<3;k++) this.tone(4600,t+k*0.05,0.025,0.02,'sine'); }
    this.rainG.gain.value = (W.weather==='rain') ? (out?0.07:0.025) : 0;
    this.oceanG.gain.value = out ? 0.05 : 0.008;
  },
};
