// All sound is synthesized: hourly music, ambience and effects. No audio files.
import { mulberry32, clamp, Time } from './util.js';


/* The ten songs. root: MIDI note, scale: steps above the root, prog: chord roots (semitones) per bar,
   voicing: chord tones, rest: chance of a gap, hold/trill: share of held and trilled notes, leap: how far the melody wanders. */
const SONGS = [
  { name:'Sea Glass', bpm:68, root:50, scale:[0,2,4,6,7,9,11], prog:[0,7,2,7], voicing:[0,7,16], bars:8, start:4, rest:0.55, hold:0.45, trill:0.12, leap:3,
    drone:0.05, padVol:0.03, padType:'sine', padAtt:1.8, padCut:1200, melVol:0.075, melType:'sine', melDecay:1.1, bell:0.07, bellVol:0.05 },
  { name:'Morning Paths', bpm:90, root:55, scale:[0,2,4,7,9], prog:[0,5,-3,-5], voicing:[0,4,7,11], bars:8, start:5, rest:0.45, hold:0.3, trill:0.08, leap:3,
    drone:0, padVol:0.022, padType:'triangle', padAtt:0.9, padCut:1600, arp:[0,null,1,null,2,null,1,3], arpVol:0.045, melVol:0.08, melType:'triangle', melDecay:0.6, bell:0.03, bellVol:0.04 },
  { name:'Kite Hill', bpm:98, root:48, scale:[0,2,4,7,9], prog:[0,7,9,5], voicing:[0,4,7,14], bars:8, start:6, rest:0.4, hold:0.25, trill:0.14, leap:4,
    drone:0, padVol:0.024, padType:'triangle', padAtt:0.7, padCut:1800, arp:[0,2,1,3,0,2,1,null], arpVol:0.04, melVol:0.08, melType:'triangle', melDecay:0.5, bell:0.02, bellVol:0.035 },
  { name:'Noon Shimmer', bpm:82, root:57, scale:[0,2,4,7,9,11], prog:[0,5,0,7], voicing:[0,4,11,14], bars:8, start:4, rest:0.5, hold:0.4, trill:0.1, leap:3,
    drone:0.03, padVol:0.025, padType:'sine', padAtt:1.4, padCut:1500, trem:0.03, tremRate:6, melVol:0.07, melType:'sine', melDecay:0.9, bell:0.06, bellVol:0.045 },
  { name:'Driftwood Afternoon', bpm:76, root:53, scale:[0,2,4,6,7,9,11], prog:[0,2,-3,-5], voicing:[0,7,16,19], bars:8, start:5, rest:0.5, hold:0.5, trill:0.08, leap:3,
    drone:0.045, padVol:0.025, padType:'triangle', padAtt:1.5, padCut:1100, melVol:0.08, melType:'triangle', melDecay:0.8, bell:0.03, bellVol:0.04 },
  { name:'Amber Hour', bpm:70, root:51, scale:[0,2,3,5,7,10], prog:[0,-4,-7,-2], voicing:[0,3,7,10], bars:8, start:5, rest:0.55, hold:0.45, trill:0.15, leap:2,
    drone:0.04, padVol:0.028, padType:'sine', padAtt:1.8, padCut:1000, trem:0.025, tremRate:4, melVol:0.075, melType:'triangle', melDecay:1.0, bell:0.04, bellVol:0.04 },
  { name:'Lantern Path', bpm:64, root:50, scale:[0,2,3,5,7,9,10], prog:[0,5,3,-2], voicing:[0,7,15], bars:8, start:4, rest:0.62, hold:0.5, trill:0.1, leap:2,
    drone:0.05, padVol:0.026, padType:'sine', padAtt:2.2, padCut:900, melVol:0.07, melType:'sine', melDecay:1.3, bell:0.08, bellVol:0.05 },
  { name:'Moth Lamp', bpm:58, root:52, scale:[0,3,5,7,10], prog:[0,-4,-2,-7], voicing:[0,7,10,15], bars:8, start:3, rest:0.68, hold:0.45, trill:0.25, leap:2,
    drone:0.055, padVol:0.022, padType:'sine', padAtt:2.6, padCut:800, trem:0.02, tremRate:3, melVol:0.065, melType:'sine', melDecay:1.4, bell:0.04, bellVol:0.04 },
  { name:'Deep Night Tide', bpm:50, root:45, scale:[0,2,3,7,8], prog:[0,-4,0,-5], voicing:[0,7,15], bars:8, start:3, rest:0.78, hold:0.6, trill:0.08, leap:2,
    drone:0.065, padVol:0.024, padType:'sine', padAtt:3, padCut:700, melVol:0.06, melType:'sine', melDecay:1.6, bell:0.05, bellVol:0.045 },
  { name:'Kettle Steam', bpm:78, root:53, scale:[0,2,4,5,7,9], prog:[0,-3,2,-5], voicing:[0,4,7,9], bars:8, start:5, rest:0.48, hold:0.3, trill:0.1, leap:3,
    drone:0, padVol:0.022, padType:'triangle', padAtt:1.0, padCut:1300, arp:[0,null,2,null,1,null,3,null], arpVol:0.035, melVol:0.07, melType:'triangle', melDecay:0.7, bell:0.05, bellVol:0.04 },
];
// overall level, and a lift for the lighter daytime songs so every song sits at about the same loudness
for (const S of SONGS){ const k=1.5*(S.arp?1.35:1); for (const key of ['drone','padVol','melVol','bellVol','arpVol','trem']) if (S[key]) S[key]*=k; }
export const SONG_NAMES = SONGS.map(s=>s.name);

export const Snd = {
  ctx:null, master:null, mus:null, sfx:null, rainG:null, song:null, loop:0, step:0, nextT:0, world:null, settings:null,
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
  magic(){ const t=this.t; [0,4,7,11,14,19,23,26].forEach((st,i)=>{ const f=392*Math.pow(2,st/12); this.tone(f,t+i*0.07,0.9,0.09,'sine'); this.tone(f*2.01,t+i*0.07+0.03,0.4,0.03,'sine'); }); for(let i=0;i<10;i++) this.tone(i%2?1568:1760, t+0.65+i*0.06, 0.1, 0.035, 'sine'); },
  rumble(){ const t=this.t; this.burst(t,2.2,0.45,'lowpass',140,0.7); this.burst(t+0.6,1.6,0.3,'lowpass',90,0.7); this.tone(55,t,2.2,0.18,'sine',null,40); },
  boing(){ const t=this.t; this.tone(440,t,0.4,0.28,'sine',null,150); this.tone(300,t+0.06,0.32,0.14,'triangle',null,620); this.burst(t,0.08,0.18,'lowpass',700); },
  swoosh(){ this.burst(this.t,0.25,0.2,'bandpass',900,1.2); },
  /* ---------- Music: ten ambient songs, one for each part of the day (and one for indoors) ----------
     Each song is a few slow layers: a low drone, long pad chords that overlap, a sparse melody of held notes
     with vibrato, little trills, glassy bells, soft plucks and tremolo tones. Phrases are regenerated from a
     seed every loop, so a song drifts instead of repeating note for note. */
  songFor(h, inside){
    if (inside) return 9;
    if (h>=5 && h<7) return 0; if (h<10 && h>=7) return 1; if (h<12 && h>=10) return 2; if (h<14 && h>=12) return 3;
    if (h<17 && h>=14) return 4; if (h<19 && h>=17) return 5; if (h<21 && h>=19) return 6; if (h>=21) return 7; return 8;
  },
  makeSong(idx, loop){
    const S=SONGS[idx], r=mulberry32(idx*1013+loop*7919+5), steps=S.bars*8, mel=new Array(steps).fill(null);
    let deg=S.start, i=0;
    while (i<steps){
      if (r()<S.rest){ i+=1+Math.floor(r()*3); continue; }
      deg=clamp(deg+Math.round((r()-0.5)*S.leap),0,S.scale.length*2-1);
      const roll=r(), kind = roll<S.trill ? 'trill' : roll<S.trill+S.hold ? 'hold' : 'note';
      const len = kind==='hold' ? 4+Math.floor(r()*6) : kind==='trill' ? 2+Math.floor(r()*2) : 1+Math.floor(r()*2);
      mel[i]={ deg, kind, len }; i+=len;
    }
    const bells=[]; for (let k=0;k<steps;k++) bells.push(r()<S.bell ? Math.floor(r()*S.scale.length) : null);
    return { S, mel, bells, steps, idx };
  },
  hz(n){ return 440*Math.pow(2,(n-69)/12); },
  noteOf(S, deg, oct=0){ const L=S.scale.length; return S.root+12*(1+oct)+S.scale[((deg%L)+L)%L]+12*Math.floor(deg/L); },
  // a soft held tone: two slightly detuned oscillators through a lowpass, slow attack and release
  pad(f, t, dur, vol, type='sine', att=1.2, rel=1.8, cut=1400){
    const c=this.ctx, g=c.createGain(), lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.setValueAtTime(cut*0.6,t); lp.frequency.linearRampToValueAtTime(cut,t+att+dur*0.4);
    g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(vol,t+att); g.gain.setValueAtTime(vol,t+Math.max(att,dur-rel)); g.gain.linearRampToValueAtTime(0.0001,t+dur+rel);
    for (const d of [-4,4]){ const o=c.createOscillator(); o.type=type; o.frequency.value=f; o.detune.value=d; o.connect(lp); o.start(t); o.stop(t+dur+rel+0.1); }
    lp.connect(g); g.connect(this.mus);
  },
  // a held melody note that swells in and wobbles a little (vibrato fades in)
  held(f, t, dur, vol, type='triangle'){
    const c=this.ctx, o=c.createOscillator(), g=c.createGain(), lfo=c.createOscillator(), lg=c.createGain();
    o.type=type; o.frequency.value=f; lfo.frequency.value=4.6; lg.gain.setValueAtTime(0,t); lg.gain.linearRampToValueAtTime(f*0.006,t+dur*0.6); lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(vol,t+0.18); g.gain.linearRampToValueAtTime(vol*0.7,t+dur*0.7); g.gain.linearRampToValueAtTime(0.0001,t+dur+0.6);
    o.connect(g); g.connect(this.mus); o.start(t); lfo.start(t); o.stop(t+dur+0.7); lfo.stop(t+dur+0.7);
  },
  // a quick flutter between a note and the one above it
  trill(n, n2, t, dur, vol){ const k=Math.max(4, Math.floor(dur/0.075)); for (let i=0;i<k;i++) this.tone(this.hz(i%2?n2:n), t+i*0.075, 0.12, vol*(1-i/k*0.5), 'sine', this.mus); },
  // glassy bell: a sine plus an inharmonic partial, long ring
  bell(f, t, vol){ this.tone(f,t,2.6,vol,'sine',this.mus); this.tone(f*2.76,t,0.9,vol*0.25,'sine',this.mus); this.tone(f*5.4,t,0.35,vol*0.08,'sine',this.mus); },
  pluck(f, t, vol){ this.tone(f,t,0.7,vol,'triangle',this.mus); this.tone(f*2,t,0.25,vol*0.3,'sine',this.mus); },
  // a held tone that pulses in volume
  tremolo(f, t, dur, vol, rate){ const c=this.ctx, o=c.createOscillator(), g=c.createGain(), lfo=c.createOscillator(), lg=c.createGain(), base=c.createGain();
    o.type='sine'; o.frequency.value=f; lfo.frequency.value=rate; lg.gain.value=0.5; base.gain.value=0.5; lfo.connect(lg); lg.connect(base.gain);
    g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(vol,t+0.8); g.gain.linearRampToValueAtTime(0.0001,t+dur+1.2);
    o.connect(base); base.connect(g); g.connect(this.mus); o.start(t); lfo.start(t); o.stop(t+dur+1.3); lfo.stop(t+dur+1.3); },
  tick(){
    if(!this.ctx || this.ctx.state!=='running') return;
    const W=this.world, c=this.ctx, want=this.songFor(Math.floor(Time.hour()), !!W.inside);
    if (!this.song || want!==this.song.idx){ this.loop=0; this.song=this.makeSong(want, 0); this.step=0; this.nextT=Math.max(this.nextT, c.currentTime+0.6); }
    while(this.nextT < c.currentTime+0.4){
      let P=this.song; if (this.step>=P.steps){ this.step=0; this.loop++; P=this.song=this.makeSong(P.idx, this.loop); }
      const S=P.S, t=this.nextT, i=this.step, sd=60/S.bpm/2, bar=Math.floor(i/8), chord=S.root+S.prog[bar%S.prog.length];
      // drone: root and fifth, re-struck every 2 bars and overlapping, so it never stops
      if (S.drone && i%16===0){ this.pad(this.hz(chord-12), t, sd*16, S.drone, 'sine', 2.5, 3, 500); this.pad(this.hz(chord-5), t+0.3, sd*16, S.drone*0.55, 'sine', 3, 3, 600); }
      // pad chord every bar
      if (i%8===0) S.voicing.forEach((iv,k)=>this.pad(this.hz(chord+iv), t+k*0.06, sd*8, S.padVol, S.padType, S.padAtt, 2.2, S.padCut));
      // plucked arpeggio
      if (S.arp && S.arp[i%S.arp.length]!==null){ const iv=S.voicing[S.arp[i%S.arp.length]%S.voicing.length]; this.pluck(this.hz(chord+12+iv), t, S.arpVol); }
      // tremolo tone, held for a bar
      if (S.trem && i%16===8) this.tremolo(this.hz(chord+12+S.voicing[1]), t, sd*8, S.trem, S.tremRate);
      // melody
      const m=P.mel[i];
      if (m){ const n=this.noteOf(S,m.deg), f=this.hz(n);
        if (m.kind==='hold') this.held(f, t, sd*m.len, S.melVol, S.melType);
        else if (m.kind==='trill') this.trill(n, this.noteOf(S,m.deg+1), t, sd*m.len, S.melVol*0.55);
        else { this.tone(f,t,S.melDecay,S.melVol,S.melType==='sine'?'sine':'triangle',this.mus); this.tone(f*2,t,0.18,S.melVol*0.2,'sine',this.mus); } }
      const b=P.bells[i]; if (b!==null) this.bell(this.hz(this.noteOf(S,b,1)), t+sd*0.5, S.bellVol);
      this.nextT += sd; this.step++;
    }
    const hr=Time.hour(), out=!W.inside;
    if(out && Math.random()<0.012 && hr>5.5 && hr<18.5 && W.weather==='sunny'){ const t=c.currentTime; const b=2400+Math.random()*1400; for(let k=0;k<2+(Math.random()*3|0);k++) this.tone(b,t+k*0.11,0.08,0.05,'sine',null,b*1.25); }
    if(out && Math.random()<0.02 && (hr>20||hr<5) && W.season!=='winter'){ const t=c.currentTime; for(let k=0;k<3;k++) this.tone(4600,t+k*0.05,0.025,0.02,'sine'); }
    this.rainG.gain.value = (W.weather==='rain') ? (out?0.07:0.025) : 0;
    this.oceanG.gain.value = out ? 0.05 : 0.008;
  },
};
