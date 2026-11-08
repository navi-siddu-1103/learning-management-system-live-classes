import 'dotenv/config';
import { Worker } from 'bullmq';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { processedDir } from '../videoStorage.js';
import { redisConnection } from '../redis.js';

const worker = new Worker('video-processing', async job => {
  const outputDir = path.join(processedDir, String(job.id));
  await fs.mkdir(outputDir, { recursive: true });
  const playlist = path.join(outputDir, 'index.m3u8');
  const ffmpegPath = 'ffmpeg';
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, ['-y', '-i', job.data.inputPath, '-c:v', 'libx264', '-c:a', 'aac', '-hls_time', '6', '-hls_playlist_type', 'vod', '-hls_segment_filename', path.join(outputDir, 'segment_%03d.ts'), playlist]);
    ffmpeg.stderr.on('data', chunk => process.stdout.write(chunk));
    ffmpeg.on('error', reject);
    ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with code ${code}`)));
  });
  // Production step: upload playlist + segments to a private S3 bucket and store the CloudFront URL.
  console.log(`HLS generated at ${playlist}. Configure S3/CloudFront upload before production.`);
  return { outputDir, playlist };
}, { connection: redisConnection({ worker: true }), concurrency: 2 });
worker.on('completed', job => console.log(`Video job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`Video job ${job?.id} failed:`, err.message));
