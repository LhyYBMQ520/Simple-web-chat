class AndroidPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRateHz = 48000;
    this.prebufferMs = 80;
    this.capacityMs = 400;
    this.fadeMs = 4;
    this.underruns = 0;
    this.overflowFrames = 0;
    this.lastStatsFrame = 0;
    this.configureBuffers();

    this.port.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'configure') {
        const nextRate = Number(data.sampleRate);
        if (Number.isFinite(nextRate) && nextRate > 0) {
          this.sampleRateHz = nextRate;
          this.configureBuffers();
        }
        return;
      }
      if (data.type !== 'pcm' || !data.samples) return;

      const samples = data.samples instanceof Float32Array
        ? data.samples
        : new Float32Array(data.samples);
      this.enqueue(samples);
    };
  }

  configureBuffers() {
    this.capacity = Math.ceil(this.sampleRateHz * this.capacityMs / 1000);
    this.prebufferFrames = Math.ceil(this.sampleRateHz * this.prebufferMs / 1000);
    this.fadeFrames = Math.max(1, Math.ceil(this.sampleRateHz * this.fadeMs / 1000));
    this.left = new Float32Array(this.capacity);
    this.right = new Float32Array(this.capacity);
    this.readIndex = 0;
    this.writeIndex = 0;
    this.count = 0;
    this.playing = false;
    this.gain = 0;
    this.lastLeft = 0;
    this.lastRight = 0;
  }

  enqueue(samples) {
    let frameCount = Math.floor(samples.length / 2);
    if (frameCount <= 0) return;

    let sourceOffset = 0;
    if (frameCount > this.capacity) {
      sourceOffset = frameCount - this.capacity;
      this.overflowFrames += sourceOffset;
      frameCount = this.capacity;
    }

    const available = this.capacity - this.count;
    if (frameCount > available) {
      // An overflow means the producer is ahead by hundreds of milliseconds.
      // Rebuffer from the newest continuous block instead of jumping the read
      // pointer in the middle of playback.
      this.overflowFrames += this.count + frameCount - this.capacity;
      this.readIndex = 0;
      this.writeIndex = 0;
      this.count = 0;
      this.playing = false;
    }

    for (let i = 0; i < frameCount; i++) {
      const sampleIndex = (sourceOffset + i) * 2;
      this.left[this.writeIndex] = samples[sampleIndex];
      this.right[this.writeIndex] = samples[sampleIndex + 1];
      this.writeIndex = (this.writeIndex + 1) % this.capacity;
    }
    this.count += frameCount;
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    const leftOutput = output[0];
    const rightOutput = output[1] || output[0];

    if (!this.playing && this.count >= this.prebufferFrames) {
      this.playing = true;
      this.gain = 0;
    }

    for (let i = 0; i < leftOutput.length; i++) {
      if (this.playing && this.count > 0) {
        let targetGain = 1;
        if (this.count <= this.fadeFrames) targetGain = this.count / this.fadeFrames;
        if (this.gain < targetGain) this.gain = Math.min(targetGain, this.gain + 1 / this.fadeFrames);
        else if (this.gain > targetGain) this.gain = Math.max(targetGain, this.gain - 1 / this.fadeFrames);

        this.lastLeft = this.left[this.readIndex];
        this.lastRight = this.right[this.readIndex];
        leftOutput[i] = this.lastLeft * this.gain;
        rightOutput[i] = this.lastRight * this.gain;
        this.readIndex = (this.readIndex + 1) % this.capacity;
        this.count--;

        if (this.count === 0) {
          this.playing = false;
          this.underruns++;
        }
      } else if (this.gain > 0) {
        this.gain = Math.max(0, this.gain - 1 / this.fadeFrames);
        leftOutput[i] = this.lastLeft * this.gain;
        rightOutput[i] = this.lastRight * this.gain;
      } else {
        leftOutput[i] = 0;
        rightOutput[i] = 0;
      }
    }

    this.lastStatsFrame += leftOutput.length;
    if (this.lastStatsFrame >= this.sampleRateHz * 5) {
      this.lastStatsFrame %= this.sampleRateHz * 5;
      this.port.postMessage({
        type: 'stats',
        bufferedMs: Math.round(this.count * 1000 / this.sampleRateHz),
        underruns: this.underruns,
        overflowFrames: this.overflowFrames
      });
    }
    return true;
  }
}

registerProcessor('android-pcm', AndroidPcmProcessor);
