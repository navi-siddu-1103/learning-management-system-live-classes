
import 'dotenv/config';

import { Worker } from 'bullmq';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

import { processedDir } from '../videoStorage.js';
import { redisConnection } from '../redis.js';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
});

const bucket = process.env.S3_BUCKET;

if (!bucket) {
  throw new Error('S3_BUCKET environment variable is missing');
}

async function downloadFromS3(key, destination) {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error(`S3 object has no body: ${key}`);
  }

  await pipeline(response.Body, createWriteStream(destination));
}

async function uploadHlsToS3(outputDir, jobId) {
  const files = (await fs.readdir(outputDir)).filter(
    (filename) =>
      filename === 'index.m3u8' ||
      /^segment_\d+\.ts$/.test(filename)
  );

  for (const filename of files) {
    const filePath = path.join(outputDir, filename);

    const contentType = filename.endsWith('.m3u8')
      ? 'application/vnd.apple.mpegurl'
      : 'video/mp2t';

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `processed/${jobId}/${filename}`,
        Body: await fs.readFile(filePath),
        ContentType: contentType,
      })
    );

    console.log(`Uploaded to S3: processed/${jobId}/${filename}`);
  }
}

const worker = new Worker(
  'video-processing',
  async (job) => {
    const { inputKey } = job.data;

    if (!inputKey) {
      throw new Error('Missing inputKey in video-processing job');
    }

    const jobId = String(job.id);

    const outputDir = path.join(processedDir, jobId);
    const inputPath = path.join(
      outputDir,
      `original-${jobId}.mp4`
    );

    await fs.mkdir(outputDir, { recursive: true });

    try {
      console.log(`Downloading original video from S3: ${inputKey}`);

      await downloadFromS3(inputKey, inputPath);

      const playlist = path.join(outputDir, 'index.m3u8');

      await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-y',
          '-i', inputPath,
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-hls_time', '6',
          '-hls_playlist_type', 'vod',
          '-hls_segment_filename',
          path.join(outputDir, 'segment_%03d.ts'),
          playlist,
        ]);

        ffmpeg.stderr.on('data', (chunk) => {
          process.stdout.write(chunk);
        });

        ffmpeg.on('error', reject);

        ffmpeg.on('close', (code) => {
          code === 0
            ? resolve()
            : reject(new Error(`FFmpeg exited with code ${code}`));
        });
      });

      console.log(`HLS conversion completed for job ${jobId}`);

      await uploadHlsToS3(outputDir, jobId);

      console.log(`All HLS files uploaded for job ${jobId}`);

      return {
        outputDir,
        playlist,
        s3Prefix: `processed/${jobId}/`,
        s3PlaylistKey: `processed/${jobId}/index.m3u8`,
      };
    } finally {
      await fs.unlink(inputPath).catch(() => {});
    }
  },
  {
    connection: redisConnection({ worker: true }),
    concurrency: 2,
  }
);

worker.on('completed', (job) => {
  console.log(`Video job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Video job ${job?.id} failed:`, err.message);
});

worker.on('ready', () => {
  console.log('Video worker connected to Redis and ready!');
});

worker.on('error', (err) => {
  console.error('Video worker error:', err.message);
});

worker.on('active', (job) => {
  console.log(`Processing video job ${job.id}`);
});