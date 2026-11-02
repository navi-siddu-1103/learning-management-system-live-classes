# LearnLive – Learning Management System with Live Classes

A MERN-stack Learning Management System designed to provide online courses, video-based learning, assessments, student progress tracking, and interactive live classes.

**GitHub Repository:** https://github.com/navi-siddu-1103/learning-management-system-live-classes

## Overview

LearnLive is an online learning platform that connects students and instructors through structured courses, recorded lessons, quizzes, and live learning sessions.

The platform is designed with role-based access for students, instructors, and administrators. It also includes a video-processing architecture using BullMQ, Redis, and FFmpeg, with AWS S3 and CloudFront planned for scalable video storage and delivery.

## Key Features

### Authentication and User Management
- User registration and login.
- Role-based access for students, instructors, and administrators.
- Protected application routes.

### Course Management
- Course creation and management.
- Lesson organization.
- Student course enrollment.
- Course and lesson information.

### Learning and Assessment
- Student learning progress tracking.
- Course quizzes and assessment attempts.
- Certificate generation.

### Live Learning
- Live-class functionality and real-time communication architecture.
- LiveKit integration in the backend.

### Video Processing Architecture
- Redis connection using Upstash.
- BullMQ queue for background video-processing jobs.
- FFmpeg-based HLS video conversion.
- AWS S3 integration groundwork for video storage.
- CloudFront planned for content delivery.

### Payments
- Razorpay payment integration in test mode.
- Payment order creation and payment workflow.

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React, Vite |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | JWT |
| Real-time communication | Socket.IO, LiveKit |
| Background jobs | BullMQ |
| Queue storage | Redis, Upstash |
| Video processing | FFmpeg, HLS |
| Cloud storage | AWS S3 |
| Content delivery | AWS CloudFront (planned) |
| Payments | Razorpay |
| Deployment | Vercel, Google Cloud Run |

## System Architecture

```text
                 STUDENT / INSTRUCTOR / ADMIN
                            |
                            v
                     React Frontend
                         (Vercel)
                            |
                            v
                    Express REST API
                      (Cloud Run)
                            |
              +-------------+-------------+
              |             |             |
              v             v             v
           MongoDB       Socket.IO      Razorpay
              |
              |
       Video Upload API
              |
              v
          AWS S3
       (planned flow)
              |
              v
        BullMQ + Redis
              |
              v
         FFmpeg Worker
              |
              v
       HLS Video Output
              |
              v
          AWS S3
              |
              v
         CloudFront
        (planned flow)
              |
              v
        Video Playback
```

*Note: The diagram represents the intended architecture. The complete cloud video-processing and CloudFront playback workflow is not yet deployed.*

## Repository Structure

```text
learning-management-system-live-classes/
│
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── assets/
│   │   └── ...
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── workers/
│   │   ├── models/
│   │   └── ...
│   ├── Dockerfile
│   ├── Dockerfile.api
│   └── package.json
│
└── README.md
```

The tree is a high-level representation. Refer to the actual repository for the complete directory and file listing.

## Local Setup

### Prerequisites

- Node.js and npm.
- MongoDB connection.
- Redis connection for BullMQ.
- FFmpeg for video processing.
- Git.

### 1. Clone the repository

```bash
git clone https://github.com/navi-siddu-1103/learning-management-system-live-classes.git

cd learning-management-system-live-classes
```

### 2. Install frontend dependencies

```bash
cd client
npm install
```

Configure the frontend environment variables using the environment variable names expected by the client source code.

Start the frontend:

```bash
npm run dev
```

### 3. Install backend dependencies

Open another terminal:

```bash
cd server
npm install
```

Configure the backend environment variables using the names expected by the server configuration.

These include the relevant settings for:

- MongoDB connection.
- JWT authentication.
- Redis connection.
- Client origin and server port.
- LiveKit credentials.
- Razorpay test credentials.
- AWS S3 configuration, where enabled.

Start the backend using the development script defined in `server/package.json`.

### 4. Video worker

The backend contains a BullMQ video-processing worker.

Run the worker using:

```bash
npm run worker
```

Run this command from the server directory after configuring Redis and FFmpeg.

## Deployment

| Component | Platform |
|---|---|
| Frontend | Vercel |
| Backend API | Google Cloud Run |
| Database | MongoDB Atlas |
| Redis | Upstash |
| Video storage | AWS S3 |
| CDN | CloudFront – pending verification |

## Current Project Status

The following status reflects the work completed at the time this README was prepared.

| Component | Status |
|---|---|
| MERN application | Implemented |
| Authentication and role-based access | Implemented |
| Course and lesson management | Implemented |
| Enrollment and learning progress | Implemented |
| Quizzes and certificates | Implemented |
| BullMQ and Redis connectivity | Tested |
| BullMQ worker processing test | Passed |
| FFmpeg worker | Implemented locally; cloud workflow pending |
| AWS S3 bucket and IAM setup | Completed |
| AWS S3 connectivity test | Passed from Cloud Shell |
| CloudFront distribution | Pending AWS account verification |
| Secure CloudFront video playback | Pending |
| Razorpay payment workflow | Requires troubleshooting |
| Live-class end-to-end testing | Pending |
| Redux Toolkit | Requires verification/implementation |
| Final documentation and demo | Pending |

## Security Considerations

- Keep credentials in environment variables or a secret manager.
- Never commit `.env` files or cloud credentials.
- Keep the S3 bucket private.
- Use authenticated access for protected course videos.
- Use Razorpay test credentials during development.
- Apply role-based authorization to protected resources.

## Future Improvements

- Complete cloud-based video upload and HLS processing.
- Integrate CloudFront with private S3 storage.
- Implement authenticated video delivery.
- Complete and validate payment workflows.
- Verify live classes and real-time communication.
- Complete Redux Toolkit integration.
- Add automated testing and monitoring.

## Project Objective

LearnLive aims to provide a centralized digital learning environment where instructors can publish courses, students can access learning materials, and both can interact through live classes and assessments.

**Project Repository:** https://github.com/navi-siddu-1103/learning-management-system-live-classes
