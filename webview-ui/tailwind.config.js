/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vscode: {
          background: 'var(--vscode-editor-background)',
          foreground: 'var(--vscode-editor-foreground)',
          'editorWidget-background': 'var(--vscode-editorWidget-background)',
          'editorWidget-foreground': 'var(--vscode-editorWidget-foreground)',
          'input-background': 'var(--vscode-input-background)',
          'input-foreground': 'var(--vscode-input-foreground)',
          'button-background': 'var(--vscode-button-background)',
          'button-foreground': 'var(--vscode-button-foreground)',
          'list-activeSelectionBackground': 'var(--vscode-list-activeSelectionBackground)',
          'list-hoverBackground': 'var(--vscode-list-hoverBackground)',
          'statusBar-background': 'var(--vscode-statusBar-background)',
          'statusBar-foreground': 'var(--vscode-statusBar-foreground)',
        }
      }
    },
  },
  plugins: [],
}