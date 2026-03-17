import { ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-vscode-focusBorder',
        {
          'bg-vscode-button-background text-vscode-button-foreground hover:bg-vscode-button-hoverBackground':
            variant === 'primary',
          'bg-vscode-editorWidget-background text-vscode-foreground hover:bg-vscode-list-hoverBackground':
            variant === 'secondary',
          'bg-red-700 text-white hover:bg-red-600': variant === 'danger',
          'bg-transparent text-vscode-foreground hover:bg-vscode-editorWidget-background':
            variant === 'ghost',
          'px-2 py-1 text-xs': size === 'sm',
          'px-4 py-2 text-sm': size === 'md',
          'px-6 py-3 text-base': size === 'lg',
          'opacity-50 cursor-not-allowed': disabled,
        },
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}