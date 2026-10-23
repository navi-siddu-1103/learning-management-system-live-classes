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
      console.error('Enrollment failed:', error);

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
      const data = await request('/courses/my-learning');
      setMyCourses(data.courses || []);
    } catch (error) {
      flash(`Unable to load your courses: ${error.message}`);
    } finally {
      setMyCoursesLoading(false);
    }
  }

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
          <section className="generic-page">
            <span className="eyebrow">YOUR JOURNEY</span>
            <h1>My learning<span className="period">.</span></h1>

            <button
              className="btn btn-primary"
              onClick={loadMyLearning}
              disabled={myCoursesLoading}
            >
              {myCoursesLoading ? 'Loading...' : 'Load my courses'}
            </button>

            {myCourses.length === 0 && !myCoursesLoading ? (
              <p>You haven't enrolled in any courses yet.</p>
            ) : (
              <div className="course-grid">
                {myCourses.map(course => (
                  <article className="course-card" key={course._id}>
                    <div className="course-card-body">
                      <h3>{course.title}</h3>
                      <p>{course.description}</p>
                      <p>Instructor: {course.instructor?.name || 'Unknown'}</p>
                      <p>Lessons: {course.lessons?.length || 0}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* LIVE CLASSES */}

        {page === 'Live Classes' && (
          <section className="generic-page">
            <span className="eyebrow">LEARN TOGETHER</span>

            <h1>
              Live classes<span className="period">.</span>
            </h1>

            <div className="feature-panel">
              <div className="feature-icon">
                <Video size={25} />
              </div>

              <div>
                <h3>Learn in real time</h3>

                <p>
                  Live classrooms require WebRTC signaling and
                  STUN/TURN configuration or a service such as LiveKit.
                  The backend also needs to support the live-class
                  features you want to offer.
                </p>

                <button
                  className="btn btn-primary"
                  onClick={() =>
                    flash(
                      'Live video requires WebRTC signaling and STUN/TURN or LiveKit configuration.'
                    )
                  }
                >
                  Open live room <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* CERTIFICATES */}

        {page === 'Certificates' && (
          <section className="generic-page">
            <span className="eyebrow">YOUR ACHIEVEMENTS</span>

            <h1>
              Certificates<span className="period">.</span>
            </h1>

            <p>
              Complete your courses to earn certificates. Certificate
              generation must be connected to your backend.
            </p>

            <div className="feature-panel">
              <div className="feature-icon">
                <Award size={25} />
              </div>

              <div>
                <h3>Every milestone matters</h3>

                <p>
                  Certificates should be issued only after the backend
                  confirms course completion.
                </p>
              </div>
            </div>
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
              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    const data = await request('/instructor/metrics');

                    flash(
                      `${data.courseCount} courses · ${data.enrollmentCount} enrollments`
                    );
                  } catch (error) {
                    flash(
                      `Unable to load metrics: ${error.message}`
                    );
                  }
                }}
              >
                Load instructor metrics
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() =>
                  setPage(user ? 'My Learning' : 'Sign in')
                }
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