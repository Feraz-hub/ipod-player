// Original ambient WAV generator; runs inside the demo worker.
export function demoWav(index: number): Blob {
  const rate = 22050,
    seconds = [96, 104, 88, 112, 92][index % 5],
    length = rate * seconds;
  const buffer = new ArrayBuffer(44 + length * 2),
    view = new DataView(buffer);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, length * 2, true);
  const chords = [
    [130.81, 164.81, 196, 246.94],
    [110, 130.81, 164.81, 220],
    [146.83, 174.61, 220, 261.63],
    [98, 123.47, 146.83, 196],
    [123.47, 146.83, 185, 246.94],
  ];
  for (let i = 0; i < length; i++) {
    const t = i / rate,
      step = Math.floor(t / 8),
      notes = chords[(index + step) % 5];
    const fade = Math.min(1, t / 2, (seconds - t) / 3),
      env = Math.min(1, (t % 8) / 1.5) * Math.min(1, (8 - (t % 8)) / 1.8);
    let sound = 0;
    notes.forEach((n, j) => {
      sound +=
        Math.sin(2 * Math.PI * n * t + Math.sin(t * 0.3 + j) * 0.2) *
        (0.032 / (1 + j * 0.3)) *
        env;
    });
    const beat = t % (0.625 + index * 0.015),
      kick =
        Math.sin(2 * Math.PI * (42 * beat + 10 * (1 - Math.exp(-beat * 20)))) *
        Math.exp(-beat * 18) *
        0.08;
    const pluck =
      Math.sin(2 * Math.PI * notes[Math.floor(t * 2) % 4] * 4 * t) *
      Math.exp(-(t % 0.5) * 9) *
      0.025;
    view.setInt16(
      44 + i * 2,
      Math.max(-1, Math.min(1, (sound + kick + pluck) * fade)) * 32767,
      true,
    );
  }
  return new Blob([buffer], { type: "audio/wav" });
}
