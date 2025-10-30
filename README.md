# LegalPlates Frontend

AI-powered legal document management and drafting system built with Next.js 15, TypeScript, and Tailwind CSS 4.

## Features

- 📄 **Document Upload**: Upload PDF/DOCX files to extract variables and create templates
- 💬 **AI-Powered Drafting**: Conversational interface for generating legal documents
- 🔍 **Template Matching**: Smart template search using AI
- 📚 **Template Management**: Browse, search, and manage document templates
- ⚡ **Fast & Secure**: Built with modern technologies for optimal performance

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **Markdown**: React Markdown

## Prerequisites

- Node.js 18+ and npm
- LegalPlates API backend running (default: http://localhost:8000)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Run Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

### 4. Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout with Navbar
│   ├── page.tsx           # Dashboard (home page)
│   ├── upload/            # Document upload page
│   ├── chat/              # AI drafting page
│   └── templates/         # Template management page
├── components/            # Reusable components
│   ├── LoadingSpinner.tsx
│   ├── Navbar.tsx
│   └── Toast.tsx
└── lib/
    └── api.ts            # API client with all endpoints
```

## Pages Overview

### Dashboard (`/`)
- Overview of available templates
- Quick access to main features
- Getting started guide

### Upload (`/upload`)
- Drag & drop file upload
- Support for PDF and DOCX files (up to 10MB)
- Variable extraction and template creation
- File validation and error handling

### Draft (`/chat`)
- Conversational AI interface
- Template matching with confidence scores
- Dynamic question generation
- Document generation with markdown preview
- Download generated documents

### Templates (`/templates`)
- Search and filter templates
- View template details and variables
- Download template JSON
- Delete templates

## API Integration

The frontend integrates with the LegalPlates API at `/api/v1/` endpoints:

- **POST** `/api/v1/upload` - Upload documents
- **GET** `/api/v1/template` - List templates
- **GET** `/api/v1/template/{id}` - Get template details
- **DELETE** `/api/v1/template/{id}` - Delete template
- **POST** `/api/v1/draft/match-stream` - Match templates
- **POST** `/api/v1/draft/questions` - Generate questions
- **POST** `/api/v1/draft/generate` - Generate draft

All API responses follow this format:
```typescript
{
  error: boolean;
  message: string;
  body: T; // Actual data
}
```

## Loading States

The application includes comprehensive loading indicators for:
- Document processing (AI extraction)
- Template matching (semantic search + AI)
- Question generation (AI formatting)
- Draft generation (template rendering)

## Error Handling

- User-friendly error messages
- Validation for file uploads
- API error handling with fallbacks
- Toast notifications for actions

## Development

### Running Lint

```bash
npm run lint
```

### Code Style

- TypeScript strict mode enabled
- React Strict Mode enabled
- ESLint with Next.js config

## Troubleshooting

### API Connection Issues

Ensure the backend API is running and the `NEXT_PUBLIC_API_URL` in `.env.local` is correct.

### Port Already in Use

If port 3000 is in use, specify a different port:
```bash
npm run dev -- -p 3001
```

### Build Errors

Clear the Next.js cache:
```bash
rm -rf .next
npm run build
```
