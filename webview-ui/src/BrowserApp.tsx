import { useState, useEffect } from 'react';
import axios from 'axios';
import './styles/index.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type Page = 'login' | 'register' | 'projects' | 'workflow';

interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  owner: User;
  createdAt: string;
  archivedAt: string | null;
}

export default function BrowserApp() {
  const [page, setPage] = useState<Page>('login');
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');

  // Check auth on load
  useEffect(() => {
    const token = localStorage.getItem('codematrix-token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      checkAuth();
      loadProjects();
    } else {
      setPage('login');
    }
  }, []);

  const checkAuth = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/users/me`);
      if (res.data.success) {
        setUser(res.data.data);
        setPage('projects');
      }
    } catch (err) {
      localStorage.removeItem('codematrix-token');
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API_BASE_URL}/api/v1/users/login`, {
        email: loginEmail,
        password: loginPassword,
      });

      if (res.data.success) {
        const { token, user } = res.data.data;
        localStorage.setItem('codematrix-token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(user);
        setPage('projects');
      } else {
        setError(res.data.error);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API_BASE_URL}/api/v1/users/register`, {
        name: registerName,
        email: registerEmail,
        password: registerPassword,
      });

      if (res.data.success) {
        const { token, user } = res.data.data;
        localStorage.setItem('codematrix-token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(user);
        setPage('projects');
      } else {
        setError(res.data.error);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/projects`);
      if (res.data.success) {
        setProjects(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load projects');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('codematrix-token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setPage('login');
  };

  if (page === 'login' || page === 'register') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
            {page === 'login' ? 'Login to CodeMatrix' : 'Register for CodeMatrix'}
          </h1>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
              {error}
            </div>
          )}

          <form onSubmit={page === 'login' ? handleLogin : handleRegister}>
            {page === 'register' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Your Name"
                  required
                />
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={page === 'login' ? loginEmail : registerEmail}
                onChange={(e) =>
                  page === 'login' ? setLoginEmail(e.target.value) : setRegisterEmail(e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={page === 'login' ? loginPassword : registerPassword}
                onChange={(e) =>
                  page === 'login' ? setLoginPassword(e.target.value) : setRegisterPassword(e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Minimum 8 characters"
                minLength={8}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {loading ? 'Loading...' : page === 'login' ? 'Login' : 'Register'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
            {page === 'login' ? (
              <>
                Don't have an account?{' '}
                <button
                  onClick={() => { setError(''); setPage('register'); }}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => { setError(''); setPage('login'); }}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Login
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (page === 'projects') {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        {/* Header */}
        <nav className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  CodeMatrix Studio
                </h1>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {user?.name || user?.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Projects List */}
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Projects</h2>
            <button
              onClick={async () => {
                // TODO: Create project modal
                alert('Create project functionality coming soon! You can create it from VS Code extension.');
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              New Project
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
              {error}
            </div>
          )}

          {projects.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <p className="text-gray-500 dark:text-gray-400">No projects yet. Create your first project from VS Code extension!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {project.name}
                  </h3>
                  {project.description && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <span>Owner: {project.owner.name || project.owner.email}</span>
                    {project.archivedAt && (
                      <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded text-xs">
                        Archived
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      // Open in VS Code or web workflow
                      window.open(`${API_BASE_URL.replace('/api', '')}/workflow/${project.id}`, '_blank');
                    }}
                    className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-md transition-colors"
                  >
                    Open Workflow
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  return null;
}
