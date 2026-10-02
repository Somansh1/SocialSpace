// Quiet UI sounds, synthesized with the Web Audio API (no audio files). Every call is safe if audio is unavailable.
type Note = [freq: number, delay: number, peak: number, seconds: number, glideTo?: number]

const SOUNDS = {
  join: [[440, 0, 0.15, 0.8], [659, 0.12, 0.15, 0.9]],
  leave: [[587, 0, 0.14, 0.8], [392, 0.13, 0.14, 0.9]],
  received: [[523, 0, 0.16, 0.7]],
  sent: [[659, 0, 0.06, 0.3]],
  ring: [[466, 0, 0.17, 0.8], [587, 0.2, 0.17, 0.9]],
  connected: [[349, 0, 0.15, 0.7], [440, 0.11, 0.15, 0.7], [587, 0.22, 0.15, 0.9]],
  ended: [[466, 0, 0.14, 0.8], [311, 0.13, 0.14, 0.9]],
  close: [[523, 0, 0.1, 0.5], [392, 0.09, 0.1, 0.6]],
  error: [[330, 0, 0.14, 0.7], [247, 0.15, 0.14, 0.9]],
  tap: [[500, 0, 0.05, 0.12]],
  pen: [[620, 0, 0.05, 0.1]],
  clear: [[700, 0, 0.1, 0.35, 300]],
} satisfies Record<string, Note[]>

export type SoundName = keyof typeof SOUNDS

const KEY = "socialspace-muted"
let ac: AudioContext | null = null
let out: AudioNode | null = null // shared lowpass -> master gain -> speakers
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
    if (!ac || !out) {
      const c: AudioContext = new (window.AudioContext || window.webkitAudioContext)()
      const lowpass = c.createBiquadFilter()
      lowpass.frequency.value = 1800
      const master = c.createGain()
      master.gain.value = 0.9
      lowpass.connect(master).connect(c.destination)
      ac = c
      out = lowpass
    }
    if (ac.state === "suspended") ac.resume().catch(() => {})
    const t0 = ac.currentTime
    for (const [freq, delay, peak, seconds, glideTo] of SOUNDS[name] as Note[]) {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      const t = t0 + delay
      osc.frequency.setValueAtTime(freq, t)
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + seconds)
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.02, seconds / 4))
      gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
      osc.connect(gain).connect(out)
      osc.start(t)
      osc.stop(t + seconds + 0.05)
    }
  } catch {}
}

const TAPPABLE = 'button, a[href], [role="button"], input[type="checkbox"], select, summary'

// One delegated listener for every button-like control. data-sound="none" opts out, data-sound="close" etc. picks another sound.
export function installTapSounds() {
  const onDown = (e: PointerEvent) => {
    const el = (e.target as Element | null)?.closest?.(TAPPABLE) as HTMLElement | null
    if (!el || el.matches(":disabled") || el.getAttribute("aria-disabled") === "true") return
    const name = el.dataset.sound ?? "tap"
    if (name in SOUNDS) play(name as SoundName)
  }
  document.addEventListener("pointerdown", onDown, true)
  return () => document.removeEventListener("pointerdown", onDown, true)
}
