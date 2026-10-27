import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/register
// Public registration always creates a student account.
router.post('/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!name || !email || password.length < 8) {
      return res.status(400).json({
        message: 'Name, email, and password (8+ characters) are required',
      });
    }

    const existingUser = await User.exists({ email });

    if (existingUser) {
      return res.status(409).json({
        message: 'Email already registered',
      });
    }

    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'student',
    });

    return res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    // Handles duplicate email registration, including concurrent requests.
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Email already registered',
      });
    }

    console.error('Registration error:', error);

    return res.status(500).json({
      message: 'Unable to register account',
    });
  }
});

// POST /api/auth/login
//
// portal:
//   "student"    -> student accounts only
//   "instructor" -> instructor and admin accounts
//
// If portal is omitted, existing login requests continue to work.
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const portal = req.body.portal;

    if (
      portal !== undefined &&
      !['student', 'instructor'].includes(portal)
    ) {
      return res.status(400).json({
        message: 'Invalid login portal',
      });
    }

    const user = await User.findOne({ email }).select('+passwordHash');

    if (
      !user ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).json({
        message: 'Invalid email or password',
      });
    }

    // Enforce the selected portal using the actual database role.
    if (portal === 'student' && user.role !== 'student') {
      return res.status(403).json({
        message: 'Please use the Instructor / Admin login portal for this account.',
      });
    }

    if (
      portal === 'instructor' &&
      !['instructor', 'admin'].includes(user.role)
    ) {
      return res.status(403).json({
        message: 'Please use the Student login portal for this account.',
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not configured');

      return res.status(500).json({
        message: 'Authentication service is not configured',
      });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '12h',
      }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      message: 'Unable to sign in',
    });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: req.user,
  });
});

export default router;
