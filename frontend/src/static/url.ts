// En el navegador el backend vive en una ruta fija: /app/backend/src (los datos en /app/backend/data)
export function fileURLToPath(_u: string | URL): string {
  return '/app/backend/src/module.ts';
}
export default { fileURLToPath };
