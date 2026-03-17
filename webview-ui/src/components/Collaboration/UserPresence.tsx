import { useState, useEffect } from 'react';

interface OnlineUser {
  userId: string;
  name?: string;
  avatarUrl?: string;
}

export function UserPresence() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  // In a real implementation, this would connect to WebSocket
  // and receive updates from the backend
  useEffect(() => {
    // Placeholder: simulate online users
    setOnlineUsers([
      { userId: '1', name: 'You' },
    ]);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-vscode-editorWidget-foreground">Online:</span>
      <div className="flex -space-x-2">
        {onlineUsers.map((user) => (
          <div
            key={user.userId}
            className="w-6 h-6 rounded-full bg-vscode-button-background flex items-center justify-center text-xs border-2 border-vscode-editor-background"
            title={user.name || 'User'}
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full" />
            ) : (
              <span className="text-vscode-button-foreground">
                {(user.name || 'U')[0].toUpperCase()}
              </span>
            )}
            <span className="absolute w-2 h-2 bg-green-500 rounded-full -bottom-0.5 -right-0.5 border border-vscode-editor-background" />
          </div>
        ))}
      </div>
    </div>
  );
}