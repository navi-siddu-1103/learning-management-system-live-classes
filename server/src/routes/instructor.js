import { Router } from 'express';
import {
  Course,
  Enrollment,
  Quiz,
  Attempt,
  User,
} from '../models.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();

// Get courses accessible to the instructor or admin.
async function getAccessibleCourses(user) {
  const filter =
    user.role === 'admin'
      ? {}
      : { instructor: user.id };

  return Course.find(filter)
    .select('_id title price instructor')
    .lean();
}

// GET /api/instructor/student-performance
router.get(
  '/student-performance',
  requireAuth,
  allowRoles('instructor', 'admin'),
  async (req, res) => {
    try {
      const courses = await getAccessibleCourses(req.user);
      const courseIds = courses.map((course) => course._id);

      const courseMap = new Map(
        courses.map((course) => [
          String(course._id),
          course.title,
        ])
      );

      const enrollments = await Enrollment.find({
        course: { $in: courseIds },
      })
        .populate('student', 'name email')
        .populate('course', 'title')
        .lean();

      const quizzes = await Quiz.find({
        course: { $in: courseIds },
      })
        .select('title course questions')
        .lean();

      const quizMap = new Map(
        quizzes.map((quiz) => [
          String(quiz._id),
          {
            title: quiz.title,
            courseId: String(quiz.course),
            questionCount: quiz.questions?.length || 0,
          },
        ])
      );

      const quizIds = quizzes.map((quiz) => quiz._id);

      const attempts = await Attempt.find({
        quiz: { $in: quizIds },
      })
        .populate('student', 'name email')
        .sort({ submittedAt: -1 })
        .lean();

      const studentMap = new Map();

      // Include enrolled students even if they haven't taken a quiz.
      for (const enrollment of enrollments) {
        if (!enrollment.student || !enrollment.course) continue;

        const studentId = String(enrollment.student._id);
        const courseId = String(enrollment.course._id);
        const key = `${studentId}:${courseId}`;

        studentMap.set(key, {
          studentId,
          studentName: enrollment.student.name,
          studentEmail: enrollment.student.email,
          courseId,
          courseTitle: enrollment.course.title,
          enrolledAt: enrollment.enrolledAt,
          attemptCount: 0,
          averageScore: null,
          attempts: [],
          _scorePercentages: [],
        });
      }

      // Attach quiz attempts to each student's course record.
      for (const attempt of attempts) {
        if (!attempt.student) continue;

        const quiz = quizMap.get(String(attempt.quiz));
        if (!quiz) continue;

        const studentId = String(attempt.student._id);
        const key = `${studentId}:${quiz.courseId}`;

        if (!studentMap.has(key)) {
          studentMap.set(key, {
            studentId,
            studentName: attempt.student.name,
            studentEmail: attempt.student.email,
            courseId: quiz.courseId,
            courseTitle: courseMap.get(quiz.courseId) || 'Unknown course',
            enrolledAt: null,
            attemptCount: 0,
            averageScore: null,
            attempts: [],
            _scorePercentages: [],
          });
        }

        const student = studentMap.get(key);
        const total = Number(attempt.total);
        const score = Number(attempt.score);

        const validScore =
          Number.isFinite(score) &&
          Number.isFinite(total) &&
          total > 0;

        const percentage = validScore
          ? Math.round((score / total) * 100)
          : null;

        student.attemptCount += 1;

        if (percentage !== null) {
          student._scorePercentages.push(percentage);
        }

        student.attempts.push({
          attemptId: String(attempt._id),
          quizId: String(attempt.quiz),
          quizTitle: quiz.title,
          questionCount: quiz.questionCount,
          score: validScore ? score : null,
          total: validScore ? total : null,
          percentage,
          submittedAt: attempt.submittedAt,
        });
      }

      const students = Array.from(studentMap.values()).map((student) => {
        const percentages = student._scorePercentages;

        const averageScore = percentages.length
          ? Math.round(
              percentages.reduce((sum, value) => sum + value, 0) /
                percentages.length
            )
          : null;

        const { _scorePercentages, ...result } = student;

        return {
          ...result,
          averageScore,
        };
      });

      students.sort((a, b) =>
        a.studentName.localeCompare(b.studentName)
      );

      res.json({
        totalStudents: new Set(
          students.map((student) => student.studentId)
        ).size,
        totalStudentCourseRecords: students.length,
        students,
      });
    } catch (error) {
      console.error('Student performance error:', error);

      res.status(500).json({
        message: 'Unable to load student performance',
      });
    }
  }
);

// GET /api/instructor/metrics
router.get(
  '/metrics',
  requireAuth,
  allowRoles('instructor', 'admin'),
  async (req, res) => {
    try {
      const courses = await getAccessibleCourses(req.user);
      const courseIds = courses.map((course) => course._id);

      const quizzes = await Quiz.find({
        course: { $in: courseIds },
      })
        .select('title course questions')
        .lean();

      const quizIds = quizzes.map((quiz) => quiz._id);

      const [enrollmentCount, attemptCount, attempts] =
        await Promise.all([
          Enrollment.countDocuments({
            course: { $in: courseIds },
          }),

          Attempt.countDocuments({
            quiz: { $in: quizIds },
          }),

          Attempt.find({
            quiz: { $in: quizIds },
          })
            .select('score total')
            .lean(),
        ]);

      const totalQuestions = quizzes.reduce(
        (sum, quiz) => sum + (quiz.questions?.length || 0),
        0
      );

      const validAttempts = attempts.filter(
        (attempt) =>
          Number(attempt.total) > 0 &&
          Number.isFinite(Number(attempt.score))
      );

      const averageQuizScore = validAttempts.length
        ? Math.round(
            validAttempts.reduce(
              (sum, attempt) =>
                sum +
                (Number(attempt.score) / Number(attempt.total)) * 100,
              0
            ) / validAttempts.length
          )
        : 0;

      const listedCourseValue = courses.reduce(
        (sum, course) => sum + Number(course.price || 0),
        0
      );

      res.json({
        courseCount: courses.length,
        enrollmentCount,
        quizCount: quizzes.length,
        attemptCount,
        totalQuestions,
        averageQuizScore,
        listedCourseValue,
        note:
          'Listed course value is not actual earnings. Add verified payment records before reporting revenue.',
      });
    } catch (error) {
      console.error('Instructor metrics error:', error);

      res.status(500).json({
        message: 'Unable to load instructor metrics',
      });
    }
  }
);

export default router;