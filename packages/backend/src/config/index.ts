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
  googleClientId?: string;
  googleAllowedDomain: string;
}

export const config: AppConfig = {
  port: Number(process.env.PORT) || 8000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgres://nusaproc:secret@172.17.0.4:5432/nusaproc_db?sslmode=disable',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'nusaproc-dev-secret-key-change-in-production',
  storageDriver: (process.env.STORAGE_DRIVER as 'local' | 's3' | 'minio') || 'local',
  storageLocalPath: process.env.STORAGE_LOCAL_PATH || './uploads',
  clamavHost: process.env.CLAMAV_HOST,
  clamavPort: process.env.CLAMAV_PORT ? Number(process.env.CLAMAV_PORT) : undefined,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleAllowedDomain: process.env.GOOGLE_ALLOWED_DOMAIN || 'nusa.id,nusanet.net.id,nusa.net.id',
};
