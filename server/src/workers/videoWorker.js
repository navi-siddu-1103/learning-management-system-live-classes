import 'dotenv/config';
import { Worker } from 'bullmq';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';

const worker = new Worker('video-processing', async job => {
  const outputDir = path.resolve('processed', String(job.id));
  await fs.mkdir(outputDir, { recursive: true });
  const playlist = path.join(outputDir, 'index.m3u8');
  const ffmpegPath = 'E:\\Installations\\ffmpeg-9.0.2-essentials_build\\bin\\ffmpeg.exe';
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, ['-y', '-i', job.data.inputPath, '-c:v', 'libx264', '-c:a', 'aac', '-hls_time', '6', '-hls_playlist_type', 'vod', '-hls_segment_filename', path.join(outputDir, 'segment_%03d.ts'), playlist]);
    ffmpeg.stderr.on('data', chunk => process.stdout.write(chunk));
    ffmpeg.on('error', reject);
    ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with code ${code}`)));
  });
  // Production step: upload playlist + segments to a private S3 bucket and store the CloudFront URL.
  console.log(`HLS generated at ${playlist}. Configure S3/CloudFront upload before production.`);
  return { outputDir, playlist };
}, { connection: { host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT || 6379) }, concurrency: 2 });
worker.on('completed', job => console.log(`Video job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`Video job ${job?.id} failed:`, err.message));
