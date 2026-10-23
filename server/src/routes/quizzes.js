import { Router } from 'express';
import { Attempt, Quiz } from '../models.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
const router = Router();
router.post('/:quizId/submit', requireAuth, allowRoles('student'), async (req, res) => {
  const quiz = await Quiz.findById(req.params.quizId);
  if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  let score = 0, total = 0;
  quiz.questions.forEach((q, i) => {
    const points = Number(q.points || 1); total += points;
    const answer = answers.find(a => Number(a.questionIndex) === i);
    if (answer && Number(answer.optionIndex) === Number(q.correctOptionIndex)) score += points;
  });
  const attempt = await Attempt.create({ student: req.user.id, quiz: quiz.id, score, total, answers: answers.map(a => ({ questionIndex: Number(a.questionIndex), optionIndex: Number(a.optionIndex) })) });
  res.json({ attemptId: attempt.id, score, total, percentage: total ? Math.round(score / total * 100) : 0 });
});
export default router;
