import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { Queue } from 'bullmq';

import { Course, Enrollment } from '../models.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();

const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
const processedDir = path.resolve(
  process.env.PROCESSED_DIR || 'processed'
);

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    cb(
      null,
      `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`
    );
  },
});

const allowedMimeTypes = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

const upload = multer({
  storage,

  limits: {
    fileSize: 500 * 1024 * 1024,
  },

  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(
        new Error('Please upload an MP4, MOV, or WebM video.')
      );
    }

    cb(null, true);
  },
});

const videoQueue = new Queue('video-processing', {
  connection: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
  },
});

/**
 * Check whether the current user may access a lesson video.
 *
 * Admin: may access all course videos.
 * Instructor: may access videos belonging to their own course.
 * Student: must be enrolled in the course.
 */
async function canAccessVideo(req, jobId) {
  const course = await Course.findOne({
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

  const enrollment = await Enrollment.exists({
    student: req.user.id,
    course: course._id,
  });

  return Boolean(enrollment);
}

/**
 * Upload a video and enqueue FFmpeg conversion.
 *
 * POST /api/uploads/video
 */
router.post(
  '/video',
  requireAuth,
  allowRoles('instructor', 'admin'),
  upload.single('video'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: 'Please upload an MP4, MOV, or WebM video.',
        });
      }

      const job = await videoQueue.add(
        'convert-to-hls',
        {
          inputPath: path.resolve(req.file.path),
          originalName: req.file.originalname,
          uploadedBy: String(req.user.id),
        },
        {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
          removeOnComplete: 100,
          removeOnFail: 100,
        }
      );

      return res.status(202).json({
        jobId: String(job.id),
        status: 'queued',
        message: 'Video uploaded and queued for HLS conversion.',
      });
    } catch (error) {
      console.error('Video upload error:', error);

      return res.status(500).json({
        message: 'Unable to upload video.',
      });
    }
  }
);

/**
 * Check FFmpeg processing status.
 *
 * GET /api/uploads/video/:jobId/status
 */
router.get(
  '/video/:jobId/status',
  requireAuth,
  allowRoles('instructor', 'admin'),
  async (req, res) => {
    try {
      const job = await videoQueue.getJob(req.params.jobId);

      if (!job) {
        return res.status(404).json({
          message: 'Video processing job not found.',
        });
      }

      if (
        req.user.role !== 'admin' &&
        String(job.data.uploadedBy) !== String(req.user.id)
      ) {
        return res.status(403).json({
          message: 'You cannot access this processing job.',
        });
      }

      const state = await job.getState();

      return res.json({
        jobId: String(job.id),
        state,
        ready:
          state === 'completed' &&
          fs.existsSync(
            path.join(processedDir, String(job.id), 'index.m3u8')
          ),
        failedReason: state === 'failed' ? job.failedReason : undefined,
      });
    } catch (error) {
      console.error('Video status error:', error);

      return res.status(500).json({
        message: 'Unable to check video processing status.',
      });
    }
  }
);

/**
 * Deliver the HLS playlist after verifying access to its course.
 *
 * GET /api/uploads/video/:jobId/playlist
 */
router.get(
  '/video/:jobId/playlist',
  requireAuth,
  async (req, res) => {
    try {
      const { jobId } = req.params;

      if (!/^\d+$/.test(jobId)) {
        return res.status(400).json({
          message: 'Invalid video job ID.',
        });
      }

      const allowed = await canAccessVideo(req, jobId);

      if (!allowed) {
        return res.status(403).json({
          message: 'You do not have permission to watch this video.',
        });
      }

      const playlistPath = path.join(
        processedDir,
        jobId,
        'index.m3u8'
      );

      if (!fs.existsSync(playlistPath)) {
        return res.status(404).json({
          message: 'Processed video playlist not found.',
        });
      }

      const playlist = fs.readFileSync(playlistPath, 'utf8');

      // Replace segment filenames with protected API endpoints.
      const protectedPlaylist = playlist.replace(
        /^segment_(\d+)\.ts$/gm,
        (_match, number) =>
          `/api/uploads/video/${jobId}/segments/segment_${number}.ts`
      );

      res.setHeader(
        'Content-Type',
        'application/vnd.apple.mpegurl'
      );
      res.setHeader('Cache-Control', 'private, no-store');

      return res.send(protectedPlaylist);
    } catch (error) {
      console.error('HLS playlist error:', error);

      return res.status(500).json({
        message: 'Unable to load video playlist.',
      });
    }
  }
);

/**
 * Deliver an individual HLS segment.
 *
 * GET /api/uploads/video/:jobId/segments/:filename
 */
router.get(
  '/video/:jobId/segments/:filename',
  requireAuth,
  async (req, res) => {
    try {
      const { jobId, filename } = req.params;

      if (
        !/^\d+$/.test(jobId) ||
        !/^segment_\d{3,}\.ts$/.test(filename)
      ) {
        return res.status(400).json({
          message: 'Invalid video segment path.',
        });
      }

      const allowed = await canAccessVideo(req, jobId);

      if (!allowed) {
        return res.status(403).json({
          message: 'You do not have permission to watch this video.',
        });
      }

      const segmentPath = path.join(
        processedDir,
        jobId,
        filename
      );

      if (!fs.existsSync(segmentPath)) {
        return res.status(404).json({
          message: 'Video segment not found.',
        });
      }

      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'private, no-store');

      return res.sendFile(segmentPath);
    } catch (error) {
      console.error('HLS segment error:', error);

      return res.status(500).json({
        message: 'Unable to load video segment.',
      });
    }
  }
);

export default router;