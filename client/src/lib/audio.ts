export const DWELL_MS = 3000;
export const MSG_DWELL_MS = 2000;
export const TAB_DWELL_MS = 1500;

export function playBell() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o1.connect(g); o2.connect(g); g.connect(ctx.destination);
    o1.type = "sine"; o1.frequency.setValueAtTime(1047, ctx.currentTime);
    o1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4);
    o2.type = "sine"; o2.frequency.setValueAtTime(1319, ctx.currentTime);
    o2.frequency.exponentialRampToValueAtTime(1109, ctx.currentTime + 0.4);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.1);
    o1.start(); o2.start(); o1.stop(ctx.currentTime + 1.1); o2.stop(ctx.currentTime + 1.1);
  } catch { /* silently ignore */ }
}
