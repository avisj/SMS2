import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

// Look for .env in current working dir, parent dirs, or project root
const candidatePaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(currentDir, '../../../.env'),
];

for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  JWT_SECRET: process.env.JWT_SECRET || 'super-secret-production-sms-saas-key-replace-in-prod',
  
  // Database Configuration
  DATABASE_URL: process.env.DATABASE_URL || '',
  
  // Supabase Configuration
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
};

export const isDatabaseConfigured = (): boolean => {
  const url = env.DATABASE_URL?.trim();
  if (!url) return false;
  if (
    url.includes('postgres.xxx') ||
    url.includes('your-project') ||
    url.includes('YOUR_DB_PASSWORD') ||
    url.includes('YOUR_PASSWORD') ||
    url.includes(':password@')
  ) {
    return false;
  }
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith('postgres')) return false;
  } catch {
    return false;
  }
  if (process.env.NODE_ENV === 'test') return false;
  return true;
};

