import { demoWav } from "./demo-synthesis";
self.onmessage = (event: MessageEvent<number>) => {
  try {
    self.postMessage({ blob: demoWav(event.data) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "Could not create the demo audio.",
    });
  }
};
