// How a codebook's items become sound, for every renderer but the guitar
// (which has a whole band of its own in band.js). There are only three:
//
//   samples - plays the contributors' own recordings
//   ratios  - synthesises pitches from frequency ratios over a base pitch,
//             which suits tunings that aren't twelve equal steps
//   rhythm  - sequences onset patterns on a simple percussive sound
//
// A Voice builds its audio graph in whatever Tone.js context is current
// when it is made, so the same code plays live and renders to a file.

const buffers = new Map();

// Resolves to an AudioBuffer, fetched once however many voices want it.
function loadBuffer(url) {
  if (!buffers.has(url)) {
    const loading = Tone.ToneAudioBuffer.fromUrl(url).then((buffer) => buffer.get());
    loading.catch(() => buffers.delete(url));
    buffers.set(url, loading);
  }
  return buffers.get(url);
}

function makeReverb(seconds) {
  const context = Tone.getContext();
  const length = Math.floor(seconds * context.sampleRate);
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return new Tone.Convolver(impulse);
}

export class Voice {
  constructor(codebook) {
    this.codebook = codebook;
    // Kept so that sources made later, while playing, are made in the same
    // context as everything else here (an offline render has its own).
    this.context = Tone.getContext();
    this.limiter = new Tone.Limiter(-1.5).toDestination();
    this.output = new Tone.Gain(0.8).connect(this.limiter);
    this.reverb = makeReverb(1.8);
    this.reverb.connect(new Tone.Gain(0.18).connect(this.output));
    this.bus = new Tone.Gain(1).connect(this.output);
    this.bus.connect(this.reverb);
    this.loaded = new Map(); // url -> AudioBuffer, for the samples asked for so far
    this.sources = new Set();
    this.pending = Promise.resolve();

    this.tones = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: codebook.tuning.voice === "organ" ? "sine" : "triangle" },
      envelope: { attack: 0.02, decay: 0.25, sustain: 0.55, release: 0.5 },
      volume: -7,
    }).connect(this.bus);
    this.tones.maxPolyphony = 48;

    // One percussive sound per name a rhythm item may ask for.
    const filtered = (frequency, type) => new Tone.Filter(frequency, type).connect(this.bus);
    this.hits = {
      clap: new Tone.NoiseSynth({ noise: { type: "pink" }, volume: -3, envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.02 } }).connect(filtered(1300, "bandpass")),
      shaker: new Tone.NoiseSynth({ noise: { type: "white" }, volume: -16, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 } }).connect(filtered(6500, "highpass")),
      drum: new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 4, volume: -3, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.05 } }).connect(this.bus),
      wood: new Tone.MembraneSynth({ pitchDecay: 0.005, octaves: 1.5, volume: -8, envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.02 } }).connect(this.bus),
    };
  }

  setLevel(level) {
    this.output.gain.value = level;
  }

  // Fetch whatever these items need before they can sound. Recordings are
  // only ever fetched for the places actually being listened to.
  prepare(items) {
    const urls = [...new Set(items.filter((item) => item.renderer === "samples").map((item) => item.audio))];
    this.pending = Promise.all(urls.map(async (url) => {
      if (!this.loaded.has(url)) this.loaded.set(url, await loadBuffer(url));
    }));
    return this.pending;
  }

  ready() {
    return this.pending;
  }

  // Called once at the top of the bar an item sounds in.
  start(item, time, seconds) {
    if (item.renderer === "samples") {
      const buffer = this.loaded.get(item.audio);
      if (!buffer) return;
      const source = new Tone.ToneBufferSource({ context: this.context, url: buffer, fadeOut: 0.08 }).connect(this.bus);
      source.onended = () => {
        this.sources.delete(source);
        // An offline render steps its clock through the whole song before
        // any audio is made, so tidying up here would silence everything.
        if (!this.context.isOffline) source.dispose();
      };
      this.sources.add(source);
      source.start(time, 0, seconds);
    } else if (item.renderer === "ratios") {
      const base = this.codebook.tuning.base;
      const level = 0.75 / Math.sqrt(item.ratios.length);
      this.tones.triggerAttackRelease(item.ratios.map((ratio) => base * ratio), Math.max(0.1, seconds * 0.92), time, level);
    }
  }

  // Called for every sixteenth of that bar. A rhythm item divides the bar
  // into as many equal steps as its pattern has characters; the onsets that
  // fall inside this sixteenth are played now, so that pausing never leaves
  // more than a sixteenth still to sound.
  slot(item, barStart, barSeconds, slotStart, slotSeconds) {
    if (item.renderer !== "rhythm") return;
    const steps = item.pattern.length;
    const first = Math.ceil(((slotStart - barStart) / barSeconds) * steps - 1e-6);
    for (let step = Math.max(0, first); step < steps; step++) {
      const at = barStart + (step / steps) * barSeconds;
      if (at >= slotStart + slotSeconds - 1e-6) break;
      const mark = item.pattern[step];
      if (mark === "x" || mark === "X") this.hit(item.sound, Math.max(at, slotStart), mark === "X" ? 1 : 0.7);
    }
  }

  hit(sound, time, velocity) {
    const name = this.hits[sound] ? sound : "clap";
    if (name === "drum") this.hits.drum.triggerAttackRelease(70, 0.25, time, velocity);
    else if (name === "wood") this.hits.wood.triggerAttackRelease(720, 0.06, time, velocity);
    else this.hits[name].triggerAttackRelease(name === "clap" ? 0.09 : 0.04, time, velocity);
  }

  silence() {
    this.tones.releaseAll();
    for (const source of this.sources) source.stop();
  }

  dispose() {
    this.silence();
    [this.tones, ...Object.values(this.hits), this.bus, this.reverb, this.output, this.limiter].forEach((node) => node.dispose());
  }
}
