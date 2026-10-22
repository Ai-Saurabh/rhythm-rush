'use strict';

// ============================================================
// RHYTHM RUSH — by Saurabh Yadav
// Browser rhythm game. Vanilla JS + Web Audio API.
// Zero external assets — all music & visuals procedurally generated.
// ============================================================

const CFG = {
  bpm: 140,
  lanes: 4,
  keys: ['d', 'f', 'j', 'k'],
  keyLabels: ['D', 'F', 'J', 'K'],
  colors: ['#ff006e', '#8338ec', '#3a86ff', '#06ffa5'],
  canvasW: 720,
  canvasH: 960,
  laneW: 130,
  laneGap: 12,
  hitY: 820,
  noteH: 26,
  travel: 1.2,
  windows: { perfect: 0.055, great: 0.10, good: 0.15 },
  scores: { perfect: 300, great: 200, good: 100 },
  totalBars: 34,
  playStartBar: 2,
};

const BEAT_DUR = 60 / CFG.bpm;
const BAR_DUR  = BEAT_DUR * 4;
const LEAD_IN  = CFG.playStartBar * BAR_DUR;
const SONG_END = CFG.totalBars * BAR_DUR;

class AudioEngine {
  constructor() { this.ctx = null; this.master = null; this.noiseBuf = null; }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.3;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  kick(t) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(1.0, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.35);
  }

  snare(t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 1200; flt.Q.value = 1.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(flt).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.2);
  }

  hat(t, open = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'highpass'; flt.frequency.value = 8000;
    const g = this.ctx.createGain();
    const dur = open ? 0.15 : 0.05;
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(flt).connect(g).connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  bass(t, freq, dur) {
    const osc = this.ctx.createOscillator();
    const flt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = freq;
    flt.type = 'lowpass'; flt.frequency.value = 450; flt.Q.value = 4;
    g.gain.setValueAtTime(0.35, t);
    g.gain.setValueAtTime(0.35, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(flt).connect(g).connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  lead(t, freq, dur) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square'; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.1, t);
    g.gain.setValueAtTime(0.1, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  scheduleSong(startTime) {
    const bassRoots = [110, 87.31, 130.81, 98];
    const penta = [440, 523.25, 587.33, 659.25, 783.99];
    for (let bar = 0; bar < CFG.totalBars; bar++) {
      const barStart = startTime + bar * BAR_DUR;
      let intensity = 1;
      if (bar < 2) intensity = 0;
      else if (bar < 6) intensity = 1;
      else if (bar < 14) intensity = 2;
      else if (bar < 22) intensity = 3;
      else if (bar < 26) intensity = 1;
      else intensity = 3;

      if (intensity >= 1) {
        const kicks = intensity >= 2 ? [0,1,2,3] : [0,2];
        for (const b of kicks) this.kick(barStart + b * BEAT_DUR);
        const div = intensity >= 2 ? 0.5 : 1;
        for (let h = 0; h < 4; h += div) this.hat(barStart + h * BEAT_DUR);
      }
      if (intensity >= 2) {
        this.snare(barStart + 1 * BEAT_DUR);
        this.snare(barStart + 3 * BEAT_DUR);
        const root = bassRoots[Math.floor(bar / 2) % 4];
        this.bass(barStart, root, BEAT_DUR * 1.8);
        this.bass(barStart + BEAT_DUR * 2, root, BEAT_DUR * 1.8);
      }
      if (intensity >= 3) {
        const mel = [0,2,1,3,2,4,3,1];
        for (let m = 0; m < 8; m++) {
          const idx = mel[(m + bar) % mel.length];
          this.lead(barStart + m * BEAT_DUR * 0.5, penta[idx], BEAT_DUR * 0.4);
        }
      }
    }
  }

  playHit(judgment) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    let freq = 880;
    if (judgment === 'perfect') freq = 1320;
    else if (judgment === 'great') freq = 990;
    else if (judgment === 'good') freq = 660;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.08);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.12);
  }

  playMiss() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.22);
  }
}

const PATTERNS = {
  intro: [
    [[0,0],[2,2]], [[0,1],[2,3]], [[0,2],[2,1]], [[0,3],[2,0]],
  ],
  build: [
    [[0,0],[1,1],[2,2],[3,3]],
    [[0,3],[1,2],[2,1],[3,0]],
    [[0.5,1],[1.5,2],[2.5,3],[3.5,0]],
    [[0,0],[0.5,1],[1,0],[2,2],[2.5,3],[3,2]],
  ],
  chorus: [
    [[0,0],[0.5,1],[1,0],[2,2],[2.5,3],[3,2],[3.5,1]],
    [[0,3],[0.5,2],[1,3],[2,1],[2.5,0],[3,1],[3.5,2]],
    [[0,0],[0.5,2],[1,1],[1.5,3],[2,0],[2.5,2],[3,1],[3.5,3]],
    [[0,1],[0.5,0],[1,2],[1.5,3],[2,1],[2.5,0],[3,2],[3.5,3]],
  ],
  break: [
    [[0,0],[2,3]], [[0,3],[2,0]], [[0,1],[2,2]], [[0,2],[2,1]],
  ],
  finale: [
    [[0,0],[0.5,1],[1,2],[1.5,3],[2,0],[2.5,1],[3,2],[3.5,3]],
    [[0,3],[0.5,2],[1,1],[1.5,0],[2,3],[2.5,2],[3,1],[3.5,0]],
    [[0,0],[0.5,1],[1,0],[1.5,2],[2,1],[2.5,3],[3,2],[3.5,3]],
    [[0,1],[0.5,2],[1,3],[1.5,0],[2,2],[2.5,3],[3,0],[3.5,1]],
  ],
};

function generateBeatmap(difficulty) {
  const notes = [];
  const sections = [
    { start: 2, end: 6, type: 'intro' },
    { start: 6, end: 14, type: 'build' },
    { start: 14, end: 22, type: 'chorus' },
    { start: 22, end: 26, type: 'break' },
    { start: 26, end: 34, type: 'finale' },
  ];
  let patIdx = 0;
  const filter = {
    easy: (b) => b % 1 === 0,
    normal: (b) => b % 0.5 === 0,
    hard: () => true,
  }[difficulty];

  for (const sec of sections) {
    const pats = PATTERNS[sec.type];
    for (let bar = sec.start; bar < sec.end; bar++) {
      const barTime = bar * BAR_DUR;
      const pattern = pats[patIdx % pats.length];
      patIdx++;
      for (const [beatOffset, lane] of pattern) {
        if (!filter(beatOffset)) continue;
        notes.push({ time: barTime + beatOffset * BEAT_DUR, lane, judged: false, hit: false });
      }
    }
  }
  notes.sort((a, b) => a.time - b.time);
  return notes;
}

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.audio = new AudioEngine();
    this.state = 'menu';
    this.difficulty = 'normal';
    this.notes = [];
    this.particles = [];
    this.floaters = [];
    this.songStartAudioTime = 0;
    this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.accuracy = 1;
    this.laneFlash = [0,0,0,0];
    this.hitFlash = 0; this.shake = 0;
    this.lastFrameTime = 0;
    this.setupUI();
    this.setupInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = CFG.canvasW * dpr;
    this.canvas.height = CFG.canvasH * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setupUI() {
    document.querySelectorAll('.difficulty button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.difficulty button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.difficulty = btn.dataset.diff;
      });
    });
    document.getElementById('play-btn').addEventListener('click', () => this.startGame());
    document.getElementById('retry-btn').addEventListener('click', () => this.startGame());
    document.getElementById('menu-btn').addEventListener('click', () => this.toMenu());
  }

  setupInput() {
    const keyLaneMap = {};
    CFG.keys.forEach((k, i) => keyLaneMap[k] = i);
    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const lane = keyLaneMap[e.key.toLowerCase()];
      if (lane !== undefined && this.state === 'playing') {
        e.preventDefault();
        this.hitLane(lane);
      }
    });
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.state !== 'playing') return;
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * CFG.canvasW;
      for (let lane = 0; lane < 4; lane++) {
        if (Math.abs(x - this.laneCenterX(lane)) < CFG.laneW / 2) {
          this.hitLane(lane);
          break;
        }
      }
    });
  }

  async startGame() {
    this.audio.init();
    await this.audio.resume();
    this.notes = generateBeatmap(this.difficulty);
    this.particles = [];
    this.floaters = [];
    this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.accuracy = 1;
    this.laneFlash = [0,0,0,0];
    this.hitFlash = 0; this.shake = 0;
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('results').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    this.updateHUD();
    this.state = 'playing';
    const startTime = this.audio.now() + 0.1;
    this.songStartAudioTime = startTime;
    this.audio.scheduleSong(startTime);
  }

  toMenu() {
    this.state = 'menu';
    document.getElementById('results').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('menu').classList.remove('hidden');
  }

  getSongTime() {
    if (this.state !== 'playing') return 0;
    return this.audio.now() - this.songStartAudioTime;
  }

  laneCenterX(lane) {
    const totalW = CFG.lanes * CFG.laneW + (CFG.lanes - 1) * CFG.laneGap;
    const startX = (CFG.canvasW - totalW) / 2;
    return startX + lane * (CFG.laneW + CFG.laneGap) + CFG.laneW / 2;
  }

  hitLane(lane) {
    const t = this.getSongTime();
    this.laneFlash[lane] = 1;
    let closest = null, minDiff = Infinity;
    for (const note of this.notes) {
      if (note.lane !== lane || note.judged) continue;
      const diff = Math.abs(note.time - t);
      if (diff < minDiff) { minDiff = diff; closest = note; }
    }
    if (!closest || minDiff > CFG.windows.good) return;
    let judgment;
    if (minDiff <= CFG.windows.perfect) judgment = 'perfect';
    else if (minDiff <= CFG.windows.great) judgment = 'great';
    else judgment = 'good';
    closest.judged = true;
    closest.hit = true;
    this.counts[judgment]++;
    const mult = 1 + Math.floor(this.combo / 10) * 0.5;
    this.score += Math.round(CFG.scores[judgment] * mult);
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.accuracy = this.computeAccuracy();
    this.hitFlash = 1;
    this.audio.playHit(judgment);
    this.spawnParticles(lane);
    this.spawnFloater(lane, judgment);
    this.updateHUD();
  }

  spawnParticles(lane) {
    const x = this.laneCenterX(lane), y = CFG.hitY;
    const color = CFG.colors[lane];
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 450,
        vy: -Math.random() * 350 - 100,
        life: 1,
        size: 3 + Math.random() * 5,
        color,
      });
    }
  }

  spawnFloater(lane, judgment) {
    this.floaters.push({
      x: this.laneCenterX(lane),
      y: CFG.hitY - 50,
      text: judgment.toUpperCase(),
      color: judgment === 'perfect' ? '#06ffa5'
           : judgment === 'great'   ? '#3a86ff'
           : '#ffbe0b',
      life: 1, vy: -100,
    });
  }

  computeAccuracy() {
    const total = this.counts.perfect + this.counts.great + this.counts.good + this.counts.miss;
    if (total === 0) return 1;
    return (this.counts.perfect + this.counts.great * 0.7 + this.counts.good * 0.4) / total;
  }

  updateHUD() {
    document.getElementById('score').textContent = this.score.toLocaleString();
    document.getElementById('accuracy').textContent = (this.accuracy * 100).toFixed(2) + '%';
    const comboEl = document.getElementById('combo');
    if (this.combo >= 3) {
      comboEl.textContent = this.combo + ' COMBO';
      comboEl.classList.add('active');
      comboEl.classList.remove('pop');
      void comboEl.offsetWidth;
      comboEl.classList.add('pop');
    } else {
      comboEl.classList.remove('active');
    }
  }

  update(dt) {
    if (this.state !== 'playing') return;
    const t = this.getSongTime();
    for (const note of this.notes) {
      if (note.judged) continue;
      if (note.time + CFG.windows.good < t) {
        note.judged = true; note.missed = true;
        this.counts.miss++;
        this.combo = 0;
        this.accuracy = this.computeAccuracy();
        this.shake = 1;
        this.audio.playMiss();
        this.updateHUD();
      }
    }
    if (t > SONG_END - 1) {
      const remaining = this.notes.filter(n => !n.judged).length;
      if (remaining === 0 || t > SONG_END + 2) { this.endGame(); return; }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 1200 * dt;
      p.life -= dt * 2.5;
      p.size *= 0.97;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.y += f.vy * dt;
      f.life -= dt * 1.5;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
    for (let i = 0; i < 4; i++) this.laneFlash[i] = Math.max(0, this.laneFlash[i] - dt * 5);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 5);
    this.shake = Math.max(0, this.shake - dt * 4);
    const progress = Math.max(0, Math.min(1, t / SONG_END));
    document.getElementById('progress-fill').style.width = (progress * 100) + '%';
  }

  endGame() {
    this.state = 'results';
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('results').classList.remove('hidden');
    const acc = this.accuracy * 100;
    let grade = 'D';
    if (acc >= 95) grade = 'S';
    else if (acc >= 88) grade = 'A';
    else if (acc >= 78) grade = 'B';
    else if (acc >= 65) grade = 'C';
    document.getElementById('grade').textContent = grade;
    document.getElementById('results-score').textContent = this.score.toLocaleString();
    document.getElementById('r-perfect').textContent = this.counts.perfect;
    document.getElementById('r-great').textContent = this.counts.great;
    document.getElementById('r-good').textContent = this.counts.good;
    document.getElementById('r-miss').textContent = this.counts.miss;
    document.getElementById('r-combo').textContent = this.maxCombo;
    document.getElementById('r-acc').textContent = acc.toFixed(2) + '%';
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000) || 0.016;
    this.lastFrameTime = now;
    this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  }

  render() {
    const ctx = this.ctx;
    const W = CFG.canvasW, H = CFG.canvasH;
    const t = this.getSongTime();
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random()-0.5) * this.shake * 15, (Math.random()-0.5) * this.shake * 15);
    }
    const beatPhase = (t % BEAT_DUR) / BEAT_DUR;
    const pulse = Math.max(0, 1 - beatPhase * 2);
    const bgGrad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W);
    bgGrad.addColorStop(0, `rgba(50, 20, 90, ${0.3 + pulse * 0.15})`);
    bgGrad.addColorStop(1, '#050510');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
    if (this.state === 'playing') {
      this.renderLanes(ctx);
      this.renderNotes(ctx, t);
      this.renderHitLine(ctx);
      this.renderParticles(ctx);
      this.renderFloaters(ctx);
      this.renderCountdown(ctx, t);
    }
    ctx.restore();
    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.hitFlash * 0.08})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  renderLanes(ctx) {
    const totalW = CFG.lanes * CFG.laneW + (CFG.lanes - 1) * CFG.laneGap;
    const startX = (CFG.canvasW - totalW) / 2;
    for (let i = 0; i < CFG.lanes; i++) {
      const x = startX + i * (CFG.laneW + CFG.laneGap);
      const flash = this.laneFlash[i];
      const grad = ctx.createLinearGradient(0, 0, 0, CFG.hitY);
      grad.addColorStop(0, 'rgba(255,255,255,0.02)');
      grad.addColorStop(1, `rgba(255,255,255,${0.05 + flash * 0.2})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, CFG.laneW, CFG.hitY);
      ctx.strokeStyle = `rgba(255,255,255,${0.08 + flash * 0.4})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, 0, CFG.laneW - 1, CFG.hitY);
      if (flash > 0) {
        ctx.save();
        ctx.shadowColor = CFG.colors[i];
        ctx.shadowBlur = 30 * flash;
        ctx.fillStyle = `rgba(255,255,255,${flash * 0.1})`;
        ctx.fillRect(x, 0, CFG.laneW, CFG.hitY);
        ctx.restore();
      }
      ctx.fillStyle = `rgba(255,255,255,${0.15 + flash * 0.5})`;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(CFG.keyLabels[i], x + CFG.laneW / 2, CFG.hitY + 50);
    }
  }

  renderHitLine(ctx) {
    const totalW = CFG.lanes * CFG.laneW + (CFG.lanes - 1) * CFG.laneGap;
    const startX = (CFG.canvasW - totalW) / 2;
    ctx.save();
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 20 + this.hitFlash * 30;
    ctx.strokeStyle = `rgba(255,255,255,${0.6 + this.hitFlash * 0.4})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startX - 10, CFG.hitY);
    ctx.lineTo(startX + totalW + 10, CFG.hitY);
    ctx.stroke();
    ctx.restore();
  }

  renderNotes(ctx, songTime) {
    for (const note of this.notes) {
      if (note.judged) continue;
      const timeUntilHit = note.time - songTime;
      if (timeUntilHit > CFG.travel + 0.3) continue;
      if (timeUntilHit < -0.2) continue;
      const progress = 1 - timeUntilHit / CFG.travel;
      const y = progress * CFG.hitY;
      const x = this.laneCenterX(note.lane);
      const w = CFG.laneW - 16;
      const h = CFG.noteH;
      const alpha = Math.min(1, progress * 3);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = CFG.colors[note.lane];
      ctx.shadowBlur = 15;
      const grad = ctx.createLinearGradient(x, y - h/2, x, y + h/2);
      grad.addColorStop(0, CFG.colors[note.lane]);
      grad.addColorStop(1, this.shade(CFG.colors[note.lane], -30));
      ctx.fillStyle = grad;
      this.roundRect(ctx, x - w/2, y - h/2, w, h, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      this.roundRect(ctx, x - w/2 + 4, y - h/2 + 3, w - 8, 5, 3);
      ctx.fill();
      ctx.restore();
    }
  }

  renderParticles(ctx) {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  renderFloaters(ctx) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px system-ui, sans-serif';
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 15;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  renderCountdown(ctx, t) {
    if (t < 0 || t >= LEAD_IN) return;
    const seg = LEAD_IN / 4;
    let text, prog;
    if (t < seg) { text = '3'; prog = t / seg; }
    else if (t < seg * 2) { text = '2'; prog = (t - seg) / seg; }
    else if (t < seg * 3) { text = '1'; prog = (t - seg * 2) / seg; }
    else { text = 'GO!'; prog = (t - seg * 3) / seg; }
    const scale = 1 + prog * 0.4;
    const alpha = 1 - prog * 0.7;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(120 * scale)}px system-ui, sans-serif`;
    ctx.fillStyle = text === 'GO!' ? '#06ffa5' : '#fff';
    ctx.shadowColor = text === 'GO!' ? '#06ffa5' : '#fff';
    ctx.shadowBlur = 40;
    ctx.fillText(text, CFG.canvasW / 2, CFG.canvasH / 2 - 100);
    ctx.restore();
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  shade(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amt));
    const B = Math.max(0, Math.min(255, (num & 0xFF) + amt));
    return `rgb(${R},${G},${B})`;
  }
}

window.addEventListener('load', () => new Game());
