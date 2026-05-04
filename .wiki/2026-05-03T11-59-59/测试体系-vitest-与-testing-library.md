现在我已掌握所有必要信息，开始撰写页面。

---

# 测试体系：Vitest 与 Testing Library

Moe Translate 的测试体系围绕 **Vitest** 作为测试运行器、**jsdom** 作为浏览器环境模拟、**@testing-library** 作为组件测试工具构建。测试策略遵循"纯函数优先、副作用用 mock、组件走集成"的分层原则，在开发效率和测试置信度之间取得平衡。

---

## 测试配置：Vitest 的设置图景

`vitest.config.ts` 是整个测试体系的入口，它继承 Vite 的插件管线，让测试环境与构建环境共享 `@vitejs/plugin-react` 配置：

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

[来源](vitest.config.ts)

三项关键配置的含义：

**`globals: true`** — 将 `describe`、`it`、`expect` 等测试 API 注入全局作用域，测试文件中无需手动 import。这减少了样板代码，但在大型项目中可能引入隐式依赖的风险。`db.test.ts` 和 `promptBuilder.test.ts` 都依赖此配置。

**`environment: 'jsdom'`** — 使用 jsdom 模拟浏览器 DOM API。这使得测试可以操作 `window`、`document`、`localStorage` 等对象，也让 IndexedDB mock（见下文）能够通过 `Object.defineProperty(window, 'indexedDB', ...)` 注入。jsdom 在 `package.json` 中被列为显式依赖（`^24.0.0`），而非 Vitest 内置。

**`setupFiles`** — 指向 `src/tests/setup.ts`，该文件在每套测试文件运行前执行一次，负责全局 mock 和预置导入。

[来源](package.json#L35)

测试文件的发现模式为 `src/tests/**/*.test.{ts,tsx}`，这意味着：
- 测试文件集中存放在 `src/tests/` 目录下，而非与源码文件相邻放置（非 colocation 策略）。
- 当前已存在的测试文件有 `src/tests/unit/db.test.ts` 和 `src/tests/unit/promptBuilder.test.ts`。

---

## IndexedDB Mock：在 jsdom 中模拟浏览器存储

`src/tests/setup.ts` 中定义了一套完整的 `indexedDB` mock，这是整个测试体系中最关键的基础设施。原因在于 Moe Translate 的数据层（[IndexedDB 数据层设计](indexeddb-数据层设计.md)）重度依赖浏览器原生 IndexedDB API，而 jsdom 不提供该 API 的实现。

Mock 的结构如下：

```ts
const indexedDB = {
  open: () => ({
    onerror: null,
    onsuccess: null,
    onupgradeneeded: null,
    result: {
      objectStoreNames: { contains: () => false },
      createObjectStore: () => ({ createIndex: () => {} }),
      transaction: () => ({
        objectStore: () => ({
          getAll: () => ({ onsuccess: null, onerror: null, result: [] }),
          get: () => ({ onsuccess: null, onerror: null, result: undefined }),
          add: () => ({ onsuccess: null, onerror: null, result: 1 }),
          put: () => ({ onsuccess: null, onerror: null }),
          delete: () => ({ onsuccess: null, onerror: null }),
          clear: () => ({ onsuccess: null, onerror: null }),
        }),
      }),
    },
  }),
};

Object.defineProperty(window, 'indexedDB', { value: indexedDB });
```

[来源](src/tests/setup.ts)

### 设计决策拆解

**`open()` 返回一个具有 `onerror`/`onsuccess`/`onupgradeneeded` 回调属性的对象**。这是模拟正式打开请求的关键——`db.ts` 中的 `getDB()` 函数在调用 `indexedDB.open()` 后，会为这三个事件处理器赋值回调函数。Mock 不主动触发任何回调，而是提供一个空壳，让测试可以手动赋值并触发。

**`result` 中的 `objectStoreNames.contains()` 始终返回 `false`**。这确保 `onupgradeneeded` 内部的 `if (!db.objectStoreNames.contains('history'))` 条件始终为真，从而执行 `createObjectStore()` 的创建逻辑。Mock 虽不真正创建存储，但避免了因条件不满足导致的代码路径遗漏。

**`transaction().objectStore()` 返回包含完整 CRUD 方法的对象**。`getAll`、`get`、`add`、`put`、`delete`、`clear` 每个方法都返回一个具有 `onsuccess`/`onerror` 回调的请求对象。其中：
- `add()` 返回 `result: 1`，模拟自动递增 ID 返回。
- `get()` 返回 `result: undefined`，模拟空数据库初始状态。
- `getAll()` 返回 `result: []`，同样模拟空数据。

**这套 Mock 的局限性**：所有 CRUD 操作都是无状态的——`add()` 始终返回 1 且不存储数据，`getAll()` 始终返回空数组。这意味着测试无法验证"先 add 再 getAll"的读写一致性。对于需要验证数据流转的集成测试，需要引入有状态的 mock 实现，或者使用 `fake-indexeddb` 等第三方库。

### 全局导入

`setup.ts` 开头的 `import '@testing-library/jest-dom'` 为 `expect` 注入了自定义匹配器，如 `toBeInTheDocument()`、`toHaveClass()`、`toHaveAttribute()` 等。这些匹配器在 `db.test.ts` 的类型测试中未使用，但对组件测试至关重要。

---

## 现有测试：类型契约验证

### `db.test.ts` — 三大实体类型的结构验证

`src/tests/unit/db.test.ts` 通过 TypeScript 类型断言 + 运行时 `toHaveProperty` 断言，验证 [IndexedDB 数据层设计](indexeddb-数据层设计.md) 中定义的三种核心接口的结构完整性：

**`TranslationRecord` 测试块**包含三个用例：

1. **必填字段验证** — 构造一个包含所有显式字段（包括 `id` 和 `thinkingContent`）的记录，逐一断言每个属性的存在性。这相当于一份可执行的接口文档。

2. **可选字段验证** — 构造一个省略 `id` 和 `thinkingContent` 的记录，验证 `id` 为 `undefined`。对应 `db.ts` 中 `interface TranslationRecord` 定义的 `id?: number`。

3. **`parsing` 模式支持** — 验证 `mode` 字段可以取值为 `'parsing'`。对应类型定义中的 `mode: 'translation' | 'parsing'`。

**`CustomLanguage` 测试块**验证三个必填字段 `id`、`name`、`promptSuffix`。该类型用于 [语言检测与自定义语言](语言检测与自定义语言.md) 中的自定义语言功能。

**`AppSettings` 测试块**验证默认值的合理性——`defaultSourceLang` 为 `'auto'`、`defaultTargetLang` 为 `'zh'`、`selectedProvider` 为 `'deepseek'`。注意这些不是运行时默认值，而是构造测试对象时手动赋值的。

[来源](src/tests/unit/db.test.ts)

### `promptBuilder.test.ts` — 提示词引擎的函数测试

`src/tests/unit/promptBuilder.test.ts` 测试 [YAML 驱动的提示词引擎](yaml-驱动的提示词引擎.md) 中的核心函数，覆盖以下维度：

| 被测函数 | 测试场景 | 断言重点 |
|---|---|---|
| `buildSystemPrompt` | translation 模式、parsing 模式、custom style | 占位符被替换、语言名正确、样式文本注入 |
| `buildUserPrompt` | translation / parsing 模式 | 语言名、原文内容包含在结果中 |
| `buildDetectionPrompt` | 中文文本检测 | 输入的检测文本出现在 prompt 中 |
| `getLanguageName` | 已知/未知语言码 | 返回正确语言名或回退为原码 |
| `getSupportedLanguages` | 返回值结构 | 返回对象含 'en' 和 'zh' |
| `getBuiltInProviders` | DeepSeek 提供商 | 提供商存在、name 正确、models 非空 |

此外还有一个 **`Input Sanitization` 描述块**，测试特殊字符（双花括号、换行符、引号）在 prompt 中的转义处理——验证 `buildUserPrompt` 不会错误地解析用户输入中的模板语法。

[来源](src/tests/unit/promptBuilder.test.ts)

---

## 扩展测试覆盖：三个高优先级目标

现有测试覆盖了类型定义和提示词构建等纯函数。以下三个模块的测试优先级最高：

### 1. `llmClient.ts` — 流式 API 客户端

[LLM 流式 API 客户端架构](llm-流式-api-客户端架构.md) 中的 `streamTranslate` 是应用的核心 IO 函数，包含 SSE 流解析、AbortController 取消、thinking content 识别等复杂逻辑。测试建议：

**`streamTranslate` 函数** 可以通过 mock `fetch`（使用 `vi.fn()` 配合 `MockResponse`）来模拟 SSE 数据流：

```ts
// 模拟 SSE 流
const mockStream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
    controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
    controller.close();
  },
});
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  body: mockStream,
});
```

关键测试场景：
- **正常流式输出** — 多个 chunk 拼装后触发 `onDone`，验证 `onChunk` 被逐段调用。
- **思考链输出** — 模拟包含 `reasoning_content` 的 chunk，验证 `onThinking` 回调被触发，且时序符合预期（思考链结束后才输出正文）。
- **AbortController 取消** — 通过 `signal` 中止请求，验证 `onError` 被调用且错误消息为 "Translation cancelled"。
- **HTTP 错误处理** — mock `response.ok = false`，验证错误被正确抛出并传递。

**`detectLanguage` 函数** 模拟非流式 fetch 响应，验证返回的语言码提取逻辑（正则匹配 `/^[a-z]{2}(-[A-Z]{2})?/`）。

### 2. `loadPrompts.ts` — 提示词加载与持久化

已有 `promptBuilder.test.ts` 测试了构建函数，但 `loadPrompts.ts` 中的持久化函数（`saveSystemPrompts`、`resetSystemPrompts`、`loadPromptsFromDB`）尚未覆盖。这些函数需要与 IndexedDB 交互，测试时依赖 `setup.ts` 中已经注入的 indexedDB mock。

测试建议：
- **`loadPromptsFromDB`** — mock `getRawSetting` 返回自定义 prompt，验证缓存对象被更新。
- **`saveSystemPrompts`** — 验证 `saveRawSetting` 被调用且参数正确。
- **`resolveModelConfig`** — 测试内置提供商和自定义提供商的模型解析路径，以及找不到模型时的 `null` 回退。

### 3. `useTranslation.ts` — 翻译 Hook

`useTranslation` 是[状态管理：Zustand 与持久化策略](状态管理-zustand-与持久化策略.md) 中定义的核心业务 Hook，编排了语言检测、streamTranslate、历史记录保存等完整翻译流程。

测试该 Hook 需要 **@testing-library/react** 的 `renderHook` 和 **Zustand store mock**：

```ts
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from '../../hooks/useAppStore';

// 重置 store 状态
beforeEach(() => {
  useAppStore.setState({
    sourceText: 'Hello',
    targetLang: 'zh',
    // ... 其他初始状态
  });
});
```

关键测试场景：
- **成功翻译流程** — mock `streamTranslate` 快速 resolve，验证 `setTargetText`、`addToHistory` 被调用。
- **自动语言检测** — mock `detectLanguage` 返回特定语言码，验证最终的 system prompt 使用了该语言。
- **API Key 缺失** — 清空 `providerApiKeys`，验证 `setTranslationError` 被调用包含配置提示信息。
- **翻译取消** — 调用 `stopTranslation`，验证 AbortController 被 abort。

---

## 组件集成测试：推荐策略

对于 UI 组件的测试，建议使用 **@testing-library/react** 结合 **@testing-library/user-event**。项目已安装这两个依赖（`^14.2.2` 和 `^14.5.2`）。

### 测试环境注意事项

jsdom 环境不提供 `TextEncoder`/`TextDecoder`/`ReadableStream` 等 Web API。在测试 `streamTranslate` 或依赖 Fetch API 的组件时，需要：

1. 全局安装 `TextEncoder`/`TextDecoder`（Vitest 在较新版本中已内置，但 jsdom 不提供）。
2. 使用 `vi.stubGlobal('fetch', mockFetch)` mock 网络请求。
3. 对于 `ReadableStream`，使用 polyfill 或直接 mock `response.body`。

### 组件测试优先级

| 组件 | 测试要点 | 对应 Wiki 页面 |
|---|---|---|
| `TranslationArea` | 受控模式下的值同步、placeholder 国际化 | [翻译组件](翻译组件-translationarea-与-markdownrenderer.md) |
| `ProviderSwitcher` + `ModelSwitcher` | 切换联动、自定义提供商渲染 | [联动机制](providerswitcher-与-modelswitcher-联动机制.md) |
| `ThinkingChain` | 流式更新 thinking 内容、展开/折叠交互 | [思考链组件](思考链-thinking-chain-展示组件.md) |
| `HistoryPanel` | 搜索过滤、收藏切换、删除操作 | [历史面板](历史面板与数据管理.md) |
| `StyleCustomization` | CSS 变量预览、深色模式切换、自定义 CSS 注入 | [主题系统](css-变量主题系统与样式自定义.md) |

### 测试编写模式示例

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TranslationArea } from './TranslationArea';

describe('TranslationArea', () => {
  it('should display value and allow input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    
    render(<TranslationArea value="Hello" onChange={onChange} />);
    
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('Hello');
    
    await user.type(textarea, ' World');
    expect(onChange).toHaveBeenCalled();
  });
});
```

注意 `@testing-library/user-event` 的所有操作都是异步的，需要使用 `await`。

---

## 运行测试

`package.json` 提供了三个测试脚本：

```bash
npm test          # 启动 Vitest watch 模式，文件修改后自动重跑
npm run test:run  # 单次运行所有测试（CI 环境使用）
npm run test:ui   # 启动 Vitest UI 仪表盘（需安装 @vitest/ui）
```

[来源](package.json#L10-L12)

覆盖率报告支持三种格式（text/json/html），HTML 报告输出到 `coverage/` 目录，可在浏览器中查看逐文件覆盖率详情。

---

## 推荐阅读

- [IndexedDB 数据层设计](indexeddb-数据层设计.md) — 测试中被 mock 的数据库 schema 定义。
- [LLM 流式 API 客户端架构](llm-流式-api-客户端架构.md) — 流式响应的完整处理逻辑。
- [YAML 驱动的提示词引擎](yaml-驱动的提示词引擎.md) — promptBuilder 测试覆盖的构建函数源头。
- [状态管理：Zustand 与持久化策略](状态管理-zustand-与持久化策略.md) — useTranslation 依赖的 store 定义。
- [构建工具链与配置](构建工具链与配置.md) — Vite 配置与测试配置的共享插件管线。