declare module "piper-tts-web" {
  export class RemoteVoiceProvider {
    constructor(options?: { baseUrl?: string; separator?: string });
    destroy(): void;
  }

  export class PiperWebEngine {
    constructor(options?: { voiceProvider?: RemoteVoiceProvider });
    generate(
      text: string,
      voice: string,
      speaker?: number,
    ): Promise<{ file: Blob; duration: number; phonemeData: unknown }>;
    destroy(): void;
  }
}