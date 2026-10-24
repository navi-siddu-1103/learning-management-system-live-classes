import React, { useCallback, useEffect, useState } from 'react';

import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LogIn,
  LogOut,
  PlusCircle,
  Video,
  Award,
  Search,
  Menu,
  PlayCircle,
  Users,
  ArrowRight,
} from 'lucide-react';

import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
} from '@livekit/components-react';

import '@livekit/components-styles';
import './certificates.css';
import { ClipboardList, CheckCircle2 } from 'lucide-react';
// --------------------------------------------------
// API CONFIGURATION
// --------------------------------------------------

const API = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
).replace(/\/$/, '');

// --------------------------------------------------
// DEMO COURSES
// Used when the backend is unavailable or returns
// an empty course list.
// --------------------------------------------------

const initialCourses = [
  {
    _id: 'demo1',
    title: 'Full-Stack Web Development',
    description:
      'Build modern web apps with React, Node.js, REST APIs, and databases.',
    category: 'Development',
    price: 0,
    instructor: { name: 'LearnLive Academy' },
    lessons: [
      { title: 'Getting started' },
      { title: 'Build your first API' },
    ],
  },
  {
    _id: 'demo2',
    title: 'Cloud & Deployment Essentials',
    description:
      'Understand cloud deployment, environment variables, and reliable releases.',
    category: 'Cloud',
    price: 499,
    instructor: { name: 'LearnLive Academy' },
    lessons: [{ title: 'Cloud fundamentals' }],
  },
  {
    _id: 'demo3',
    title: 'Java Backend Engineering',
    description:
      'Explore REST design, persistence, authentication, and production practices.',
    category: 'Backend',
    price: 299,
    instructor: { name: 'LearnLive Academy' },
    lessons: [{ title: 'REST principles' }],
  },
];

// --------------------------------------------------
// API REQUEST HELPER
// --------------------------------------------------

async function request(path, options = {}) {
  const token = localStorage.getItem('learnlive_token');

  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : options.body
        ? { 'Content-Type': 'application/json' }
        : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let response;

  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      `Cannot connect to the server at ${API}. Make sure the backend is running.`
    );
  }

  // Read the response safely, including non-JSON responses.
  const text = await response.text();

  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data;
}

// --------------------------------------------------
// COURSE RESPONSE NORMALIZATION
// --------------------------------------------------

function normalizeCourses(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.courses)) {
    return data.courses;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.data?.courses)) {
    return data.data.courses;
  }

  return null;
}

// --------------------------------------------------
// MAIN APPLICATION
// --------------------------------------------------

export default function App() {
  const [courses, setCourses] = useState(initialCourses);

  const [user, setUser] = useState(null);
  const [page, setPage] = useState('Explore');
  
  const [myCourses, setMyCourses] = useState([]);
  const [myCoursesLoading, setMyCoursesLoading] = useState(false);

  const [query, setQuery] = useState('');

  const [modal, setModal] = useState(false);
  const [notice, setNotice] = useState('');

  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);

  const [quizzes, setQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);

  const [quizTitle, setQuizTitle] = useState('');
  const [quizDescription, setQuizDescription] = useState('');
  const [quizCourseId, setQuizCourseId] = useState('');

  const [newQuizQuestions, setNewQuizQuestions] = useState([
    {
      prompt: '',
      options: ['', '', '', ''],
      correctOptionIndex: 0,
      points: 1,
    },
  ]);

const [quizSaving, setQuizSaving] = useState(false);


  const [auth, setAuth] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
  });

  const [isRegister, setIsRegister] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Development',
    price: 0,
  });
  const [liveRoomName, setLiveRoomName] = useState('');
  const [liveToken, setLiveToken] = useState('');
  const [liveServerUrl, setLiveServerUrl] = useState('');
  const [liveConnecting, setLiveConnecting] = useState(false);

  // ------------------------------------------------
  // NOTIFICATIONS
  // ------------------------------------------------

  const flash = useCallback((message) => {
    setNotice(message);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;

    const timer = setTimeout(() => {
      setNotice('');
    }, 4500);

    return () => clearTimeout(timer);
  }, [notice]);

  // ------------------------------------------------
  // LOAD COURSES AND RESTORE AUTHENTICATION
  // ------------------------------------------------

  useEffect(() => {
    let active = true;

    async function initializeApp() {
      const token = localStorage.getItem('learnlive_token');

      // Load courses independently of authentication.
      try {
        const data = await request('/courses');
        const result = normalizeCourses(data);

        if (active && result !== null && result.length > 0) {
          setCourses(result);
        }
      } catch (error) {
        // Keep demo courses visible when the API fails.
        console.error('Course loading failed:', error.message);

        if (active) {
          setNotice(
            `Showing demo courses. Course API error: ${error.message}`
          );
        }
      }

      // Do not call /auth/me when there is no token.
      if (!token) {
        if (active) {
          setAuthChecking(false);
        }
        return;
      }

      try {
        const data = await request('/auth/me');

        if (!active) return;

        if (data?.user) {
          setUser(data.user);
          setPage('Explore');
        } else {
          localStorage.removeItem('learnlive_token');
          setUser(null);
        }
      } catch (error) {
        console.error('Session restoration failed:', error.message);

        if (active) {
          // Clear a token that cannot restore a valid session.
          localStorage.removeItem('learnlive_token');
          setUser(null);
        }
      } finally {
        if (active) {
          setAuthChecking(false);
        }
      }
    }

    initializeApp();

    return () => {
      active = false;
    };
  }, []);

  // ------------------------------------------------
  const joinLiveClass = async () => {
    if (!liveRoomName.trim()) {
      flash('Please enter a meeting code.');
      return;
    }

    setLiveConnecting(true);

    try {
      const data = await request('/live-classes/token', {
        method: 'POST',
        body: JSON.stringify({
          roomName: liveRoomName.trim(),
        }),
      });

      setLiveToken(data.token);
      setLiveServerUrl(data.serverUrl);
    } catch (error) {
      flash(error.message || 'Unable to join the live class.');
    } finally {
      setLiveConnecting(false);
    }
  };
  // ------------------------------------------------
  
  // ------------------------------------------------
  // LOGIN AND REGISTRATION
  // ------------------------------------------------

  async function submitAuth(event) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setNotice('');

    try {
      if (isRegister) {
        const data = await request('/auth/register', {
          method: 'POST',
          body: JSON.stringify(auth),
        });

        // Support APIs that return a token immediately
        // after registration.
        if (data?.token && data?.user) {
          localStorage.setItem('learnlive_token', data.token);

          setUser(data.user);
          setPage('Explore');

          flash(`Welcome to LearnLive, ${data.user.name}!`);
        } else {
          setIsRegister(false);

          setAuth((previous) => ({
            ...previous,
            password: '',
          }));

          flash('Account created successfully. Please sign in.');
        }
      } else {
        const data = await request('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: auth.email,
            password: auth.password,
          }),
        });

        if (!data?.token || !data?.user) {
          throw new Error(
            'Login response is missing the user or authentication token.'
          );
        }

        // Save the token before updating the authenticated UI.
        localStorage.setItem('learnlive_token', data.token);

        setUser(data.user);

        // IMPORTANT: Navigate away from the sign-in page.
        setPage('Explore');

        setAuth((previous) => ({
          ...previous,
          password: '',
        }));

        flash(`Welcome back, ${data.user.name}!`);
      }
    } catch (error) {
      console.error('Authentication failed:', error);

      flash(error.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------
  // LOGOUT
  // ------------------------------------------------

  function logout() {
    localStorage.removeItem('learnlive_token');

    setUser(null);
    setPage('Explore');

    setAuth({
      name: '',
      email: '',
      password: '',
      role: 'student',
    });

    flash('You have signed out successfully.');
  }

  // ------------------------------------------------
  // CREATE COURSE
  // ------------------------------------------------

  async function createCourse(event) {
    event.preventDefault();

    if (!user) {
      flash('Please sign in first.');
      return;
    }

    try {
      const data = await request('/courses', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      const course = data?.course || data;

      if (!course?._id) {
        throw new Error(
          'The server did not return a valid course. Check the API response.'
        );
      }

      setCourses((previous) => [course, ...previous]);

      setModal(false);

      setForm({
        title: '',
        description: '',
        category: 'Development',
        price: 0,
      });

      flash('Course published successfully.');
    } catch (error) {
      console.error('Course creation failed:', error);

      flash(`Unable to create course: ${error.message}`);
    }
  }

  // ------------------------------------------------
  // ENROLL IN COURSE
  // ------------------------------------------------

  async function enroll(course) {
    if (!user) {
      setPage('Sign in');
      flash('Please sign in to enroll in a course.');
      return;
    }

    if (String(course._id).startsWith('demo')) {
      flash(
        'This is a demo course. Add it to the backend database before enrolling.'
      );
      return;
    }

    try {
      await request(`/courses/${course._id}/enroll`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      flash(`You have enrolled in ${course.title}.`);
    } catch (error) {
        if (error.message?.toLowerCase().includes('already enrolled')) {
          setNotice('You are already enrolled in this course.');
          await loadMyLearning();
          return;
        }
        console.error('Enrollment failed:', error);
        setNotice(error.message || 'Failed to enroll in course.');
      flash(`Enrollment failed: ${error.message}`);
    }
  }

  // ------------------------------------------------
  // FILTER COURSES
  // ------------------------------------------------

  async function loadMyLearning() {
    if (!user) {
      setPage('Sign in');
      flash('Please sign in to view your courses.');
      return;
    }
    setMyCoursesLoading(true);
    try {
      const data = await request('/learning/my-learning');
      setMyCourses(data.courses || []);
    } catch (error) {
      flash(`Unable to load your courses: ${error.message}`);
    } finally {
      setMyCoursesLoading(false);
    }
  }

  async function loadQuizzes(courseId) {
    setQuizzesLoading(true);
    setQuizzes([]);
    setSelectedQuiz(null);
    setQuizAnswers({});
    setQuizResult(null);

    try {
      const data = await request(`/quizzes/course/${courseId}`);
      setQuizzes(data.quizzes || []);
    } catch (error) {
      flash(`Unable to load quizzes: ${error.message}`);
    } finally {
      setQuizzesLoading(false);
    }
  }

  const downloadCertificate = async (course) => {
    try {
      const token = localStorage.getItem('learnlive_token');

      if (!token) {
        setNotice('Please sign in again to download your certificate.');
        return;
      }

      const courseId = course._id || course.id;

      const response = await fetch(`${API}/certificates/${courseId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to download certificate.');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = downloadUrl;
      link.download = `learnlive-certificate-${courseId}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(downloadUrl);
      setNotice('Certificate downloaded successfully!');
    } catch (error) {
      console.error('Certificate download error:', error);
      setNotice(error.message || 'Unable to download certificate.');
    }
  };

  const filtered = courses.filter((course) => {
    const searchableText = [
      course.title,
      course.description,
      course.category,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchableText.includes(query.toLowerCase());
  });

  // ------------------------------------------------
  // NAVIGATION
  // ------------------------------------------------

  const nav = [
    { name: 'Explore', icon: Search },
    { name: 'My Learning', icon: BookOpen },
    { name: 'Live Classes', icon: Video },
    { name: 'Certificates', icon: Award },
    { name: 'Dashboard', icon: LayoutDashboard },
  ];

  // ------------------------------------------------
  // LOADING SCREEN
  // ------------------------------------------------

  if (authChecking) {
    return (
      <div className="app-shell">
        <main className="main-content">
          <section className="generic-page">
            <h2>Loading LearnLive...</h2>
            <p>Checking your session and loading courses.</p>
          </section>
        </main>
      </div>
    );
  }
  // ------------------------------------------------
  // RENDER APPLICATION
  // ------------------------------------------------

  return (
    <div className="app-shell">
      {/* SIDEBAR */}

      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">
            <GraduationCap size={23} />
          </span>

          <span>
            learn<span className="brand-accent">live</span>
            <small>LEARNING PLATFORM</small>
          </span>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        {nav.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.name}
              onClick={() => setPage(item.name)}
              className={`nav-item ${
                page === item.name ? 'active' : ''
              }`}
            >
              <Icon size={18} />

              {item.name}

              {item.name === 'Live Classes' && (
                <span className="live-dot" />
              )}
            </button>
          );
        })}

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">✦</div>

            <b>Keep growing</b>

            <p>Small lessons. Big progress.</p>

            <button onClick={() => setPage('Explore')}>
              Explore courses <ArrowRight size={14} />
            </button>
          </div>

          {user ? (
            <div className="profile">
              <div className="avatar">
                {user.name?.slice(0, 1).toUpperCase()}
              </div>

              <div className="profile-info">
                <b>{user.name}</b>
                <small>{user.role}</small>
              </div>

              <button
                className="icon-button"
                onClick={logout}
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              className="sign-in-link"
              onClick={() => setPage('Sign in')}
            >
              <LogIn size={17} />
              Sign in / Register
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open menu">
            <Menu size={20} />
          </button>

          <div className="breadcrumb">
            Workspace <span>/</span> <b>{page}</b>
          </div>

          <div className="topbar-right">
            <span className="status-pill">
              <span />
              Platform online
            </span>

            {user ? (
              <div className="avatar small">
                {user.name?.slice(0, 1).toUpperCase()}
              </div>
            ) : (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setPage('Sign in')}
              >
                Sign in
              </button>
            )}
          </div>
        </header>

        {notice && (
          <div className="toast" role="status">
            <span>{notice}</span>

            <button
              type="button"
              onClick={() => setNotice('')}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}

        {/* SIGN IN / REGISTER */}

        {page === 'Sign in' ? (
          <section className="auth-layout">
            <div className="auth-art">
              <span className="eyebrow">
                YOUR NEXT CHAPTER STARTS HERE
              </span>

              <h1>
                Make learning
                <br />
                your superpower.
              </h1>

              <p>
                Learn from experts, build practical skills, and move
                forward one lesson at a time.
              </p>

              <div className="art-stat">
                <div>
                  <b>Learn</b>
                  <span>at your pace</span>
                </div>

                <div>
                  <b>Connect</b>
                  <span>live with experts</span>
                </div>
              </div>
            </div>

            <form className="auth-card" onSubmit={submitAuth}>
              <div className="eyebrow">WELCOME TO LEARNLIVE</div>

              <h2>
                {isRegister ? 'Create your account' : 'Welcome back'}
              </h2>

              <p className="muted">
                {isRegister
                  ? 'Start your learning journey today.'
                  : 'Sign in to continue learning.'}
              </p>

              {isRegister && (
                <label>
                  Full name

                  <input
                    required
                    value={auth.name}
                    onChange={(event) =>
                      setAuth({
                        ...auth,
                        name: event.target.value,
                      })
                    }
                    placeholder="Your name"
                  />
                </label>
              )}

              <label>
                Email address

                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={auth.email}
                  onChange={(event) =>
                    setAuth({
                      ...auth,
                      email: event.target.value,
                    })
                  }
                  placeholder="you@example.com"
                />
              </label>

              <label>
                Password

                <input
                  required
                  minLength={8}
                  type="password"
                  autoComplete={
                    isRegister ? 'new-password' : 'current-password'
                  }
                  value={auth.password}
                  onChange={(event) =>
                    setAuth({
                      ...auth,
                      password: event.target.value,
                    })
                  }
                  placeholder="At least 8 characters"
                />
              </label>

              <button
                className="btn btn-primary full"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? 'Please wait...'
                  : isRegister
                    ? 'Create account'
                    : 'Sign in'}

                <ArrowRight size={16} />
              </button>

              <p className="switch-auth">
                {isRegister
                  ? 'Already have an account?'
                  : "Don't have an account?"}

                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setNotice('');
                  }}
                >
                  {isRegister ? 'Sign in' : 'Create one'}
                </button>
              </p>
            </form>
          </section>
        ) : null}

        {/* EXPLORE COURSES */}

        {page === 'Explore' && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow">
                  <span className="sparkle">✦</span>
                  LEARN SOMETHING EXTRAORDINARY
                </span>

                <h1>
                  Skills that move
                  <br />
                  you <em>forward.</em>
                </h1>

                <p>
                  Expert-led courses, hands-on lessons, and live
                  learning experiences designed around your goals.
                </p>

                <div className="hero-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      document
                        .getElementById('catalogue')
                        ?.scrollIntoView({ behavior: 'smooth' })
                    }
                  >
                    Explore courses <ArrowRight size={16} />
                  </button>

                  <button
                    className="btn btn-ghost"
                    onClick={() => setPage('Live Classes')}
                  >
                    <PlayCircle size={17} />
                    Discover live classes
                  </button>
                </div>

                <div className="hero-trust">
                  <div className="mini-avatars">
                    <span>J</span>
                    <span>A</span>
                    <span>M</span>
                    <span>+</span>
                  </div>

                  <div>
                    <b>Learn at your own pace</b>
                    <small>Real skills. Real progress.</small>
                  </div>
                </div>
              </div>

              <div className="hero-visual">
                <div className="visual-glow" />

                <div className="floating-tag tag-top">
                  <span className="tag-icon purple">✦</span>

                  <div>
                    <b>Keep growing</b>
                    <small>One lesson at a time</small>
                  </div>
                </div>

                <div className="course-illustration">
                  <div className="illustration-top">
                    <span>LEARNLIVE / ACADEMY</span>
                    <span className="illustration-dot">●</span>
                  </div>

                  <div className="illustration-orbit">
                    <div className="orbit-ring" />

                    <div className="orbit-core">
                      <GraduationCap size={53} />
                    </div>

                    <span className="orbit-node node-one">JS</span>
                    <span className="orbit-node node-two">AI</span>
                    <span className="orbit-node node-three">UX</span>
                  </div>

                  <div className="illustration-caption">
                    <span>YOUR LEARNING JOURNEY</span>
                    <b>Build. Learn. Become.</b>
                  </div>
                </div>

                <div className="floating-tag tag-bottom">
                  <span className="tag-icon green">✓</span>

                  <div>
                    <b>Progress unlocked</b>
                    <small>You're on your way</small>
                  </div>
                </div>
              </div>
            </section>

            <section className="stats-row">
              <div>
                <span className="stat-icon blue">
                  <BookOpen size={19} />
                </span>

                <div>
                  <b>Expert-led learning</b>
                  <small>Courses built for real skills</small>
                </div>
              </div>

              <div>
                <span className="stat-icon purple">
                  <Video size={19} />
                </span>

                <div>
                  <b>Learn live</b>
                  <small>Connect with instructors</small>
                </div>
              </div>

              <div>
                <span className="stat-icon green">
                  <Award size={19} />
                </span>

                <div>
                  <b>Show your progress</b>
                  <small>Earn completion certificates</small>
                </div>
              </div>

              <div>
                <span className="stat-icon orange">
                  <Users size={19} />
                </span>

                <div>
                  <b>Learn together</b>
                  <small>Join a growing community</small>
                </div>
              </div>
            </section>

            <section className="catalogue" id="catalogue">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">YOUR NEXT BIG THING</span>

                  <h2>
                    Explore our courses<span className="period">.</span>
                  </h2>

                  <p>
                    Find the knowledge you need to get where you want
                    to go.
                  </p>
                </div>

                <div className="catalogue-tools">
                  <label className="search-box">
                    <Search size={17} />

                    <input
                      placeholder="Search courses..."
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>

                  {(user?.role === 'instructor' ||
                    user?.role === 'admin') && (
                    <button
                      className="btn btn-primary"
                      onClick={() => setModal(true)}
                    >
                      <PlusCircle size={16} />
                      Create course
                    </button>
                  )}
                </div>
              </div>

              <div className="filter-row">
                <span className="filter-chip selected">
                  All courses <span>{filtered.length}</span>
                </span>

                <span className="filter-caption">
                  Curated for your next step
                </span>
              </div>

              <div className="course-grid">
                {filtered.map((course, index) => (
                  <article className="course-card" key={course._id}>
                    <div
                      className={`course-cover cover-${index % 4}`}
                    >
                      <div className="cover-top">
                        <span>{course.category || 'Learning'}</span>

                        <span className="cover-symbol">
                          {['◈', '⌘', '✳', '△'][index % 4]}
                        </span>
                      </div>

                      <div className="cover-art">
                        <div className="cover-ring" />

                        <span>
                          {['01', '02', '03', '04'][index % 4]}
                        </span>
                      </div>

                      <div className="cover-bottom">
                        <span>LEARNLIVE ACADEMY</span>
                        <span>✦</span>
                      </div>
                    </div>

                    <div className="course-card-body">
                      <div className="course-meta">
                        <span>{course.lessons?.length || 0} lessons</span>

                        <span className="meta-sep">·</span>

                        <span>Self-paced</span>

                        <span className="level-pill">All levels</span>
                      </div>

                      <h3>{course.title}</h3>

                      <p>{course.description}</p>

                      <div className="instructor-line">
                        <div className="instructor-avatar">
                          {(course.instructor?.name || 'L')
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>

                        <span>
                          {course.instructor?.name ||
                            'LearnLive Instructor'}
                        </span>

                        <b>
                          {Number(course.price || 0) === 0
                            ? 'Free'
                            : `₹${course.price}`}
                        </b>
                      </div>

                      <button
                        className="course-action"
                        onClick={() => enroll(course)}
                      >
                        View course <ArrowRight size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {!filtered.length && (
                <div className="empty-state">
                  No courses match "{query}". Try another search.
                </div>
              )}
            </section>
          </>
        )}

        {/* MY LEARNING */}
        
        {page === 'My Learning' && (
          <section className="generic-page my-learning-page">
            <div className="my-learning-heading">
              <div>
                <span className="eyebrow">YOUR JOURNEY</span>
                <h1>
                  My learning<span className="period">.</span>
                </h1>
                <p>Pick up where you left off and keep making progress.</p>
              </div>

              <button
                className="btn btn-primary"
                onClick={loadMyLearning}
                disabled={myCoursesLoading}
              >
                {myCoursesLoading ? 'Loading courses...' : 'Refresh courses'}
              </button>
            </div>

            {!myCoursesLoading && myCourses.length === 0 ? (
              <div className="my-learning-empty">
                <div className="my-learning-empty-icon">
                  <BookOpen size={32} />
                </div>
                <h2>Your learning journey starts here</h2>
                <p>
                  You haven't enrolled in any courses yet. Explore the catalogue
                  and find a course that matches your goals.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => setPage('Explore')}
                >
                  Explore courses <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div className="my-learning-grid">
                {myCourses.map((course) => {
                  const lessons = course.lessons || [];
                  const completedLessons = course.completedLessons || [];
                  const totalLessons = lessons.length;
                  const completedCount = completedLessons.length;
                  const progress = totalLessons
                    ? Math.min(
                        100,
                        Math.round((completedCount / totalLessons) * 100)
                      )
                    : 0;

                  return (
                    <article className="my-learning-card" key={course._id}>
                      <div className="my-learning-card-top">
                        <div className="my-learning-course-icon">
                          <BookOpen size={23} />
                        </div>
                        <span className="my-learning-status">
                          {progress === 100 ? 'Completed' : 'In progress'}
                        </span>
                      </div>

                      <div className="my-learning-card-content">
                        <h3>{course.title}</h3>
                        <p className="my-learning-description">
                          {course.description || 'Continue learning and building your skills.'}
                        </p>

                        <div className="my-learning-meta">
                          <span>
                            Instructor: {course.instructor?.name || 'Instructor not available'}
                          </span>
                          <span>
                            {completedCount} of {totalLessons} lessons
                          </span>
                        </div>

                        <div
                          className="my-learning-progress-track"
                          role="progressbar"
                          aria-valuenow={progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${course.title} completion`}
                        >
                          <div
                            className="my-learning-progress-fill"
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        <div className="my-learning-progress-label">
                          <span>Course progress</span>
                          <strong>{progress}%</strong>
                        </div>
                      </div>

                      <div className="my-learning-card-footer">
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            setSelectedCourse(course);
                            setPage('Course Details');
                          }}
                        >
                          {progress === 100 ? 'Review course' : 'Continue learning'}
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {page === 'Course Details' && selectedCourse && (
          <section className="generic-page">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSelectedCourse(null);
                setSelectedQuiz(null);
                setQuizResult(null);
                setPage('My Learning');
              }}
            >
              ← Back to My Learning
            </button>

            <h1>{selectedCourse.title}</h1>
            <p>{selectedCourse.description}</p>

            <p>
              Instructor: {selectedCourse.instructor?.name || 'Not available'}
            </p>

            <div className="quiz-section">
              <h2>Course Quizzes</h2>

              <button
                className="btn btn-secondary"
                onClick={() => loadQuizzes(selectedCourse._id)}
                disabled={quizzesLoading}
              >
                {quizzesLoading ? 'Loading quizzes...' : 'Load Quizzes'}
              </button>

              {quizzesLoading && <p>Loading available quizzes...</p>}

              {!quizzesLoading && quizzes.length === 0 && (
                <p>No quizzes found. Click "Load Quizzes" to check again.</p>
              )}

              {quizzes.map((quiz) => (
                <article key={quiz._id} className="feature-panel">
                  <div>
                    <h3>{quiz.title}</h3>
                    <p>{quiz.description || 'Test your knowledge of this course.'}</p>
                    <p>{quiz.questions?.length || 0} questions</p>

                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setSelectedQuiz(quiz);
                        setQuizAnswers({});
                        setQuizResult(null);
                      }}
                    >
                      Take Quiz
                    </button>
                  </div>
                </article>
              ))}

              {selectedQuiz && !quizResult && (
                <div className="quiz-attempt">
                  <div className="quiz-attempt-header">
                    <div>
                      <span className="quiz-eyebrow">ASSESSMENT</span>
                      <h2>{selectedQuiz.title}</h2>
                      <p>Choose the best answer for each question.</p>
                    </div>

                    <div className="quiz-question-count">
                      <span>{Object.keys(quizAnswers).length}</span>
                      <span> / {selectedQuiz.questions?.length || 0} answered</span>
                    </div>
                  </div>

                  <div className="quiz-question-list">
                    {selectedQuiz.questions?.map((question, questionIndex) => (
                      <div
                        key={question._id || questionIndex}
                        className="quiz-question-card"
                      >
                        <div className="quiz-question-top">
                          <span className="quiz-number">
                            Question {String(questionIndex + 1).padStart(2, '0')}
                          </span>

                          <span className="quiz-points">
                            {question.points || 1}{' '}
                            {(question.points || 1) === 1 ? 'point' : 'points'}
                          </span>
                        </div>

                        <h3 className="quiz-question-title">
                          {question.prompt}
                        </h3>

                        <div className="quiz-options-list">
                          {question.options?.map((option, optionIndex) => {
                            const isSelected =
                              quizAnswers[questionIndex] === optionIndex;

                            return (
                              <label
                                key={optionIndex}
                                className={`quiz-option-card ${
                                  isSelected ? 'selected' : ''
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`question-${questionIndex}`}
                                  value={optionIndex}
                                  checked={isSelected}
                                  onChange={() =>
                                    setQuizAnswers((previous) => ({
                                      ...previous,
                                      [questionIndex]: optionIndex,
                                    }))
                                  }
                                />

                                <span className="quiz-option-letter">
                                  {String.fromCharCode(65 + optionIndex)}
                                </span>

                                <span className="quiz-option-text">
                                  {option}
                                </span>

                                <span className="quiz-option-indicator">
                                  {isSelected ? '✓' : ''}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="quiz-submit-panel">
                    <div>
                      <strong>
                        {Object.keys(quizAnswers).length ===
                        (selectedQuiz.questions?.length || 0)
                          ? 'All questions answered'
                          : `${(selectedQuiz.questions?.length || 0) -
                              Object.keys(quizAnswers).length} questions remaining`}
                      </strong>

                      <p>Review your answers before submitting.</p>
                    </div>

                    <button
                      className="btn btn-primary quiz-submit-button"
                      disabled={quizSubmitting}
                      onClick={async () => {
                        const questionCount = selectedQuiz.questions?.length || 0;

                        if (Object.keys(quizAnswers).length !== questionCount) {
                          flash('Please answer every question before submitting.');
                          return;
                        }

                        setQuizSubmitting(true);

                        try {
                          const result = await request(
                            `/quizzes/${selectedQuiz._id}/submit`,
                            {
                              method: 'POST',
                              body: JSON.stringify({
                                answers: Object.entries(quizAnswers).map(
                                  ([questionIndex, optionIndex]) => ({
                                    questionIndex: Number(questionIndex),
                                    optionIndex,
                                  })
                                ),
                              }),
                            }
                          );

                          setQuizResult(result);
                          flash('Quiz submitted successfully!');
                        } catch (error) {
                          flash(`Quiz submission failed: ${error.message}`);
                        } finally {
                          setQuizSubmitting(false);
                        }
                      }}
                    >
                      {quizSubmitting ? 'Submitting...' : 'Submit Assessment'}
                    </button>
                  </div>
                </div>
              )}

              {selectedQuiz && quizResult && (
                 <div className="quiz-result">
                  <div className="quiz-result-card">
                    <div className="quiz-result-icon">
                      {quizResult.percentage >= 70 ? '✓' : '↻'}
                    </div>

                    <span className="quiz-result-eyebrow">
                      ASSESSMENT COMPLETED
                    </span>

                    <h2>
                      {quizResult.percentage === 100
                        ? 'Perfect Score!'
                        : quizResult.percentage >= 70
                        ? 'Well Done!'
                        : 'Keep Practising!'}
                    </h2>

                    <p className="quiz-result-description">
                      {quizResult.percentage === 100
                        ? 'Excellent work! You answered every question correctly.'
                        : quizResult.percentage >= 70
                        ? 'Great effort! Keep building your knowledge.'
                        : 'Review the course lessons and try again to improve your score.'}
                    </p>

                    <div className="quiz-result-score">
                      <div className="quiz-result-percentage">
                        <strong>{quizResult.percentage}%</strong>
                        <span>Overall score</span>
                      </div>

                      <div className="quiz-result-divider" />

                      <div className="quiz-result-marks">
                        <strong>
                          {quizResult.score}/{quizResult.total}
                        </strong>
                        <span>Marks earned</span>
                      </div>
                    </div>

                    <div className="quiz-result-progress">
                      <div
                        className="quiz-result-progress-fill"
                        style={{
                          width: `${Math.min(100, Math.max(0, quizResult.percentage))}%`,
                        }}
                      />
                    </div>

                    <p className="quiz-result-footer">
                      Quiz: {selectedQuiz.title}
                    </p>

                    <div className="quiz-result-actions">
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setSelectedQuiz(null);
                          setQuizAnswers({});
                          setQuizResult(null);
                        }}
                      >
                        Back to Quizzes
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setSelectedQuiz(null);
                          setQuizAnswers({});
                          setQuizResult(null);
                          setQuizzes([]);
                        }}
                      >
                        Close Results
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <h2>Lessons</h2>

            {selectedCourse.lessons?.length > 0 ? (
              <div>
                {selectedCourse.lessons.map((lesson, index) => (
                  <article key={lesson._id || index}>
                    <h3>
                      {index + 1}. {lesson.title || `Lesson ${index + 1}`}
                    </h3>

                    <p>{lesson.description || 'No description available.'}</p>

                    {lesson.videoUrl && (
                      <video controls width="100%">
                        <source src={lesson.videoUrl} />
                        Your browser does not support video playback.
                      </video>
                    )}
                    <div className="lesson-actions">
                      <button
                        className="btn btn-primary"
                        onClick={async () => {
                          try {
                            const result = await request(
                              `/learning/${selectedCourse._id}/lessons/${lesson._id}/progress`,
                              {
                                method: 'POST',
                                body: JSON.stringify({ completed: true }),
                              }
                            );

                            setSelectedCourse((previous) => ({
                              ...previous,
                              completedLessons: result.completedLessons,
                              progress: result.progress,
                            }));

                            flash('Lesson marked as completed!');
                          } catch (error) {
                            flash(`Unable to update lesson: ${error.message}`);
                          }
                        }}
                      >
                        {(selectedCourse.completedLessons || []).includes(String(lesson._id))
                          ? 'Completed ✓'
                          : 'Mark as completed'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p>No lessons have been added to this course yet.</p>
            )}
          </section>
        )}

        {/* INSTRUCTOR QUIZ MANAGEMENT */}
        {page === 'Quiz Management' && (
          <section className="generic-page quiz-management-page">
            <button
              className="btn btn-secondary"
              onClick={() => setPage('Dashboard')}
            >
              ← Back to Dashboard
            </button>

            <div className="quiz-management-header">
              <span className="eyebrow">INSTRUCTOR WORKSPACE</span>

              <h1>
                Quiz Management<span className="period">.</span>
              </h1>

              <p>Create, organize, and manage assessments for your courses.</p>
            </div>

            <div className="quiz-management-form">
              <div className="quiz-form-header">
                <div>
                  <span className="eyebrow">ASSESSMENT BUILDER</span>
                  <h2>Create a new quiz</h2>
                  <p>Set up your quiz and add questions for your students.</p>
                </div>

                <div className="quiz-form-icon" aria-hidden="true">
                  <ClipboardList size={28} />
                </div>
              </div>

              {/* QUIZ DETAILS */}
              <div className="quiz-form-grid">
                <label className="quiz-form-field">
                  Select course
                  <select
                    className="quiz-input"
                    value={quizCourseId}
                    onChange={(e) => setQuizCourseId(e.target.value)}
                  >
                    <option value="">Select a course</option>

                    {courses.map((course) => (
                      <option key={course._id} value={course._id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="quiz-form-field">
                  Quiz title
                  <input
                    className="quiz-input"
                    type="text"
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    placeholder="e.g. Java Fundamentals Quiz"
                  />
                </label>

                <label className="quiz-form-field quiz-description-field">
                  Description
                  <textarea
                    className="quiz-input quiz-textarea"
                    value={quizDescription}
                    onChange={(e) => setQuizDescription(e.target.value)}
                    placeholder="Describe what students will be assessed on"
                    rows={4}
                  />
                </label>
              </div>


              {/* QUESTIONS HEADER */}
              <div className="quiz-builder-heading">
                <div>
                  <h3>Questions</h3>
                  <p>
                    Add multiple-choice questions and select the correct answer.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setNewQuizQuestions((previous) => [
                      ...previous,
                      {
                        prompt: '',
                        options: ['', '', '', ''],
                        correctOptionIndex: 0,
                        points: 1,
                      },
                    ])
                  }
                >
                  + Add question
                </button>
              </div>

              {/* QUESTION EDITORS */}
              <div className="quiz-builder-list">
                {newQuizQuestions.map((question, questionIndex) => (
                  <article
                    className="quiz-builder-question"
                    key={questionIndex}
                  >
                    <div className="quiz-builder-question-heading">
                      <div className="quiz-question-number">
                        <span>
                          QUESTION {String(questionIndex + 1).padStart(2, '0')}
                        </span>

                        <h4>Question {questionIndex + 1}</h4>
                      </div>

                      <div className="quiz-question-heading-actions">
                        <span className="quiz-points-badge">
                          {question.points} {Number(question.points) === 1 ? 'point' : 'points'}
                        </span>

                        {newQuizQuestions.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-secondary quiz-remove-button"
                            onClick={() =>
                              setNewQuizQuestions((previous) =>
                                previous.filter(
                                  (_, index) => index !== questionIndex
                                )
                              )
                            }
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    {/* QUESTION TEXT */}
                    <label className="quiz-form-field">
                      Question text
                      <textarea
                        className="quiz-input quiz-textarea"
                        value={question.prompt}
                        onChange={(e) =>
                          setNewQuizQuestions((previous) =>
                            previous.map((item, index) =>
                              index === questionIndex
                                ? { ...item, prompt: e.target.value }
                                : item
                            )
                          )
                        }
                        placeholder="Enter your question here..."
                        rows={2}
                      />
                    </label>

                    {/* ANSWER OPTIONS */}
                    <div className="quiz-options-heading">
                      <h5>Answer options</h5>
                      <span>Enter four possible answers</span>
                    </div>

                    <div className="quiz-builder-options">
                      {question.options.map((option, optionIndex) => (
                        <label
                          className="quiz-form-field quiz-option-field"
                          key={optionIndex}
                        >
                          <span>
                            Option {String.fromCharCode(65 + optionIndex)}
                          </span>

                          <div className="quiz-option-input-wrap">
                            <span className="quiz-option-letter">
                              {String.fromCharCode(65 + optionIndex)}
                            </span>

                            <input
                              className="quiz-input"
                              value={option}
                              onChange={(e) =>
                                setNewQuizQuestions((previous) =>
                                  previous.map((item, index) =>
                                    index === questionIndex
                                      ? {
                                          ...item,
                                          options: item.options.map((value, i) =>
                                            i === optionIndex
                                              ? e.target.value
                                              : value
                                          ),
                                        }
                                      : item
                                  )
                                )
                              }
                              placeholder={`Enter option ${String.fromCharCode(
                                65 + optionIndex
                              )}`}
                            />
                          </div>
                        </label>
                      ))}
                    </div>

                    {/* CORRECT ANSWER AND POINTS */}
                    <div className="quiz-question-settings">
                      <label className="quiz-form-field">
                        Correct answer
                        <select
                          className="quiz-input"
                          value={question.correctOptionIndex}
                          onChange={(e) =>
                            setNewQuizQuestions((previous) =>
                              previous.map((item, index) =>
                                index === questionIndex
                                  ? {
                                      ...item,
                                      correctOptionIndex: Number(e.target.value),
                                    }
                                  : item
                              )
                            )
                          }
                        >
                          {question.options.map((_, optionIndex) => (
                            <option key={optionIndex} value={optionIndex}>
                              Option {String.fromCharCode(65 + optionIndex)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="quiz-form-field">
                        Points
                        <input
                          className="quiz-input"
                          type="number"
                          min="1"
                          step="1"
                          value={question.points}
                          onChange={(e) =>
                            setNewQuizQuestions((previous) =>
                              previous.map((item, index) =>
                                index === questionIndex
                                  ? {
                                      ...item,
                                      points:
                                        e.target.value === ''
                                          ? ''
                                          : Number(e.target.value),
                                    }
                                  : item
                              )
                            )
                          }
                        />
                      </label>
                    </div>
                  </article>
                ))}
              </div>

              {/* FORM FOOTER */}
              <div className="quiz-builder-footer">
                <div className="quiz-builder-summary">
                  <span>
                    {newQuizQuestions.length}{' '}
                    {newQuizQuestions.length === 1 ? 'question' : 'questions'}
                  </span>

                  <span>
                    {newQuizQuestions.reduce(
                      (total, question) =>
                        total + (Number(question.points) > 0 ? Number(question.points) : 0),
                      0
                    )}{' '}
                    total points
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-primary quiz-save-button"
                  disabled={quizSaving}
                  onClick={async () => {
                    if (!quizCourseId || !quizTitle.trim()) {
                      flash('Please select a course and enter a quiz title.');
                      return;
                    }

                    if (newQuizQuestions.length === 0) {
                      flash('Please add at least one question.');
                      return;
                    }

                    const invalidQuestion = newQuizQuestions.some(
                      (question) =>
                        !question.prompt.trim() ||
                        question.options.length !== 4 ||
                        question.options.some(
                          (option) =>
                            typeof option !== 'string' || !option.trim()
                        ) ||
                        !Number.isInteger(Number(question.points)) ||
                        Number(question.points) < 1
                    );

                    if (invalidQuestion) {
                      flash(
                        'Complete every question and all four options. Points must be a positive whole number.'
                      );
                      return;
                    }

                    setQuizSaving(true);

                    try {
                      await request('/quizzes', {
                        method: 'POST',
                        body: JSON.stringify({
                          courseId: quizCourseId,
                          title: quizTitle.trim(),
                          description: quizDescription.trim(),
                          questions: newQuizQuestions.map((question) => ({
                            prompt: question.prompt.trim(),
                            options: question.options.map((option) => option.trim()),
                            correctOptionIndex: Number(question.correctOptionIndex),
                            points: Number(question.points),
                          })),
                        }),
                      });

                      flash('Quiz created successfully!');

                      setQuizTitle('');
                      setQuizDescription('');
                      setQuizCourseId('');

                      setNewQuizQuestions([
                        {
                          prompt: '',
                          options: ['', '', '', ''],
                          correctOptionIndex: 0,
                          points: 1,
                        },
                      ]);
                    } catch (error) {
                      flash(`Unable to create quiz: ${error.message}`);
                    } finally {
                      setQuizSaving(false);
                    }
                  }}
                >
                  {quizSaving ? (
                    'Saving quiz...'
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Save Quiz
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        )}


        {/* LIVE CLASSES */}

        {page === 'Live Classes' && (
          <section className="generic-page">
            <span className="eyebrow">LEARN TOGETHER</span>

            <h1>
              Live Classes<span className="period">.</span>
            </h1>

            {!liveToken ? (
              <>
                <p>Join your instructor and classmates for live video and audio sessions.</p>

                <div className="feature-panel">
                  <div className="feature-icon">
                    <Video size={25} />
                  </div>

                  <div>
                    <h3>Join a Live Class</h3>
                    <p>Enter the meeting code provided by your instructor.</p>

                    <input
                      type="text"
                      placeholder="Enter meeting code"
                      value={liveRoomName}
                      onChange={(e) => setLiveRoomName(e.target.value)}
                      disabled={liveConnecting}
                    />

                    <button
                      className="btn btn-primary"
                      onClick={joinLiveClass}
                      disabled={liveConnecting}
                    >
                      {liveConnecting ? 'Connecting...' : 'Join Class'}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="live-classroom">
                <h2>Room: {liveRoomName}</h2>

                <LiveKitRoom
                  token={liveToken}
                  serverUrl={liveServerUrl}
                  connect={true}
                  audio={true}
                  video={true}
                  onDisconnected={() => {
                    setLiveToken('');
                    setLiveServerUrl('');
                  }}
                  style={{ height: '75vh' }}
                >
                  <VideoConference chatMessageFormatter={undefined} />
                  <RoomAudioRenderer />
                </LiveKitRoom>

                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setLiveToken('');
                    setLiveServerUrl('');
                  }}
                >
                  Leave Class
                </button>
              </div>
            )}
          </section>
        )}
        
        {/* CERTIFICATES */}
        {page === 'Certificates' && (
          <section className="generic-page">
            <span className="eyebrow">YOUR ACHIEVEMENTS</span>
            <h1>
              Certificates<span className="period">.</span>
            </h1>
            <p>Download certificates for courses you have successfully completed.</p>

            {!user ? (
              <p>Please sign in to view your certificates.</p>
            ) : myCourses.filter((course) => course.progress === 100).length === 0 ? (
              <div className="feature-panel">
                <div className="feature-icon">
                  <Award size={25} />
                </div>
                <div>
                  <h3>No certificates yet</h3>
                  <p>Complete all lessons in a course to earn your certificate.</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => setPage('My Learning')}
                  >
                    View My Learning
                  </button>
                </div>
              </div>
            ) : (
              <div className="certificate-grid">
                {myCourses
                  .filter((course) => course.progress === 100)
                  .map((course) => (
                    <article className="certificate-card" key={course._id}>
                      <div className="certificate-card-top">
                        <div className="certificate-card-icon">
                          <Award size={26} />
                        </div>
                        <span className="certificate-badge">Completed</span>
                      </div>

                      <div className="certificate-card-body">
                        <h3>{course.title}</h3>

                        <div className="certificate-meta">
                          <div>
                            <small>Instructor</small>
                            <span>{course.instructor?.name || 'Not available'}</span>
                          </div>
                          <div>
                            <small>Lessons completed</small>
                            <span>{course.totalLessons}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        className="btn btn-primary certificate-download-btn"
                        onClick={() => downloadCertificate(course)}
                      >
                        <Award size={18} />
                        Download Certificate
                      </button>
                    </article>
                  ))}
              </div>
            )}
          </section>
        )}

        {/* DASHBOARD */}

        {page === 'Dashboard' && (
          <section className="generic-page">
            <span className="eyebrow">YOUR WORKSPACE</span>

            <h1>
              Dashboard<span className="period">.</span>
            </h1>

            <p>
              {user
                ? `Signed in as ${user.name} (${user.role}).`
                : 'Sign in to access your learning dashboard.'}
            </p>

            {user?.role === 'instructor' ||
            user?.role === 'admin' ? (
              <div className="instructor-dashboard-actions">
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    try {
                      const data = await request('/instructor/metrics');

                      flash(
                        `${data.courseCount} courses · ${data.enrollmentCount} enrollments`
                      );
                    } catch (error) {
                      flash(`Unable to load metrics: ${error.message}`);
                    }
                  }}
                >
                  Load instructor metrics
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => setPage('Quiz Management')}
                >
                  Manage Quizzes
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => setPage(user ? 'My Learning' : 'Sign in')}
              >
                {user ? 'View my learning' : 'Sign in'}
                <ArrowRight size={16} />
              </button>
            )}
          </section>
        )}
      </main>

      {/* CREATE COURSE MODAL */}

      {modal && (
        <div
          className="modal-backdrop"
          onClick={() => setModal(false)}
        >
          <form
            className="modal"
            onSubmit={createCourse}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setModal(false)}
            >
              ×
            </button>

            <span className="eyebrow">INSTRUCTOR STUDIO</span>

            <h2>Create a course</h2>

            <label>
              Course title

              <input
                required
                value={form.title}
                onChange={(event) =>
                  setForm({
                    ...form,
                    title: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Description

              <textarea
                required
                rows="3"
                value={form.description}
                onChange={(event) =>
                  setForm({
                    ...form,
                    description: event.target.value,
                  })
                }
              />
            </label>

            <div className="form-row">
              <label>
                Category

                <input
                  value={form.category}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      category: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Price (₹)

                <input
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      price: Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>

            <button className="btn btn-primary full" type="submit">
              Publish course <ArrowRight size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}