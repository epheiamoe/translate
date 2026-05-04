现在我已获取全部必要源码，开始撰写。

---

# LLM 流式 API 客户端架构

**`llmClient.ts`** 是 Moe Translate 与 LLM 提供商网络通信的唯一桥梁。它不关心业务逻辑——不知道翻译模式、风格系统、语言列表——只负责一件事：将结构化的提示词转换成 HTTP 请求，从流式响应中逐字节提取文本块，并分派给回调。这种关注点分离使得流式协议的所有边缘情况（断线、空行、格式异常、中止信号）都封装在单一模块中，其余代码只需消费 `StreamCallbacks` 接口。

本文逐行拆解 `streamTranslate` 的设计决策，涵盖从请求体组装到 SSE 解析、思考链分发、令牌用量跟踪、双 AbortController 桥接，再到 `detectLanguage` 的非流式补集设计。

---

## 1. 请求体构建：协议适配层的起点

`streamTranslate` 接收一个 `StreamTranslateOptions` 对象，其核心字段经过两层映射后组装成最终 HTTP body：

**消息数组**直接从入参映射：

```typescript
const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userPrompt }
];
```
[来源](src/lib/llmClient.ts#L53-L56)

**基础请求体**固定包含 `model`、`messages` 和 `stream: true`——这三者是 OpenAI 兼容 API 流式调用的最小契约：

```typescript
const requestBody: Record<string, unknown> = {
  model,
  messages,
  stream: true
};
```
[来源](src/lib/llmClient.ts#L58-L62)

**思考链扩展字段**通过条件分支注入。当 `supportsThinking` 为 `true` 时，附加两个字段：顶层 `reasoning_effort: 'high'` 是 OpenAI 规范中控制推理深度的参数；`extra_body` 则是为 DeepSeek 等提供商预留的专有参数通道，其内部的 `thinking` 对象指示启用推理模式并分配 1000 token 的预算：

```typescript
if (supportsThinking) {
  requestBody.reasoning_effort = 'high';
  requestBody.extra_body = {
    thinking: { type: 'enabled', budget_tokens: 1000 }
  };
}
```
[来源](src/lib/llmClient.ts#L64-L71)

> 注意：`supportsThinking` 的值最终追溯至 `prompts.yaml` 中每个模型的 `supports_thinking` 布尔字段（如 `deepseek-v4-flash` 为 `true`、`gpt-5.4-mini` 为 `false`），经 `resolveModelConfig` 映射为 `supportsThinking`。
> [来源](src/lib/prompts/loadPrompts.ts#L436-L439)

---

## 2. SSE 流读取管线：Fetch + Reader + TextDecoder + 行分割

### 2.1 发起 POST 请求

使用标准 Fetch API，请求头包含 `Content-Type: application/json` 和 `Authorization: Bearer ${apiKey}`。`signal` 参数绑定一个 **有效信号**（见第 6 节），使得 Fetch 可被外部中止：

```typescript
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify(requestBody),
  signal: effectiveSignal
});
```
[来源](src/lib/llmClient.ts#L83-L90)

非 2xx 响应直接抛出异常，包含状态码和响应体文本。无 Body 的响应也单独处理：

```typescript
if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`API error: ${response.status} - ${errorText}`);
}
if (!response.body) {
  throw new Error('No response body');
}
```
[来源](src/lib/llmClient.ts#L92-L98)

### 2.2 获取 ReadableStream reader

`response.body` 是 `ReadableStream<Uint8Array>`，调用 `.getReader()` 获得可以逐 chunk 拉取的 reader。与此同时实例化 `TextDecoder` 用于二进制→字符串转换：

```typescript
const reader = response.body.getReader();
const decoder = new TextDecoder();
```
[来源](src/lib/llmClient.ts#L100-L101)

### 2.3 主循环：逐 chunk 读取

循环调用 `reader.read()`，返回 `{ done, value }`。`done` 为 `true` 时退出循环：

```typescript
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // ... 处理 value
}
```
[来源](src/lib/llmClient.ts#L108-L111)

### 2.4 TextDecoder 流式解码 + buffer 分行策略

此处有一个关键的流式处理模式：`TextDecoder.decode(value, { stream: true })` 的 `stream: true` 告知解码器当前 chunk 可能不完整（多字节字符可能被截断），解码器内部会保留部分字节状态。解码后的文本追加到 `buffer` 中，然后按 `\n` 分割成行数组。**最后一行总是残留的不完整行**，用 `buffer = lines.pop() || ''` 将其保留回 buffer，等待下一个 chunk 补全：

```typescript
buffer += decoder.decode(value, { stream: true });
const lines = buffer.split('\n');
buffer = lines.pop() || '';
```
[来源](src/lib/llmClient.ts#L113-L115)

> 这种"分割-退回最后一行"模式（dequeue-with-requeue）是流式行解析的标准做法，确保 SSE 事件边界不因网络分包而被破坏。

### 2.5 SSE 行解析：data: 前缀与 [DONE] 标记

遍历每一行，执行三道过滤：

1. **空行跳过**：`trimmedLine` 为空时 `continue`
2. **[DONE] 终止**：若行内容精确为 `data: [DONE]`，调用 `callbacks.onDone(lastUsage)` 并 return——这是 OpenAI SSE 协议的结束信号
3. **data: 前缀校验**：不以 `data: ` 开头的行直接跳过（忽略注释行、事件类型行等非数据行）

```typescript
if (trimmedLine === 'data: [DONE]') {
  callbacks.onDone(lastUsage);
  return;
}
if (!trimmedLine.startsWith('data: ')) {
  continue;
}
const jsonStr = trimmedLine.slice(6);
```
[来源](src/lib/llmClient.ts#L121-L131)

`trimmedLine.slice(6)` 剥离前缀 `data: `，剩余部分即为 JSON 字符串。解析失败的行（格式）静默跳过，**不中断流处理**——这是对部分提供商偶发非标准输出的容错：

```typescript
try {
  const data = JSON.parse(jsonStr);
  // ... 处理 data
} catch {
  // Skip malformed JSON
}
```
[来源](src/lib/llmClient.ts#L133-L148)

---

## 3. 思考链提取：reasoning_content 的分发逻辑

`supportsThinking` 为 `true` 时，`streamTranslate` 监听 `data.choices[0].delta.reasoning_content` 字段。这是 DeepSeek Reasoner / OpenAI o-series 等模型在输出最终内容之前推送的中间推理过程。

实现维护两个状态：`thinkingBuffer`（累积的推理文本）和 `inThinkingBlock`（布尔标志，标记当前是否处于推理阶段）：

```typescript
let thinkingBuffer = '';
let inThinkingBlock = false;
```
[来源](src/lib/llmClient.ts#L103-L104)

**推理内容到达**时，设置 `inThinkingBlock = true`，追加内容到 `thinkingBuffer`，并调用 `callbacks.onThinking?.(thinkingBuffer)`——注意每次新 chunk 都传递整个累积 buffer，而非仅增量。这简化了 UI 端的处理：`ThinkingChain` 组件直接替换显示即可，无需自行拼接：

```typescript
if (supportsThinking && data.choices?.[0]?.delta?.reasoning_content) {
  inThinkingBlock = true;
  thinkingBuffer += data.choices[0].delta.reasoning_content;
  callbacks.onThinking?.(thinkingBuffer);
}
```
[来源](src/lib/llmClient.ts#L135-L139)

**推理结束、内容到达**时，检测到 `inThinkingBlock` 为 `true`，先触发一次 `onThinking` 最终推送（刷新推理完整文本），然后重置标志和 buffer：

```typescript
else if (data.choices?.[0]?.delta?.content) {
  if (inThinkingBlock && callbacks.onThinking) {
    callbacks.onThinking(thinkingBuffer);
    inThinkingBlock = false;
    thinkingBuffer = '';
  }
  callbacks.onChunk(data.choices[0].delta.content);
}
```
[来源](src/lib/llmClient.ts#L140-L147)

这个推理→内容的边界检测确保了 UI 能够表现"推理完成，开始输出"的转场——`ThinkingChain` 组件正是利用这一机制在推理内容尾部渲染转场动画。参见[思考链展示组件](思考链-thinking-chain-展示组件.md)。

---

## 4. TokenUsage 追踪：从 stream 中捕获 usage

在 SSE JSON 解析体中，每行数据都可能携带 `data.usage` 字段。部分提供商（如 DeepSeek、OpenAI）只在最后一个 chunk 中返回完整的 token 用量，但某些中间 chunk 也可能包含阶段性统计数据。`streamTranslate` 的实现策略是：**持续更新**：

```typescript
if (data.usage) {
  lastUsage = data.usage;
  lastTokenUsage = data.usage;  // 模块级变量，供外部查询
}
```
[来源](src/lib/llmClient.ts#L170-L173)

`lastTokenUsage` 是模块级变量，通过 `getLastTokenUsage()` 暴露，供组件在翻译结束后非侵入式查询最后一次用量。`callbacks.onDone(lastUsage)` 将最终 usage 传入 `useTranslation.ts`，后者将其持久化到 IndexedDB 的 `tokenStats` 表中：

```typescript
if (lastUsage) {
  await addTokenUsage(lastUsage.total_tokens);
  await setLastUsage(lastUsage.total_tokens);
}
```
[来源](src/hooks/useTranslation.ts#L113-L116)

关于 Token 统计的持久化设计详见 [IndexedDB 数据层设计](indexeddb-数据层设计.md)，关于估算误差见[离线策略与性能优化](离线策略与性能优化.md)。

---

## 5. AbortController 双信号桥接：内外两层的取消链路

`streamTranslate` 实现了**双 AbortController 模式**，原因在于 `useTranslation.ts` 的 `stopTranslation` 需要能从外部取消正在进行的流请求，而 `streamTranslate` 内部也需要一个可控的 abort 令牌。

实现细节：

1. 在函数内部实例化一个**私有** `abortController`：
```typescript
const abortController = new AbortController();
```
[来源](src/lib/llmClient.ts#L73)

2. 基于入参 `signal` 的存在与否确定**有效信号**：
```typescript
const effectiveSignal = signal || abortController.signal;
```
[来源](src/lib/llmClient.ts#L74)

3. **关键桥接**：若传入外部 `signal`，在它上面注册 abort 事件监听器，触发时调用内部 `abortController.abort()`：
```typescript
if (signal) {
  signal.addEventListener('abort', () => {
    abortController.abort();
  });
}
```
[来源](src/lib/llmClient.ts#L76-L80)

这保证了无论哪一端触发取消——外部通过 `abortControllerRef.current.abort()`，内部通过任何逻辑——最终 `effectiveSignal` 都会进入 aborted 状态，Fetch API 抛出的 `AbortError` 在 catch 块中被捕获并转为友好的错误消息：

```typescript
if ((error as Error).name === 'AbortError') {
  callbacks.onError(new Error('Translation cancelled'));
}
```
[来源](src/lib/llmClient.ts#L155-L156)

在 `useTranslation.ts` 一侧，`abortControllerRef` 管理着外部 `AbortController` 的生命周期。每次新翻译开始时，旧 controller 被 abort，新 controller 创建：

```typescript
if (abortControllerRef.current) {
  abortControllerRef.current.abort();
}
abortControllerRef.current = new AbortController();
```
[来源](src/hooks/useTranslation.ts#L47-L49)

`stopTranslation` 直接引用该 ref：

```typescript
const stopTranslation = useCallback(() => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
  }
}, []);
```
[来源](src/hooks/useTranslation.ts#L39-L44)

---

## 6. detectLanguage：非流式的补集设计

与 `streamTranslate` 相对，`detectLanguage` 是一个**一次性非流式请求**，用于在翻译开始前确定源语言。其设计遵循两个原则：

### 6.1 请求体最小化

`stream: false`、没有系统 prompt、只有一条 user message：

```typescript
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: model || 'deepseek-v4-flash',
    messages: [{ role: 'user', content: prompt }],
    stream: false
  })
});
```
[来源](src/lib/llmClient.ts#L179-L189)

默认为 `deepseek-v4-flash`（当前最快模型），可被可选参数覆盖。

### 6.2 响应解析 + 正则提取

直接 `response.json()` 取 `choices[0].message.content`。由于系统提示词要求模型只返回 ISO 639-1 代码，客户端用正则 `/^[a-z]{2}(-[A-Z]{2})?/` 提取前两个字母（及可选的地区子标签）。不匹配时兜底返回 `'en'`：

```typescript
const data = await response.json();
const content = data.choices?.[0]?.message?.content;
if (typeof content === 'string') {
  const match = content.match(/^[a-z]{2}(-[A-Z]{2})?/);
  if (match) return match[0].toLowerCase();
}
return 'en';
```
[来源](src/lib/llmClient.ts#L191-L199)

### 6.3 调用时序

在 `useTranslation.ts` 的 `translate` 函数中，`detectLanguage` 在 **state 重置之后、streamTranslate 调用之前** 执行。只有当 `sourceLang === 'auto'` 时才会触发，且只取输入文本的前 200 个字符作为检测样本以降低 token 消耗：

```typescript
if (sourceLang === 'auto') {
  const detectionPrompt = buildDetectionPrompt(sourceText.slice(0, 200));
  resolvedSourceLang = await detectLanguage(
    config.baseUrl, config.apiKey, detectionPrompt
  );
}
```
[来源](src/hooks/useTranslation.ts#L59-L65)

若检测请求失败（网络错误、API 异常），静默降级至 `'en'`，不阻塞翻译流程。

---

## 7. 从 useTranslation 到 streamTranslate：callbacks 的组装

`useTranslation.ts` 中的 `translate` 函数是 `streamTranslate` 的唯一高层调用入口。其回调组装方式反映了数据流的完整路径：

| 回调 | 闭包内行为 | 数据终点 |
|------|-----------|---------|
| `onChunk` | 追加到 `fullResponse`，调用 `setTargetText(removeEndMarker(fullResponse))` | Zustand store → `TranslationArea` 组件 |
| `onThinking` | 赋值 `thinkingContent`，调用 `setThinkingContent(text)` | Zustand store → `ThinkingChain` 组件 |
| `onDone` | 记录 `lastUsage`，调用 `resolve()` 结束 Promise | 触发后续 token 持久化和历史记录写入 |
| `onError` | 调用 `reject(error)` 结束 Promise | 进入 catch 块，调用 `setTranslationError` |

[来源](src/hooks/useTranslation.ts#L96-L112)

这里有一个微妙的设计：`streamTranslate` 是 `async` 函数，但 `useTranslation` 没有直接用 `await` 调用它，而是将其包装在 `new Promise<void>` 中，用 `resolve/reject` 桥接回调。这是因为 `streamTranslate` 本身在流结束后才 resolve，而 `onDone`/`onError` 回调需要在 resolve 之前完成状态更新——Promise 构造器提供了精确的控制时机。

翻译完成后，如果 `lastUsage` 非空，将其持久化到 IndexedDB，然后才写入历史记录。这种**先记 token，再记历史**的顺序确保了即使历史写入失败，token 统计也不会丢失：

```typescript
if (lastUsage) {
  await addTokenUsage(lastUsage.total_tokens);
  await setLastUsage(lastUsage.total_tokens);
}
await addToHistory({ /* ... */ });
```
[来源](src/hooks/useTranslation.ts#L113-L121)

---

## 8. 模块整体数据流图

```mermaid
flowchart TD
    A[useTranslation.translate] --> B{sourceLang === 'auto'?}
    B -->|Yes| C[detectLanguage]
    B -->|No| D[build prompts]
    C --> D
    D --> E[streamTranslate]
    
    subgraph E [streamTranslate 内部]
        E1[构建请求体<br/>model + messages + stream:true<br/>+ reasoning_effort (可选)]
        E2[Fetch POST]
        E3[ReadableStream.getReader]
        E4[逐 chunk 读取]
        E5[TextDecoder + buffer 分行]
        E6[SSE 行解析<br/>data: 前缀 / [DONE] 标记]
        E7{thinking?} -->|reasoning_content| E8[onThinking]
        E7 -->|content| E9[onChunk]
        E10[usage 捕获]
        E11[onDone / onError]
        
        E1 --> E2 --> E3 --> E4 --> E5 --> E6 --> E7
        E6 --> E10
        E10 --> E11
    end
    
    E -->|onChunk| F[setTargetText → UI 实时更新]
    E -->|onThinking| G[setThinkingContent → ThinkingChain]
    E -->|onDone| H[resolve Promise]
    H --> I[addTokenUsage + addToHistory]
    
    J[AbortController 桥接] -->|abort| E2
    K[stopTranslation] --> J
```

---

## 9. 异常与边界情况一览

| 场景 | 处理方式 |
|------|---------|
| 非 2xx HTTP 响应 | 抛出 `API error: ${status} - ${body}` |
| 无 response.body | 抛出 `No response body` |
| SSE 行非 JSON | `catch` 静默跳过，不中断流 |
| SSE 行无 `data: ` 前缀 | 整行跳过 |
| `[DONE]` 前断开 | 主循环 `done` 退出，调用 `onDone(lastUsage)` |
| AbortError | 转为 `Translation cancelled` 错误 |
| detectLanguage 失败 | 降级为 `'en'`，不阻塞翻译 |

[来源](src/lib/llmClient.ts#L92-L98, L121-L123, L133-L135, L155-L156)

---

## 下一步

- 查看 [思考链展示组件](思考链-thinking-chain-展示组件.md) 如何消费 `onThinking` 回调的累积数据。
- 查看 [流程状态管理：Zustand 与持久化策略](状态管理-zustand-与持久化策略.md) 理解 `setTargetText` 等状态写入的持久化链路。
- 查看 [YAML 驱动的提示词引擎](yaml-驱动的提示词引擎.md) 了解 `buildSystemPrompt`/`buildUserPrompt` 如何生成 `streamTranslate` 的入参。
- 查看 [替代翻译功能](替代翻译-alternatives-功能.md) 了解 `fetchAlternatives` 如何复用 `streamTranslate` 的同一管线但传入不同的 prompt 和 `supportsThinking: false`。