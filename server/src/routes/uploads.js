import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { Queue } from 'bullmq';
import { requireAuth, allowRoles } from '../middleware/auth.js';
const router = Router();
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({ destination: uploadDir, filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`) });
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ['video/mp4', 'video/quicktime', 'video/webm'].includes(file.mimetype)) });
const queue = new Queue('video-processing', { connection: { host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT || 6379) } });
router.post('/video', requireAuth, allowRoles('instructor', 'admin'), upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Upload an MP4, MOV, or WebM video' });
  const job = await queue.add('convert-to-hls', { inputPath: path.resolve(req.file.path), originalName: req.file.originalname }, { attempts: 2, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: 100, removeOnFail: 100 });
  res.status(202).json({ jobId: job.id, status: 'queued', message: 'Video queued for HLS conversion' });
});
export default router;
