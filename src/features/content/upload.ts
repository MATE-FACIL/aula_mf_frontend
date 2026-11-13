import type { UploadGrant } from '@/types/content';

/**
 * Sube UN archivo directo al almacenamiento con el permiso que dio el backend (SCRUM-58): el archivo viaja del
 * navegador al almacenamiento, nunca por el aula ni por la API. Se usa XMLHttpRequest porque `fetch` no informa el
 * avance de una subida, y un video puede pesar hasta 2 GB.
 *
 * Rechaza con un mensaje para el administrador. El permiso vence a los 15 minutos.
 */
export function uploadToStorage(file: File, grant: UploadGrant, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(grant.method || 'PUT', grant.url);
    for (const [name, value] of Object.entries(grant.headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve();
      } else if (request.status === 403) {
        reject(new Error('El permiso para subir el archivo venció. Elígelo otra vez.'));
      } else {
        reject(new Error('No se pudo subir el archivo. Inténtalo otra vez.'));
      }
    };
    request.onerror = () => reject(new Error('No pudimos subir el archivo. Revisa tu conexión e inténtalo otra vez.'));
    request.onabort = () => reject(new Error('Se canceló la subida.'));
    request.send(file);
  });
}
