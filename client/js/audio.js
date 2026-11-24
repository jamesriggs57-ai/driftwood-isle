// All sound is synthesized: hourly music, ambience and effects. No audio files.
import { mulberry32, clamp, Time } from './util.js';


/* The songs. root: MIDI note, scale: steps above the root, prog: chord roots (semitones) per bar,
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
  { name:'Tide Pools', bpm:84, root:52, scale:[0,2,4,7,9], prog:[0,-3,5,-5], voicing:[0,7,14,16], bars:8, start:5, rest:0.5, hold:0.3, trill:0.12, leap:3,
    drone:0, padVol:0.022, padType:'sine', padAtt:1.1, padCut:1500, arp:[0,null,2,1,null,3,null,2], arpVol:0.035, melVol:0.075, melType:'sine', melDecay:0.8, bell:0.05, bellVol:0.04 },
  { name:'Cloud Shadows', bpm:72, root:55, scale:[0,2,4,6,7,9,11], prog:[0,2,0,-5], voicing:[0,7,11,16], bars:8, start:4, rest:0.55, hold:0.45, trill:0.1, leap:3,
    drone:0.035, padVol:0.025, padType:'sine', padAtt:1.6, padCut:1300, trem:0.025, tremRate:5, melVol:0.07, melType:'sine', melDecay:1.0, bell:0.05, bellVol:0.04 },
  { name:'Salt Breeze', bpm:88, root:50, scale:[0,2,4,5,7,9,10], prog:[0,-2,5,0], voicing:[0,4,7,14], bars:8, start:5, rest:0.45, hold:0.3, trill:0.1, leap:3,
    drone:0, padVol:0.022, padType:'triangle', padAtt:0.9, padCut:1600, arp:[0,1,2,null,1,null,3,null], arpVol:0.035, melVol:0.075, melType:'triangle', melDecay:0.6, bell:0.03, bellVol:0.035 },
  { name:'Firefly Field', bpm:66, root:49, scale:[0,2,3,5,7,9,10], prog:[0,5,-2,3], voicing:[0,7,10,15], bars:8, start:4, rest:0.58, hold:0.4, trill:0.2, leap:2,
    drone:0.045, padVol:0.025, padType:'sine', padAtt:2.0, padCut:1000, melVol:0.07, melType:'sine', melDecay:1.2, bell:0.06, bellVol:0.045 },
  { name:'Starlit Dock', bpm:54, root:47, scale:[0,2,4,7,9], prog:[0,5,-3,5], voicing:[0,7,16], bars:8, start:3, rest:0.7, hold:0.55, trill:0.1, leap:2,
    drone:0.055, padVol:0.024, padType:'sine', padAtt:2.6, padCut:750, melVol:0.065, melType:'sine', melDecay:1.5, bell:0.07, bellVol:0.045 },
  { name:'Window Seat', bpm:74, root:55, scale:[0,2,4,5,7,9,11], prog:[0,-5,-3,5], voicing:[0,4,7,11], bars:8, start:5, rest:0.5, hold:0.35, trill:0.08, leap:3,
    drone:0, padVol:0.022, padType:'triangle', padAtt:1.2, padCut:1200, arp:[0,null,1,null,2,null,1,null], arpVol:0.03, melVol:0.07, melType:'triangle', melDecay:0.7, bell:0.04, bellVol:0.04 },
];
/* Which songs fit each part of the day. The game rotates through the pool, a new song every 3 to 5 minutes,
   never the same one twice in a row. Indexes into SONGS. */
const POOLS = {
  dawn:[0,10,11], morning:[1,10,2], late:[2,12,1], noon:[3,11,12], afternoon:[4,12,11], evening:[5,13,4],
  dusk:[6,13,5], night:[7,14,6], deep:[8,14,7], inDay:[9,15,4], inNight:[9,15,6],
};
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
    const src=()=>{ const n=c.createBufferSource(); n.buffer=buf; n.loop=true; n.start(0, Math.random()*2); return n; };
    // Ocean: a low bed plus separate swells that roll in at uneven times and sizes (see waves()).
    this.oceanOut=c.createGain(); this.oceanOut.gain.value=1; this.oceanOut.connect(this.master);
    this.oceanLP=c.createBiquadFilter(); this.oceanLP.type='lowpass'; this.oceanLP.frequency.value=380;
    this.oceanG=c.createGain(); this.oceanG.gain.value=0.035;
    src().connect(this.oceanLP); this.oceanLP.connect(this.oceanG); this.oceanG.connect(this.oceanOut);
    this.foamHP=c.createBiquadFilter(); this.foamHP.type='bandpass'; this.foamHP.frequency.value=2200; this.foamHP.Q.value=0.5;
    this.foamG=c.createGain(); this.foamG.gain.value=0; src().connect(this.foamHP); this.foamHP.connect(this.foamG); this.foamG.connect(this.oceanOut);
    // Wind, all into one bus that gets muffled indoors: a breeze that wanders in pitch and strength,
    // gusts that swell and sweep, and now and then a thin whistle.
    this.windOut=c.createGain(); this.windOut.gain.value=1; this.windLP=c.createBiquadFilter(); this.windLP.type='lowpass'; this.windLP.frequency.value=3000;
    this.windOut.connect(this.windLP); this.windLP.connect(this.master);
    this.breezeBP=c.createBiquadFilter(); this.breezeBP.type='bandpass'; this.breezeBP.frequency.value=500; this.breezeBP.Q.value=0.8;
    this.breezeG=c.createGain(); this.breezeG.gain.value=0; src().connect(this.breezeBP); this.breezeBP.connect(this.breezeG); this.breezeG.connect(this.windOut);
    this.gustBP=c.createBiquadFilter(); this.gustBP.type='bandpass'; this.gustBP.frequency.value=400; this.gustBP.Q.value=1.1;
    this.gustG=c.createGain(); this.gustG.gain.value=0; src().connect(this.gustBP); this.gustBP.connect(this.gustG); this.gustG.connect(this.windOut);
    this.whistleBP=c.createBiquadFilter(); this.whistleBP.type='bandpass'; this.whistleBP.frequency.value=900; this.whistleBP.Q.value=22;
    this.whistleG=c.createGain(); this.whistleG.gain.value=0; src().connect(this.whistleBP); this.whistleBP.connect(this.whistleG); this.whistleG.connect(this.windOut);
    this.breeze={ v:0.3, drift:0 }; this.nextGust=c.currentTime+6+Math.random()*10; this.nextWave=c.currentTime+2; this.lastOut=null;
    const rs=src();
    const rbp=c.createBiquadFilter(); rbp.type='bandpass'; rbp.frequency.value=2600; rbp.Q.value=0.4;
    this.rainG=c.createGain(); this.rainG.gain.value=0; rs.connect(rbp); rbp.connect(this.rainG); this.rainG.connect(this.master);
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
  /* ---------- Music: sixteen ambient songs, grouped by part of the day (plus indoors), rotating every few minutes ----------
     Each song is a few slow layers: a low drone, long pad chords that overlap, a sparse melody of held notes
     with vibrato, little trills, glassy bells, soft plucks and tremolo tones. Phrases are regenerated from a
     seed every loop, so a song drifts instead of repeating note for note. */
  poolFor(h, inside){
    if (inside) return (h>=19 || h<6) ? 'inNight' : 'inDay';
    if (h>=5 && h<7) return 'dawn'; if (h>=7 && h<10) return 'morning'; if (h>=10 && h<12) return 'late'; if (h>=12 && h<14) return 'noon';
    if (h>=14 && h<17) return 'afternoon'; if (h>=17 && h<19) return 'evening'; if (h>=19 && h<21) return 'dusk'; if (h>=21) return 'night'; return 'deep';
  },
  // pick the next song from a pool, not the one that just played
  pickSong(pool){ const opts=POOLS[pool].filter(i=>!this.song || i!==this.song.idx); return opts[Math.floor(Math.random()*opts.length)]; },
  startSong(idx, gap){
    const c=this.ctx; this.loop=0; this.seed=Math.floor(Math.random()*100000); this.song=this.makeSong(idx, 0); this.step=0;
    this.songEnd=c.currentTime+180+Math.random()*120;   // 3 to 5 minutes, then the next song at the end of a phrase
    this.nextT=Math.max(this.nextT, c.currentTime+gap);
  },
  makeSong(idx, loop){
    const S=SONGS[idx], r=mulberry32(idx*1013+loop*7919+(this.seed||0)*31+5), steps=S.bars*8, mel=new Array(steps).fill(null);
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
    const W=this.world, c=this.ctx, pool=this.poolFor(Time.hour(), !!W.inside);
    // new part of the day (or went in or out): switch now, unless the current song also fits there
    if (!this.song || pool!==this.pool){ const keep=this.song && POOLS[pool].includes(this.song.idx); this.pool=pool; if (!keep) this.startSong(this.pickSong(pool), 0.6); }
    while(this.nextT < c.currentTime+0.4){
      let P=this.song;
      if (this.step>=P.steps){
        if (c.currentTime>=this.songEnd){ this.startSong(this.pickSong(pool), 0); this.nextT+=3+Math.random()*3; continue; }   // a short breath between songs
        this.step=0; this.loop++; P=this.song=this.makeSong(P.idx, this.loop);
      }
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
    if (out!==this.lastOut){ this.lastOut=out; const n=c.currentTime;
      this.oceanOut.gain.setTargetAtTime(out?1:0.16, n, 0.4); this.windOut.gain.setTargetAtTime(out?1:0.35, n, 0.4); this.windLP.frequency.setTargetAtTime(out?3000:420, n, 0.4); }
    this.wind(W, hr);
    if (c.currentTime>=this.nextWave) this.wave();
  },
  // how windy it is right now, 0 to 1, from weather, season and time of night
  windiness(W, hr){
    let w = W.weather==='rain' ? 0.62 : W.weather==='snow' ? 0.5 : W.weather==='cloudy' ? 0.42 : 0.25;
    if (W.season==='winter') w+=0.12; else if (W.season==='autumn') w+=0.06;
    if (hr>=22 || hr<5) w-=0.08;
    return clamp(w,0.1,0.9);
  },
  wind(W, hr){
    const c=this.ctx, n=c.currentTime, B=this.breeze, base=this.windiness(W, hr);
    // slow random walk around the weather's level, so the breeze rises and settles on its own
    B.drift = clamp(B.drift*0.985 + (Math.random()-0.5)*0.04, -0.25, 0.25);
    B.v += (clamp(base+B.drift,0.05,1)-B.v)*0.03;
    this.breezeG.gain.setTargetAtTime(0.012+B.v*0.05, n, 0.8);
    this.breezeBP.frequency.setTargetAtTime(280+B.v*520+B.drift*300, n, 1.2);
    if (n<this.nextGust) return;
    // a gust: swells in, the pitch climbs and falls back, then trails off. Size and length vary.
    const big=Math.random(), dur=2.5+Math.random()*4.5, peak=(0.03+big*0.09)*(0.6+base), up=dur*(0.3+Math.random()*0.25);
    const f0=250+Math.random()*200, f1=f0+300+big*700;
    const g=this.gustG.gain, f=this.gustBP.frequency;
    g.cancelScheduledValues(n); g.setValueAtTime(Math.max(0.0001,g.value),n); g.linearRampToValueAtTime(peak,n+up); g.linearRampToValueAtTime(peak*0.55,n+up+dur*0.2); g.linearRampToValueAtTime(0.0001,n+dur);
    f.cancelScheduledValues(n); f.setValueAtTime(f0,n); f.linearRampToValueAtTime(f1,n+up); f.exponentialRampToValueAtTime(f0*0.9,n+dur);
    // sometimes the gust whistles: a thin tone that slides around (more often in cold, cloudy or stormy weather)
    const whistleOdds = 0.15 + (W.season==='winter'?0.25:0) + (W.weather==='snow'||W.weather==='rain'?0.15:W.weather==='cloudy'?0.08:0);
    if (Math.random()<whistleOdds){
      const wg=this.whistleG.gain, wf=this.whistleBP.frequency, w0=600+Math.random()*700, t0=n+up*0.4, wd=dur*0.8;
      wg.cancelScheduledValues(n); wg.setValueAtTime(0.0001,n); wg.linearRampToValueAtTime(0.0001,t0); wg.linearRampToValueAtTime(0.18+big*0.25,t0+wd*0.4); wg.linearRampToValueAtTime(0.0001,t0+wd);
      wf.cancelScheduledValues(n); wf.setValueAtTime(w0,t0); wf.linearRampToValueAtTime(w0*(1.15+Math.random()*0.35),t0+wd*0.45); wf.linearRampToValueAtTime(w0*(0.85+Math.random()*0.2),t0+wd);
    }
    // leaves rustle as a bigger gust passes (no leaves in winter); nothing indoors
    if (this.lastOut && W.season!=='winter' && big>0.35){ const k=2+Math.floor(big*5); for (let i=0;i<k;i++) this.burst(n+up*0.6+Math.random()*dur*0.6, 0.18+Math.random()*0.3, 0.05+big*0.07, 'bandpass', 2800+Math.random()*2400, 0.9); }
    // stormy weather gusts more often
    const gap = W.weather==='rain'||W.weather==='snow' ? 8+Math.random()*18 : W.weather==='cloudy' ? 12+Math.random()*25 : 18+Math.random()*40;
    this.nextGust = n+dur+gap;
  },
  // one ocean swell: rolls in (louder, brighter), sometimes with a foamy wash, then draws back. Uneven timing and size.
  wave(){
    const c=this.ctx, n=c.currentTime, size=Math.random(), rise=1.6+Math.random()*1.8, fall=2.5+Math.random()*3, peak=0.045+size*0.05;
    const g=this.oceanG.gain, f=this.oceanLP.frequency;
    g.cancelScheduledValues(n); g.setValueAtTime(Math.max(0.0001,g.value),n); g.linearRampToValueAtTime(peak,n+rise); g.linearRampToValueAtTime(0.03,n+rise+fall);
    f.cancelScheduledValues(n); f.setValueAtTime(Math.max(200,f.value),n); f.linearRampToValueAtTime(420+size*450,n+rise); f.linearRampToValueAtTime(330,n+rise+fall);
    if (size>0.45){ const fg=this.foamG.gain; fg.cancelScheduledValues(n); fg.setValueAtTime(0.0001,n+rise*0.8); fg.linearRampToValueAtTime(0.01+size*0.015,n+rise+0.4); fg.linearRampToValueAtTime(0.0001,n+rise+fall*0.8); }
    this.nextWave = n+rise+fall*(0.6+Math.random()*0.5)+(size<0.2?2+Math.random()*3:0);
  },
};
