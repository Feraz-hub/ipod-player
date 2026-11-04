// Keep the output silent even if a browser repeats its last decoded buffer.
export function pauseMusic(audio, gain) {
  if (gain) gain.gain.value = 0;
  if (audio) {
    audio.muted = true;
    audio.pause();
  }
}

export function applyMusicVolume(audio, gain, volume) {
  if (gain) gain.gain.value = !audio || audio.paused ? 0 : volume;
  else if (audio) audio.volume = volume;
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
