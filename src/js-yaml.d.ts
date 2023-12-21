declare module 'js-yaml' {
  interface LoadOptions {
    schema?: any;
    json?: boolean;
  }

  export function safeLoad(
    str: string,
    options?: LoadOptions
  ): any | undefined;
}
