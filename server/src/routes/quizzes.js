import { Router } from 'express';
import mongoose from 'mongoose';
import { Attempt, Quiz, Course, Enrollment } from '../models.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();

// Validate quiz questions before creating or updating a quiz.
function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return 'At least one question is required';
  }

  for (const question of questions) {
    if (
      typeof question.prompt !== 'string' ||
      !question.prompt.trim() ||
      !Array.isArray(question.options) ||
      question.options.length < 2 ||
      question.options.some(
        (option) => typeof option !== 'string' || !option.trim()
      ) ||
      !Number.isInteger(question.correctOptionIndex) ||
      question.correctOptionIndex < 0 ||
      question.correctOptionIndex >= question.options.length
    ) {
      return 'Each question needs a prompt, at least two valid options, and a valid correct answer';
    }

    if (
      question.points !== undefined &&
      (!Number.isFinite(Number(question.points)) ||
        Number(question.points) <= 0)
    ) {
      return 'Question points must be a positive number';
    }
  }

  return null;
}

// Normalize questions for database storage.
function prepareQuestions(questions) {
  return questions.map((question) => ({
    prompt: question.prompt.trim(),
    options: question.options.map((option) => option.trim()),
    correctOptionIndex: question.correctOptionIndex,
    points:
      question.points !== undefined
        ? Number(question.points)
        : 1,
  }));
}

// Check whether the current instructor owns the course.
// Admins can manage quizzes across courses.
async function canManageCourse(courseId, user) {
  const course = await Course.findById(courseId);

  if (!course) {
    return { course: null, allowed: false };
  }

  const allowed =
    user.role === 'admin' ||
    String(course.instructor) === String(user.id);

  return { course, allowed };
}

// Create a quiz for a course.
router.post(
  '/',
  requireAuth,
  allowRoles('instructor', 'admin'),
  async (req, res) => {
    try {
      const { title, courseId, questions } = req.body;

      if (
        typeof title !== 'string' ||
        !title.trim() ||
        !mongoose.isValidObjectId(courseId)
      ) {
        return res.status(400).json({
          message: 'Valid title and course ID are required',
        });
      }

      const validationError = validateQuestions(questions);

      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      const { course, allowed } = await canManageCourse(
        courseId,
        req.user
      );

      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }

      if (!allowed) {
        return res.status(403).json({
          message: 'You can only create quizzes for your own courses',
        });
      }

      const quiz = await Quiz.create({
        title: title.trim(),
        course: course._id,
        questions: prepareQuestions(questions),
      });

      await Course.updateOne(
        { _id: course._id },
        { $addToSet: { quizIds: quiz._id } }
      );

      return res.status(201).json({
        id: quiz.id,
        title: quiz.title,
        course: quiz.course,
        questionCount: quiz.questions.length,
      });
    } catch (error) {
      console.error('Create quiz error:', error);
      return res.status(500).json({ message: 'Failed to create quiz' });
    }
  }
);

// List quizzes managed by the logged-in instructor/admin.
// This route must appear before GET /:quizId.
router.get(
  '/instructor',
  requireAuth,
  allowRoles('instructor', 'admin'),
  async (req, res) => {
    try {
      let courseFilter = {};

      if (req.user.role !== 'admin') {
        const courses = await Course.find({
          instructor: req.user.id,
        }).select('_id title');

        const courseIds = courses.map((course) => course._id);

        const quizzes = await Quiz.find({
          course: { $in: courseIds },
        })
          .select('title course questions.prompt createdAt')
          .populate('course', 'title')
          .sort({ createdAt: -1 });

        return res.json({
          quizzes: quizzes.map((quiz) => ({
            _id: quiz._id,
            title: quiz.title,
            courseId: quiz.course?._id,
            courseTitle: quiz.course?.title || 'Unknown course',
            questionCount: quiz.questions.length,
            createdAt: quiz.createdAt,
          })),
        });
      }

      const quizzes = await Quiz.find({})
        .select('title course questions.prompt createdAt')
        .populate('course', 'title')
        .sort({ createdAt: -1 });

      return res.json({
        quizzes: quizzes.map((quiz) => ({
          _id: quiz._id,
          title: quiz.title,
          courseId: quiz.course?._id,
          courseTitle: quiz.course?.title || 'Unknown course',
          questionCount: quiz.questions.length,
          createdAt: quiz.createdAt,
        })),
      });
    } catch (error) {
      console.error('List instructor quizzes error:', error);
      return res.status(500).json({ message: 'Failed to load quizzes' });
    }
  }
);

// List quizzes for a course. Correct answers are never returned.
router.get('/course/:courseId', requireAuth, async (req, res) => {
  try {
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
      .select(
        'title course questions.prompt questions.options questions.points createdAt'
      )
      .sort({ createdAt: -1 });

    return res.json({
      quizzes: quizzes.map((quiz) => ({
        _id: quiz._id,
        title: quiz.title,
        course: quiz.course,
        questions: quiz.questions,
        createdAt: quiz.createdAt,
      })),
    });
  } catch (error) {
    console.error('List course quizzes error:', error);
    return res.status(500).json({ message: 'Failed to load course quizzes' });
  }
});

// Edit a quiz's title and questions.
router.patch(
  '/:quizId',
  requireAuth,
  allowRoles('instructor', 'admin'),
  async (req, res) => {
    try {
      const { quizId } = req.params;
      const { title, questions } = req.body;

      if (!mongoose.isValidObjectId(quizId)) {
        return res.status(400).json({ message: 'Invalid quiz ID' });
      }

      if (
        typeof title !== 'string' ||
        !title.trim()
      ) {
        return res.status(400).json({ message: 'A valid title is required' });
      }

      const validationError = validateQuestions(questions);

      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      const quiz = await Quiz.findById(quizId);

      if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found' });
      }

      const { course, allowed } = await canManageCourse(
        quiz.course,
        req.user
      );

      if (!course) {
        return res.status(404).json({ message: 'Quiz course not found' });
      }

      if (!allowed) {
        return res.status(403).json({
          message: 'You can only edit quizzes for your own courses',
        });
      }

      const existingAttempt = await Attempt.exists({ quiz: quiz._id });

      if (existingAttempt) {
        return res.status(409).json({
          message:
            'This quiz already has student attempts and cannot be edited.',
        });
      }

      quiz.title = title.trim();
      quiz.questions = prepareQuestions(questions);

      await quiz.save();

      return res.json({
        message: 'Quiz updated successfully',
        quiz: {
          _id: quiz._id,
          title: quiz.title,
          course: quiz.course,
          questionCount: quiz.questions.length,
        },
      });
    } catch (error) {
      console.error('Update quiz error:', error);
      return res.status(500).json({ message: 'Failed to update quiz' });
    }
  }
);

// Delete a quiz (instructor/admin)
router.delete(
  '/:quizId',
  requireAuth,
  allowRoles('instructor', 'admin'),
  async (req, res) => {
    try {
      const { quizId } = req.params;

      if (!mongoose.isValidObjectId(quizId)) {
        return res.status(400).json({ message: 'Invalid quiz ID' });
      }

      const quiz = await Quiz.findById(quizId);

      if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found' });
      }

      const course = await Course.findById(quiz.course);

      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }

      // Instructors can only delete quizzes from their own courses.
      if (
        req.user.role !== 'admin' &&
        String(course.instructor) !== String(req.user.id)
      ) {
        return res.status(403).json({
          message: 'You can only delete quizzes from your own courses',
        });
      }

      // Preserve quiz history when students have attempted this quiz.
      const attemptsExist = await Attempt.exists({ quiz: quiz._id });

      if (attemptsExist) {
        return res.status(409).json({
          message: 'This quiz has student attempts and cannot be deleted.',
        });
      }

      await Quiz.deleteOne({ _id: quiz._id });

      await Course.updateOne(
        { _id: course._id },
        { $pull: { quizIds: quiz._id } }
      );

      return res.json({
        message: 'Quiz deleted successfully',
        quizId,
      });
    } catch (error) {
      console.error('Delete quiz error:', error);
      return res.status(500).json({
        message: 'Unable to delete quiz',
      });
    }
  }
);
// Get one quiz. Correct answers are not exposed to students.
router.get('/:quizId', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.quizId)) {
      return res.status(400).json({ message: 'Invalid quiz ID' });
    }

    const quiz = await Quiz.findById(req.params.quizId).select(
      'title course questions.prompt questions.options questions.points createdAt'
    );

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
      const { allowed } = await canManageCourse(quiz.course, req.user);

      if (!allowed) {
        return res.status(403).json({
          message: 'You do not own this quiz',
        });
      }
    }

    return res.json({ quiz });
  } catch (error) {
    console.error('Get quiz error:', error);
    return res.status(500).json({ message: 'Failed to load quiz' });
  }
});

// Submit quiz answers.
router.post(
  '/:quizId/submit',
  requireAuth,
  allowRoles('student'),
  async (req, res) => {
    try {
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
        const points =
          Number(question.points) > 0 ? Number(question.points) : 1;

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

      return res.json({
        attemptId: attempt.id,
        score,
        total,
        percentage: total ? Math.round((score / total) * 100) : 0,
      });
    } catch (error) {
      console.error('Submit quiz error:', error);
      return res.status(500).json({ message: 'Failed to submit quiz' });
    }
  }
);

export default router;