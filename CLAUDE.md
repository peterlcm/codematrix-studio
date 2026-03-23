# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

本文档为 Claude Code (claude.ai/code) 在本代码库工作时提供指导。

## 常用命令

### 安装依赖
```bash
pnpm install:all          # 安装所有工作空间的依赖
```

### 开发
```bash
pnpm dev                  # 启动所有服务开发模式
pnpm dev:extension        # VS Code 扩展监听模式
pnpm dev:backend          # 后端 tsx 监听模式
pnpm dev:webview          # React 开发服务器 (Vite)
```

### 构建
```bash
pnpm build                # 构建所有三个包（webview、extension、backend）
pnpm build:webview        # 构建 React UI
pnpm build:extension      # 构建 VS Code 扩展
pnpm build:backend        # 构建后端
```

### 代码检查
```bash
pnpm lint                 # 运行所有代码检查
pnpm lint:extension       # 检查扩展代码
pnpm lint:backend         # 检查后端代码
pnpm lint:webview         # 检查 webview-ui 代码
```

### 后端专属命令
```bash
cd backend
pnpm prisma:generate      # 生成 Prisma 客户端
pnpm prisma:migrate       # 执行数据库迁移
pnpm prisma:studio        # 打开 Prisma Studio 图形界面
pnpm test                 # 运行 Jest 测试
pnpm test:watch           # 监听模式运行测试
pnpm test:coverage        # 运行测试并生成覆盖率报告
pnpm start                # 启动生产服务器
```

### Docker
```bash
# 开发环境（PostgreSQL + Redis）
docker-compose -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.dev.yml down -v

# 生产环境
docker-compose up -d
docker-compose down
```

## 架构概述

CodeMatrix Studio 是一个 **AI+人类协同软件开发平台**，作为 VS Code 扩展构建。它遵循 "AI 先行，人工审核批准，AI 进入下一阶段" 的工作流程，覆盖完整的软件开发生命周期（PRD → UI/UX → 开发 → 测试）。

### 项目结构（使用 pnpm workspaces 的单体仓库）

```
codematrix-studio/
├── extensions/              # VS Code 扩展（TypeScript）
│   ├── src/extension.ts     # 主入口文件
│   ├── src/services/        # 后端 API 客户端
│   ├── src/sidebar/         # 工作流侧边栏 UI 提供者
│   ├── src/webview/         # Webview 管理
│   └── dist/                # 构建输出（git 忽略）
├── webview-ui/              # React Web 界面（Vite）
│   ├── src/components/      # React 组件
│   ├── src/store/           # Zustand 状态管理
│   ├── src/App.tsx          # 主应用组件
│   └── dist/                # 构建输出（git 忽略）
├── backend/                 # Node.js 后端服务
│   ├── src/api/v1/          # REST API 路由
│   ├── src/services/        # 业务逻辑（AI 网关、工作流引擎、WebSocket）
│   ├── src/database/        # Prisma ORM 配置
│   ├── src/middleware/      # 认证、错误处理、RBAC
│   ├── src/redis/           # Redis 客户端
│   ├── prisma/              # 数据模型和迁移
│   ├── plugins/             # 动态插件目录
│   └── dist/                # 构建输出（git 忽略）
└── docker-compose*.yml      # Docker 配置文件
```

### 技术栈

| 层级               | 技术栈                                         |
|---------------------|------------------------------------------------|
| VS Code 扩展        | TypeScript, esbuild, Socket.IO 客户端          |
| Webview UI          | React 18, TypeScript, Vite, Tailwind CSS, Zustand, Socket.IO, Axios |
| 后端               | Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, Redis, JWT, Socket.IO, Anthropic Claude API, Jest |

### 核心架构概念

1. **四阶段工作流引擎**：管理 PRD 设计 → UI/UX 设计 → 开发 → 测试。每个阶段 AI 生成内容，人类批准或请求修改。

2. **实时协作**：Socket.IO 处理双向通信，支持在线状态、光标同步、打字指示和通知。

3. **基于角色的访问控制 (RBAC)**：三种角色 - OWNER（所有者，全部权限）、EDITOR（编辑，可编辑）、VIEWER（查看者，只读+评论）。

4. **插件系统**：后端支持动态插件加载，便于扩展。

5. **AI 网关**：抽象的 AI 服务接口，默认集成 Anthropic Claude，设计上支持扩展到其他提供商。

### 环境变量

后端需要 `backend/.env` 配置：
- `ANTHROPIC_API_KEY` - 用于 AI 生成的 Anthropic API 密钥
- `DATABASE_URL` - PostgreSQL 连接字符串
- `REDIS_URL` - Redis 连接字符串
- `JWT_SECRET` - JWT 签名密钥
- `PORT` - 服务器端口（默认：3001）
- `NODE_ENV` - `development` 或 `production`

### 端口

| 服务           | 端口  |
|----------------|-------|
| 后端 API       | 3001  |
| Vite 开发服务器 | 5173  |
| PostgreSQL     | 5432  |
| Redis          | 6379  |

### VS Code 扩展命令

- `codematrix.initProject` - 初始化新项目
- `codematrix.openWorkflow` - 打开现有项目工作流
- `codematrix.approveStage` - 批准当前工作流阶段
- `codematrix.requestRevision` - 请求修改当前阶段
- `codematrix.login` - 登录 CodeMatrix Studio
- `codematrix.logout` - 登出 CodeMatrix Studio
- `codematrix.openSettings` - 打开设置网页
