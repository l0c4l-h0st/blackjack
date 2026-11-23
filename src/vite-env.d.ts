/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** « memory » : routeur en mémoire (page hébergée dans un cadre sans URL propre). */
  readonly VITE_ROUTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
