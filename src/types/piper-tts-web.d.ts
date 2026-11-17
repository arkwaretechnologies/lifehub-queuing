declare module "piper-tts-web" {
  export class RemoteVoiceProvider {
    constructor(options?: {
      baseUrl?: string;
      separator?: string;
      /** Must resolve .json URLs to parsed JSON and other URLs to blob: URLs. */
      provider?: { fetch(url: string): Promise<unknown>; destroy(): void };
    });
    destroy(): void;
  }

  export class OnnxWebRuntime {
    constructor(options?: { basePath?: string; numThreads?: number });
    destroy(): void;
  }

  export class PiperWebEngine {
    constructor(options?: { voiceProvider?: RemoteVoiceProvider; onnxRuntime?: OnnxWebRuntime });
    generate(
      text: string,
      voice: string,
      speaker?: number,
    ): Promise<{ file: Blob; duration: number; phonemeData: unknown }>;
    destroy(): void;
  }
}