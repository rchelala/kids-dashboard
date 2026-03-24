// Alarm sound options — all generated with Web Audio API, no files needed

export const SOUND_OPTIONS = [
  { id: 'rocket',   label: '🚀 Rocket Launch' },
  { id: 'retro',    label: '🎮 Retro Game' },
  { id: 'powerup',  label: '⚡ Power Up' },
  { id: 'sonar',    label: '🌊 Sonar Ping' },
  { id: 'drumroll', label: '🥁 Drum Roll' }
]

export function playSound(soundType) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const fns = { rocket: playRocket, retro: playRetro, powerup: playPowerUp, sonar: playSonar, drumroll: playDrumRoll }
    const fn = fns[soundType] || playRetro
    fn(ctx)
  } catch (_) {}
}

function note(ctx, freq, start, dur, type = 'sine', vol = 0.3) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  gain.gain.setValueAtTime(vol, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
  osc.start(start)
  osc.stop(start + dur + 0.05)
}

function playRocket(ctx) {
  // Rising whoosh
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(80, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 1.2)
  gain.gain.setValueAtTime(0.15, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 1.25)
  // Blast notes after whoosh
  ;[523, 659, 784, 1047].forEach((f, i) =>
    note(ctx, f, ctx.currentTime + 1.2 + i * 0.1, 0.3, 'sine', 0.4)
  )
}

function playRetro(ctx) {
  ;[262, 330, 392, 523, 392, 330, 262].forEach((f, i) =>
    note(ctx, f, ctx.currentTime + i * 0.12, 0.15, 'square', 0.2)
  )
}

function playPowerUp(ctx) {
  ;[262, 330, 392, 523, 659, 784, 1047].forEach((f, i) =>
    note(ctx, f, ctx.currentTime + i * 0.1, 0.15, 'square', 0.25)
  )
}

function playSonar(ctx) {
  for (let i = 0; i < 3; i++) {
    const t = ctx.currentTime + i * 0.65
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(900, t)
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.5)
    gain.gain.setValueAtTime(0.4, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    osc.start(t)
    osc.stop(t + 0.55)
  }
}

function playDrumRoll(ctx) {
  // Snare hits, accelerating
  for (let i = 0; i < 10; i++) {
    const t = ctx.currentTime + i * Math.max(0.04, 0.13 - i * 0.009)
    const bufSize = Math.floor(ctx.sampleRate * 0.08)
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let j = 0; j < bufSize; j++) data[j] = (Math.random() * 2 - 1) * 0.3
    const src = ctx.createBufferSource()
    src.buffer = buf
    const gain = ctx.createGain()
    src.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
    src.start(t)
  }
  // Cymbal crash
  note(ctx, 1200, ctx.currentTime + 0.85, 1.0, 'sine', 0.35)
  note(ctx, 1800, ctx.currentTime + 0.85, 0.8, 'sine', 0.2)
}
