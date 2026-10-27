import { Router } from 'express';
import mongoose from 'mongoose';
import {
  User,
  Course,
  Enrollment,
  Quiz,
  Attempt,
} from '../models.js';

import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();

// All routes in this file require an authenticated admin.
router.use(requireAuth, allowRoles('admin'));

// GET /api/admin/metrics
router.get('/metrics', async (req, res) => {
  try {
    const [
      totalUsers,
      totalStudents,
      totalInstructors,
      totalAdmins,
      totalCourses,
      publishedCourses,
      totalEnrollments,
      totalQuizzes,
      totalAttempts,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'instructor' }),
      User.countDocuments({ role: 'admin' }),
      Course.countDocuments(),
      Course.countDocuments({ published: true }),
      Enrollment.countDocuments(),
      Quiz.countDocuments(),
      Attempt.countDocuments(),
    ]);

    res.json({
      totalUsers,
      totalStudents,
      totalInstructors,
      totalAdmins,
      totalCourses,
      publishedCourses,
      unpublishedCourses: totalCourses - publishedCourses,
      totalEnrollments,
      totalQuizzes,
      totalAttempts,
    });
  } catch (error) {
    console.error('Admin metrics error:', error);
    res.status(500).json({ message: 'Unable to load admin metrics' });
  }
});

// GET /api/admin/users?search=example&role=student&page=1&limit=20
router.get('/users', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const role = String(req.query.role || '').trim();
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
    );

    const filter = {};

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    if (role) {
      if (!['student', 'instructor', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role filter' });
      }
      filter.role = role;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('_id name email role createdAt updatedAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ message: 'Unable to load users' });
  }
});

// PATCH /api/admin/users/:userId/role
router.patch('/users/:userId/role', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    if (!['student', 'instructor', 'admin'].includes(role)) {
      return res.status(400).json({
        message: 'Role must be student, instructor, or admin',
      });
    }

    const targetUser = await User.findById(userId).select('_id name email role');

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Do not allow the current admin to remove their own admin role.
    if (
      String(targetUser._id) === String(req.user._id) &&
      role !== 'admin'
    ) {
      return res.status(400).json({
        message: 'You cannot change your own admin role',
      });
    }

    // Protect the last admin account from being demoted.
    if (targetUser.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });

      if (adminCount <= 1) {
        return res.status(400).json({
          message: 'The last admin account cannot be demoted',
        });
      }
    }

    targetUser.role = role;
    await targetUser.save();

    res.json({
      message: 'User role updated successfully',
      user: {
        id: String(targetUser._id),
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
      },
    });
  } catch (error) {
    console.error('Admin role update error:', error);
    res.status(500).json({ message: 'Unable to update user role' });
  }
});

// GET /api/admin/courses?search=javascript&published=true&page=1&limit=20
router.get('/courses', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
    );

    const filter = {};

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = { $regex: escapedSearch, $options: 'i' };
    }

    if (req.query.published !== undefined) {
      if (!['true', 'false'].includes(String(req.query.published))) {
        return res.status(400).json({
          message: 'published must be true or false',
        });
      }

      filter.published = String(req.query.published) === 'true';
    }

    const [courses, total] = await Promise.all([
      Course.find(filter)
        .select('_id title category price instructor published createdAt')
        .populate('instructor', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Course.countDocuments(filter),
    ]);

    res.json({
      courses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin courses error:', error);
    res.status(500).json({ message: 'Unable to load courses' });
  }
});

// PATCH /api/admin/courses/:courseId/published
router.patch('/courses/:courseId/published', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { published } = req.body;

    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ message: 'Invalid course ID' });
    }

    if (typeof published !== 'boolean') {
      return res.status(400).json({
        message: 'published must be a boolean',
      });
    }

    const course = await Course.findByIdAndUpdate(
      courseId,
      { $set: { published } },
      { new: true, runValidators: true }
    )
      .select('_id title published')
      .lean();

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.json({
      message: published
        ? 'Course published successfully'
        : 'Course unpublished successfully',
      course,
    });
  } catch (error) {
    console.error('Admin course update error:', error);
    res.status(500).json({ message: 'Unable to update course' });
  }
});
// GET /api/admin/courses/:id/details
router.get(
  '/courses/:id/details',
  requireAuth,
  allowRoles('admin'),
  async (req, res) => {
    try {
      const course = await Course.findById(req.params.id)
        .populate('instructor', 'name email')
        .lean();

      if (!course) {
        return res.status(404).json({
          message: 'Course not found'
        });
      }

      const enrollmentCount = await Enrollment.countDocuments({
        course: course._id
      });

      return res.json({
        _id: course._id,
        title: course.title,
        description: course.description || '',
        category: course.category || 'General',
        price: course.price ?? 0,
        published: Boolean(course.published),
        totalLessons: Array.isArray(course.lessons)
          ? course.lessons.length
          : 0,
        enrollmentCount,
        instructor: course.instructor
          ? {
              _id: course.instructor._id,
              name: course.instructor.name,
              email: course.instructor.email
            }
          : null,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt
      });
    } catch (error) {
      console.error('Admin course details error:', error);

      return res.status(500).json({
        message: 'Unable to load course details'
      });
    }
  }
);

export default router;