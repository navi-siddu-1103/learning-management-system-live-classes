import { Router } from 'express';
import mongoose from 'mongoose';
import { Attempt, Quiz, Course, Enrollment } from '../models.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();

// Create a quiz for a course (instructor/admin)
router.post(
  '/',
  requireAuth,
  allowRoles('instructor', 'admin'),
  async (req, res) => {
    const { title, courseId, questions } = req.body;

    if (
      typeof title !== 'string' ||
      !title.trim() ||
      !mongoose.isValidObjectId(courseId) ||
      !Array.isArray(questions) ||
      questions.length === 0
    ) {
      return res.status(400).json({
        message: 'Valid title, course ID, and questions are required',
      });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (
      req.user.role !== 'admin' &&
      String(course.instructor) !== String(req.user.id)
    ) {
      return res.status(403).json({
        message: 'You can only create quizzes for your own courses',
      });
    }

    for (const question of questions) {
      if (
        typeof question.prompt !== 'string' ||
        !question.prompt.trim() ||
        !Array.isArray(question.options) ||
        question.options.length < 2 ||
        !Number.isInteger(question.correctOptionIndex) ||
        question.correctOptionIndex < 0 ||
        question.correctOptionIndex >= question.options.length
      ) {
        return res.status(400).json({
          message: 'Each question needs a prompt, at least two options, and a valid correct answer',
        });
      }
    }

    const quiz = await Quiz.create({
      title: title.trim(),
      course: course._id,
      questions: questions.map((question) => ({
        prompt: question.prompt.trim(),
        options: question.options,
        correctOptionIndex: question.correctOptionIndex,
        points: Number.isFinite(Number(question.points))
          && Number(question.points) > 0
          ? Number(question.points)
          : 1,
      })),
    });

    await Course.updateOne(
      { _id: course._id },
      { $addToSet: { quizIds: quiz._id } }
    );

    res.status(201).json({
      id: quiz.id,
      title: quiz.title,
      course: quiz.course,
      questionCount: quiz.questions.length,
    });
  }
);

// List quizzes for a course (hide correct answers)
router.get(
  '/course/:courseId',
  requireAuth,
  async (req, res) => {
    const { courseId } = req.params;

    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ message: 'Invalid course ID' });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (req.user.role === 'student') {
      const enrolled = await Enrollment.exists({
        student: req.user.id,
        course: courseId,
      });

      if (!enrolled) {
        return res.status(403).json({
          message: 'Enroll in this course to access its quizzes',
        });
      }
    } else if (
      req.user.role !== 'admin' &&
      String(course.instructor) !== String(req.user.id)
    ) {
      return res.status(403).json({
        message: 'You do not own this course',
      });
    }

    const quizzes = await Quiz.find({ course: courseId })
      .select('title course questions.prompt questions.options questions.points createdAt')
      .sort({ createdAt: -1 });

    res.json({
      quizzes: quizzes.map((quiz) => ({
        _id: quiz._id,
        title: quiz.title,
        course: quiz.course,
        questions: quiz.questions,
        createdAt: quiz.createdAt,
      })),
    });
  }
);

// Get one quiz (hide correct answers)
router.get(
  '/:quizId',
  requireAuth,
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.quizId)) {
      return res.status(400).json({ message: 'Invalid quiz ID' });
    }

    const quiz = await Quiz.findById(req.params.quizId)
      .select('title course questions.prompt questions.options questions.points createdAt');

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    if (req.user.role === 'student') {
      const enrolled = await Enrollment.exists({
        student: req.user.id,
        course: quiz.course,
      });

      if (!enrolled) {
        return res.status(403).json({
          message: 'Enroll in this course to access its quiz',
        });
      }
    } else if (req.user.role !== 'admin') {
      const course = await Course.findById(quiz.course);

      if (!course || String(course.instructor) !== String(req.user.id)) {
        return res.status(403).json({
          message: 'You do not own this quiz',
        });
      }
    }

    res.json({ quiz });
  }
);

// Submit quiz answers (student)
router.post(
  '/:quizId/submit',
  requireAuth,
  allowRoles('student'),
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.quizId)) {
      return res.status(400).json({ message: 'Invalid quiz ID' });
    }

    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const enrolled = await Enrollment.exists({
      student: req.user.id,
      course: quiz.course,
    });

    if (!enrolled) {
      return res.status(403).json({
        message: 'Enroll in this course to submit its quiz',
      });
    }

    const answers = Array.isArray(req.body.answers)
      ? req.body.answers
      : [];

    let score = 0;
    let total = 0;

    quiz.questions.forEach((question, index) => {
      const points = Number(question.points) > 0
        ? Number(question.points)
        : 1;

      total += points;

      const answer = answers.find(
        (item) => Number(item.questionIndex) === index
      );

      if (
        answer &&
        Number.isInteger(Number(answer.optionIndex)) &&
        Number(answer.optionIndex) === question.correctOptionIndex
      ) {
        score += points;
      }
    });

    const attempt = await Attempt.create({
      student: req.user.id,
      quiz: quiz.id,
      score,
      total,
      answers: answers.map((answer) => ({
        questionIndex: Number(answer.questionIndex),
        optionIndex: Number(answer.optionIndex),
      })),
    });

    res.json({
      attemptId: attempt.id,
      score,
      total,
      percentage: total
        ? Math.round((score / total) * 100)
        : 0,
    });
  }
);

export default router;
