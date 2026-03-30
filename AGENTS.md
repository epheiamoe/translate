# Moe Translate Agent Notes

## Project Overview
Offline-first translation PWA with LLM support. Features include:
- LLM-powered translation with streaming responses
- Document translation (upload TXT/MD files or fetch from URL via Jina AI)
- Multiple translation modes (Translate, Explain, Doc Translate)
- i18n support (English and Chinese)
- PWA with offline support
- Custom model configuration with max context settings
- Style customization (GUI + advanced CSS)

## Deployment

### Cloudflare Pages
```bash
cd /e/Epheia/dev/vibe-app/pwa-apps/moe.epheia.translate
npm run build
wrangler pages deploy dist --project-name=moe-epheia-translate
```

### First Time Setup (if project doesn't exist)
```bash
wrangler pages deploy dist --project-name=moe-epheia-translate
# Select "Create a new project" when prompted
# Production branch: main
```

### URLs
- Cloudflare: https://7ffde264.moe-epheia-translate.pages.dev
- Custom Domain: https://translate.epheia.moe

## Git
- Branch: main
- Repository: E:/Epheia/dev/vibe-app/pwa-apps/moe.epheia.translate

## Build
```bash
npm run build  # Production build to dist/
npm run dev    # Development server
npm run lint   # Lint check
npm test       # Run tests
```

## Key Files
- `src/App.tsx` - Main component with tabs
- `src/lib/prompts/prompts.yaml` - LLM prompt templates
- `src/components/DocumentTranslation/` - Document translation with fullscreen result
- `src/components/StyleCustomization/` - Theme customization UI
- `src/lib/db.ts` - IndexedDB with auto-cleanup (1000 records / 30 days)

## Current Status
- [x] PWA configured with vite-plugin-pwa
- [x] IndexedDB storage with auto-cleanup
- [x] Translation, Explain, Doc Translate tabs
- [x] Fullscreen result view for document translation
- [x] i18n (English/Chinese)
- [x] Style customization (GUI + advanced CSS)
- [x] CSS variable filtering for TRANSLATION_END marker
- [x] Explain mode uses target language
- [x] Responsive mobile layout
- [x] Deployment to Cloudflare Pages
