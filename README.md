# ASA Dialog + MCP 系统

ASA Dialog + MCP 系统分为前端和后端，前端采用现代化技术栈构建，提供智能对话和 MCP 扩展功能； 后端采用fastapi + langchain实现业务逻辑;

## 技术栈

- **Next.js 15** - React 框架，提供服务端渲染和静态生成功能
- **React** - 用户界面库
- **TypeScript** - 静态类型检查
- **Tailwind CSS** - 实用优先的 CSS 框架
- **shadcn/ui** - 高质量 UI 组件库
- **date-fns** - 日期处理库
- **Lucide React** - 图标库

## 功能特点

- 三栏式现代布局设计
- 响应式界面，适配桌面和移动设备
- 对话列表和详情页面
- MCP 扩展商店
- 用户设置与偏好

## 开发指南

### 环境要求

- Node.js 18+ 
- npm 9+

### 安装和运行

1. 克隆仓库

```bash
git clone <仓库地址>
cd asa/frontend
```

2. 安装依赖

```bash
npm install
```

3. 启动开发服务器

```bash
npm run dev
```

4. 打开浏览器访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
```

## 项目结构

```
frontend/
├── public/              # 静态资源
├── src/                 # 源代码
│   ├── app/             # 应用页面
│   │   ├── conversations/  # 对话相关页面
│   │   ├── store/       # MCP 商店页面
│   │   ├── settings/    # 设置页面
│   │   ├── layout.tsx   # 根布局
│   │   └── page.tsx     # 首页
│   ├── components/      # 组件
│   │   ├── layout/      # 布局组件
│   │   └── ui/          # UI 组件
│   └── lib/          # 工具函数
└── package.json         # 项目配置
```

## 开发约定

- 使用 TypeScript 编写所有代码
- 遵循 React 最佳实践
- 使用 Tailwind CSS 进行样式设计
- 使用 shadcn/ui 组件构建界面

## 代码规范

- 使用 ESLint 进行代码检查
- 使用 Prettier 进行代码格式化

## 许可

该项目采用 MIT 许可证。
