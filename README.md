# LearnLive — Learning Management System with Live Classes

A full-stack MVP starter aligned with FS-03 requirements. Stack: React + Vite, Express, MongoDB/Mongoose, JWT, BullMQ/Redis, FFmpeg, AWS S3/CloudFront integration points, Socket.IO chat, WebRTC-ready live class page, PDF certificates, and payment-gateway test-mode integration points.

## Features in this starter
- JWT registration/login and role-based access (`student`, `instructor`, `admin`)
- Course creation/listing/enrollment APIs
- Quiz submission with server-side grading
- Learning progress API
- Instructor dashboard metrics endpoint
- Certificate PDF endpoint
- Video upload endpoint with BullMQ processing worker and FFmpeg HLS conversion
- S3/CloudFront storage adapter points
- Socket.IO room chat and a WebRTC-ready live class UI
- React pages for catalogue, dashboard, course creation, quiz, and live classes
- Health check, sample environment files, architecture notes, API documentation, and test checklist

> This is a project starter, not a claim that AWS credentials, Redis, a payment provider, or TURN/STUN infrastructure are already configured. Follow setup instructions and test each integration before presenting it as complete.

## Prerequisites
- Node.js 20+
- MongoDB local or Atlas
- Redis (required for background video jobs)
- FFmpeg installed on the backend host for video processing

## Run locally
1. Copy `server/.env.example` to `server/.env` and fill in values.
2. Copy `client/.env.example` to `client/.env`.
3. In one terminal:
   ```bash
   cd server
   npm install
   npm run dev
   ```
4. In another terminal:
   ```bash
   cd client
   npm install
   npm run dev
   ```
5. Open the Vite URL shown in the terminal. API defaults to `http://localhost:5000`.

## Seed a first admin
Register normally, then promote the account directly in MongoDB:
```js
db.users.updateOne({ email: "you@example.com" }, { $set: { role: "admin" } })
```
Never expose an admin-promotion endpoint publicly.

## Important production tasks
- Use HTTPS and secure secrets in the deployment platform.
- Configure S3 bucket permissions and CloudFront origin access; do not make the bucket public.
- Configure Redis and a persistent worker process.
- Use a TURN server for reliable WebRTC across restrictive networks, or use LiveKit for a production-ready managed SFU.
- Connect a real payment gateway in test mode and verify webhook signatures.
- Add rate limiting, email verification, password reset, audit logs, pagination, and integration tests before production.
