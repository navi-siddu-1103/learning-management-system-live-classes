import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'instructor', 'admin'], default: 'student' }
}, { timestamps: true });

const courseSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  category: { type: String, default: 'General' },
  price: { type: Number, min: 0, default: 0 },
  instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  published: { type: Boolean, default: true },
  lessons: [{ title: String, description: String, videoUrl: String, durationSeconds: Number, order: Number }],
  quizIds: [{ type: Schema.Types.ObjectId, ref: 'Quiz' }]
}, { timestamps: true });

const enrollmentSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  enrolledAt: { type: Date, default: Date.now }
});
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

const progressSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  completedLessons: [{ type: String }],
  updatedAt: { type: Date, default: Date.now }
});
progressSchema.index({ student: 1, course: 1 }, { unique: true });

const quizSchema = new Schema({
  title: { type: String, required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  questions: [{
    prompt: String,
    options: [String],
    correctOptionIndex: Number,
    points: { type: Number, default: 1 }
  }]
}, { timestamps: true });

const attemptSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
  score: Number,
  total: Number,
  answers: [{ questionIndex: Number, optionIndex: Number }],
  submittedAt: { type: Date, default: Date.now }
});

export const User = model('User', userSchema);
export const Course = model('Course', courseSchema);
export const Enrollment = model('Enrollment', enrollmentSchema);
export const Progress = model('Progress', progressSchema);
export const Quiz = model('Quiz', quizSchema);
export const Attempt = model('Attempt', attemptSchema);
