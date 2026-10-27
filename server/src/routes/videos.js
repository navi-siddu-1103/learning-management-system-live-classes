import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { requireAuth } from '../middleware/auth.js';
import { Course, Enrollment } from '../models.js';

const router = Router();
const processedDir = path.resolve('processed');

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
      return res.status(403).json({ message: 'You cannot access this video' });
    }

    const playlistPath = path.join(processedDir, jobId, 'index.m3u8');

    if (!fs.existsSync(playlistPath)) {
      return res.status(404).json({ message: 'Video playlist not found' });
    }

    let playlist = fs.readFileSync(playlistPath, 'utf8');

    // Route every HLS segment through the protected endpoint.
    playlist = playlist.replace(
      /^([^#\r\n][^\r\n]*)$/gm,
      (segment) => {
        const filename = path.basename(segment.trim());

        if (!/^[a-zA-Z0-9_.-]+\.ts$/.test(filename)) {
          return segment;
        }

        return `/api/videos/${jobId}/segments/${encodeURIComponent(filename)}`;
      }
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.send(playlist);
  } catch (error) {
    console.error('HLS playlist error:', error);
    return res.status(500).json({ message: 'Unable to load video playlist' });
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
        !/^[a-zA-Z0-9_.-]+\.ts$/.test(filename)
      ) {
        return res.status(400).json({ message: 'Invalid video segment' });
      }

      if (!(await canAccessVideo(req, jobId))) {
        return res.status(403).json({ message: 'You cannot access this video' });
      }

      const segmentPath = path.join(processedDir, jobId, filename);

      if (!fs.existsSync(segmentPath)) {
        return res.status(404).json({ message: 'Video segment not found' });
      }

      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'private, no-store');
      return res.sendFile(segmentPath);
    } catch (error) {
      console.error('HLS segment error:', error);
      return res.status(500).json({ message: 'Unable to load video segment' });
    }
  }
);

export default router;