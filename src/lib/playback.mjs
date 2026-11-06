// Keep the output silent even if a browser repeats its last decoded buffer.
export function pauseMusic(audio, gain) {
  if (gain) gain.gain.value = 0;
  if (audio) {
    audio.muted = true;
    audio.pause();
  }
}

export function applyMusicVolume(audio, gain, volume) {
  if (!audio) return;
  if (gain) {
    gain.gain.value = audio.paused ? 0 : volume;
  } else {
    audio.volume = volume;
    audio.muted = audio.paused || volume === 0;
  }
}

export async function resumeMusicOutput(context, timeoutMs = 5000) {
  if (!context || context.state === "running") return true;
  let timer;
  try {
    return await Promise.race([
      context.resume().then(() => context.state === "running", () => false),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
