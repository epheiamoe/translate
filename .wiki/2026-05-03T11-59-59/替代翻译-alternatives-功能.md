现在我已经收集了所有必要的信息。让我来撰写 Wiki 页面。

---

# 替代翻译（Alternatives）功能

**替代翻译** 是 Moe Translate 的一项增值功能：在完成一次翻译后，用户点击按钮即可让 LLM 在保持相同语气风格的前提下，额外生成 3 个语义一致但措辞各异的翻译版本。这些版本以可滚动列表呈现，用户点击任一版本即可切换当前显示的译文。

整个流程可分为四个阶段：**状态准备 → 提示词构建 → API 调用与流式解析 → 版本切换**。下面逐一追踪代码的实际执行路径。

## 一、状态层：四个核心字段

替代翻译功能依赖 Zustand store 中的四个状态变量，定义于 [useAppStore.ts](src/hooks/useAppStore.ts#L78-L79)：

| 字段 | 类型 | 作用 |
|---|---|---|
| `alternatives` | `string[]` | 存放 `parseAlternatives` 解析后的 3 个版本 |
| `showAlternatives` | `boolean` | 控制替代面板的显示/隐藏 |
| `isLoadingAlternatives` | `boolean` | 控制加载状态（旋转圈 + 停止按钮） |
| `originalTranslation` | `string` | 发起请求时对 `targetText` 的快照 |

当用户点击"显示替代翻译"按钮时，UI 首先检查 `alternatives.length > 0`：若已有缓存则直接 `setShowAlternatives(true)`；否则调用 `fetchAlternatives()` 发起新的 API 请求 [来源](src/App.tsx#L416-L424)。

## 二、fetchAlternatives：完整调用链路

`fetchAlternatives` 定义于 [useTranslation.ts:182](src/hooks/useTranslation.ts#L182-L287)，其执行流程如下：

### 2.1 前置检查与状态清理

```typescript
if (!sourceText.trim() || !config?.apiKey || !targetText.trim()) {
  return;
}
```

缺少源文本、API Key 或目标译文（`targetText`）时直接退出。通过后，中止任何正在进行的请求，然后设置状态：

```typescript
setIsLoadingAlternatives(true);
setAlternatives([]);
setShowAlternatives(true);
setOriginalTranslation(targetText); // 快照当前译文
```

`setOriginalTranslation(targetText)` 是关键步骤——它保存了用户当前看到的译文，供后续在列表中以"原始版本"展示 [来源](src/hooks/useTranslation.ts#L192-L196)。

### 2.2 语言二次检测

如果 `sourceLang === 'auto'`，函数会调用 `detectLanguage` 重新检测源语言。这是因为初次翻译时的自动检测结果未被持久化到 store 中，而替代翻译的提示词需要明确的语言名称 [来源](src/hooks/useTranslation.ts#L198-L207)。

### 2.3 加载自定义指令与术语表

```typescript
const [customInstructions, glossary] = await Promise.all([
  getSetting('customInstructions') as Promise<string | undefined>,
  getSetting('glossary') as Promise<string | undefined>
]);
```

这保证了替代翻译版本同样遵守用户配置的自定义指令和术语表 [来源](src/hooks/useTranslation.ts#L209-L213)。

## 三、提示词构建

### 3.1 System Prompt：`buildAlternativeSystemPrompt`

模板来自 [prompts.yaml:51-59](src/lib/prompts/prompts.yaml#L51-L59)：

```yaml
alternative_translation: |
  You are a professional translator. The user will provide a text in {{source_lang}} and its existing translation to {{target_lang}}.
  Please generate 3 different alternative translations while maintaining the same style/tone: {{style}}
  Requirements:
  - All 3 versions must be semantically consistent with the original text
  - Expression styles must be noticeably different from each other
  - Keep the same formal/casual/academic/literary tone as the original translation
  - Use numbering format: 1. ... 2. ... 3. ...
  - Only provide the 3 translations, nothing else
```

`buildAlternativeSystemPrompt` 函数（[loadPrompts.ts:514](src/lib/prompts/loadPrompts.ts#L514-L553)）执行以下替换：

1. `{{source_lang}}` 和 `{{target_lang}}` → 从 `prompts.languages` 中获取语言全名
2. `{{style}}` → 根据 `style` 参数选择对应的风格描述，支持 `formal/casual/academic/literary/unspecified/custom`
3. 如果存在 `customInstructions`，追加在提示词末尾
4. 如果存在 `glossary`，以 `Glossary (use these translations consistently):` 格式追加

与主翻译的 `buildSystemPrompt` 不同，替代翻译的 system prompt **不包含翻译模式（translation/parsing）维度**——它固定为翻译模式，仅生成 3 个版本。

### 3.2 User Prompt：`buildAlternativeUserPrompt`

`buildAlternativeUserPrompt` 函数（[loadPrompts.ts:556](src/lib/prompts/loadPrompts.ts#L556-L568)）构造如下格式：

```
Original English text:
{sourceText}

Existing Chinese translation:
{targetText}
```

这里传入的 `targetText` 是当前显示的译文，即 `fetchAlternatives` 中快照的 `originalTranslation`。将原文和现有译文**同时提供给 LLM**，使模型能够基于已有译文进行变体创作，而不是从零翻译。

### 3.3 与主翻译提示词的对比

| 维度 | 主翻译 (`translate`) | 替代翻译 (`fetchAlternatives`) |
|---|---|---|
| System prompt 模板 | `translation`/`parsing`/`translation_long` | `alternative_translation` |
| User prompt 内容 | 仅原文 | 原文 + 现有译文 |
| 输出约束 | 单个译文 | 3 个版本，编号 "1. 2. 3." |
| 思考链 | 支持（取决于模型和设置） | **关闭**（`supportsThinking: false`） |

## 四、流式调用与实时解析

### 4.1 调用 streamTranslate

```typescript
streamTranslate({
  ...,
  supportsThinking: false,  // 明确关闭思考链
  signal: abortControllerRef.current!.signal,
  callbacks: {
    onChunk: (text) => {
      fullResponse += text;
      const alternatives = parseAlternatives(fullResponse);
      setAlternatives(alternatives);
    },
    ...
  }
});
```

`supportsThinking: false` 是硬编码的——替代翻译不需要显示推理过程，且解析逻辑依赖纯文本格式。关于 `streamTranslate` 的完整设计，参见 [LLM 流式 API 客户端架构](llm-流式-api-客户端架构.md)。

### 4.2 parseAlternatives 解析逻辑

`parseAlternatives` 函数（[loadPrompts.ts:570](src/lib/prompts/loadPrompts.ts#L570-L583)）采用两步解析策略：

```typescript
export function parseAlternatives(response: string): string[] {
  // 第一步：尝试匹配 "1. ... 2. ... 3. ..." 编号格式
  const matches = response.match(/\d\.\s*([^\n]+(?:\n(?!\d\.)[^\n]+)*)/g);
  if (!matches) {
    // 降级：按行分割，去除编号前缀
    const lines = response.split('\n').filter(l => l.trim());
    return lines.map(l => l.replace(/^\d\.\s*/, '').trim()).filter(l => l.length > 0);
  }
  return matches.map(m => {
    const cleaned = m.replace(/^\d\.\s*/, '').trim();
    return cleaned.split('\n').filter(l => l.trim()).join(' ');
  }).filter(l => l.length > 0);
}
```

- **主路径**：使用正则 `\d\.\s*([^\n]+(?:\n(?!\d\.)[^\n]+)*)` 匹配以 "1. "、"2. "、"3. " 开头的段落。每个段落可以跨多行，直到遇到下一个编号标记。
- **降级路径**：如果 LLM 未按编号格式返回，则按行分割并去除行首的 "1. " 等前缀。

**重要细节**：`onChunk` 回调每收到一个数据块就调用一次 `parseAlternatives`。这意味着在流式传输过程中，`alternatives` 数组会不断更新——用户可能在完整响应到达之前就看到部分结果。这种渐进式渲染提升了感知速度。

### 4.3 完成后的处理

流式完成后，`onDone` 回调会将 token 用量记录到 IndexedDB（通过 `addTokenUsage` 和 `setLastUsage`），并在 `finally` 块中将 `isLoadingAlternatives` 重置为 `false`，释放 `abortControllerRef` [来源](src/hooks/useTranslation.ts#L274-L280)。

## 五、UI 层：三种状态

[App.tsx:416-499](src/App.tsx#L416-L499) 中渲染了三种互斥的 UI 状态：

### 5.1 入口按钮：`show-alternatives-btn`

```tsx
{!showAlternatives && !isStreaming && useAppStore.getState().targetText && (
  <button className="show-alternatives-btn" onClick={() => {
    if (alternatives.length > 0) {
      setShowAlternatives(true);
    } else {
      fetchAlternatives();
    }
  }}>
    {t('translation.showAlternatives')}
  </button>
)}
```

条件：**未显示替代面板** + **不在流式翻译中** + **存在译文**。按钮首次点击时若已有缓存则直接显示，否则发起请求。

### 5.2 加载状态：旋转圈 + 停止按钮

```tsx
{isLoadingAlternatives && (
  <div className="alternatives-loading">
    <span className="spinner"></span>
    {t('translation.loadingAlternatives')}
    <button className="alternatives-stop-btn" onClick={stopTranslation}>
      <svg ...><rect x="6" y="6" width="12" height="12"/></svg>
    </button>
  </div>
)}
```

停止按钮调用 `stopTranslation`，触发 `AbortController.abort()`，在 `fetchAlternatives` 的 catch 块中被静默捕获（仅忽略 `Translation cancelled` 错误）[来源](src/hooks/useTranslation.ts#L269-L273)。

### 5.3 结果面板：替代版本列表

面板包含头部（标题 + 重新生成按钮 + 关闭按钮）和列表：

```tsx
<div className="alternatives-list">
  {originalTranslation && (
    <div className="alternative-item current" onClick={() => setTargetText(originalTranslation)}>
      <span className="alternative-number">1.</span>
      <span className="alternative-text">{originalTranslation}</span>
    </div>
  )}
  {alternatives.map((alt, i) => (
    <div key={i} className="alternative-item" onClick={() => setTargetText(alt)}>
      <span className="alternative-number">{offset + i + 1}.</span>
      <span className="alternative-text">{alt}</span>
    </div>
  ))}
</div>
```

- **第一项始终是"原始版本"**（编号 1），即发起请求时 `targetText` 的快照，带 `current` CSS 类名以突出显示
- **后续项**为 LLM 生成的 3 个替代版本，编号从 2 开始
- 每个版本都是可点击的，点击后调用 `setTargetText(version)` 切换当前显示的译文

`alternatives-regenerate` 按钮在 `isLoadingAlternatives` 时为 `disabled`，防止重复请求 [来源](src/App.tsx#L452-L453)。

### 5.4 CSS 动画与样式

面板使用 `slideDown` 动画展开（`animation: slideDown 0.3s ease-out`），列表区域 `max-height: 200px` 支持滚动。原始版本项左侧有 3px 宽的蓝色指示条（`.alternative-item.current::before`）[来源](src/App.css#L854-L858)。

## 六、数据流全景

```mermaid
flowchart TD
    A[用户点击"显示替代翻译"] --> B{alternatives 有缓存?}
    B -->|有| C[setShowAlternatives=true]
    B -->|无| D[fetchAlternatives]
    
    D --> E[setIsLoadingAlternatives=true]
    E --> F[setOriginalTranslation=targetText]
    F --> G[构建 system prompt<br>调用 buildAlternativeSystemPrompt]
    G --> H[构建 user prompt<br>调用 buildAlternativeUserPrompt]
    H --> I[streamTranslate<br>supportsThinking=false]
    I --> J[onChunk: parseAlternatives]
    J --> K[setAlternatives 更新列表]
    I --> L[onDone: 记录 token 用量]
    L --> M[setIsLoadingAlternatives=false]
    
    K --> N[用户点击某版本]
    N --> O[setTargetText 切换译文]
    
    C --> N
```

## 七、注意事项

1. **独立 API 调用**：替代翻译是独立于主翻译的二次 API 调用，每次点击都消耗额外的 token。与主翻译共用同一个 `abortControllerRef`、API Key 和模型配置。
2. **无思考链**：`supportsThinking: false` 硬编码——替代翻译不需要展示推理过程，且 `parseAlternatives` 依赖纯文本格式，思考链内容会干扰解析。
3. **渐进式渲染**：`parseAlternatives` 在流式过程中反复调用，早期 chunk 可能产生不完整的版本（如仅解析出 1 个），随着更多数据的到达逐渐增至 3 个。
4. **原始版本快照**：`originalTranslation` 在请求发起时快照，即使用户在流式过程中手动修改了 `targetText` 区域，原始版本也不会改变。
5. **隐藏时机**：当用户发起新的主翻译请求时，`translate` 函数会调用 `setAlternatives([])` 和 `setShowAlternatives(false)` 重置状态 [来源](src/hooks/useTranslation.ts#L69-L70)。

## 相关章节

- [翻译模式与解释模式详解](翻译模式与解释模式详解.md) — 了解三种工作模式下 system prompt 的区别
- [YAML 驱动的提示词引擎](yaml-驱动的提示词引擎.md) — 深入了解 `prompts.yaml` 中模板变量的完整替换机制
- [LLM 流式 API 客户端架构](llm-流式-api-客户端架构.md) — 理解 `streamTranslate` 的 SSE 流解析与 AbortController 取消机制
- [状态管理：Zustand 与持久化策略](状态管理-zustand-与持久化策略.md) — 深入 store 层的完整状态定义
- [翻译组件：TranslationArea 与 MarkdownRenderer](翻译组件-translationarea-与-markdownrenderer.md) — `setTargetText` 切换译文后如何影响展示组件