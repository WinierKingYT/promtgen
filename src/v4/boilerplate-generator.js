export function generateRepositoryBoilerplate(project) {
    const projName = String(project.identity?.name || project.identity?.originalIdea || 'promtgen-projesi').trim();
    const idea = String(project.identity?.originalIdea || '').trim();
    const isWeb = /web|saas|react|next|node|api/i.test(idea);
    const isMobile = /mobil|flutter|react native|ios|android/i.test(idea);
    const isGame = /oyun|game|s&box|unity|godot/i.test(idea);

    const readme = `# ${projName}

> ${project.identity?.summary || idea}

## 🚀 Proje Hakkında
Bu proje **PromtGen Proje Mimarı (V4)** tarafından üretilen canonical plan ve kararlarla yapılandırılmıştır.

- **Plan Sürümü:** r${project.revision}
- **Plan Derinliği:** ${project.planningDepth?.selected?.toUpperCase()}
- **Hazırlık Skoru:** %${project.readiness?.score || 0}

## 🏗️ Mimari ve Kararlar
${(project.decisions || []).filter(d => d.status === 'accepted').slice(0, 5).map(d => `- **${d.title}:** ${d.decision}`).join('\n') || '- Temel yerel ilkeler.'}

## 🛠️ Hızlı Başlatma
\`\`\`bash
# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev

# Testleri çalıştırın
npm test
\`\`\`

## 📝 Ajan Kodlama Komutları
- Cursor kullanıcıları için: \`.cursor/rules/promtgen-plan.mdc\`
- Claude Code kullanıcıları için: \`CLAUDE.md\`
- Codex kullanıcıları için: \`AGENTS.md\`
`;

    const gitignore = `# Bağımlılıklar
node_modules/
.pnp
.pnp.js

# Derleme çıktıları
dist/
build/
out/
.next/

# Ortam değişkenleri ve gizli anahtarlar
.env
.env.local
.env.*.local
*.pem

# IDE ve İşletim sistemi
.DS_Store
Thumbs.db
.vscode/
.idea/
*.log
`;

    const dockerCompose = `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped

${isWeb ? `  database:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: app_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres_password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
` : ''}`;

    const ciWorkflow = `name: CI & Quality Gate

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Use Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18.x'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck --if-present
      - run: npm test --if-present
      - run: npm run build --if-present
`;

    return {
        'README.md': readme,
        '.gitignore': gitignore,
        'docker-compose.yml': dockerCompose,
        '.github/workflows/ci.yml': ciWorkflow
    };
}
