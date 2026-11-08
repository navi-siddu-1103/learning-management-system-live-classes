import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

function resolveStoragePath(configuredPath, fallback) {
  const storagePath = configuredPath || fallback;
  return path.isAbsolute(storagePath)
    ? storagePath
    : path.resolve(serverRoot, storagePath);
}

export const uploadDir = resolveStoragePath(
  process.env.UPLOAD_DIR,
  'uploads'
);

export const processedDir = resolveStoragePath(
  process.env.PROCESSED_DIR,
  'processed'
);

export function playlistPath(jobId) {
  return path.join(processedDir, String(jobId), 'index.m3u8');
}
