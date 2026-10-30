// Modo normal (con servidor): no hay backend local
export async function handle(): Promise<unknown> {
  throw new Error('Sin backend local');
}
