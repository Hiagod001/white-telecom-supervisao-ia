declare global {
  interface Env {
    DB: D1Database;
    PROCESS_FILES?: R2Bucket;
    AUTH_BOOTSTRAP_TOKEN?: string;
    BLIP_CONTRACT_ID?: string;
    BLIP_BOT_ID?: string;
    BLIP_AUTH_KEY?: string;
    BLIP_WEBHOOK_SECRET?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    OPENAI_TRANSCRIPTION_MODEL?: string;
  }
}

export {};
