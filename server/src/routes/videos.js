import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { Queue } from 'bullmq';
import { requireAuth } from '../middleware/auth.js';
import { Course, Enrollment } from '../models.js';
import { playlistPath, processedDir } from '../videoStorage.js';
import { redisConnection } from '../redis.js';
import {
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

const router = Router();
const videoQueue = new Queue('video-processing', {
  connection: redisConnection(),
});
const s3 = new S3Client({
  region: process.env.AWS_REGION,
});
const bucket = process.env.S3_BUCKET;

// Check whether the user can access a course containing this video.
async function canAccessVideo(req, jobId) {
  const course = await Course.findOne({
    published: true,
    'lessons.videoJobId': String(jobId),
  });

  if (!course) {
    return false;
  }

  if (req.user.role === 'admin') {
    return true;
  }

  if (
    req.user.role === 'instructor' &&
    String(course.instructor) === String(req.user.id)
  ) {
    return true;
  }

  return Boolean(
    await Enrollment.exists({
      student: req.user.id,
      course: course._id,
    })
  );
}


// Serve an HLS playlist only to authorized users.
router.get('/:jobId/playlist', requireAuth, async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!/^\d+$/.test(jobId)) {
      return res.status(400).json({ message: 'Invalid video ID' });
    }

    if (!(await canAccessVideo(req, jobId))) {
      return res.status(403).json({
        message: 'You cannot access this video',
      });
    }

    const job = await videoQueue.getJob(jobId);
    const state = job ? await job.getState() : null;

    if (state !== 'completed') {
      if (state === 'failed') {
        return res.status(409).json({
          message: 'Video processing failed',
        });
      }

      if (state && state !== 'completed') {
        res.setHeader('Retry-After', '2');
        return res.status(425).json({
          message: 'Video is still being processed',
          state,
        });
      }

      return res.status(404).json({
        message: 'Video processing job not found',
      });
    }

    let playlist;

    try {
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: `processed/${jobId}/index.m3u8`,
        })
      );

      if (!response.Body) {
        throw new Error('S3 playlist response has no body');
      }

      playlist = await response.Body.transformToString();
    } catch (error) {
      console.error('S3 playlist retrieval error:', error);

      return res.status(500).json({
        message: 'Unable to retrieve processed video playlist from S3',
      });
    }

    // Rewrite segment paths to use the protected API endpoint.
    playlist = playlist.replace(
      /^([^#\r\n][^\r\n]*)$/gm,
      (segment) => {
        const filename = path.basename(segment.trim());

        if (!/^segment_\d+\.ts$/.test(filename)) {
          return segment;
        }

        return `segments/${encodeURIComponent(filename)}`;
      }
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'private, no-store');

    return res.send(playlist);
  } catch (error) {
    console.error('HLS playlist error:', error);

    return res.status(500).json({
      message: 'Unable to load video playlist',
    });
  }
});


// Serve individual HLS segments only to authorized users.
router.get(
  '/:jobId/segments/:filename',
  requireAuth,
  async (req, res) => {
    try {
      const { jobId, filename } = req.params;

      if (
        !/^\d+$/.test(jobId) ||
        !/^segment_\d+\.ts$/.test(filename)
      ) {
        return res.status(400).json({
          message: 'Invalid video segment',
        });
      }

      if (!(await canAccessVideo(req, jobId))) {
        return res.status(403).json({
          message: 'You cannot access this video',
        });
      }

      const response = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: `processed/${jobId}/${filename}`,
        })
      );

      if (!response.Body) {
        return res.status(404).json({
          message: 'Video segment not found',
        });
      }

      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'private, no-store');

      response.Body.on('error', (error) => {
        console.error('S3 segment stream error:', error);

        if (!res.headersSent) {
          res.status(500).json({
            message: 'Unable to stream video segment',
          });
        } else {
          res.destroy(error);
        }
      });

      return response.Body.pipe(res);
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        return res.status(404).json({
          message: 'Video segment not found',
        });
      }

      console.error('HLS segment error:', error);

      return res.status(500).json({
        message: 'Unable to load video segment',
      });
    }
  }
);

export default router;