import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { getMaxFileSizeMB } from '../config/upload.config';

/**
 * Filtro global para capturar y manejar errores de Multer
 * Proporciona mensajes de error claros y específicos según el tipo de error
 */
@Catch()
export class MulterExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MulterExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Determinar si es un error de Multer
    const isMulterError = exception?.name === 'MulterError';
    const isBadRequestWithFileError =
      exception?.status === HttpStatus.BAD_REQUEST &&
      exception?.message?.includes('archivo');

    if (isMulterError) {
      this.handleMulterError(exception, response);
    } else if (isBadRequestWithFileError) {
      this.handleFileValidationError(exception, response);
    } else {
      // No es un error de Multer, re-lanzar para que otros filtros lo manejen
      throw exception;
    }
  }

  /**
   * Maneja errores nativos de Multer (límite de tamaño, etc.)
   */
  private handleMulterError(exception: any, response: Response) {
    const maxSizeMB = getMaxFileSizeMB();
    let message = 'Error al procesar el archivo';

    switch (exception.code) {
      case 'LIMIT_FILE_SIZE':
        message = `Archivo demasiado grande. Tamaño máximo permitido: ${maxSizeMB} MB`;
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Demasiados archivos. Solo se permite un archivo a la vez';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message =
          'Campo de archivo inesperado. Use el campo "file" para subir archivos';
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Nombre de campo demasiado largo';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Valor de campo demasiado largo';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Demasiados campos en la solicitud';
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Demasiadas partes en la solicitud multipart';
        break;
      default:
        message = `Error de Multer: ${exception.message}`;
    }

    this.logger.warn(`Error de Multer: ${exception.code} - ${message}`);

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: message,
      error: 'Bad Request',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Maneja errores de validación de archivos (tipo de archivo no permitido)
   */
  private handleFileValidationError(exception: any, response: Response) {
    const message =
      exception.message ||
      'Tipo de archivo no permitido. Solo se aceptan imágenes (jpg, jpeg, png, webp) y PDF';

    this.logger.warn(`Error de validación de archivo: ${message}`);

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: message,
      error: 'Bad Request',
      timestamp: new Date().toISOString(),
    });
  }
}
