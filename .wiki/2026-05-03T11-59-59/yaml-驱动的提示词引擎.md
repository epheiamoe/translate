```markdown
---
title: YAML 驱动的提示词引擎
slug: yaml-驱动的提示词引擎
description: 剖析以 prompts.yaml 为核心的提示词管理系统，包括模板变量替换、多模式 system/user prompt 构建、提供商-模型解析、IndexedDB 自定义覆盖与 TRANSLATION_END_MARKER 截断检测
---

# YAML 驱动的提示词引擎

## 三层架构：数据、逻辑与降级

`src/lib/prompts/` 目录包含三个文件，彼此构成明确的**分层依赖**关系：

```
prompts.yaml ──► loadPrompts.ts ──► defaultPrompts.ts
     │                  │
  数据源             逻辑引擎         降级方案
```

- **prompts.yaml**：唯一的可信数据源，定义所有提示模板、样式描述、语言名称映射、内置提供商及模型规格。
- **loadPrompts.ts**：核心引擎，负责解析 YAML、提供内存缓存、执行变量替换、管理 IndexedDB 自定义覆盖、解析提供商-模型组合、检测翻译完成标记。
- **defaultPrompts.ts**：当 YAML 解析失败时的降级方案，以 TypeScript 字符串硬编码兜底，并导出类型接口供外部消费。

[来源](https://github.com/Epheia/moe.epheia.translate/blob/main/src/lib/prompts)

---

## 数据源：prompts.yaml 的结构化配置

**prompts.yaml** 是这一系统的底层数据源，通过 Vite 的 `?raw` 后缀以原始字符串导入，再由 `yaml` 库解析。其顶层结构包含五个部分：

### 1. 提示模板（system / user）

定义 5 类 system prompt 和 5 类 user prompt，覆盖应用的全部工作模式：

| 角色 | 模板键 | 用途 |
|------|--------|------|
| system | `translation` | 标准翻译 |
| system | `translation_long` | 长文本翻译（含 TRANSLATION_END 指令） |
| system | `parsing` | 语言解释 |
| system | `language_detection` | 语言检测 |
| system | `doc_translation` | 文档翻译（含 Markdown 结构保护指令） |
| system | `alternative_translation` | 替代翻译生成 |
| user | `translation` | 标准翻译用户输入 |
| user | `translation_long` | 长文本用户输入 |
| user | `translation_continue` | 续写翻译（提供上次截断位置） |
| user | `parsing` | 解释模式用户输入 |
| user | `doc_translation` | 文档翻译用户输入 |

此外，`detection_prompt` 是一个独立的、不含变量模板的纯文本检测提示，直接内嵌原文。

### 2. styles 映射

定义五种预设风格描述文本，以及一个可扩展的 `custom` 占位：

```yaml
styles:
  formal: "Use formal, professional language..."
  casual: "Use casual, conversational language..."
  academic: "Use academic language with precise terminology..."
  literary: "Use literary language with expressive elements..."
  unspecified: "Use contextually appropriate style..."
  custom: "{{custom_style}}"  # 由用户自定义填充
```

风格文本在构建 prompt 时通过 `{{style}}` 变量注入。若用户选择 `custom`，`{{custom_style}}` 会被用户输入替换。详见 [翻译风格与自定义指令](翻译风格与自定义指令.md)。

### 3. languages 映射

约 30 种语言的 ISO 639-1 代码到中文名称的映射表，包括一个 `auto`（自动检测）条目。该映射同时用于：
- 变量替换时的语言名称显示
- 语言选择器的可选项列表
- 用户界面中的语言名称显示

详见 [语言检测与自定义语言](语言检测与自定义语言.md)。

### 4. providers 配置

内置 7 个提供商，共 25+ 模型，每个模型包含完整规格：

```
providers:
  deepseek:      # 2 模型（v4 Flash / v4 Pro），均支持思维链
  openai:        # 6 模型（GPT-5.5 → 5.4 Nano），价格跨度 0.2 ~ 30
  anthropic:     # 5 模型（Opus 4.7 → Haiku 4.5），最大上下文 1M
  google:        # 6 模型（Gemini 3.1 Pro → 2.5 Flash Lite），上下文全部 1M
  xai:           # 5 模型（Grok 4.3 → 4.1 Fast），上下文 1M-2M
  mistral:       # 5 模型（Large → Small），含 Codestral / Magistral
  cohere:        # 5 模型（Command A → Light），输出长度 4K-8K
```

每个模型条目包含 `pricing_input` / `pricing_output`（单位：美元/百万 token），这些定价数据在 `getModelConfig` 中透出，供 Token 消耗估算使用。详见 [离线策略与性能优化](离线策略与性能优化.md)。

### 5. custom_providers 占位

定义为空数组 `[]`，由运行时动态注入。详见 [ProviderSwitcher 与 ModelSwitcher 联动机制](providerswitcher-与-modelswitcher-联动机制.md)。

[来源](https://github.com/Epheia/moe.epheia.translate/blob/main/src/lib/prompts/prompts.yaml)

---

## 加载与缓存：loadPrompts.ts 的核心机制

### YAML 解析与内存缓存

`loadPrompts()` 是模块的内部函数，采用**惰性单例模式**：

```typescript
let cachedConfig: PromptConfig | null = null;

function loadPrompts(): PromptConfig {
  if (cachedConfig) return cachedConfig;
  cachedConfig = parse(promptsYaml) as PromptConfig;
  return cachedConfig;
}
```

`promptsYaml` 通过 Vite 的 `?raw` 后缀以字符串形式导入，`yaml.parse()` 将其转换为类型化的 `PromptConfig` 对象。缓存 `cachedConfig` 为模块级变量，首次调用后即驻留内存，后续所有读取操作共享同一对象引用——这也意味着任何对 `config.system` 的修改都会**原地生效**，不必重新解析 YAML。

[来源](https://github.com/Epheia/moe.epheia.translate/blob/main/src/lib/prompts/loadPrompts.ts#L24-L28)

### 变量替换：模板引擎的简约实现

`buildSystemPrompt`、`buildUserPrompt` 和它们的变体（`buildSystemPromptLong`、`buildDocSystemPrompt`、`buildAlternativeSystemPrompt` 等）构成了轻量级模板引擎，核心模式是：

```typescript
systemPrompt = systemPrompt
  .replace('{{source_lang}}', langName)
  .replace('{{target_lang}}', targetLangName);
```

关键设计决策：

- **无模板引擎依赖**：直接使用 `String.replace` 而非 Handlebars/Mustache，零运行时开销。
- **语言名称由 YAML 映射解析**：`langName = prompts.languages[sourceLang] || sourceLang`，若找不到则回退为代码本身。
- **风格注入分叉逻辑**：当 `style === 'custom'` 时，使用 `prompts.styles.custom.replace('{{custom_style}}', customStyle)` 生成个性化风格描述；否则查表取值，默认回退 `formal`。
- **自定义指令与术语表附加**：若传入了 `customInstructions` 或 `glossary`，直接拼接在 system prompt 尾部，不做变量替换——这是有意为之：让自定义指令以固定的后置位置出现，避免与模板变量冲突。

[来源](https://github.com/Epheia/moe.epheia.translate/blob/main/src/lib/prompts/loadPrompts.ts#L137-L177)

### IndexedDB 自定义覆盖系统

`loadPromptsFromDB()` 是应用的**核心初始化调用**，在 `App.tsx` 启动时执行：

```typescript
export async function loadPromptsFromDB(): Promise<void> {
  const [customSystem, customUser] = await Promise.all([
    getRawSetting(STORAGE_KEY_SYSTEM),
    getRawSetting(STORAGE_KEY_USER)
  ]);
  const config = loadPrompts();
  if (customSystem) config.system = { ...config.system, ...customSystem };
  if (customUser)   config.user   = { ...config.user, ...customUser };
}
```

设计要点：

- **浅合并策略**：`{ ...config.system, ...customSystem }` 以用户自定义覆盖 YAML 默认值，但仅替换顶层键。这意味着用户可以只覆盖 `translation` 模板而保留其他所有模板不变。
- **增量持久化**：`saveSystemPrompts` / `saveUserPrompts` 在写入 IndexedDB 后立即更新内存缓存，无需重启。
- **重置机制**：`resetSystemPrompts` / `resetUserPrompts` / `resetAllPrompts` 先将 IndexedDB 中对应键置为 `null`，再重新解析 YAML 恢复出厂默认值——注意这里必须重新执行 `parse(promptsYaml)` 而不是引用缓存，因为缓存可能已被修改。

[来源](https://github.com/Epheia/moe.epheia.translate/blob/main/src/lib/prompts/loadPrompts.ts#L64-L129)

### Provider 与 Model 解析

模块暴露一组查询函数，形成了从 **提供商 ID → 模型 ID → 完整配置** 的解析链路：

```
resolveModelConfig(providerId, modelId, customProviders)
  ├─ 查内置提供商表 ─► 若找到，返回 provider + model 合并信息
  └─ 查自定义提供商 ─► 若找到，apiType 固定为 "openai"，pricing 为 undefined
                      └─ 均未找到，返回 null
```

`getModelConfig(modelId)` 则遍历所有内置提供商，按**模型 ID** 全局搜索（不依赖提供商 ID），返回 `ModelConfig`，包含 `max_context`、`max_output`、`supports_thinking` 和 `pricing_*`。这种设计使 Token 计数和价格估算可以跨提供商统一处理。

`getModelsForProvider(providerId, customProviders)` 用于动态生成模型下拉列表，也时搜索自定义提供商列表。

[来源](https://github.com/Epheia/moe.epheia.translate/blob/main/src/lib/prompts/loadPrompts.ts#L416-L480)

### TRANSLATION_END_MARKER：截断检测与续写边界

```
export const TRANSLATION_END_MARKER = '<!-- TRANSLATION_END -->';
```

这是一个 **HTML 注释标记**，设计原则如下：

1. **不可见性**：作为 HTML 注释，它不会在 UI 渲染结果中出现，即使 LLM 输出被直接渲染。
2. **人类可读**：对 LLM 而言是清晰的终止指令，对开发者调试时一目了然。
3. **低误触概率**：`<!-- ... -->` 格式在普通翻译文本中几乎不会自然出现。

在长文本和文档翻译场景中，该标记的作用链条是：

```
LLM 返回流式内容
    ↓
checkTranslationComplete(content) 检测标记
    ├─ true  ─► removeEndMarker() 剥离标记，翻译完成
    └─ false ─► 构造翻译续写 prompt：
                buildUserPromptContinue(lastContent, remainingText)
                ├─ lastContent  = 前次响应末尾 50 字符（上下文锚点）
                └─ remainingText = 未翻译的源文
```

`buildUserPromptContinue` 将上次响应的尾部 50 字符和剩余源文组合为续写请求，使 LLM 理解从哪里衔接。该机制与 `maxContinuations` 计数器配合使用，防止无限循环。详见 [长文本与文档翻译的分段策略](长文本与文档翻译的分段策略.md)。

[来源](https://github.com/Epheia/moe.epheia.translate/blob/main/src/lib/prompts/loadPrompts.ts#L494-L501)

---

## 降级层：defaultPrompts.ts 的角色

`defaultPrompts.ts` 承担两个职责：

### 1. 类型定义

导出 `SystemPrompts`、`UserPrompts`、`EditablePrompts` 三个接口，它们是整个 prompt 系统的**类型契约**，被 `loadPrompts.ts` 和外部组件共同引用。

### 2. 兜底默认值

`getDefaultSystemPrompts()` 和 `getDefaultUserPrompts()` 返回的内容与 `prompts.yaml` 完全一致的硬编码字符串。其使用场景：

```typescript
export function getCurrentSystemPrompts(): SystemPrompts {
  const defaults = getDefaultSystemPrompts();
  const config = loadPrompts();
  return { ...defaults, ...config.system };
}
```

当 YAML 解析成功时，defaults 被 config 覆盖，无用；但当 YAML 加载失败（如资源文件损坏），`loadPrompts()` 抛出异常时，`getCurrentSystemPrompts` 仍可通过默认值提供可用内容。这种**双保险策略**确保了离线场景下的基本可用性。

[来源](https://github.com/Epheia/moe.epheia.translate/blob/main/src/lib/prompts/defaultPrompts.ts)

---

## 架构总结

提示词引擎的设计遵循了三个原则：

| 原则 | 体现 |
|------|------|
| **配置即代码** | 提示词作为 YAML 数据存在，修改模板无需重新编译 |
| **离线优先** | 内存缓存 + IndexedDB 持久化 + TypeScript 硬编码兜底，三层保障 |
| **关注点分离** | YAML 负责内容、loadPrompts 负责变体组装、defaultPrompts 负责类型与兜底 |

这种设计使得提示词模板可以独立演化，不依赖前端组件逻辑的变更，也为未来支持用户界面内直接编辑提示词（通过 `saveSystemPrompts` / `saveUserPrompts` 接口）预留了架构基础。

---

## 推荐阅读

- [翻译模式与解释模式详解](翻译模式与解释模式详解.md) —— 了解不同模式下 system prompt 的策略差异
- [长文本与文档翻译的分段策略](长文本与文档翻译的分段策略.md) —— TRANSLATION_END_MARKER 在分段续写中的完整运行机制
- [翻译风格与自定义指令](翻译风格与自定义指令.md) —— 风格映射与自定义指令如何与模板变量交互
- [API 密钥与提供商配置](api-密钥与提供商配置.md) —— 提供商与模型的完整配置列表
- [ProviderSwitcher 与 ModelSwitcher 联动机制](providerswitcher-与-modelswitcher-联动机制.md) —— 自定义提供商的动态注册
- [测试体系：Vitest 与 Testing Library](测试体系-vitest-与-testing-library.md) —— 查看 promptBuilder 的单元测试覆盖
```