import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);

    this.client = new Redis({
      host,
      port,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.warn(`Reintentando conexión a Redis (intento ${times})`);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.client.on('connect', () => {
      this.logger.log(`✅ Conectado a Redis en ${host}:${port}`);
    });

    this.client.on('error', (err) => {
      this.logger.error(`❌ Error de Redis: ${err.message}`);
    });

    this.client.on('ready', () => {
      this.logger.log('Redis está listo para recibir comandos');
    });
  }

  /**
   * Obtiene un valor de Redis
   * @param key Clave a buscar
   * @returns Valor como string o null si no existe
   */
  async get(key: string): Promise<string | null> {
    try {
      const value = await this.client.get(key);
      if (value) {
        this.logger.debug(`✅ Cache HIT: ${key}`);
      } else {
        this.logger.debug(`❌ Cache MISS: ${key}`);
      }
      return value;
    } catch (error) {
      this.logger.error(`Error al obtener ${key} de Redis: ${error.message}`);
      return null;
    }
  }

  /**
   * Guarda un valor en Redis con TTL opcional
   * @param key Clave
   * @param value Valor (será convertido a string)
   * @param ttlSeconds Tiempo de vida en segundos (opcional)
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
        this.logger.debug(
          `✅ Cache SET: ${key} (TTL: ${ttlSeconds}s = ${ttlSeconds / 3600}h)`,
        );
      } else {
        await this.client.set(key, value);
        this.logger.debug(`✅ Cache SET: ${key} (sin TTL)`);
      }
      return true;
    } catch (error) {
      this.logger.error(`Error al guardar ${key} en Redis: ${error.message}`);
      return false;
    }
  }

  /**
   * Elimina una o varias claves de Redis
   * @param keys Clave(s) a eliminar
   * @returns Número de claves eliminadas
   */
  async del(...keys: string[]): Promise<number> {
    try {
      const result = await this.client.del(...keys);
      this.logger.debug(`✅ Cache DELETE: ${keys.join(', ')} (${result} keys)`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error al eliminar ${keys.join(', ')} de Redis: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Verifica si una clave existe en Redis
   * @param key Clave a verificar
   * @returns true si existe, false si no
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Error al verificar existencia de ${key}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Obtiene el TTL restante de una clave
   * @param key Clave
   * @returns Segundos restantes, -1 si no tiene TTL, -2 si no existe
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(`Error al obtener TTL de ${key}: ${error.message}`);
      return -2;
    }
  }

  /**
   * Elimina todas las claves que coincidan con un patrón
   * @param pattern Patrón (ej: "messages:*")
   * @returns Número de claves eliminadas
   */
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        this.logger.debug(`No se encontraron claves con patrón: ${pattern}`);
        return 0;
      }
      const result = await this.client.del(...keys);
      this.logger.debug(
        `✅ Eliminadas ${result} claves con patrón: ${pattern}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error al eliminar por patrón ${pattern}: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * limpia toda la db redis
   */
  async flushAll(): Promise<void> {
    try {
      await this.client.flushall();
      this.logger.warn('⚠️ Redis: Todas las claves han sido eliminadas');
    } catch (error) {
      this.logger.error(`Error al limpiar Redis: ${error.message}`);
    }
  }
  /**
   *get info de redis
   */
  async info(): Promise<string> {
    try {
      return await this.client.info();
    } catch (error) {
      this.logger.error(`Error al obtener info de Redis: ${error.message}`);
      return '';
    }
  }
  /**
   *Cerramos conexion con redis cuando se destruye el modulo
   */
  async onModuleDestroy() {
    this.logger.log('Cerrando conexión con Redis...');
    await this.client.quit();
  }

  /**
   * Obtiene el cliente de ioredis para operaciones avanzadas
   * (usar con precaución)
   */
  getClient(): Redis {
    return this.client;
  }
}
