/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TRADECLASS_API?: string;
  readonly VITE_TRADECLASS_DEMO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
