/// <reference types="vite/client" />

declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

interface ImportMetaEnv {
  readonly VITE_AOAI_ENDPOINT: string;
  readonly VITE_AOAI_APIKEY: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
