import { Router } from 'express';
import {
  Course,
  Enrollment,
  Progress,
  Quiz,
  Attempt,
} from '../models.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import mongoose from 'mongoose';
import { Queue } from 'bullmq';

const router = Router();
const videoQueue = new Queue('video-processing', {
  connection: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
  },
});

router.get('/', async (_req, res) => {
  const courses = await Course.find({ published: true }).populate('instructor', 'name').sort({ createdAt: -1 }).limit(100);
  res.json(courses);
});

// Get courses enrolled by the logged-in student with lesson progress
router.get('/my-learning', requireAuth, allowRoles('student'), async (req, res) => {
  const enrollments = await Enrollment.find({
    student: req.user.id
  })
    .populate({
      path: 'course',
      match: { published: true },
      populate: {
        path: 'instructor',
        select: 'name'
      }
    })
    .sort({ enrolledAt: -1 });

  const validEnrollments = enrollments.filter(item => item.course);

  const courses = await Promise.all(
    validEnrollments.map(async enrollment => {
      const course = enrollment.course;

      const progress = await Progress.findOne({
        student: req.user.id,
        course: course._id
      });

      const completedLessons = (progress?.completedLessons || [])
        .map(String);

      const totalLessons = course.lessons.length;

      const completedCount = course.lessons.filter(lesson =>
        completedLessons.includes(String(lesson._id))
      ).length;

      return {
        enrollmentId: enrollment._id,
        enrolledAt: enrollment.enrolledAt,
        course,
        progress: {
          completedLessons: course.lessons
            .filter(lesson => completedLessons.includes(String(lesson._id)))
            .map(lesson => String(lesson._id)),
          completedCount,
          totalLessons,
          percentage: totalLessons
            ? Math.round((completedCount / totalLessons) * 100)
            : 0
        }
      };
    })
  );
  res.json({ courses });
});

// Get public course details without exposing lesson video URLs
router.get('/:id', async (req, res) => {
  const course = await Course.findOne({
    _id: req.params.id,
    published: true,
  }).populate('instructor', 'name');

  if (!course) {
    return res.status(404).json({
      message: 'Course not found',
    });
  }
  const courseData = course.toObject();
  courseData.lessons = courseData.lessons.map(
    ({ videoUrl, ...lesson }) => lesson
  );
  res.json(courseData);
});

router.post('/', requireAuth, allowRoles('instructor', 'admin'), async (req, res) => {
  const { title, description, category, price, lessons } = req.body;
  if (!title || !description) 
    return res.status(400).json({ 
  message: 'Title and description are required' 
  });
  const course = await Course.create({ title, description, category, price, lessons: Array.isArray(lessons) ? lessons : [], instructor: req.user.id });
  res.status(201).json(course);
});

// Get lessons for enrolled students and authorized course managers.
router.get('/:id/lessons', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate the MongoDB ObjectId before querying.
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid course ID',
      });
    }
    // Find the published course.
    const course = await Course.findOne({
      _id: id,
      published: true,
    }).populate('instructor', 'name');

    if (!course) {
      return res.status(404).json({
        message: 'Course not found',
      });
    }
    // Check administrator permissions.
    const isAdmin = req.user.role === 'admin';

    // Check whether the logged-in instructor owns this course.
    const instructorId = course.instructor?._id
      ? String(course.instructor._id)
      : String(course.instructor);

    const isInstructor =
      req.user.role === 'instructor' &&
      instructorId === String(req.user.id);

    // Students must be enrolled to access lessons.
    if (!isAdmin && !isInstructor) {
      if (req.user.role !== 'student') {
        return res.status(403).json({
          message: 'You are not authorized to access these lessons',
        });
      }

      const isEnrolled = await Enrollment.exists({
        student: req.user.id,
        course: course._id,
      });

      if (!isEnrolled) {
        return res.status(403).json({
          message: 'Enroll in this course to access its lessons',
          requiresEnrollment: true,
        });
      }
    }

    // Return lesson information, including the video job ID.
    return res.json({
      lessons: course.lessons.map((lesson) => ({
        ...lesson.toObject(),
        videoUrl: lesson.videoUrl || '',
        videoJobId: lesson.videoJobId || '',
      })),
    });
  } catch (error) {
    console.error('Error fetching lessons:', error);

    return res.status(500).json({
      message: 'Unable to fetch lessons',
    });
  }
});

// Add a lesson to a course
router.post(
  '/:id/lessons',
  requireAuth,
  allowRoles('instructor', 'admin'),
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          message: 'Invalid course ID. Please select a course from the database.',
        });
      }
      const course = await Course.findById(req.params.id);

      if (!course) {
        return res.status(404).json({
          message: 'Course not found',
        });
      }

      if (
        req.user.role !== 'admin' &&
        String(course.instructor) !== String(req.user.id)
      ) {
        return res.status(403).json({
          message: 'You do not own this course',
        });
      }
      const {
        title,
        description,
        videoJobId,
        durationSeconds,
      } = req.body;
      if (!title || !title.trim()) {
        return res.status(400).json({
          message: 'Lesson title is required',
        });
      }
      let verifiedVideoJobId = '';

      // Verify the uploaded video before attaching it to the lesson.
      if (videoJobId) {
        const job = await videoQueue.getJob(String(videoJobId));

        if (!job) {
          return res.status(404).json({
            message: 'Video-processing job not found',
          });
        }
        // Only the uploader or an admin can attach this video.
        if (
          req.user.role !== 'admin' &&
          String(job.data.uploadedBy) !== String(req.user.id)
        ) {
          return res.status(403).json({
            message: 'You cannot use this uploaded video',
          });
        }
        const state = await job.getState();
        if (state !== 'completed') {
          return res.status(409).json({
            message: 'Video processing has not completed yet',
            status: state,
          });
        }
        verifiedVideoJobId = String(job.id);
      }
      course.lessons.push({
        title: title.trim(),
        description: description || '',
        videoUrl: verifiedVideoJobId
          ? `/api/uploads/video/${verifiedVideoJobId}/playlist`
          : '',
        videoJobId: verifiedVideoJobId,
        durationSeconds: Number(durationSeconds) || 0,
        order: course.lessons.length + 1,
      });
      await course.save();
      return res.status(201).json({
        message: 'Lesson created successfully',
        lessons: course.lessons,
      });
    } catch (error) {
      console.error('Create lesson failed:', error);
      return res.status(500).json({
        message: 'Unable to create lesson',
        error: error.message
      });
    }
  }
);

router.post(
  '/:id/enroll',
  requireAuth,
  allowRoles('student'),
  async (req, res) => {
    const course = await Course.findOne({
      _id: req.params.id,
      published: true,
    });

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    const existingEnrollment = await Enrollment.findOne({
      student: req.user.id,
      course: course._id,
    });
    if (existingEnrollment) {
      return res.status(409).json({ message: 'Already enrolled' });
    }

    // Paid courses require payment verification through the payment API.
    if (course.price > 0) {
      return res.status(402).json({
        message: 'Payment is required before enrolling in this course',
        requiresPayment: true,
      });
    }
    try {
      const enrollment = await Enrollment.create({
        student: req.user.id,
        course: course._id,
      });
      return res.status(201).json(enrollment);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'Already enrolled' });
      }
      throw error;
    }
  }
);
export default router;


router.patch('/:id', requireAuth, allowRoles('instructor', 'admin'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      message: 'Invalid course ID. Please select a course from the database.',
    });
  }
  const course = await Course.findById(req.params.id);
  if (!course) {
    return res.status(404).json({ message: 'Course not found' });
  }
  if (
    req.user.role !== 'admin' &&
    String(course.instructor) !== req.user.id
  ) {
    return res.status(403).json({ message: 'You do not own this course' });
  }
  const {
    title,
    description,
    videoUrl,
    videoJobId,
    durationSeconds,
  } = req.body;
  if (title !== undefined) course.title = title;
  if (description !== undefined) course.description = description;
  if (category !== undefined) course.category = category;
  if (price !== undefined) course.price = price;
  if (published !== undefined) course.published = published;

  if (lessons !== undefined) {
    if (!Array.isArray(lessons)) {
      return res.status(400).json({ message: 'Lessons must be an array' });
    }

    course.lessons = lessons;
  }
  await course.save();
  res.json(course);
});

// Delete a course: instructors can delete only their own courses; admins can delete any course.
router.delete(
  '/:id',
  requireAuth,
  allowRoles('instructor', 'admin'),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Validate course ID.
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: 'Invalid course ID',
        });
      }

      // Find the course.
      const course = await Course.findById(id);

      if (!course) {
        return res.status(404).json({
          message: 'Course not found',
        });
      }

      // Only the course owner or an admin can delete it.
      if (
        req.user.role !== 'admin' &&
        String(course.instructor) !== String(req.user.id)
      ) {
        return res.status(403).json({
          message: 'You can delete only courses created by you.',
        });
      }

      // Delete the course.
      await Course.findByIdAndDelete(id);

      return res.status(200).json({
        message: 'Course deleted successfully',
        courseId: id,
      });
    } catch (error) {
      console.error('Delete course failed:', error);

      return res.status(500).json({
        message: 'Unable to delete course',
      });
    }
  }
);