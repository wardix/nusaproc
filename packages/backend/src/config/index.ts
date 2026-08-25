export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  storageDriver: 'local' | 's3' | 'minio';
  storageLocalPath: string;
  clamavHost?: string;
  clamavPort?: number;
  corsOrigin?: string;
}

export const config: AppConfig = {
  port: Number(process.env.PORT) || 8000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgres://nusaproc:secret@localhost:5432/nusaproc_db',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'nusaproc-dev-secret-key-change-in-production',
  storageDriver: (process.env.STORAGE_DRIVER as 'local' | 's3' | 'minio') || 'local',
  storageLocalPath: process.env.STORAGE_LOCAL_PATH || './uploads',
  clamavHost: process.env.CLAMAV_HOST,
  clamavPort: process.env.CLAMAV_PORT ? Number(process.env.CLAMAV_PORT) : undefined,
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
