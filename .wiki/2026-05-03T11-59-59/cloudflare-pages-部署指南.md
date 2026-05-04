# Cloudflare Pages 部署指南

将 Moe Translate 部署到 Cloudflare Pages，使其作为一个高性能、全球 CDN 加速的 PWA 应用对外提供服务。本文从源码目录中的三个关键配置文件入手，详解部署流程与注意事项。

---

## 工作原理：部署的三个支柱

Cloudflare Pages 在构建和托管过程中，会识别项目根目录（构建输出目录 `dist`）中的以下几个特殊文件，分别控制 HTTP 响应行为和路由规则：

| 文件 | 作用 | Cloudflare Pages 行为 |
|------|------|----------------------|
| `_headers` | 定义安全标头和缓存策略 | 读取后附加到对应路径的 HTTP 响应头 |
| `_routes.json` | 定义 URL 路由规则 | 决定请求分发方式，支持 SPA fallback |
| `manifest.webmanifest` | PWA 清单 | 被浏览器读取，定义应用安装元数据 |

这三个文件协同工作：`_headers` 保护传输层安全，`_routes.json` 确保 SPA 前端路由正确，`manifest.webmanifest` 让浏览器将站点识别为可安装的 PWA。

[来源](public/_headers) · [来源](public/_routes.json) · [来源](dist/manifest.webmanifest)

---

## `_headers`：安全标头与缓存策略

文件 `public/_headers` 中的配置分为两层：**全局默认规则**（通配 `/*`）和 **路径级细化规则**。

### 全局安全标头

```
/*
  Cache-Control: public, max-age=0, must-revalidate
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
```

[来源](public/_headers#L1-L6)

| 标头 | 值 | 作用 |
|------|-----|------|
| `Cache-Control` | `public, max-age=0, must-revalidate` | 浏览器立即验证新鲜度，避免 HTML 被长期缓存导致更新不及时 |
| `X-Content-Type-Options` | `nosniff` | 禁用 MIME 类型嗅探，防止脚本注入攻击 |
| `X-Frame-Options` | `DENY` | 禁止被嵌入 iframe，防止点击劫持 |
| `X-XSS-Protection` | `1; mode=block` | 启用 XSS 过滤器（兼容旧浏览器） |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 同源请求发送完整 Referer，跨源仅发送源信息 |

### 路径级缓存策略

不同资源有截然不同的缓存寿命，按变更频率分层：

| 路径 | Cache-Control | 设计意图 |
|------|--------------|-----------|
| `/manifest.webmanifest` | `max-age=86400`（1 天） | PWA 清单更新频率低，但需要及时反映 icons 等变更 |
| `/app-icon-*.png` | `max-age=2592000, immutable`（30 天） | 图标一旦发布即不可变 |
| `/assets/*` | `max-age=31536000, immutable`（1 年） | 经 Vite hash 化的构建产物，内容不变则 URL 不变 |
| `/sw.js` | `max-age=0, must-revalidate` + `Service-Worker-Allowed: /` | Service Worker 必须保持最新，禁止任何缓存 |
| `/workbox-*.js` | `max-age=31536000, immutable`（1 年） | Workbox 运行时库，由 vite-plugin-pwa 固定版本 |

[来源](public/_headers#L8-L22)

> `immutable` 指令告诉浏览器：在此 max-age 内该资源**绝不会**变更，浏览器无需发起条件请求验证。此指令仅对 `assets/*` 等带 hash 的文件安全——一旦内容变化，文件名也随之改变。

关于 Service Worker 的离线缓存策略详情，参见 [离线策略与性能优化](离线策略与性能优化.md)。

---

## `_routes.json`：SPA 路由重写

```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": [],
  "hooks": [],
  "metadata": {
    "origin": "moe-epheia-translate"
  }
}
```

[来源](public/_routes.json)

这是 Cloudflare Pages 的标准 SPA fallback 配置。核心逻辑：

- `include: ["/*"]`：所有路径的请求都走 Pages 应用处理。
- 没有配置 `exclude`，意味着没有路径被交给 Cloudflare 的默认 404 处理。
- 当请求的路径没有对应文件时，Cloudflare Pages 会自动回退到 `index.html`（这是 Pages 内部逻辑，无需显式声明 `"/*": "/index.html"`）。

这种机制确保 React Router 等前端路由库管理的路径（如 `/settings`、`/history`）在直接访问或刷新时，由 SPA 接管路由解析而非返回 404。

---

## PWA 清单与 Service Worker 路径

### manifest.webmanifest

由 `vite-plugin-pwa` 在构建时自动生成，输出到 `dist/manifest.webmanifest`。核心声明：

```json
{
  "name": "Moe Translate",
  "short_name": "Translate",
  "display": "standalone",
  "start_url": "/",
  "scope": "/",
  "icons": [
    { "src": "app-icon-192.png", "sizes": "192x192" },
    { "src": "app-icon-512.png", "sizes": "512x512" },
    { "src": "app-icon-512.png", "sizes": "512x512", "purpose": "maskable" }
  ]
}
```

[来源](dist/manifest.webmanifest)

- `display: "standalone"`：安装后以无浏览器 UI 的独立窗口运行。
- `scope: "/"`：应用范围限定在根路径下。
- `start_url: "/"`：从桌面图标启动时打开的页面。

### Service Worker

构建输出的关键文件：

- `dist/sw.js`：Service Worker 主文件，由 Workbox 注入预缓存清单后生成。
- `dist/registerSW.js`：注册脚本，由 `vite-plugin-pwa` 自动注入到 HTML 中。
- `dist/workbox-*.js`：Workbox 运行时库，由 `sw.js` 在运行时加载。

[来源](dist)

`_headers` 中专门为 Service Worker 文件设置了 **`Service-Worker-Allowed: /`** 标头。这一标头是必要的，因为 Moe Translate 的 `scope: "/"` 要求 Service Worker 的生效范围覆盖根路径，而 Service Worker 文件默认只能控制其所在路径以下的范围，通过此标头显式声明允许其控制整个域。

更多关于 PWA 安装和离线体验的细节，参见 [PWA 安装与离线使用](pwa-安装与离线使用.md)。

---

## Cloudflare Pages 控制面板配置步骤

### 步骤 1：连接 Git 仓库

在 Cloudflare Dashboard 中进入 **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**，选择你的仓库（需要包含此项目源码）。

### 步骤 2：构建配置

| 字段 | 值 | 说明 |
|------|-----|------|
| **Build command** | `npm run build` | 执行 TypeScript 编译（`tsc -b`）后调用 Vite 构建，输出到 `dist/`。构建管线详情参见 [构建工具链与配置](构建工具链与配置.md) |
| **Output directory** | `dist` | Cloudflare Pages 将此目录作为网站根 |
| **Root directory** | （留空） | 使用仓库根目录 |
| **Node.js version** | 18+（推荐 20 LTS） | 项目 `package.json` 的 `engines` 字段未锁定版本，但依赖需要 Node 18+ |

[来源](package.json#L6-L14) · [来源](vite.config.ts)

### 步骤 3：环境变量

以下环境变量可在 Cloudflare Pages 的 **Environment variables** 面板中设置：

| 变量名 | 建议值 | 用途 |
|--------|--------|------|
| `NODE_VERSION` | `20` | 指定构建环境 Node 版本 |
| `VITE_LLM_API_BASE_URL` | `https://api.deepseek.com/v1` | 可选的构建时嵌入 API 基础地址 |

[来源](.env.example)

> **注意**：`VITE_LLM_API_KEY` **不应**设置为构建环境变量。以 `VITE_` 前缀暴露的环境变量会被 Vite 内联到客户端 JS bundle 中，任何人查看浏览器源码即可获取。

---

## API 密钥安全：客户端环境无法隐藏密钥

这是一个值得特别强调的架构约束：Moe Translate 的 LLM API 调用直接在浏览器端发起（参见 [LLM 流式 API 客户端架构](llm-流式-api-客户端架构.md)），这意味着：

1. **`VITE_*` 环境变量会暴露**：Vite 将所有 `VITE_` 前缀变量注入客户端代码，构建产物中的 API Key 任何人都能在 DevTools 中找到。
2. **Cloudflare Pages 不支持服务端逻辑**：Pages 是纯静态托管平台，没有 Node.js 运行时来隐蔽密钥。
3. **当前方案：用户自备密钥**：应用启动后在 Settings 界面手动输入 API Key，key 存储在 IndexedDB 中——至少不会出现在静态源码里。

### 生产级建议：Cloudflare Workers 代理

如果需要向其他用户分发无需自备密钥的部署，推荐在 Cloudflare Pages 前套一层 **Cloudflare Workers** 作为 API 代理：

```
┌──────────────┐      ┌──────────────┐      ┌─────────────────┐
│  浏览器      │ ───> │  Workers     │ ───> │ LLM API (外部)  │
│  (Pages)     │      │  (隐藏密钥)  │      │ 如 DeepSeek     │
└──────────────┘      └──────────────┘      └─────────────────┘
```

Workers 脚本中将 API Key 设置为环境变量（`CLOUD-ENV` 类型，仅 Workers 运行时可见），浏览器只请求 Workers 域名，API Key 对客户端完全透明。这是目前最安全的静态站点 + LLM API 组合方案。

更多 API 提供商和模型配置方式，参见 [API 密钥与提供商配置](api-密钥与提供商配置.md)。

---

## 验证部署

部署完成后，通过以下方式验证配置是否正确：

1. **检查响应头**：在浏览器 DevTools → Network 面板中查看任意请求的 Response Headers，确认 `X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff` 等标头已生效。
2. **验证 SPA 路由**：直接访问 `https://your-domain.pages.dev/settings`（或任何非根路径），确认页面正常渲染而非返回 404。
3. **验证 PWA 安装提示**：在支持 PWA 的浏览器中，确认地址栏或浏览器菜单中出现「安装」提示。
4. **验证 Service Worker**：DevTools → Application → Service Workers，确认 `sw.js` 已注册且状态为 `activated`。

---

## 推荐阅读

- [项目结构与模块依赖图](项目结构与模块依赖图.md) — 了解 `public/` 目录在整个项目中的位置
- [构建工具链与配置](构建工具链与配置.md) — 深入了解 Vite + TypeScript + vite-plugin-pwa 的构建管线
- [PWA 安装与离线使用](pwa-安装与离线使用.md) — 将部署后的应用安装为桌面/移动端应用
- [离线策略与性能优化](离线策略与性能优化.md) — Service Worker 缓存的深层逻辑
- [API 密钥与提供商配置](api-密钥与提供商配置.md) — 在客户端配置 LLM 提供商和模型的完整指南