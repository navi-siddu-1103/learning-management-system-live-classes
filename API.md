# API reference

Base URL: `http://localhost:5000/api`

## Auth
- `POST /auth/register` `{name,email,password,role?}` — creates student by default; public role assignment should be locked to student in production.
- `POST /auth/login` `{email,password}` — returns `{token,user}`.
- `GET /auth/me` — current user (Bearer token).

## Courses
- `GET /courses` — published course catalogue.
- `GET /courses/:id` — course details.
- `POST /courses` — instructor/admin; `{title,description,price,category,lessons?}`.
- `PATCH /courses/:id` — owner instructor/admin.
- `POST /courses/:id/enroll` — student enrollment.

## Learning / quizzes
- `POST /progress/:courseId` — `{lessonId,completed}`.
- `POST /quizzes/:quizId/submit` — `{answers:[{questionId,optionIndex}]}`; returns score and percentage.

## Instructor
- `GET /instructor/metrics` — instructor/admin metrics.

## Uploads
- `POST /uploads/video` — multipart field `video`, instructor/admin; queues FFmpeg job and returns `jobId`.

## Certificates
- `GET /certificates/:courseId` — creates a completion certificate PDF for the authenticated student if all course lessons are marked complete.

## Live chat
Socket.IO events:
- client emits `join-room` with `{roomId}`
- client emits `chat-message` with `{roomId,message}`
- server broadcasts `chat-message` to that room

## Health
- `GET /health`
