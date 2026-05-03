# Moe Translate

Offline-first translation PWA application powered by LLM API.

**Online Demo**: [moe-epheia-translate.pages.dev](https://moe-epheia-translate.pages.dev) | [translate.epheia.moe](https://translate.epheia.moe)

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
- **Thinking Chain**: Display reasoning process for supported models
- **Multi-Provider**: Built-in support for DeepSeek, OpenAI, Anthropic, Google Gemini, xAI Grok, Mistral AI, and Cohere
- **Custom Prompts**: Edit system and user prompt templates directly in Settings with reset to defaults
- **Thinking Mode**: Configurable toggle in Settings to enable/disable model reasoning output
- **Token Cost Display**: Shows estimated cost per request based on model pricing
- **Responsive Design**: Mobile and desktop layouts
- **Customizable**: CSS variables for easy theming
- **Custom Models/Providers**: Add your own provider configurations with custom models

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
3. Select your provider (DeepSeek, OpenAI, Anthropic, etc.)
4. Enter your API Key for the selected provider
5. Select your preferred model
6. Click Save

### Available Providers

- **DeepSeek**: V4 Flash, V4 Pro
- **OpenAI**: GPT-5.5, GPT-5.5 Pro, GPT-5.4, GPT-5.4 Pro, GPT-5.4 Mini, GPT-5.4 Nano
- **Anthropic**: Claude Opus 4.7, Opus 4.6, Sonnet 4.6, Haiku 4.5, Sonnet 4.5
- **Google Gemini**: Gemini 3.1 Pro, 2.5 Pro, 3 Flash, 3.1 Flash Lite, 2.5 Flash, 2.5 Flash Lite
- **xAI Grok**: Grok 4.3, 4.20 Reasoning, 4.20 Multi-Agent, 4.1 Fast Reasoning, 4.1 Fast
- **Mistral AI**: Mistral Large, Medium, Codestral, Magistral Medium, Small
- **Cohere**: Command A, Command R+, Command R, Command R 7B, Command Light

### Custom Prompts

You can customize all system and user prompts directly from the Settings panel:

1. Go to Settings
2. Scroll to "Prompt Templates"
3. Edit any prompt template
4. Click Save to apply, or Reset to restore defaults

### Thinking Mode

Toggle thinking mode in Settings to enable/disable model reasoning display. When enabled, supported models will show their internal thought process before the final response.

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
│   │   │   ├── Settings.tsx
│   │   │   ├── Settings.css
│   │   │   └── PromptSettings.tsx
│   │   ├── ProviderSwitcher/
│   │   ├── ModelSwitcher/
│   │   ├── StyleSettings/
│   │   ├── ThinkingChain/
│   │   └── TranslationArea/
│   ├── hooks/             # Custom React hooks
│   │   ├── useAppStore.ts # Zustand store
│   │   └── useTranslation.ts
│   ├── lib/              # Core libraries
│   │   ├── db.ts         # IndexedDB operations
│   │   ├── llmClient.ts   # LLM API client
│   │   └── prompts/      # Prompt templates and defaults
│   │       ├── loadPrompts.ts
│   │       ├── defaultPrompts.ts
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

Edit prompt templates via the Settings UI or directly in `src/lib/prompts/prompts.yaml`:
- System prompts for translation and parsing modes
- User prompts for various modes
- Style descriptions
- Language detection prompt
- Supported languages list
- Provider and model configurations

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