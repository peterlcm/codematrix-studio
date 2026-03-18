import { useEffect, useState } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Import all pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ProjectList from './pages/projects/ProjectList';
import CreateProject from './pages/projects/CreateProject';
import ProjectDetail from './pages/projects/ProjectDetail';
import ProjectSettings from './pages/projects/ProjectSettings';
import Settings from './pages/settings/Settings';
import WorkflowCreate from './pages/workflow/WorkflowCreate';
import WorkflowDetail from './pages/workflow/WorkflowDetail';
import WorkflowStage from './pages/workflow/WorkflowStage';
import AISettingsPage from './pages/ai/AISettings';
import Notifications from './pages/notifications/Notifications';
import Dashboard from './pages/dashboard/Dashboard';
import './styles/index.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3001`;

// Setup axios defaults
const token = localStorage.getItem('codematrix-token');
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export default function BrowserApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('codematrix-token');
  });

  useEffect(() => {
    // Add dark mode class based on system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }

    // Check if token is valid on app load
    const checkAuth = async () => {
      const currentToken = localStorage.getItem('codematrix-token');
      if (!currentToken) {
        setIsAuthenticated(false);
        return;
      }

      try {
        await axios.get(`${API_BASE_URL}/api/v1/users/me`);
        setIsAuthenticated(true);
      } catch (err) {
        localStorage.removeItem('codematrix-token');
        delete axios.defaults.headers.common['Authorization'];
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route path="/auth/login" element={
          isAuthenticated ? <Navigate to="/projects" replace /> : <Login />
        } />
        <Route path="/auth/register" element={
          isAuthenticated ? <Navigate to="/projects" replace /> : <Register />
        } />
        <Route path="/auth/forgot-password" element={
          isAuthenticated ? <Navigate to="/projects" replace /> : <ForgotPassword />
        } />

        {/* Protected Routes */}
        <Route path="/" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth/login" replace />
        } />

        <Route path="/dashboard" element={
          isAuthenticated ? <Dashboard /> : <Navigate to="/auth/login" replace />
        } />

        {/* Project Routes */}
        <Route path="/projects" element={
          isAuthenticated ? <ProjectList /> : <Navigate to="/auth/login" replace />
        } />
        <Route path="/projects/create" element={
          isAuthenticated ? <CreateProject /> : <Navigate to="/auth/login" replace />
        } />
        <Route path="/projects/:id" element={
          isAuthenticated ? <ProjectDetail /> : <Navigate to="/auth/login" replace />
        } />
        <Route path="/projects/:id/settings" element={
          isAuthenticated ? <ProjectSettings /> : <Navigate to="/auth/login" replace />
        } />

        {/* Workflow Routes */}
        <Route path="/workflow/create/:id" element={
          isAuthenticated ? <WorkflowCreate /> : <Navigate to="/auth/login" replace />
        } />
        <Route path="/workflow/:id" element={
          isAuthenticated ? <WorkflowDetail /> : <Navigate to="/auth/login" replace />
        } />
        <Route path="/workflow/:id/stage/:stageId" element={
          isAuthenticated ? <WorkflowStage /> : <Navigate to="/auth/login" replace />
        } />

        {/* Settings Routes */}
        <Route path="/settings" element={
          isAuthenticated ? <Settings /> : <Navigate to="/auth/login" replace />
        } />

        {/* AI Settings */}
        <Route path="/settings/ai" element={
          isAuthenticated ? <AISettingsPage /> : <Navigate to="/auth/login" replace />
        } />

        {/* Notifications */}
        <Route path="/notifications" element={
          isAuthenticated ? <Notifications /> : <Navigate to="/auth/login" replace />
        } />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
