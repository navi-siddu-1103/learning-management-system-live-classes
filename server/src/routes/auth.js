import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 8)
    return res.status(400).json({ message: 'Name, email, and password (8+ characters) are required' });
  if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ message: 'Email already registered' });
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'student' });
  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
});
router.post('/login', async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email || '').toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(req.body.password || '', user.passwordHash)))
    return res.status(401).json({ message: 'Invalid email or password' });
  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
export default router;
