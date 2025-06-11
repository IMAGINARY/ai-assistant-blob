export class AdsrEnvelope {
  constructor(
    attackTime = 0.1,
    decayTime = 0.5,
    sustainLevel = 0.75,
    sustainTime = 1,
    releaseTime = 0.25,
    samplesPerSecond = 60,
  ) {
    this._attackTime = attackTime; // Attack time in seconds
    this._decayTime = decayTime; // Decay time in seconds
    this._sustainLevel = sustainLevel; // Sustain level (0 to 1)
    this._sustainTime = sustainTime; // Sustain time in seconds
    this._releaseTime = releaseTime; // Release time in seconds
    this._samplesPerSecond = samplesPerSecond; // Number of samples per second
    this._samples = [];
    this._envelope = [];
    this._envelopeAppliedToSamples = [];
    this._needsInit = true; // Flag to indicate if the envelope needs to be updated
    this._lastSampleTime = Number.POSITIVE_INFINITY;
  }

  get attackTime() {
    return this._attackTime;
  }

  get decayTime() {
    return this._decayTime;
  }

  get sustainLevel() {
    return this._sustainLevel;
  }

  get sustainTime() {
    return this._sustainTime;
  }

  get releaseTime() {
    return this._releaseTime;
  }

  set attackTime(value) {
    this._needsInit = value || this._attackTime !== value;
    this._attackTime = value;
  }

  set decayTime(value) {
    this._needsInit = value || this._decayTime !== value;
    this._needsInit = true;
  }

  set sustainLevel(value) {
    this._needsInit = value || this._sustainLevel !== value;
    this._sustainLevel = value;
  }

  set sustainTime(value) {
    this._needsInit = value || this._sustainTime !== value;
    this._sustainTime = value;
  }

  set releaseTime(value) {
    this._needsInit = value || this._releaseTime !== value;
    this._releaseTime = value;
  }

  init() {
    const adsrDuration =
      this._attackTime +
      this._decayTime +
      this._sustainTime +
      this._releaseTime;
    const numSamples = Math.ceil(adsrDuration * this._samplesPerSecond);
    const samplesToAdd = Math.max(0, numSamples - this._samples.length);
    const samplesToRemove = Math.max(0, this._samples.length - numSamples);
    this._samples.splice(numSamples, samplesToRemove);
    this._samples.splice(
      this._samples.length,
      0,
      ...new Array(samplesToAdd).fill(0),
    );
    this._envelope = new Array(numSamples).fill(0).map((_, i) => {
      let t = i / 60; // Convert sample index to seconds
      if (t < this._attackTime) return t / this._attackTime; // Linear increase during attack

      t -= this._attackTime; // Adjust time for decay phase
      if (t < this._decayTime)
        return 1 - (t / this._decayTime) * (1 - this._sustainLevel); // Linear decrease during decay

      t -= this._decayTime; // Adjust time for sustain phase
      if (t < this._sustainTime) return this._sustainLevel; // Sustain level

      t -= this._sustainTime; // Adjust time for release phase
      if (t <= this._releaseTime)
        return this._sustainLevel * (1 - t / this._releaseTime); // Linear decrease during release
    });
    this._envelopeAppliedToSamples = new Array(numSamples).fill(0);
    this._envelopeAppliedToSamplesNeedsUpdate = true;
  }

  _initIfNeeded() {
    if (this._needsInit) {
      this.init();
      this._needsInit = false;
    }
  }

  _applyEnvelopeToSamples() {
    for (let i = 0; i < this._samples.length; i++) {
      this._envelopeAppliedToSamples[i] = this._samples[i] * this._envelope[i];
    }
  }

  _applyEnvelopeToSamplesIfNeeded() {
    if (this._envelopeAppliedToSamplesNeedsUpdate) {
      this._applyEnvelopeToSamples();
      this._envelopeAppliedToSamplesNeedsUpdate = false;
    }
  }

  getMax() {
    this._initIfNeeded();
    this._applyEnvelopeToSamplesIfNeeded();
    return Math.max(...this._envelopeAppliedToSamples);
  }

  getMean() {
    this._initIfNeeded();
    this._applyEnvelopeToSamplesIfNeeded();
    return (
      this._envelopeAppliedToSamples.reduce((sum, value) => sum + value, 0) /
      this._envelopeAppliedToSamples.length
    );
  }

  appendSample(sample) {
    this._initIfNeeded();
    const sampleTime = performance.now();
    do {
      this._samples.pop();
      this._samples.unshift(sample);
      this._lastSampleTime += 1000 / this._samplesPerSecond;
    } while (
      ((sampleTime - this._lastSampleTime) * 1000) / this._samplesPerSecond >
      0
    );
    this._lastSampleTime = sampleTime;
    this._envelopeAppliedToSamplesNeedsUpdate = true;
  }
}
