// Schedule a short window ahead, and retain every node so Stop cancels future audio too.
export class ScorePlayer {
  constructor({ createContext = () => new AudioContext(), onState = () => {}, timers = globalThis } = {}) {
    this.createContext = createContext;
    this.onState = onState;
    this.timers = timers;
    this.context = null;
    this.nodes = new Set();
    this.generation = 0;
    this.playing = false;
  }

  stop() {
    this.generation++;
    this.timers.clearInterval(this.timer);
    this.timer = null;
    for (const { oscillator, gain } of this.nodes) {
      try { oscillator.stop(); } catch { /* already ended */ }
      oscillator.disconnect();
      gain.disconnect();
    }
    this.nodes.clear();
    this.playing = false;
    this.onState(false);
  }

  async prepare() {
    this.context ??= this.createContext();
    await this.context.resume();
  }

  async play(notes) {
    this.stop();
    const generation = this.generation;
    const valid = notes.filter(n => Number.isFinite(n.time) && n.time >= 0 &&
      Number.isFinite(n.duration) && n.duration > 0 && Number.isFinite(n.midi))
      .slice().sort((a, b) => a.time - b.time);
    if (!valid.length) return;
    try { await this.prepare(); }
    catch (error) { if (generation === this.generation) throw error; return; }
    if (generation !== this.generation) return;
    const context = this.context;
    const start = context.currentTime + 0.035;
    const end = valid.reduce((end, n) => Math.max(end, n.time + n.duration), 0) + 0.08;
    let index = 0;
    this.playing = true;
    this.onState(true);
    const tick = () => {
      if (generation !== this.generation) return;
      const ahead = context.currentTime - start + 0.12;
      while (index < valid.length && valid[index].time <= ahead) {
        const note = valid[index++];
        if (start + note.time + note.duration <= context.currentTime) continue;
        const when = Math.max(context.currentTime, start + note.time);
        const duration = Math.max(0.025, start + note.time + note.duration - when);
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const node = { oscillator, gain };
        oscillator.type = 'triangle';
        oscillator.frequency.value = 440 * 2 ** ((note.midi - 69) / 12);
        const level = Math.min(1, Math.max(0.03, note.velocity ?? 0.65)) * 0.11;
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(level, when + Math.min(0.01, duration / 3));
        gain.gain.setValueAtTime(level * 0.75, when + duration * 0.75);
        gain.gain.linearRampToValueAtTime(0, when + duration + 0.04);
        oscillator.connect(gain);
        gain.connect(context.destination);
        this.nodes.add(node);
        oscillator.onended = () => {
          oscillator.disconnect(); gain.disconnect(); this.nodes.delete(node);
        };
        oscillator.start(when);
        oscillator.stop(when + duration + 0.05);
      }
      if (context.currentTime >= start + end) this.stop();
    };
    tick();
    this.timer = this.timers.setInterval(tick, 25);
  }
}
