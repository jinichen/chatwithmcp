# Modern Chat Application

A modern, elegant chat application built with Next.js, React, and TypeScript. Features a beautiful UI with real-time streaming responses, conversation management, and theme support.

## Features

- 🚀 Real-time streaming responses with typing effect
- 💬 Conversation management (create, select, delete)
- 🎨 Modern UI with light/dark theme support
- 🔄 Automatic message history loading
- 💭 Special formatting for AI thinking process
- 📱 Responsive design
- ⌨️ Keyboard shortcuts support

## Tech Stack

- **Frontend**:
  - Next.js
  - React
  - TypeScript
  - Tailwind CSS
  - Shadcn/ui
- **Backend**:
  - FastAPI (Python)
  - SQLAlchemy (ORM)
  - PostgreSQL
  - LangChain (LLM Integration)
- **Other**:
  - Alembic (Database Migrations)
  - Pydantic (Data Validation)
  - LangSmith (Tracing - configured but not actively used in code)

## Getting Started

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <project-directory>
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_API_BASE_URL=your_api_base_url
   ```

4. Run the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

### Frontend Structure

```
frontend/
├── .gitignore
├── components.json
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
└── src/
    ├── app/
    │   ├── favicon.ico
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   ├── conversation-area.tsx
    │   ├── model-selector.tsx
    │   ├── sidebar.tsx
    │   ├── theme-provider.tsx
    │   ├── top-nav.tsx
    │   └── ui/
    │       ├── avatar.tsx
    │       ├── button.tsx
    │       ├── collapsible.tsx
    │       ├── select.tsx
    │       ├── sheet.tsx
    │       └── textarea.tsx
    └── lib/
        └── utils.ts
```

### Backend Structure

```
backend/
├── .env.example
├── .gitignore
├── alembic.ini
├── requirements.txt
├── alembic/
│   ├── env.py
│   ├── README
│   ├── script.py.mako
│   └── versions/
└── app/
    ├── __init__.py
    ├── main.py
    ├── api/
    │   ├── __init__.py
    │   ├── routes.py
    │   └── v1/
    │       ├── chat.py
    │       └── conversations.py
    ├── core/
    │   ├── __init__.py
    │   ├── config.py
    │   └── database.py
    ├── migrations/
    │   ├── env.py
    │   └── versions/
    │       └── 001_create_tables.py
    ├── models/
    │   ├── __init__.py
    │   ├── base.py
    │   └── chat.py
    ├── schemas/
    │   ├── __init__.py
    │   ├── chat.py
    │   └── conversation.py
    ├── services/
    │   ├── __init__.py
    │   ├── chat.py
    │   ├── conversation.py
    │   └── model_factory.py
    └── utils/
        └── __init__.py
```

## Features in Detail

### Real-time Chat
- Streaming responses with typing effect
- Support for markdown formatting
- Special formatting for AI thinking process
- Message history management

### Conversation Management
- Create new conversations
- Switch between existing conversations
- Delete conversations
- Automatic loading of recent conversations

### UI/UX Features
- Modern, clean interface
- Responsive design
- Light/dark theme support
- Smooth animations and transitions
- Enhanced input area with shadow effects
- Avatar support for user and AI messages

### Keyboard Shortcuts
- Enter to send message
- Shift + Enter for new line

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)
