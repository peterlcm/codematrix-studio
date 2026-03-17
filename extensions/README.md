# CodeMatrix Studio - VS Code Extension

## Installation

1. Build the extension:
   ```bash
   pnpm build
   ```

2. Package the extension:
   ```bash
   pnpm package
   ```

3. Install the `.vsix` file in VS Code

## Development

```bash
# Watch mode for development
pnpm dev
```

## Features

- Initialize new AI-collaborative projects
- View workflow progress in sidebar
- Open workflow webview
- Approve/request revisions for stages
- Real-time collaboration

## Commands

- `codematrix.initProject` - Initialize a new project
- `codematrix.openWorkflow` - Open workflow for a project
- `codematrix.approveStage` - Approve current stage
- `codematrix.requestRevision` - Request revision for current stage
- `codematrix.login` - Login to backend
- `codematrix.logout` - Logout