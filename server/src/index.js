import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import progressRoutes from './routes/progress.js';
import quizRoutes from './routes/quizzes.js';
import instructorRoutes from './routes/instructor.js';
import uploadRoutes from './routes/uploads.js';
import certificateRoutes from './routes/certificates.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' } });
app.set('io', io);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120 }));
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'learnlive-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/certificates', certificateRoutes);
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Internal server error' });
});
io.on('connection', socket => {
  socket.on('join-room', ({ roomId }) => {
    if (typeof roomId === 'string' && roomId.length < 120) socket.join(roomId);
  });
  socket.on('chat-message', ({ roomId, message, sender }) => {
    if (typeof roomId !== 'string' || typeof message !== 'string') return;
    const clean = message.trim().slice(0, 1000);
    if (clean) io.to(roomId).emit('chat-message', { message: clean, sender: String(sender || 'Learner').slice(0, 60), sentAt: new Date().toISOString() });
  });
});
const port = process.env.PORT || 5000;
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/learnlive');
server.listen(port, () => console.log(`LearnLive API listening on ${port}`));
