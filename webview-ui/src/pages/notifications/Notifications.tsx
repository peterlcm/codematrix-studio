import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './notifications.css';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'WORKFLOW_UPDATE' | 'TEAM_INVITE' | 'AI_COMPLETION' | 'SYSTEM';
  read: boolean;
  projectId?: string;
  projectName?: string;
  createdAt: string;
  actionUrl?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const TYPE_LABELS: Record<string, string> = {
  WORKFLOW_UPDATE: 'Workflow',
  TEAM_INVITE: 'Team',
  AI_COMPLETION: 'AI',
  SYSTEM: 'System',
};

const TYPE_ICONS: Record<string, string> = {
  WORKFLOW_UPDATE: '⚙️',
  TEAM_INVITE: '👥',
  AI_COMPLETION: '🤖',
  SYSTEM: 'ℹ️',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const loadNotifications = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/notifications`);
      if (response.data.success) {
        setNotifications(response.data.data);
      } else {
        setError(response.data.error || 'Failed to load notifications');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      await axios.post(`${API_BASE_URL}/api/v1/notifications/${notificationId}/read`);
      setNotifications(notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      ));
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/v1/notifications/mark-all-read`);
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to mark all as read');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/v1/notifications/${notificationId}`);
      setNotifications(notifications.filter(n => n.id !== notificationId));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete notification');
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    } else if (notification.projectId) {
      navigate(`/projects/${notification.projectId}`);
    }
  };

  const filteredNotifications = notifications.filter(n =>
    filter === 'all' || !n.read
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-content">
          <h1>
            Notifications
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount} unread</span>
            )}
          </h1>
          <div className="header-actions">
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="btn btn-secondary btn-sm">
                Mark All Read
              </button>
            )}
            <button onClick={() => navigate(-1)} className="btn btn-secondary">
              ← Back
            </button>
          </div>
        </div>
      </header>

      <main className="page-main">
        {error && <div className="error-message">{error}</div>}

        <div className="notifications-container">
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
              <span className="count">{notifications.length}</span>
            </button>
            <button
              className={`filter-tab ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => setFilter('unread')}
            >
              Unread
              <span className="count">{unreadCount}</span>
            </button>
          </div>

          {filteredNotifications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔔</div>
              <h3>No notifications</h3>
              <p>You're all caught up! Check back later for updates.</p>
            </div>
          ) : (
            <div className="notifications-list">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon">
                    {TYPE_ICONS[notification.type] || '🔔'}
                  </div>
                  <div className="notification-content">
                    <div className="notification-header">
                      <h4>{notification.title}</h4>
                      <div className="notification-actions">
                        {!notification.read && <span className="unread-dot"></span>}
                        <button
                          className="btn-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <p className="notification-message">{notification.message}</p>
                    <div className="notification-footer">
                      <span className="type-badge">{TYPE_LABELS[notification.type]}</span>
                      {notification.projectName && (
                        <span className="project-badge">
                          📁 {notification.projectName}
                        </span>
                      )}
                      <span className="time">
                        {new Date(notification.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
