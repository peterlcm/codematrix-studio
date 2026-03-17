# CodeMatrix Studio

AI+人类协同软件开发平台，基于 VS Code 构建。

## 概述

CodeMatrix Studio 遵循 **"AI 先行，人工审核批准，AI 进入下一阶段"** 的协同开发工作流，覆盖完整软件开发生命周期：

1. **PRD 需求文档设计** - AI 根据你的想法生成完整的产品需求文档
2. **UI/UX 设计** - AI 根据已批准的 PRD 设计交互流程和组件结构
3. **全栈开发** - AI 根据已批准的设计文档生成前端和后端代码
4. **测试** - AI 生成测试计划和测试用例

所有团队成员都可以在 VS Code 中协作，支持实时同步。

## 技术架构

- **VS Code 扩展**: 使用 TypeScript 构建，提供 IDE 集成能力
- **Web 界面**: 基于 React 的协作用户界面
- **后端服务**: Node.js + Express + PostgreSQL + Redis，处理工作流编排和实时协作
- **AI 集成**: 默认使用 Anthropic Claude，支持多提供商扩展

## 环境要求

- Node.js 20+
- pnpm
- Docker 和 Docker Compose（用于运行 PostgreSQL 和 Redis）
- Anthropic API 密钥

## 快速开始

### 1. 安装依赖

```bash
pnpm install:all
```

### 2. 使用 Docker Compose 启动数据库

```bash
docker-compose up -d
```

### 3. 配置环境变量

复制 `.env.example` 到 `backend/.env`，填入你的 Anthropic API 密钥：

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env 添加 ANTHROPIC_API_KEY
```

### 4. 初始化数据库

```bash
cd backend
pnpm prisma migrate dev
```

### 5. 构建项目

```bash
pnpm build
```

### 6. 启动后端服务

```bash
cd backend
pnpm dev
```

### 7. 在 VS Code 中开发扩展

打开项目根目录，按 F5 启动扩展开发宿主。

## 工作流程

1. **创建新项目**，使用命令 `CodeMatrix: Initialize Project`
2. **启动工作流** - AI 自动生成 PRD
3. **审核和批准** - 编辑 PRD，添加评论，准备好后批准
4. **AI 进入下一阶段** - 根据已批准的 PRD 自动生成 UI/UX 设计
5. **重复审核/批准** 每个阶段
6. **最终输出** - 获得包含代码和测试的完整项目

## 核心功能

- 👤 **用户系统** - JWT 认证，会话管理，修改密码
- 📁 **项目管理** - CRUD，搜索，归档/取消归档，统计信息
- 👥 **团队协作** - 添加/移除成员，角色管理，项目转让，退出项目
- 🔗 **项目邀请** - 可配置有效期和角色，邀请链接，撤销邀请
- ⚙️ **四阶段工作流** - PRD 设计 → UI/UX 设计 → 开发 → 测试
- 🤖 **AI 生成** - 每个阶段 AI 自动生成内容
- 💬 **评论协作** - 支持评论线程，代码位置定位
- ✅ **审批流程** - 多人审批，记录批准人和时间
- ⚡ **实时协作** - 在线状态，光标同步，打字指示，实时通知
- 🔌 **插件系统** - 动态加载插件，支持配置存储

## 权限角色

| 角色 | 权限 |
|------|------|
| **OWNER** (所有者) | 所有权限，删除项目，转让所有权，归档，管理团队 |
| **EDITOR** (编辑) | 编辑项目，修改内容，创建邀请，评论审批 |
| **VIEWER** (查看者) | 只能查看，发表评论 |

## 项目结构

```
codematrix-studio/
├── extensions/          # VS Code 扩展
├── webview-ui/         # React 前端界面
├── backend/            # 后端服务
└── docker-compose.yml  # Docker Compose 配置
```

## 许可证

MIT
