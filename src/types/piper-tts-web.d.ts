declare module "piper-tts-web" {
  export class RemoteVoiceProvider {
    constructor(options?: { baseUrl?: string; separator?: string });
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