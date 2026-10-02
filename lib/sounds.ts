// Quiet UI sounds, synthesized with the Web Audio API (no audio files). Every call is safe if audio is unavailable.
type Note = [freq: number, delay: number, peak: number]

const SOUNDS = {
  join: [[523, 0, 0.06], [784, 0.11, 0.06]],
  leave: [[659, 0, 0.05], [440, 0.12, 0.05]],
  received: [[587, 0, 0.07]],
  sent: [[740, 0, 0.025]],
  ring: [[523, 0, 0.07], [659, 0.18, 0.07]],
  connected: [[392, 0, 0.06], [494, 0.1, 0.06], [659, 0.2, 0.06]],
  ended: [[523, 0, 0.05], [349, 0.13, 0.05]],
} satisfies Record<string, Note[]>

export type SoundName = keyof typeof SOUNDS

const KEY = "socialspace-muted"
let ac: AudioContext | null = null
let muted = false
try {
  muted = localStorage.getItem(KEY) === "1"
} catch {}

export const isMuted = () => muted

export function setMuted(value: boolean) {
  muted = value
  try {
    localStorage.setItem(KEY, value ? "1" : "0")
  } catch {}
}

export function play(name: SoundName) {
  if (muted) return
  try {
    const ctx = (ac ??= new (window.AudioContext || window.webkitAudioContext)()) as AudioContext
    if (ctx.state === "suspended") ctx.resume().catch(() => {})
    const t0 = ctx.currentTime
    for (const [freq, delay, peak] of SOUNDS[name]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const t = t0 + delay
      osc.type = name === "sent" ? "triangle" : "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.45)
    }
  } catch {}
}
