# Test plan and results template

Do not claim tests passed until you run them in your environment.

| Test | Expected result | Result |
|---|---|---|
| Register with valid data | User created; password is not returned | Pending |
| Login with wrong password | 401 response | Pending |
| Student creates course | 403 response | Pending |
| Instructor creates course | 201 response | Pending |
| Student enrolls in course | Enrollment created once | Pending |
| Submit quiz | Score calculated on server | Pending |
| Mark every lesson complete | Certificate endpoint returns PDF | Pending |
| Upload supported video | BullMQ job queued | Pending |
| FFmpeg worker | HLS playlist and segments generated | Pending |
| Live chat room | Messages only broadcast to room | Pending |
| Instructor metrics | Only instructor/admin can access | Pending |
| Payment test flow | Test transaction and webhook verified | Pending |

## Manual smoke test
1. Start MongoDB and Redis.
2. Start API and worker.
3. Register an instructor and create a course with at least one lesson.
4. Register a student and enroll.
5. Mark the lesson complete and request certificate.
6. Upload a small MP4 and inspect BullMQ worker logs.
7. Open two browser windows in a live room and test chat.
