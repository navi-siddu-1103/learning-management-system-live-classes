import { Router } from 'express';
import { Course, Enrollment, Progress } from '../models.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
const router = Router();
router.post('/:courseId', requireAuth, allowRoles('student'), async (req, res) => {
  const { lessonId, completed = true } = req.body;
  const course = await Course.findById(req.params.courseId);
  if (!course) return res.status(404).json({ message: 'Course not found' });
  if (!(await Enrollment.exists({ student: req.user.id, course: course.id }))) return res.status(403).json({ message: 'Enroll first' });
  if (!lessonId || !course.lessons.some(l => String(l._id) === String(lessonId))) return res.status(400).json({ message: 'Unknown lesson' });
  let progress = await Progress.findOne({ student: req.user.id, course: course.id });
  if (!progress) progress = new Progress({ student: req.user.id, course: course.id, completedLessons: [] });
  const id = String(lessonId);
  progress.completedLessons = completed ? [...new Set([...progress.completedLessons.map(String), id])] : progress.completedLessons.filter(x => String(x) !== id);
  progress.updatedAt = new Date();
  await progress.save();
  res.json({ completedLessons: progress.completedLessons, totalLessons: course.lessons.length, percentage: course.lessons.length ? Math.round(progress.completedLessons.length / course.lessons.length * 100) : 0 });
});
export default router;
