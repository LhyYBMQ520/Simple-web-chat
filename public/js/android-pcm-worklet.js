class AndroidPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRateHz = 48000;
    this.capacity = Math.ceil(this.sampleRateHz * 0.3);
    this.left = new Float32Array(this.capacity);
    this.right = new Float32Array(this.capacity);
    this.readIndex = 0;
    this.writeIndex = 0;
    this.count = 0;
    this.port.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'configure') {
        const nextRate = Number(data.sampleRate);
        if (Number.isFinite(nextRate) && nextRate > 0) {
          this.sampleRateHz = nextRate;
          this.capacity = Math.ceil(this.sampleRateHz * 0.3);
          this.left = new Float32Array(this.capacity);
          this.right = new Float32Array(this.capacity);
          this.readIndex = 0;
          this.writeIndex = 0;
          this.count = 0;
        }
        return;
      }
      if (data.type !== 'pcm' || !data.samples) return;

      const samples = data.samples instanceof Float32Array
        ? data.samples
        : new Float32Array(data.samples);
      const frameCount = Math.floor(samples.length / 2);
      if (frameCount <= 0) return;

      // Keep latency bounded: discard the oldest frames before writing.
      if (frameCount >= this.capacity) {
        const start = (frameCount - this.capacity) * 2;
        this.readIndex = 0;
        this.writeIndex = 0;
        this.count = this.capacity;
        for (let i = 0; i < this.capacity; i++) {
          this.left[i] = samples[start + i * 2];
          this.right[i] = samples[start + i * 2 + 1];
        }
        return;
      }

      const overflow = Math.max(0, this.count + frameCount - this.capacity);
      if (overflow > 0) {
        this.readIndex = (this.readIndex + overflow) % this.capacity;
        this.count -= overflow;
      }

      for (let i = 0; i < frameCount; i++) {
        this.left[this.writeIndex] = samples[i * 2];
        this.right[this.writeIndex] = samples[i * 2 + 1];
        this.writeIndex = (this.writeIndex + 1) % this.capacity;
      }
      this.count += frameCount;
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    const leftOutput = output[0];
    const rightOutput = output[1] || output[0];

    for (let i = 0; i < leftOutput.length; i++) {
      if (this.count > 0) {
        leftOutput[i] = this.left[this.readIndex];
        rightOutput[i] = this.right[this.readIndex];
        this.readIndex = (this.readIndex + 1) % this.capacity;
        this.count--;
      } else {
        leftOutput[i] = 0;
        rightOutput[i] = 0;
      }
    }
    return true;
  }
}

registerProcessor('android-pcm', AndroidPcmProcessor);
