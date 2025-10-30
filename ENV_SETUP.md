# Environment Setup

## Required Environment File

This application requires a `.env.local` file in the root directory to configure the API connection.

### Create `.env.local`

Create a new file named `.env.local` in the project root with the following content:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Important Notes

- The `.env.local` file is ignored by git for security reasons
- Make sure your API backend is running before starting the frontend
- The `NEXT_PUBLIC_` prefix makes this variable available in the browser
- Restart the development server after creating or modifying `.env.local`

### Verify Setup

After creating the file, restart the development server:

```bash
npm run dev
```

The application should now connect to your API backend at the specified URL.
