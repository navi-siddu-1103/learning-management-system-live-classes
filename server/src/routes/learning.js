import { Router } from 'express';
import mongoose from 'mongoose';
import { Course, Enrollment, Progress } from '../models.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();

// Get enrolled courses with instructor details and lesson progress
router.get('/my-learning', requireAuth, allowRoles('student'), async (req, res) => {
  const enrollments = await Enrollment.find({
    student: req.user.id,
  }).sort({ enrolledAt: -1 });

  const courseIds = enrollments.map((item) => item.course);

  const courses = await Course.find({
    _id: { $in: courseIds },
  }).populate('instructor', 'name email');

  const progressRecords = await Progress.find({
    student: req.user.id,
    course: { $in: courseIds },
  });

  const progressMap = new Map(
    progressRecords.map((item) => [String(item.course), item])
  );

  const courseMap = new Map(
    courses.map((course) => [String(course._id), course])
  );

  const myCourses = enrollments
    .map((enrollment) => {
      const course = courseMap.get(String(enrollment.course));

      if (!course) return null;

      const progressRecord = progressMap.get(String(course._id));
      const completedLessons = (progressRecord?.completedLessons || []).map(
        String
      );

      const totalLessons = course.lessons.length;

      const completedCount = course.lessons.filter((lesson) =>
        completedLessons.includes(String(lesson._id))
      ).length;

      const percentage = totalLessons
        ? Math.round((completedCount / totalLessons) * 100)
        : 0;

      return {
        ...course.toObject(),
        completedLessons,
        totalLessons,
        completedCount,
        progress: percentage,
        enrolledAt: enrollment.enrolledAt,
      };
    })
    .filter(Boolean);

  res.json({ courses: myCourses });
});

// Mark a lesson as completed or incomplete
router.post(
  '/:courseId/lessons/:lessonId/progress',
  requireAuth,
  allowRoles('student'),
  async (req, res) => {
    const { courseId, lessonId } = req.params;
    const { completed = true } = req.body;

    if (
      !mongoose.isValidObjectId(courseId) ||
      !mongoose.isValidObjectId(lessonId)
    ) {
      return res.status(400).json({ message: 'Invalid course or lesson ID' });
    }

    if (typeof completed !== 'boolean') {
      return res.status(400).json({
        message: 'Completed must be true or false',
      });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const enrolled = await Enrollment.exists({
      student: req.user.id,
      course: courseId,
    });

    if (!enrolled) {
      return res.status(403).json({
        message: 'You must enroll in this course first',
      });
    }

    const lessonExists = course.lessons.some(
      (lesson) => String(lesson._id) === lessonId
    );

    if (!lessonExists) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    let progress = await Progress.findOne({
      student: req.user.id,
      course: courseId,
    });

    if (!progress) {
      progress = new Progress({
        student: req.user.id,
        course: courseId,
        completedLessons: [],
      });
    }

    const completedSet = new Set(
      progress.completedLessons.map(String)
    );

    if (completed) {
      completedSet.add(lessonId);
    } else {
      completedSet.delete(lessonId);
    }

    progress.completedLessons = [...completedSet];
    progress.updatedAt = new Date();

    await progress.save();

    const totalLessons = course.lessons.length;
    const completedCount = course.lessons.filter((lesson) =>
      completedSet.has(String(lesson._id))
    ).length;

    res.json({
      courseId,
      completedLessons: progress.completedLessons,
      totalLessons,
      completedCount,
      progress: totalLessons
        ? Math.round((completedCount / totalLessons) * 100)
        : 0,
    });
  }
);

export default router;