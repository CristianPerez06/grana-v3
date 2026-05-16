# Next.js Project

This is a Next.js project using the App Router architecture.

## Tech Stack

- Next.js with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- React Server Components by default

## Project Structure

- `app/` - App Router pages and layouts
- `components/` - Reusable React components
- `lib/` - Utility functions and shared code
- `public/` - Static assets

## Conventions

- Use Server Components by default, add 'use client' only when needed
- Prefer named exports for components
- Use TypeScript strict mode
- Follow the Next.js file-based routing conventions
- Use next/image for optimized images
- Use next/link for client-side navigation

## Code Style

- Use functional components with TypeScript
- Prefer async/await over .then() chains
- Use early returns for cleaner code
- Keep components small and focused

## Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint

## Branching

- `main` — main development branch
- `feature/*`, `bugfix/*`, `hotfix/*`, `chore/*` — work branches
