# Moe Translate

Offline-first translation PWA application powered by LLM API.

## Features

- **Offline Support**: Full PWA capability with Service Worker caching
- **LLM Translation**: Direct API calls to DeepSeek or OpenAI-compatible APIs with streaming
- **Multi-language**: Automatic language detection with 25+ supported languages
- **Custom Languages**: Add your own language definitions
- **Translation Modes**: Translate mode for standard translation, Parse mode for word/phrase explanations
- **Document Translation**: Upload TXT/MD files or fetch from URL (via r.jina.ai) for full document translation
- **Style Settings**: Choose from Formal, Casual, Academic, Literary, or custom styles
- **History & Favorites**: All translations saved locally with IndexedDB
- **Import/Export**: Backup and restore your history and settings
- **Thinking Chain**: Display reasoning process for supported models (DeepSeek Reasoner)
- **Responsive Design**: DeepL-style UI with mobile (vertical) and desktop (side-by-side) layouts
- **Customizable**: CSS variables for easy theming
- **Custom Models**: Add your own model configurations with max context settings

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Setup

```bash
npm install
```

### Development Server

```bash
npm run dev
```

### Type Checking

```bash
npm run typecheck
```

### Testing

```bash
npm run test        # Run tests in watch mode
npm run test:run    # Run tests once
```

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Configuration

### API Key Setup

1. Open the app
2. Click the Settings icon
3. Enter your API Base URL (default: `https://api.deepseek.com/v1`)
4. Enter your API Key
5. Select your preferred model
6. Click Save

### Available Models

- **DeepSeek Chat**: Standard chat model, fast responses (128K context)
- **DeepSeek Reasoner**: Supports thinking chain display (128K context)

### Adding Custom Models

1. Go to Settings
2. Scroll to Custom Models
3. Enter:
   - Model name (e.g., "GPT-4o")
   - Model ID (e.g., "gpt-4o")
   - Max context size (e.g., "128000")
   - Check "Supports Thinking" if applicable
4. Click Add Model

### Adding Custom Languages

1. Go to Settings
2. Scroll to Custom Languages
3. Enter a name (e.g., "Sanskrit") and prompt suffix
4. Click Add
5. The language will appear in the language selector

### Document Translation

1. Click the "文档翻译" tab
2. Choose input method:
   - **URL**: Enter a URL to fetch markdown content via r.jina.ai
   - **File Upload**: Upload a .txt or .md file
3. Select source and target languages
4. Click "Translate Document"
5. Download the translated result as .txt or .md

For higher rate limits on URL fetching, add your Jina API key in Settings.

## Project Structure

```
├── public/
│   ├── _headers           # Cloudflare Pages headers
│   ├── _routes.json       # Cloudflare Pages routing
│   └── app-icon-*.png      # PWA icons (auto-generated)
├── src/
│   ├── components/        # React components
│   │   ├── DocumentTranslation/
│   │   ├── HistoryPanel/
│   │   ├── LanguageSelector/
│   │   ├── ModeSwitcher/
│   │   ├── ModelSwitcher/
│   │   ├── Settings/
│   │   ├── StyleSettings/
│   │   ├── ThinkingChain/
│   │   └── TranslationArea/
│   ├── hooks/             # Custom React hooks
│   │   ├── useAppStore.ts # Zustand store
│   │   └── useTranslation.ts
│   ├── lib/              # Core libraries
│   │   ├── db.ts         # IndexedDB operations
│   │   ├── llmClient.ts   # LLM API client
│   │   └── prompts/      # Prompt templates
│   │       ├── loadPrompts.ts
│   │       └── prompts.yaml
│   ├── styles/           # Styles and docs
│   │   ├── global.css    # CSS variables
│   │   └── custom-docs.md # CSS customization guide
│   ├── tests/            # Test files
│   │   ├── setup.ts
│   │   └── unit/
│   ├── App.tsx           # Main app component
│   ├── main.tsx          # Entry point
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── .gitignore
```

## Customization

### CSS Variables

The app uses CSS custom properties defined in `src/styles/global.css`. Override them to customize the appearance:

```css
:root {
  --color-primary: #0f30e0;
  --color-bg: #ffffff;
  --font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  /* ... */
}
```

See `src/styles/custom-docs.md` for full documentation.

### Prompt Templates

Edit `src/lib/prompts/prompts.yaml` to customize:
- System prompts for translation and parsing modes
- Style descriptions
- Language detection prompt
- Supported languages list
- Model configurations
- Document translation prompts (with completion markers)

## Deployment

### Cloudflare Pages

1. Connect your Git repository to Cloudflare Pages
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Deploy

The app is configured with:
- `public/_headers`: Security headers and caching
- `public/_routes.json`: Cloudflare Pages routing

### Manual Deployment

1. Run `npm run build`
2. Upload the `dist` folder contents to your static host

## TODO

- [ ] Implement proper tokenizer for accurate token counting
  - Current estimation uses: `characters / 3.5 ≈ tokens`
  - Consider different tokenizers for different models
  - Use tiktoken or similar for accurate counting

## Technology Stack

- **Framework**: React 18 with TypeScript
- **Build**: Vite 5
- **State**: Zustand with persistence
- **Storage**: IndexedDB (idb library)
- **PWA**: vite-plugin-pwa with Workbox
- **Testing**: Vitest with Testing Library
- **Styling**: CSS Variables with CSS Modules pattern

## License

MIT