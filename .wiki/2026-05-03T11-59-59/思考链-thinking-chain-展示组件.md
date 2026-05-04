现在我已掌握了所有证据，可以撰写这篇 Wiki 页面。

---

# 思考链（Thinking Chain）展示组件

**思考链（Thinking Chain）** 是 Moe Translate 中用于可视化 LLM "推理过程"的专用 UI 单元。当使用支持 reasoning 的模型（如 DeepSeek Reasoner 系列）时，模型会在返回最终翻译内容之前输出一段 **推理中间结果**，思考链组件负责捕获、实时展示并管理其折叠状态。

本文将沿数据流方向逐层拆解：从 `llmClient.ts` 的 SSE 流解析，到 `useTranslation.ts` 的回调传递，再到 `useAppStore` 的全局状态存储，最后落足于 `App.tsx` 的条件渲染与折叠逻辑。

---

## 核心竞争力：两张面孔

思考链呈现形式分两种场景：

| 场景 | 交互模式 |
|---|---|
| **流式翻译中**（`isStreaming === true`） | 自动展开，实时追加 `reasoning_content` delta 文本 |
| **翻译完成后**（`isStreaming === false`） | 自动折叠为一个可点击的按钮，点击后展开查看完整思考过程 |

这种设计避免了思考链在非必要场景下过度占据屏幕空间，同时让用户在翻译过程中能实时窥见模型的"思考轨迹"。[来源](../src/App.tsx#L205-L215)

---

## 数据流全景

```
llmClient.ts                    useTranslation.ts              useAppStore                    App.tsx
──────────────                  ─────────────────              ────────────                   ───────
streamTranslate()               translate()                    setThinkingContent()           showThinking 条件判断
  ↓ reasoning_content delta    ↓                               ↓                              ↓
onThinking?.(buffer)  ──────►  callbacks.onThinking(text)  ──► set({ thinkingContent })  ──► 渲染 thinking-inline
                                  setThinkingContent(text)                                    <pre>{thinkingContent}</pre>
```

### 第 1 步：`llmClient.ts` — SSE 流中识别 `reasoning_content`

在 `streamTranslate` 函数中，当 `options.supportsThinking === true` 时，请求体会附加两个关键字段：

```typescript
requestBody.reasoning_effort = 'high';
requestBody.extra_body = {
  thinking: {
    type: 'enabled',
    budget_tokens: 1000
  }
};
```

这是 API 层的关键开关：只有设置了 `supportsThinking` 的模型才会发送 `extra_body.thinking`。[来源](../src/lib/llmClient.ts#L61-L68)

在 SSE 行解析循环中，每次收到 delta 数据时检查 `reasoning_content` 字段：

```typescript
if (supportsThinking && data.choices?.[0]?.delta?.reasoning_content) {
  inThinkingBlock = true;
  thinkingBuffer += data.choices[0].delta.reasoning_content;
  callbacks.onThinking?.(thinkingBuffer);
}
```

推理内容不断追加到 `thinkingBuffer`，然后通过 `onThinking` 回调实时推送出去。当 `reasoning_content` 结束、`content` 开始时，缓冲区会被清空，标志着推理阶段的结束。[来源](../src/lib/llmClient.ts#L142-L148)

### 第 2 步：`useTranslation.ts` — 接收回调并写入全局状态

在 `translate` 函数中，`onThinking` 回调被绑定为：

```typescript
onThinking: (text) => {
  thinkingContent = text;
  setThinkingContent(text);
}
```

其中 `setThinkingContent` 正是从 `useAppStore` 解构来的状态更新函数。[来源](../src/hooks/useTranslation.ts#L126-L128)

翻译开始前，`setThinkingContent('')` 先清除上一次残留内容；翻译完成后，思考内容还会被持久化到历史记录中（`addToHistory({ ..., thinkingContent })`）。[来源](../src/hooks/useTranslation.ts#L65) [来源](../src/hooks/useTranslation.ts#L154)

### 第 3 步：`useAppStore` — 全局状态持有

`thinkingContent` 是 Zustand store 中的一个普通字符串字段：

```typescript
thinkingContent: string;          // 类型定义
thinkingContent: '',              // 初始值
setThinkingContent: (content) => set({ thinkingContent: content }),  // setter
```

该字段**不会**被 `persist` 中间件持久化——它在 `partialize` 白名单之外，刷新页面即丢失，这符合"思考链是会话级瞬态数据"的设计意图。详见 [状态管理：Zustand 与持久化策略](状态管理-zustand-与持久化策略.md)。[来源](../src/hooks/useAppStore.ts#L62) [来源](../src/hooks/useAppStore.ts#L135) [来源](../src/hooks/useAppStore.ts#L178)

### 第 4 步：`App.tsx` — 条件渲染与自动折叠管理

App.tsx 中定义了两个关键变量和一个 `useEffect`：

```typescript
const showThinking = thinkingContent && settings.thinkingEnabled !== false;
const [thinkingCollapsed, setThinkingCollapsed] = useState(false);

useEffect(() => {
  if (!isStreaming && thinkingContent) {
    setThinkingCollapsed(true);   // 翻译完成 → 折叠
  }
  if (isStreaming && thinkingContent) {
    setThinkingCollapsed(false);  // 流式进行中 → 展开
  }
}, [isStreaming, thinkingContent]);
```

- **`showThinking`**：`thinkingContent` 非空 **且** 用户未在设置中关闭 `thinkingEnabled`。注意 `thinkingEnabled` 默认值为 `false`，这意味着思考链**默认不显示**，用户需要手动在设置中开启。
- **`thinkingCollapsed`**：流式翻译中自动设为 `false`（展开），翻译完成后自动设为 `true`（折叠）。[来源](../src/App.tsx#L205-L215)

---

## 内联渲染的两套模板

App.tsx 中不直接使用 `ThinkingChain` 组件，而是自行内联渲染。渲染逻辑根据 `isStreaming` 分为两套模板：

### 流式进行中（展开状态）

```tsx
{isStreaming ? (
  <>
    <div className="thinking-header">
      <svg>...</svg>
      <span>{t('thinkingChain.title')}</span>
    </div>
    <pre className="thinking-content">{thinkingContent}</pre>
  </>
) : ( ... )}
```

### 翻译完成（折叠状态）

```tsx
<button className="thinking-collapsed-btn" onClick={() => setThinkingCollapsed(!thinkingCollapsed)}>
  <span className="thinking-icon"><svg>...</svg></span>
  <span>{thinkingCollapsed ? t('thinkingChain.view') : t('thinkingChain.hide')}</span>
  <svg className="thinking-arrow ...">...</svg>
</button>
{!thinkingCollapsed && !isStreaming && (
  <pre className="thinking-content">{thinkingContent}</pre>
)}
```

两套模板共用 `i18n` 键值：`thinkingChain.title`（"思考过程"/"Thinking Process"）、`thinkingChain.view`（"查看思考"/"View thinking"）、`thinkingChain.hide`（"隐藏思考"/"Hide thinking"）。[来源](../src/i18n/locales/zh.json#L185-L189)

---

## ThinkingChain 组件（独立可复用）

`components/ThinkingChain/ThinkingChain.tsx` 定义了一个独立、可复用的展示组件，虽然当前版本中未被 App.tsx 直接引用，但作为架构资产保留。

### Props

```typescript
interface ThinkingChainProps {
  content: string;    // 思考链文本内容
}
```

### 内部状态

```typescript
const [isCollapsed, setIsCollapsed] = useState(false);
```

一个本地布尔值控制组件的展开/折叠。用户点击 `.thinking-header` 按钮时切换 `isCollapsed`。

### 渲染逻辑

```
if (!content) return null;          // 零状态处理
```

渲染结构为：

```
div.thinking-chain
├── button.thinking-header (aria-expanded)
│   ├── div.thinking-title
│   │   ├── span.thinking-icon  🤖
│   │   └── span              {t('thinkingChain.title')}
│   └── svg.thinking-arrow    (collapsed 时旋转 -90°)
└── div.thinking-content (当 !isCollapsed)
    └── pre{content}
```

### CSS 设计要点

- `.thinking-chain`：带 1px 边框和圆角，背景使用 `--color-bg-secondary`
- `.thinking-content pre`：等宽字体、`pre-wrap` 保留空白、`word-break: break-word`、`max-height: 200px` 带滚动
- `.thinking-arrow.collapsed`：`transform: rotate(-90deg)` 箭头向下折叠[来源](../src/components/ThinkingChain/ThinkingChain.css#L1-L52)

---

## `supportsThinking` 模型标记

这是整个思考链功能的**入口开关**，定义在模型配置层。

### 内置提供商模型

```typescript
// loadPrompts.ts
supportsThinking: model.supports_thinking,  // 从内置提供商数据读取
```

### 自定义提供商模型

```typescript
// 用户在 Settings 中新建模型时勾选 "Supports Thinking"
supportsThinking: model.supportsThinking,
```

### 生效链路

```
模型定义 (supports_thinking: true)
    ↓
resolveModelConfig() → ResolvedModelConfig.supportsThinking
    ↓
useTranslation 中: config.supportsThinking && settings.thinkingEnabled !== false
    ↓
streamTranslate 中: supportsThinking → 添加 extra_body.thinking
```

注意在 `fetchAlternatives`（替代翻译）中，`supportsThinking` 被硬编码为 `false`，因为替代功能不需要推理内容。[来源](../src/lib/llmClient.ts#L26) [来源](../src/hooks/useTranslation.ts#L119) [来源](../src/hooks/useTranslation.ts#L245) [来源](../src/lib/prompts/loadPrompts.ts#L439) [来源](../src/lib/prompts/loadPrompts.ts#L459)

---

## 推荐阅读

- [LLM 流式 API 客户端架构](llm-流式-api-客户端架构.md) — 深入分析 `streamTranslate` 的 SSE 流解析和 AbortController 取消机制
- [状态管理：Zustand 与持久化策略](状态管理-zustand-与持久化策略.md) — 理解 `thinkingContent` 为何不被持久化、`partialize` 白名单机制
- [ProviderSwitcher 与 ModelSwitcher 联动机制](providerswitcher-与-modelswitcher-联动机制.md) — 模型 `supportsThinking` 标记的配置入口
- [历史面板与数据管理](历史面板与数据管理.md) — 了解 `thinkingContent` 如何随翻译记录一起持久化到 IndexedDB
- [项目结构与模块依赖图](项目结构与模块依赖图.md) — 将本组件放入全局架构图中查看