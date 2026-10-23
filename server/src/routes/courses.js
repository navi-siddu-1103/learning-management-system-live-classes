import { Router } from 'express';
import { Course, Enrollment } from '../models.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
const router = Router();

router.get('/', async (_req, res) => {
  const courses = await Course.find({ published: true }).populate('instructor', 'name').sort({ createdAt: -1 }).limit(100);
  res.json(courses);
});
router.get('/my-learning', requireAuth, allowRoles('student'), async (req, res) => {
  const enrollments = await Enrollment.find({ student: req.user.id })
    .sort({ enrolledAt: -1 })
    .populate({
      path: 'course',
      populate: {
        path: 'instructor',
        select: 'name'
      }
    });

  const courses = enrollments
    .filter(enrollment => enrollment.course)
    .map(enrollment => ({
      ...enrollment.course.toObject(),
      enrolledAt: enrollment.enrolledAt
    }));

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
  if (!course) return res.status(404).json({ message: 'Course not found' });
  if (req.user.role !== 'admin' && String(course.instructor) !== req.user.id) return res.status(403).json({ message: 'You do not own this course' });
  for (const key of ['title', 'description', 'category', 'price', 'published', 'lessons']) if (req.body[key] !== undefined) course[key] = req.body[key];
  await course.save();
  res.json(course);
});
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
