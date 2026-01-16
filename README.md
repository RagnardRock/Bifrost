# Bifrost

**Site-First Headless CMS** - Le CMS qui s'adapte à votre site, pas l'inverse.

Bifrost permet aux développeurs web de proposer à leurs clients une interface d'édition de contenu simple et sécurisée, sans risque de casser le design mobile-first des sites.

## Features

- **Schema-Driven UI** - L'interface d'édition est générée automatiquement depuis votre `bifrost-schema.yaml`
- **Collections** - Gérez des listes de contenu (blog posts, slides, événements)
- **Dual Integration** - API REST pour sites dynamiques, script JS pour sites statiques
- **Versioning & Rollback** - Historique complet des modifications
- **Webhooks** - Notifications en temps réel pour invalidation de cache
- **Glassmorphism UI** - Interface moderne avec support dark mode

## Tech Stack

- **Frontend:** Vue 3 + Vite + TailwindCSS + Pinia
- **Backend:** Express.js + Prisma + PostgreSQL
- **Loader:** Vanilla JS (<10KB)
- **Infrastructure:** Render + Neon.tech + Cloudinary

## Quick Start

### Prerequisites

- Node.js 20.x LTS
- npm 10.x
- PostgreSQL (or Neon.tech account)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/bifrost.git
cd bifrost

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your values

# Run database migrations
npm run db:migrate

# Seed with demo data
npm run db:seed

# Start development servers
npm run dev
```

### Development URLs

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3000
- **API Health:** http://localhost:3000/health

### Demo Credentials

After seeding:

- **Admin:** admin@bifrost.local / admin123
- **Client:** user@demo.com / user123

## Project Structure

```
bifrost/
├── packages/
│   ├── client/     # Vue 3 Dashboard (admin + client)
│   ├── server/     # Express.js API
│   ├── loader/     # JS script for static sites
│   └── shared/     # Shared TypeScript types
├── docs/           # Documentation
└── .github/        # CI/CD workflows
```

## Available Commands

```bash
# Development
npm run dev           # Start all services
npm run dev:client    # Frontend only
npm run dev:server    # Backend only

# Build
npm run build         # Build all packages

# Testing
npm test              # Run all tests
npm run test:coverage # With coverage report

# Code Quality
npm run lint          # ESLint check
npm run lint:fix      # Fix ESLint issues
npm run format        # Prettier format
npm run typecheck     # TypeScript check

# Database
npm run db:migrate    # Run migrations
npm run db:studio     # Open Prisma Studio
npm run db:seed       # Seed database
npm run db:reset      # Reset database (DESTRUCTIVE)
```

## Schema Example

```yaml
# bifrost-schema.yaml
groups:
  hero:
    label: "Section Hero"
    fields: [hero-title, hero-subtitle, hero-image]

fields:
  hero-title:
    type: text
    label: "Titre principal"
    default: "Bienvenue"
  hero-subtitle:
    type: text
    label: "Sous-titre"
  hero-image:
    type: image
    label: "Image de fond"

collections:
  blog-posts:
    label: "Articles du blog"
    fields:
      title:
        type: text
        label: "Titre"
      content:
        type: richtext
        label: "Contenu"
      published:
        type: boolean
        label: "Publié"
        default: true
```

## API Usage

### REST API (for dynamic sites)

```javascript
// Fetch all content
const response = await fetch('https://api.bifrost.com/api/sites/{siteId}/content', {
  headers: { 'X-Bifrost-Key': 'your-api-key' }
})
const { data } = await response.json()
// data.fields['hero-title'] = "Bienvenue"
// data.collections['blog-posts'] = [...]
```

### JS Loader (for static sites)

```html
<!-- Add to your HTML -->
<script src="https://bifrost.com/loader.js?site=YOUR_SITE_ID"></script>

<!-- Mark editable elements -->
<h1 data-bifrost="hero-title">Fallback Title</h1>
<p data-bifrost="hero-subtitle">Fallback subtitle</p>
```

## Deployment

### Docker Deployment (Recommended)

#### Prerequisites

- Docker 20.x+
- Docker Compose 2.x+

#### Quick Deploy

```bash
# 1. Clone and configure
git clone https://github.com/your-org/bifrost.git
cd bifrost
cp .env.example .env.production

# 2. Edit .env.production with your values
# Required:
#   JWT_SECRET=your-super-secret-jwt-key
#   CLOUDINARY_CLOUD_NAME=your-cloud-name
#   CLOUDINARY_API_KEY=your-api-key
#   CLOUDINARY_API_SECRET=your-api-secret

# 3. Build and start
docker compose -f docker-compose.yml --env-file .env.production up -d --build

# 4. Run migrations
docker compose exec bifrost npm run db:migrate:prod

# 5. Seed initial data (optional)
docker compose exec bifrost npm run db:seed
```

The app will be available at `http://localhost:3000`

- Admin Panel: `http://localhost:3000/admin`
- API: `http://localhost:3000/api`
- Loader: `http://localhost:3000/loader.js`

#### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | Secret for JWT tokens |
| `JWT_EXPIRES_IN` | No | `7d` | JWT token expiration |
| `DB_USER` | No | `postgres` | Database user |
| `DB_PASSWORD` | No | `password` | Database password |
| `DB_NAME` | No | `bifrost` | Database name |
| `PORT` | No | `3000` | Server port |
| `CORS_ORIGINS` | No | `*` | Allowed CORS origins |
| `CLOUDINARY_CLOUD_NAME` | No | - | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | No | - | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No | - | Cloudinary API secret |

#### Development with Docker

For local development, use the dev compose file (only PostgreSQL):

```bash
# Start only the database
docker compose -f docker-compose.dev.yml up -d

# Run the app locally
npm install
npm run db:migrate
npm run dev
```

### Manual Deployment

#### Building

```bash
# Install dependencies
npm ci

# Build all packages
npm run build

# The server will serve the client from /admin in production
```

#### Running

```bash
# Set environment variables
export NODE_ENV=production
export DATABASE_URL=postgresql://user:pass@host:5432/bifrost
export JWT_SECRET=your-secret

# Run migrations
npm run db:migrate:prod

# Start server
npm run start:server
```

### Cloud Deployment Options

#### Render.com

1. Create a new Web Service
2. Connect your repository
3. Set build command: `npm ci && npm run build`
4. Set start command: `npm run start:server`
5. Add environment variables
6. Create a PostgreSQL database and link it

#### Railway

1. Create new project from GitHub
2. Add PostgreSQL plugin
3. Set environment variables
4. Deploy automatically

## Client Site Integration

### Using the Loader

Add the loader script to your static site:

```html
<script src="https://your-bifrost.com/loader.js" data-site="YOUR_API_KEY"></script>
```

Mark editable elements:

```html
<!-- Text content -->
<h1 data-bifrost="hero.title">Default Title</h1>

<!-- Image -->
<img data-bifrost="hero.image" src="default.jpg" alt="Hero" />

<!-- Rich text (HTML content) -->
<div data-bifrost="about.description">
  <p>Default content with <strong>formatting</strong></p>
</div>

<!-- Collection -->
<div data-bifrost-collection="testimonials" data-bifrost-template="testimonial-tpl">
  <template id="testimonial-tpl">
    <div class="testimonial">
      <p data-field="quote">"Quote here"</p>
      <span data-field="name">Name</span>
    </div>
  </template>
</div>
```

Edit mode is enabled via URL parameter: `https://your-site.com?edit=true`

## Documentation

- [Project Brief](./docs/brief.md)
- [Product Requirements](./docs/prd.md)
- [Architecture](./docs/architecture.md)

## License

Private - All rights reserved

---

Built with BMAD Method


