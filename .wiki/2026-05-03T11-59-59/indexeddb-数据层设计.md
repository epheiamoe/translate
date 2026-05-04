现在我有了完整的代码上下文，可以撰写这篇关于 IndexedDB 数据层设计的 Wiki 页面了。

---

# IndexedDB 数据层设计

Moe Translate 的持久化方案采用浏览器原生 IndexedDB 作为存储后端，而非传统的 localStorage。这一选择出于容量考量——翻译历史可能包含大量文本记录，而 IndexedDB 的存储上限（通常为磁盘可用空间的 50%）远高于 localStorage（5MB）。数据层作为 `lib/db.ts` 独立模块存在，通过 Zustand store 的 action 函数间接暴露给 UI 层。如需了解状态管理整体架构，可参考 [状态管理：Zustand 与持久化策略](状态管理-zustand-与持久化策略.md)。

---

## 数据库初始化与 Schema

数据库名为 `'translate-pwa-db'`，当前版本为 `2`。初始化逻辑集中在 `getDB()` 函数的 `onupgradeneeded` 回调中，该函数采用 **IDBDatabase 单例模式**——首次调用时打开连接并缓存 `dbInstance`，后续复用已建立的连接。

```mermaid
flowchart TD
    A[getDB()] --> B{dbInstance 已存在?}
    B -->|是| C[返回 dbInstance]
    B -->|否| D[indexedDB.open\nDB_VERSION=2]
    D --> E{onupgradeneeded}
    E --> F[创建 history store\nkeyPath: id, autoIncrement]
    F --> G[创建 history 索引\ntimestamp, isFavorite]
    G --> H[创建 settings store\nkeyPath: key]
    H --> I[创建 tokenStats store\nkeyPath: key]
    I --> J[缓存 dbInstance\n返回连接]
```

`onupgradeneeded` 中通过 `db.objectStoreNames.contains()` 做幂等检查，防止重复创建。三个 **object store** 的设计意图如下：

| Store | keyPath | 目的 |
|-------|---------|------|
| `history` | `id`（autoIncrement） | 存储翻译记录，支持时间戳和收藏状态索引 |
| `settings` | `key` | 键值对存储应用配置 |
| `tokenStats` | `key` | 键值对存储 Token 消耗统计 |

[来源](../src/lib/db.ts#L68-L82)

---

## history Store：翻译记录存储

### TranslationRecord 类型

翻译记录的核心接口定义如下：

```typescript
export interface TranslationRecord {
  id?: number;               // 自增主键（写入前可选）
  sourceText: string;        // 原文
  targetText: string;        // 译文
  sourceLang: string;        // 源语言代码
  targetLang: string;        // 目标语言代码
  mode: 'translation' | 'parsing';  // 翻译模式/解释模式
  style: string;             // 翻译风格
  customStyle?: string;      // 自定义风格
  timestamp: number;         // Unix 时间戳（毫秒）
  isFavorite: boolean;       // 是否收藏
  thinkingContent?: string;  // 思考链内容（可选）
}
```

[来源](../src/lib/db.ts#L1-L15)

`id` 字段在写入时由 IndexedDB 自增分配，因此 `saveTranslation()` 接受的参数类型为 `Omit<TranslationRecord, 'id'>`。`thinkingContent` 字段用于保存支持 reasoning 的模型（如 DeepSeek Reasoner）的推理过程，详见 [思考链（Thinking Chain）展示组件](思考链-thinking-chain-展示组件.md)。

### 索引设计

history store 创建了两个非唯一索引：

- **`timestamp` 索引**：用于按时间倒序排序历史记录。`getAllHistory()` 在获取全部记录后，在内存中按 `b.timestamp - a.timestamp` 排序。
- **`isFavorite` 索引**：用于快速筛选收藏记录。但当前实现并未直接使用该索引，而是通过 `getAll()` 全量获取后过滤 `record.isFavorite === true`。

[来源](../src/lib/db.ts#L76-L79)

### 自动清理策略

每次成功写入新记录后，`saveTranslation()` 会调用 `cleanupOldRecords()` 执行自动清理。其规则为：

- **数量上限**：`MAX_RECORDS = 1000`，仅对非收藏记录计数。
- **时间上限**：`MAX_DAYS = 30`，仅对非收藏记录检查。
- **收藏豁免**：收藏记录（`isFavorite === true`）完全不受清理影响，永不自动删除。

```typescript
// 核心逻辑（简化）
nonFavorites.sort((a, b) => b.timestamp - a.timestamp);

// 策略 1：超出数量上限的旧记录
for (let i = MAX_RECORDS; i < nonFavorites.length; i++) {
  toDelete.push(nonFavorites[i].id);
}

// 策略 2：超过 30 天的过期记录
for (const record of nonFavorites) {
  if (now - record.timestamp >= maxAge) {
    toDelete.push(record.id);
  }
}
```

[来源](../src/lib/db.ts#L120-L166)

这一设计确保用户不会因长期使用导致存储膨胀，同时收藏记录作为用户主动标记的有价值数据得到永久保留。

### CRUD 操作

| 函数 | 操作 | 用途 |
|------|------|------|
| `saveTranslation()` | Create | 写入新记录，触发清理 |
| `updateTranslation()` | Update | 更新完整记录（`store.put`） |
| `deleteTranslation()` | Delete | 按 id 删除单条 |
| `getAllHistory()` | Read | 获取全部历史（按时间倒序） |
| `getFavorites()` | Read | 获取全部收藏 |
| `toggleFavorite()` | Update | 切换收藏状态（读→改→写） |
| `clearHistory()` | Delete | 清空整个 store |

`toggleFavorite()` 的实现体现了 IndexedDB 的事务特点：先 `store.get(id)` 读出记录，修改 `isFavorite` 字段，再 `store.put(record)` 写回。这两步操作在同一事务中执行，保证了原子性。

[来源](../src/lib/db.ts#L84-L181)

---

## settings Store：泛型键值对

settings store 采用最简的 key-value 模式，`keyPath` 为 `'key'`。值的类型通过 TypeScript 泛型约束保证：

```typescript
export async function saveSetting<K extends keyof AppSettings>(
  key: K, 
  value: AppSettings[K]
): Promise<void>

export async function getSetting<K extends keyof AppSettings>(
  key: K
): Promise<AppSettings[K] | undefined>
```

[来源](../src/lib/db.ts#L183-L216)

`AppSettings` 接口定义了所有可持久化的配置项，包括：

- 默认语言对（`defaultSourceLang`、`defaultTargetLang`）
- 默认模式与风格（`defaultMode`、`defaultStyle`、`customStyle`）
- 提示词配置（`customInstructions`、`glossary`）
- 提供商与模型选择（`selectedProvider`、`selectedModel`、`providerApiKeys`）
- 自定义实体（`customLanguages`、`customProviders`）
- 主题变量与自定义 CSS（`cssVariables`、`customCSS`）
- 功能开关（`thinkingEnabled`）

此外还提供了 `getRawSetting` / `saveRawSetting` 作为类型安全版本的回退，供 `loadPromptsFromDB` 等外部模块动态读写未预定义的键。

[来源](../src/lib/db.ts#L218-L260)

settings store 与 [状态管理：Zustand 与持久化策略](状态管理-zustand-与持久化策略.md) 中的 `persist` 中间件形成双重持久化：Zustand 负责将部分 settings 同步到 localStorage 以便应用启动时快速恢复，IndexedDB 作为权威存储用于跨会话的完整配置同步。

---

## tokenStats Store：月度统计与自动重置

tokenStats store 存储 `TokenStats` 类型数据：

```typescript
export interface TokenStats {
  totalTokens: number;       // 累计总消耗
  monthlyTokens: number;     // 本月消耗
  lastResetDate: string;     // 上次重置月份 "YYYY-MM"
}
```

[来源](../src/lib/db.ts#L275-L279)

### 核心 API

- **`getTokenStats()`**：读取统计信息，内部包含自动重置逻辑。如果当前月份与 `lastResetDate` 不匹配，则将 `monthlyTokens` 归零，同时将上一月的消耗累加到 `totalTokens`。
- **`addTokenUsage(tokens)`**：增加消耗计数，内部调用 `getTokenStats()` 获取当前状态，累加后写入。
- **`getLastUsage()` / `setLastUsage()`**：记录最近一次翻译消耗的 Token 数，用于在 UI 中单次显示。

[来源](../src/lib/db.ts#L281-L337)

### 自动重置机制

```typescript
if (result.lastResetDate !== currentMonth) {
  const newStats: TokenStats = {
    totalTokens: result.totalTokens + result.monthlyTokens,  // 将上月合并到累计
    monthlyTokens: 0,                                          // 月度归零
    lastResetDate: currentMonth                                // 更新月份
  };
  resolve(newStats);
}
```

这一设计确保月度统计在跨月首次访问时自动重置，无需额外的定时器或外部调度。关于 Token 统计的 UI 展示和使用方式，可参考 [离线策略与性能优化](离线策略与性能优化.md) 中的 Token 消耗追踪章节。

---

## 数据导入导出

`exportData()` 和 `importData()` 实现了完整的数据库序列化与反序列化：

```typescript
export async function exportData(): Promise<string> {
  const history = await getAllHistory();
  const settings = await getAllSettings();
  return JSON.stringify({ history, settings }, null, 2);
}
```

[来源](../src/lib/db.ts#L262-L265)

导出格式为包含 `history` 和 `settings` 两个顶级字段的 JSON 对象。导入时，历史记录会剥离 `id` 字段后重新写入（以触发自增主键分配），设置则逐条调用 `saveSetting()` 写入。

在 [历史面板与数据管理](历史面板与数据管理.md) 中，`HistoryPanel` 通过 Zustand action `exportData` / `importData` 触发这些函数，并处理文件下载/上传的 DOM 操作。

---

## Promise 封装与单例模式

所有数据库操作函数都遵循相同的模式：

```typescript
export async function someOperation(): Promise<T> {
  const db = await getDB();                     // 1. 获取连接
  return new Promise((resolve, reject) => {     // 2. 包装为 Promise
    const transaction = db.transaction([...], 'readonly');
    const store = transaction.objectStore('...');
    const request = store.xxx();                // 3. IndexedDB 操作
    
    request.onsuccess = () => resolve(result);
    request.onerror = () => reject(request.error);
  });
}
```

[来源](../src/lib/db.ts#L28-L47)

这种模式有三个关键设计考量：

1. **单例连接**：`dbInstance` 变量缓存 `IDBDatabase` 实例，避免重复打开连接的开销。
2. **异步统一**：将 IndexedDB 基于事件的异步模型（`onsuccess` / `onerror`）统一为 Promise，使调用方可使用 `async/await`。
3. **事务隔离**：每个函数创建独立的事务，Reader 使用 `readonly`，Writer 使用 `readwrite`，由 IndexedDB 引擎处理并发控制。

---

## App.tsx 的加载时机

在 `App.tsx` 的 `useEffect` 中，数据的加载分为两阶段：

### 阶段一：初始化依赖检查

```typescript
useEffect(() => {
  if (!Array.isArray(safeSettings.customProviders) || 
      Object.keys(safeSettings.providerApiKeys || {}).length === 0) {
    loadSettingsFromDb();
  }
}, []);
```

这个空的依赖数组 `useEffect` 在组件挂载时执行一次。如果 Zustand persist 恢复的 settings 中 `customProviders` 或 `providerApiKeys` 不完整（可能是旧版本数据迁移不完全），则立即从 IndexedDB 加载完整设置。这里 `safeSettings` 是对 `settings` 的防御性处理，确保 `customProviders` 是数组、`providerApiKeys` 是对象。

### 阶段二：全量数据加载

```typescript
useEffect(() => {
  loadPromptsFromDB();
  loadSettingsFromDb();
  loadHistory();
  loadFavorites();
}, [loadSettingsFromDb, loadHistory, loadFavorites]);
```

[来源](../src/App.tsx#L95-L99)

这个 `useEffect` 定义了 `loadSettingsFromDb`、`loadHistory`、`loadFavorites` 作为依赖项。虽然这三个函数来自 Zustand store 且引用稳定（不会在组件生命周期中变化），但将其显式声明为依赖项是一种最佳实践。调用的顺序也有意义：

1. **`loadPromptsFromDB()`**：从 IndexedDB 加载用户自定义的提示词覆盖（通过 `getRawSetting('prompts')` 读取）。
2. **`loadSettingsFromDb()`**：从 IndexedDB 加载所有设置覆盖到 Zustand state。
3. **`loadHistory()`** / **`loadFavorites()`**：加载历史记录和收藏到 `history` / `favorites` state 数组。

第二个 `useEffect`（加载 CSS 变量）使用 `getSetting('cssVariables')` 和 `getSetting('customCSS')` 直接读取设置，将主题样式应用到 `document.documentElement`，这一过程独立于 Zustand 的状态管理。详见 [CSS 变量主题系统与样式自定义](css-变量主题系统与样式自定义.md)。

[来源](../src/App.tsx#L102-L125)

---

## 推荐阅读

- [状态管理：Zustand 与持久化策略](状态管理-zustand-与持久化策略.md) —— 了解 IndexedDB 与 Zustand persist 的配合方式
- [历史面板与数据管理](历史面板与数据管理.md) —— 数据层在 UI 中的完整交互流程
- [测试体系：Vitest 与 Testing Library](测试体系-vitest-与-testing-library.md) —— 了解 IndexedDB mock 策略与现有测试覆盖
- [离线策略与性能优化](离线策略与性能优化.md) —— Token 消耗追踪与离线缓存策略
- [项目结构与模块依赖图](项目结构与模块依赖图.md) —— 查看 db.ts 在整个项目中的模块定位