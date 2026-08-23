export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
}

export const config: AppConfig = {
  port: Number(process.env.PORT) || 8000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgres://nusaproc:secret@localhost:5432/nusaproc_db',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'nusaproc-dev-secret-key-change-in-production',
};
