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
  lessons: [{ 
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    videoJobId: { type: String, default: '' },
    durationSeconds: { type: Number, default: 0 },
    order: { type: Number, default: 0 }
  }],
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

const paymentSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    course: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },

    instructor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },

    status: {
      type: String,
      enum: [
        'created',
        'pending',
        'paid',
        'failed',
        'refunded',
        'partially_refunded',
      ],
      default: 'created',
      index: true,
    },

    gateway: {
      type: String,
      enum: ['razorpay'],
      default: 'razorpay',
    },

    gatewayOrderId: {
      type: String,
      unique: true,
      sparse: true,
    },

    gatewayPaymentId: {
      type: String,
      unique: true,
      sparse: true,
    },

    gatewaySignature: {
      type: String,
      select: false,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    refundedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    failureReason: {
      type: String,
      default: '',
      maxlength: 500,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ student: 1, createdAt: -1 });
paymentSchema.index({ instructor: 1, status: 1 });
paymentSchema.index({ course: 1, status: 1 });

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    type: {
      type: String,
      enum: [
        'course',
        'live-class',
        'announcement',
        'quiz',
        'system',
      ],
      default: 'system',
    },

    link: {
      type: String,
      default: '',
      maxlength: 500,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Notification = mongoose.model(
  'Notification',
  notificationSchema
);

export const User = model('User', userSchema);
export const Course = model('Course', courseSchema);
export const Enrollment = model('Enrollment', enrollmentSchema);
export const Progress = model('Progress', progressSchema);
export const Quiz = model('Quiz', quizSchema);
export const Attempt = model('Attempt', attemptSchema);
export const Payment = model('Payment', paymentSchema);