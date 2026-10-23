import { Router } from 'express';
import { Course, Enrollment } from '../models.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
const router = Router();
router.get('/metrics', requireAuth, allowRoles('instructor', 'admin'), async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { instructor: req.user.id };
  const courses = await Course.find(filter).select('_id title price');
  const ids = courses.map(c => c._id);
  const enrollments = await Enrollment.countDocuments({ course: { $in: ids } });
  const expectedRevenue = courses.reduce((sum, c) => sum + Number(c.price || 0), 0);
  res.json({ courseCount: courses.length, enrollmentCount: enrollments, listedCourseValue: expectedRevenue, note: 'Listed course value is not actual earnings. Add verified payment records before reporting revenue.' });
});
export default router;
