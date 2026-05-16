# Grana V3

Aplicación de finanzas personales.

## Primeros pasos

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Configurar variables de entorno

Copia el archivo de ejemplo y completa tus credenciales de Supabase:

```bash
cp .env.local.example .env.local
```

| Variable                        | Dónde encontrarla                                              |
| ------------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Panel de Supabase → Project Settings → API → Project URL       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Panel de Supabase → Project Settings → API → Publishable key   |

### 3. Ejecutar la aplicación

```bash
pnpm dev
```

La app estará disponible en [http://localhost:3000](http://localhost:3000).

### 4. (Opcional) Instalar el CLI de OpenSpec

El repo está configurado para usar [OpenSpec](https://github.com/Fission-AI/OpenSpec) como flujo de spec-driven development. Los skills y slash commands ya vienen versionados en `.claude/`, pero el CLI se instala aparte:

```bash
pnpm add -g @fission-ai/openspec
```

Una vez instalado, dentro de Claude Code podés usar:

- `/opsx:propose "<idea>"` — crear una nueva propuesta de cambio
- `/opsx:explore` — explorar / refinar una idea antes de proponerla
- `/opsx:apply` — implementar las tasks de un cambio
- `/opsx:archive` — archivar un cambio ya completado

Las propuestas viven en `openspec/changes/` y las specs en `openspec/specs/`.

## Scripts disponibles

| Script         | Descripción                              |
| -------------- | ---------------------------------------- |
| `pnpm dev`     | Inicia el servidor de desarrollo         |
| `pnpm build`   | Compila la app para producción           |
| `pnpm start`   | Ejecuta la build de producción           |
| `pnpm lint`    | Ejecuta ESLint en todo el proyecto       |

---

## Estructura del proyecto

```
grana-v3/
├── app/                    # App Router de Next.js (páginas, layouts, route handlers)
│   ├── favicon.ico
│   ├── globals.css         # Estilos globales (Tailwind CSS v4)
│   ├── layout.tsx          # Layout raíz
│   └── page.tsx            # Página de inicio
├── public/                 # Activos estáticos servidos tal cual
├── CLAUDE.md               # Contexto del proyecto para Claude Code (se carga automáticamente en cada sesión)
├── SUPABASE_SETUP.md       # Guía paso a paso para integrar Supabase
├── README.md
├── eslint.config.mjs       # Configuración de ESLint (flat config)
├── next.config.ts          # Configuración de Next.js
├── next-env.d.ts           # Tipos ambientales de Next.js para TypeScript
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── postcss.config.mjs      # Pipeline de PostCSS / Tailwind
└── tsconfig.json           # Configuración de TypeScript (alias: @/*)
```

## Stack tecnológico

- [Next.js 16](https://nextjs.org) (App Router)
- [React 19](https://react.dev)
- [TypeScript](https://www.typescriptlang.org) (modo estricto)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Supabase](https://supabase.com) — autenticación y base de datos (ver [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md))
- [pnpm](https://pnpm.io) — gestor de paquetes
- [OpenSpec](https://github.com/Fission-AI/OpenSpec) — spec-driven development asistido por IA
