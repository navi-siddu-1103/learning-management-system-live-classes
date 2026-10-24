import { Router } from 'express';
import { Course, Enrollment, Progress } from '../models.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
const router = Router();

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
router.get('/:id', async (req, res) => {
  const course = await Course.findById(req.params.id).populate('instructor', 'name');
  if (!course) return res.status(404).json({ message: 'Course not found' });
  res.json(course);
});
router.post('/', requireAuth, allowRoles('instructor', 'admin'), async (req, res) => {
  const { title, description, category, price, lessons } = req.body;
  if (!title || !description) return res.status(400).json({ message: 'Title and description are required' });
  const course = await Course.create({ title, description, category, price, lessons: Array.isArray(lessons) ? lessons : [], instructor: req.user.id });
  res.status(201).json(course);
});
router.patch('/:id', requireAuth, allowRoles('instructor', 'admin'), async (req, res) => {
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

  const { title, description, category, price, published, lessons } = req.body;

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
// Get lessons for a course
router.get('/:id/lessons', async (req, res) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    return res.status(404).json({ message: 'Course not found' });
  }

  res.json({ lessons: course.lessons });
});
// Add a lesson to a course
router.post(
  '/:id/lessons',
  requireAuth,
  allowRoles('instructor', 'admin'),
  async (req, res) => {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (
      req.user.role !== 'admin' &&
      String(course.instructor) !== req.user.id
    ) {
      return res.status(403).json({
        message: 'You do not own this course'
      });
    }

    const { title, description, videoUrl, durationSeconds } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        message: 'Lesson title is required'
      });
    }

    course.lessons.push({
      title: title.trim(),
      description: description || '',
      videoUrl: videoUrl || '',
      durationSeconds: Number(durationSeconds) || 0,
      order: course.lessons.length + 1
    });

    await course.save();

    res.status(201).json({
      message: 'Lesson created successfully',
      lessons: course.lessons
    });
  }
);
router.post('/:id/enroll', requireAuth, allowRoles('student'), async (req, res) => {
  const course = await Course.findOne({ _id: req.params.id, published: true });
  if (!course) return res.status(404).json({ message: 'Course not found' });
  try {
    const enrollment = await Enrollment.create({ student: req.user.id, course: course.id });
    res.status(201).json(enrollment);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: 'Already enrolled' });
    throw e;
  }
});
export default router;
