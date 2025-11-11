import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly cloudName: string;
  private readonly uploadPreset: string;
  private readonly uploadUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME')!;
    this.uploadPreset = this.configService.get<string>(
      'CLOUDINARY_UPLOAD_PRESET',
    )!;

    if (!this.cloudName) {
      throw new Error(
        'CLOUDINARY_CLOUD_NAME no está configurado en las variables de entorno',
      );
    }

    if (!this.uploadPreset) {
      throw new Error(
        'CLOUDINARY_UPLOAD_PRESET no está configurado en las variables de entorno',
      );
    }

    this.uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`;
    this.logger.log('CloudinaryService inicializado correctamente');
  }

  /**
   * Sube un archivo a Cloudinary usando la API HTTP directa (sin SDK)
   * @param file Archivo recibido por Multer
   * @returns URL pública del archivo subido
   */
  async uploadFile(file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        'El archivo excede el tamaño máximo permitido de 10 MB',
      );
    }

    try {
      this.logger.log(
        `Subiendo archivo a Cloudinary: ${file.originalname} (${file.size} bytes)`,
      );

      // Convertir el buffer a base64
      const base64File = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

      // Crear el payload para Cloudinary
      const formData = new URLSearchParams();
      formData.append('file', base64File);
      formData.append('upload_preset', this.uploadPreset);

      // Hacer el request HTTP a Cloudinary
      const response = await axios.post<{ secure_url: string }>(
        this.uploadUrl,
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 30000, // 30 segundos
        },
      );

      if (!response.data || !response.data.secure_url) {
        throw new InternalServerErrorException(
          'Cloudinary no devolvió una URL válida',
        );
      }

      const fileUrl: string = response.data.secure_url;
      this.logger.log(`Archivo subido exitosamente: ${fileUrl}`);

      return fileUrl;
    } catch (error) {
      this.logger.error(
        `Error al subir archivo a Cloudinary: ${error.message}`,
        error.stack,
      );

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;

        if (status === 400) {
          throw new BadRequestException(
            `Error de Cloudinary: ${message}. Verifica que el upload_preset esté configurado correctamente`,
          );
        } else if (status === 401) {
          throw new InternalServerErrorException(
            'Error de autenticación con Cloudinary',
          );
        }
      }

      throw new InternalServerErrorException(
        'Error al subir el archivo a Cloudinary',
      );
    }
  }
}
