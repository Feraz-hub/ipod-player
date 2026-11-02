// Original generative ambient sketches. Audio is created only after a Play gesture.
const demoCache = new Map<number, Blob>();
export async function createDemoAudio(index: number): Promise<Blob> {
  const cached = demoCache.get(index);
  if (cached) return cached;
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./demo.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (
      event: MessageEvent<{ blob?: Blob; error?: string }>,
    ) => {
      worker.terminate();
      if (event.data.blob) {
        demoCache.set(index, event.data.blob);
        if (demoCache.size > 3)
          demoCache.delete(demoCache.keys().next().value!);
        resolve(event.data.blob);
      } else
        reject(new Error(event.data.error || "Could not create demo audio."));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(
        new Error("Could not create demo audio. Try an uploaded song instead."),
      );
    };
    worker.postMessage(index);
  });
}
