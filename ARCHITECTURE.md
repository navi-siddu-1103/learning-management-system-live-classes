# Architecture

```text
React + Vite
  ├── REST API calls (JWT)
  ├── Socket.IO chat
  └── Live class UI (WebRTC signaling adapter point)
          |
          v
Express API ───── MongoDB
  ├── Auth / RBAC       ├── Users
  ├── Courses           ├── Courses / Lessons
  ├── Enrollments       ├── Quizzes / Attempts
  ├── Progress          ├── Progress
  ├── Certificates      └── Live sessions / payment records
  ├── Upload API
  │      |
  │      v
  │   BullMQ + Redis → FFmpeg worker → HLS output
  │                                  |
  │                                  v
  │                            S3 → CloudFront
  └── Payment adapter (test mode; provider-specific)
```

## Security boundaries
- Passwords are hashed with bcrypt.
- JWTs are signed using a server-only secret.
- Protected routes enforce roles on the server, not just in the UI.
- Course creation is instructor/admin-only.
- Enrollment is student-only.
- Quiz scores are computed server-side.
- Uploads are size-limited and should be further constrained by MIME/file-signature validation in production.
- Keep AWS, database, JWT, Redis, and payment secrets out of source control.
