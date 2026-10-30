declare module '@local' {
  export function handle(method: string, url: string, body?: unknown): Promise<unknown>;
}
