/// <reference types="vite/client" />

declare const process: {
  env: {
    NODE_ENV: string;
    [key: string]: string | undefined;
  };
};

declare namespace NodeJS {
  interface Timeout {}
  interface Timer {}
}
