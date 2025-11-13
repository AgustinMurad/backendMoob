import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

/**
 * Configuración global de Multer para validación de archivos
 *
 * Límites:
 * - Tamaño máximo: definido por MAX_FILE_SIZE_MB (por defecto 10 MB)
 * - Tipos permitidos: imágenes (jpg, jpeg, png, webp) y PDF
 */
export const multerConfig: MulterOptions = {
  limits: {
    fileSize: getMaxFileSize(),
  },
  fileFilter: (req, file, callback) => {
    // MIMEtypes permitidos
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];

    // Validar tipo de archivo
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(
        new BadRequestException(
          `Tipo de archivo no permitido. Solo se aceptan imágenes (jpg, jpeg, png, webp) y PDF. Tipo recibido: ${file.mimetype}`,
        ),
        false,
      );
    }

    // Archivo válido
    callback(null, true);
  },
};

/**
 * Obtiene el tamaño máximo de archivo desde variables de entorno
 * @returns Tamaño máximo en bytes
 */
function getMaxFileSize(): number {
  const maxSizeMB = process.env.MAX_FILE_SIZE_MB
    ? parseInt(process.env.MAX_FILE_SIZE_MB, 10)
    : 10; // Valor por defecto

  // Validar que sea un número positivo
  if (isNaN(maxSizeMB) || maxSizeMB <= 0) {
    throw new Error(
      'MAX_FILE_SIZE_MB debe ser un número positivo. Valor actual: ' +
        process.env.MAX_FILE_SIZE_MB,
    );
  }

  // Convertir MB a bytes
  return maxSizeMB * 1024 * 1024;
}

/**
 * Obtiene el tamaño máximo en MB para mensajes de error legibles
 * @returns Tamaño máximo en MB
 */
export function getMaxFileSizeMB(): number {
  return process.env.MAX_FILE_SIZE_MB
    ? parseInt(process.env.MAX_FILE_SIZE_MB, 10)
    : 10;
}
