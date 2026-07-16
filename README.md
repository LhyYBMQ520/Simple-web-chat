# Simple-web-chat

这是一款基于 Node.js 和 WebSocket 的简洁高效的网页即时聊天应用，支持实时消息、会话管理、消息历史记录等功能。

## 📋 项目介绍

Simple-web-chat 是一个轻量级的、开箱即用的网页聊天应用。用户无需注册即可快速获得唯一的临时 ID，通过交换 ID 可以与其他用户建立会话并进行实时对话。所有消息均被持久化存储到本地数据库，支持历史消息查看。

## ✨ 主要特性

- **⚡ 实时通信**：基于 WebSocket 的双向实时消息传输
- **🆔 快速入门**：自动生成唯一用户 ID，24 小时有效期的“阅后即焚”功能
- **💾 消息存储**：使用 SQLite 数据库持久化聊天记录
- **📋 会话管理**：支持多会话管理，易于切换
- **👥 在线状态**：实时显示联系人在线/离线状态
- **📝 用户备注**：为联系人设置备注名称，便于识别
- **🔔 未读提醒**：未读消息提示，及时获取新消息通知
- **✏️ 消息编辑与撤回**：点击编辑按钮一键回填至输入框，修改后发送即可更新消息；或撤回为系统提示态
- **⌨️ 多行输入框**：支持桌面 Enter 发送 / 移动端 Enter 换行，Ctrl或Shift / Cmd+Enter 手动换行，粘贴文本完整保留原始换行格式，自动高度适配最多 3 行，随后使用滚动条调整上下
- **😊 表情选择器**：输入框旁表情按钮，弹出面板支持分类浏览和关键词搜索，点击表情插入光标位置
- **💬 引用回复**：点击消息旁的引用按钮，输入栏上方显示被引用消息预览，发送后可点击引用跳转到原消息并高亮
- **✅ 消息已读状态**：每条消息在时间小字旁显示已读/未读状态，阅读状态可实时同步
- **🖼️ 图片与文件传输**：支持发送图片（点击灯箱放大预览）和文件，通过 Cloudflare R2 对象存储直传，不占用 VPS 带宽和磁盘
- **📶 连接状态与延迟**：会话列表标题右侧实时显示与服务器连接状态及网络延迟
- **📱 响应式设计**：完美支持桌面端和移动端的屏幕比例（尽量吧。。。移动端的不确定性太多了）
- **📞 音视频通话**：基于 WebRTC 的实时语音通话、视频通话和屏幕共享（带语音），支持静音、摄像头开关、连接模式显示（LAN/P2P/UDP中继/TCP中继）及 RTT 延迟；通话中切换网络时自动执行 ICE restart 恢复媒体连接
- **⚙️ 零配置**：开箱即用，无需复杂配置

## 🛠️ 技术栈

- **前端**：HTML5、CSS3、JavaScript、WebSocket、WebRTC
- **后端**：Node.js、TypeScript、Express、WebSocket (ws)
- **运行时**：tsx（TypeScript 直接运行，无需预编译）
- **数据库**：SQLite3 (better-sqlite3)
- **UI 图标库**：FontAwesome 7.2.0（已本地化）
- **字体**：Google Fonts（Noto Sans SC / JP / KR + Noto Color Emoji）

## 📦 依赖项

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.1045.0",
    "@aws-sdk/s3-request-presigner": "^3.1045.0",
    "better-sqlite3": "^12.8.0",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "ws": "^8.20.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/express": "^5.0.6",
    "@types/node": "^25.6.0",
    "@types/ws": "^8.18.1",
    "tsx": "^4.21.0",
    "typescript": "^6.0.3"
  }
}
```

## 🚀 快速开始

### 前置要求

- **Node.js** 18.0 或以上版本（TypeScript + tsx 运行时要求），作者使用的版本为 24
- **pnpm**（推荐）包管理器

> 安装 Node.js：[官网下载](https://nodejs.org/) 或使用 [nvm-windows](https://github.com/coreybutler/nvm-windows)（Windows）/ [nvm](https://github.com/nvm-sh/nvm)（macOS/Linux）
>
> 安装 pnpm：`npm install -g pnpm`

### 安装步骤

**1. 克隆项目**

```bash
git clone https://github.com/LhyYBMQ520/Simple-web-chat.git
cd Simple-web-chat
```

**2. 安装依赖**

```bash
pnpm install
```

**3. 配置文件传输（可选，需要文件/图片功能时配置）**

项目使用 Cloudflare R2 作为对象存储（也兼容 S3/MinIO/OSS）。复制并编辑配置文件：

```bash
cp .env.example .env
```

编辑 `.env` 填入你的 R2 凭据：

```env
STORAGE_PROVIDER=r2
STORAGE_ENDPOINT=https://<your-account-id>.r2.cloudflarestorage.com
STORAGE_BUCKET=chat-files
STORAGE_ACCESS_KEY=<your-access-key>
STORAGE_SECRET_KEY=<your-secret-key>
STORAGE_PUBLIC_URL=https://cdn.yourdomain.com  # 自定义域名需绑定到存储桶；若未绑定需手动在地址后追加桶名（如 /chat-files）
STORAGE_REGION=auto
MAX_FILE_SIZE=10485760
UPLOAD_URL_EXPIRY=300

# === WebRTC TURN 中继（可选，不配置则仅支持局域网/P2P，STUN默认为 Google 公共 STUN 服务） ===
TURN_SERVER_URLS=turn:your-coturn-server.com:3478?transport=udp;turn:your-coturn-server.com:3478?transport=tcp
TURN_USERNAME=your-username
TURN_CREDENTIAL=your-password
```

> **获取 R2 凭据**：Cloudflare 控制台 → R2 → 创建存储桶 → 管理 API 令牌。Access Key 和 Secret Key 在 API 令牌页面获取。

配置完成后，还需在 R2 控制台完成以下两项设置（否则文件上传和下载都会失败）：

**① 开启公开访问**：存储桶 → Settings → Public Access → 打开 Allow Public Access

**② 配置 CORS 策略**：存储桶 → Settings → CORS Policy → Add CORS Policy → 切换到 **JSON** 标签页，粘贴：
```json
[
  {
    "AllowedOrigins": ["http://localhost:21451"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type", "Content-Disposition"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
> R2 CORS 策略必须使用 JSON 格式，且 `AllowedOrigins` 需要精确匹配访问来源（R2 不支持 `*` 通配符）。本地开发填 `http://localhost:21451`，部署后改为你的实际域名。

若不配置对象存储，纯文本聊天功能不受影响。

---

### 开发模式

`tsx` 直接运行 TypeScript 源码，无需预编译，修改代码后重启即可生效：

```bash
pnpm dev
```

服务将运行在 `http://localhost:21451`。

---

### 生产模式（部署用）

先编译 TypeScript 为 JavaScript，再用 Node.js 运行编译产物：

```bash
pnpm build          # 编译 TypeScript → JavaScript，输出到 dist/
pnpm start          # 运行编译后的 dist/server.js
```

或一步完成：

```bash
pnpm build && pnpm start
```

---

### 其他命令

```bash
pnpm typecheck      # 仅检查 TypeScript 类型，不产出文件
```

### 打开浏览器

访问 `http://IP:21451` 即可使用（本机访问 `http://localhost:21451`）。

> **💡 提示**：如果你没有安装 pnpm，也可以使用 npm：
> ```bash
> npm install
> npm run dev
> ```

## 💬 使用指南

### 快速开始聊天

1. **获取您的 ID**
   - 进入网页后，左侧栏会自动生成您的唯一 ID（由时间戳和随机数组成）
   - 点击复制按钮可快速复制 ID

2. **添加聊天对象**
   - 在左侧栏下方的输入框中输入对方的 ID
   - 点击 "发送请求" 按钮
   - 等待对方确认

3. **开始聊天**
   - 对方同意后，会话会自动建立
   - 在右侧聊天窗口输入消息；桌面端按 Enter 发送，移动端 Enter 仅换行；Ctrl或Shift/Cmd+Enter 手动换行；空内容时发送按钮禁用
   - 所有消息自动保存到数据库

4. **管理会话**
   - 点击左侧会话列表中的会话可切换聊天对象
   - 右键点击会话可显示管理菜单
   - 支持为会话添加备注名称
   - 支持删除不需要的会话

### 功能说明

- **在线状态指示**：绿色圆点表示在线，红色圆点表示离线
- **未读消息计数**：有未读消息时会在列表右上角显示红色小圆点
- **消息历史**：切换会话时自动从服务端数据库加载完整的消息历史记录
- **消息编辑/撤回**：点击消息旁的编辑按钮，原文即刻回填到输入框，修改后按 Enter 或点击发送直接更新消息；撤回后显示为“你撤回了一条消息/对方撤回了一条消息”
- **引用回复**：点击消息旁的引用按钮，输入栏上方出现蓝色引用预览条，显示被引用消息的发送者和内容摘要；发送后消息气泡内展示引用预览，点击可跳转到原消息并高亮所在行
- **输入框交互**：桌面端 Enter 发送 / 移动端 Enter 换行；Ctrl或Shift/Cmd+Enter 手动换行；粘贴保留完整换行格式；输入框自动增高最多 3 行后出现滚动条；空内容时发送按钮禁用并提示“不能发送空消息”；Esc 依次取消引用状态和编辑回填；输入框左侧表情按钮点击弹出表情选择器
- **消息状态小字**：普通消息显示“时间 · 已读/未读”，已编辑消息显示“编辑时间 · 已编辑 · 已读/未读”
- **撤回消息显示规则**：已撤回消息会清除时间与已读/未读状态显示
- **连接状态显示**：在“会话列表”标题右侧显示连接中/重连中/已断开/已连接等状态图标
- **连接延迟显示**：已连接时显示与服务器的实时延迟（ms）
- **ID 有效期**：ID 有 24 小时有效期，过期后会自动生成新 ID，相当于每个会话的有效期为 24 小时
- **通话功能**：会话 header 右侧三个按钮分别发起语音通话、视频通话和屏幕共享（部分安卓浏览器不支持主动共享屏幕）；通话中使用悬浮窗控制按钮进行静音（屏幕共享时仅关闭麦克风）、开关摄像头、挂断等操作；屏幕共享为单向模式（发起方共享屏幕 + 语音，接收方仅语音）；连接信息区显示当前 ICE 连接模式和 RTT 延迟；网络切换时先显示“重连中…”，信令恢复后自动重新协商，无需挂断重拨

### 通话中网络切换

- Wi-Fi 与移动网络互相切换时，原 ICE 候选对会失效，界面短暂显示“重连中…”属于正常现象
- WebSocket 重新连接并完成 UID 绑定后，客户端会自动执行完整 ICE restart，现有音视频或屏幕共享 track 不会重新采集
- 恢复后连接标签会重新读取实际候选对：同一私网显示“LAN 直连”，公网直连显示“P2P 直连”，使用 TURN 时显示 UDP/TCP 中继
- 如果运营商 NAT 无法建立 P2P 且服务端未配置 TURN，切换到移动网络后可能无法恢复；此时需要配置 TURN 作为兜底

## 📁 项目结构

```
Simple-web-chat/
├── server.ts                 # 后端主入口（Express + WebSocket + 上传/下载端点 + 动态配置 /js/config.js）
├── .env.example             # 对象存储配置模板
├── tsconfig.json            # TypeScript 编译配置
├── package.json             # 项目配置文件
├── README.md                # 项目说明文档
├── LICENSE                  # 开源许可证
├── db/                      # 会话数据库存储文件夹（自动生成）
├── src/                     # 后端模块目录
│   ├── config/
│   │   ├── constants.ts     # 后端常量配置（含 dotenv 加载）
│   │   └── webrtc-config.ts # STUN/TURN ICE 服务器配置
│   ├── services/
│   │   ├── session-db-service.ts  # 会话数据库与消息持久化服务
│   │   ├── uid-service.ts   # UID 生命周期服务
│   │   └── storage-service.ts    # 对象存储服务（R2/S3 预签名 URL）
│   └── ws/
│       ├── connection-handler.ts   # WebSocket 消息处理器（含信令分发）
│       └── signaling-handler.ts    # WebRTC 信令转发 handler
└── public/                  # 前端静态资源
    ├── index.html          # 主页 HTML
    ├── css/
    │   │   └── style.css       # 样式文件（含图片/文件/灯箱/表情选择器）
    ├── js/
   │   ├── app-state.js    # 前端状态模块
   │   ├── uid-module.js   # UID 与复制功能模块
   │   │   ├── message-module.js  # 消息渲染（text/image/file）
│   │   ├── session-module.js  # 会话与备注管理模块
│   │   ├── ws-module.js    # WebSocket 通信与延迟检测模块
│   │   ├── file-upload-module.js  # 文件上传（预签名 + 直传 + 大小校验）
│   │   ├── webrtc-module.js    # WebRTC 核心（PeerConnection/媒体采集/信令）
│   │   ├── webrtc-ui-module.js # WebRTC 通话 UI（悬浮窗/控制按钮/来电提示）
   │   ├── emoji-data.js       # 表情数据包（含中文名称和搜索索引）
   │   ├── emoji-module.js     # 表情选择器 UI 模块
   │   └── script.js       # 前端入口与模块装配
    └── fontawesome-free-7.2.0-web/  # 图标库（本地版）
```

## 🔧 核心功能说明

### 后端实现

- **模块化架构**：`server.ts` 仅负责启动与装配，核心逻辑拆分到 `src/config`、`src/services`、`src/ws`，全部使用 TypeScript 编写，具备完整的类型定义
- **WebSocket 连接管理**：维护活跃的客户端连接映射
- **用户绑定**：接收并绑定用户 ID 和 WebSocket 连接
- **消息路由**：实现两个用户间的消息转发
- **在线列表广播**：实时推送在线用户列表
- **数据持久化**：所有消息存储到 SQLite 数据库
- **消息编辑/撤回**：提供 `editMessage` 与 `recallMessage` 协议，服务端校验消息归属与会话关系后更新数据库并双向广播变更
- **消息已读同步**：通过 `read_at` 字段标记已读状态；当用户进入会话或正在查看该会话时，自动更新并推送已读状态
- **心跳响应机制**：处理前端 `ping` 心跳并回传 `pong`，用于客户端连接质量与延迟测量
- **UID 生命周期管理**：记录 UID 创建时间，自动计算 24 小时过期时间，前后端统一校验 UID 有效性；过期时自动删除关联的会话 DB 文件
- **会话数据库独立存储**：每个会话维度拥有独立数据库文件，存放在 `/db` 目录，file 命名规则为 `uid1,uid2.db`（排序避免重复）
- **对象存储服务**：支持 Cloudflare R2 / S3 兼容存储，提供预签名上传 URL、带 `response-content-disposition` 的预签名下载 URL（307 重定向，不经过 VPS 中转文件流量）、文件删除
- **文件上传校验**：前后端双重校验文件大小，限制值由 `MAX_FILE_SIZE` 环境变量统一控制，通过 `/js/config.js` 动态注入前端
- **动态前端配置**：`/js/config.js` 由服务端动态生成，向浏览器注入 `MAX_FILE_SIZE`、WebRTC ICE 服务器等后端配置
- **WebRTC 信令转发**：支持 8 种信令消息类型（callRequest/callAccept/callReject/callEnd/callRestart/callOffer/callAnswer/iceCandidate），服务端纯转发 + 详细日志（ICE 重启请求、ICE 候选类型/协议、SDP 协商阶段）

### 前端实现

- **模块化架构**：`script.js` 仅负责入口装配，核心逻辑拆分至 `app-state`、`uid`、`message`、`session`、`ws`、`file-upload` 模块
- **UI 交互**：会话管理、聊天窗口、消息输入等
- **WebSocket 通信**：与服务器建立持久连接
- **本地存储**：使用 localStorage 保存会话、备注和 ID 信息
- **历史加载**：从服务器查询消息历史记录
- **状态同步**：实时更新在线状态和未读计数
- **连接状态可视化**：在侧边栏标题显示连接状态图标（连接中/重连中/已断开/已连接）
- **延迟测量**：通过 WebSocket 心跳（ping/pong）计算并显示当前连接延迟
- **消息操作**：支持对本人消息进行编辑、撤回；编辑采用输入框回填方式，无需弹窗；界面实时更新消息内容与状态
- **已读回执展示**：在每条消息时间小字旁显示已读/未读，接收 `messagesRead` 推送后即时刷新
- **编辑时间显示**：消息编辑后，小字时间更新为编辑时间并附带“已编辑”标记
- **UID 状态显示**：实时显示 UID 剩余有效期，即将过期时带有警告标识
- **输入框交互**：桌面 Enter 发送 / 移动端 Enter 换行；粘贴保留原始换行格式；自动高度扩展；空内容禁用发送；表情面板支持搜索和分类；引用回复支持
- **文件上传**：支持图片和文件上传，预签名 URL 直传 R2；前端预检文件大小、类型，超限直接拦截；未知类型自动 fallback `application/octet-stream`；上传期间切换会话不会发错目标（入口捕获 targetId）
- **WebRTC 通话**：语音/视频/屏幕共享三种通话模式；通话悬浮窗含远程视频 + 本地 PIP 小窗；静音/摄像头/屏幕共享控制按钮；ICE 连接模式 + RTT 延迟实时显示；使用完整 ICE restart 自动恢复 Wi-Fi/移动网络切换；SDP 发送失败自动 rollback，Offer/Answer 对应的 ICE candidate 在 SDP 发出后再释放；通话中移动端旋转不触发页面刷新

## 📊 数据库设计

### messages 表

| 字段名 | 类型 | 说明 |
|-------|------|------|
| id | INTEGER PRIMARY KEY | 消息 ID（自增） |
| sender | TEXT | 发送者 ID |
| receiver | TEXT | 接收者 ID |
| content | TEXT | 消息内容 |
| time | INTEGER | 消息时间戳 |
| status | TEXT | 消息状态（`normal` / `recalled`） |
| edited_at | INTEGER | 编辑时间戳（未编辑为 `NULL`） |
| read_at | INTEGER | 已读时间戳（未读为 `NULL`） |
| msg_type | TEXT | 消息类型（`text` / `image` / `file`） |
| file_key | TEXT | R2 对象 Key，用于撤回时清理文件 |
| quote_id | INTEGER | 引用的消息 ID（未引用为 `NULL`） |

## 🌐 网络协议

### 文件上传与下载流程

文件采用**预签名 URL 直传**方式，上传和下载均不经过 VPS 中转文件流量：

**上传**
1. 前端检查 `file.size` 是否超限，超限直接拦截
2. 客户端 `POST /api/upload/presign` 获取预签名上传 URL（后端也会校验 fileSize）
3. 客户端 `PUT` 文件到对象存储（直传 R2）
4. 客户端发送 `file_message` WebSocket 消息通知接收方

**下载**

5. 接收方点击文件卡片，发起 `GET /api/download?key=...&name=...`（同源请求）

6. 后端生成带 `response-content-disposition` 的 R2 预签名 GET URL，返回 307 Redirect

7. 浏览器跟随重定向直连 R2 下载，R2 返回文件流 + 正确文件名

```javascript
// 请求预签名上传 URL
POST /api/upload/presign
{ fileName: "photo.jpg", contentType: "image/jpeg", fileSize: 1024000 }

// 响应
{ uploadUrl: "https://...", publicUrl: "https://...", fileKey: "chat/2026/05/10/...", headers: {...} }

// 请求下载（同源，download 属性生效）
GET /api/download?key=chat/2026/05/10/...&name=photo.jpg
→ 307 Redirect → R2 预签名 URL（含 response-content-disposition）

// 文件消息（通过 WebSocket 发送）
{ type: "file_message", to: "peerUID", msgType: "image", content: { name, size, url, fileKey } }
```

### WebSocket 消息格式

所有 WebSocket 消息均采用 JSON 格式，常见类型包括：

```javascript
// 绑定用户
{type: "bind", uid: "user_id"}

// 发送聊天请求
{type: "request", to: "target_id"}

// 同意请求
{type: "accept", from: "requester_id"}

// 发送消息（可选 quoteId 引用回复某条消息）
{type: "message", to: "target_id", content: "message_content", quoteId: 42}

// 发送文件/图片消息（可选 quoteId）
{type: "file_message", to: "target_id", msgType: "image", content: {...}, quoteId: 42}
{type: "editMessage", to: "target_id", messageId: 1, content: "new_content"}

// 撤回消息
{type: "recallMessage", to: "target_id", messageId: 1}

// 上报当前激活会话（用于已读判定）
{type: "activeChat", with: "other_id"}

// 心跳探测（客户端发送）
{type: "ping", clientTime: 1710000000000}

// 心跳回包（服务端返回）
{type: "pong", clientTime: 1710000000000, serverTime: 1710000000100}

// 获取历史消息
{type: "getHistory", with: "other_id"}

// 历史消息返回（list 中每条消息均为完整消息对象，含可选 quoteId/quoteMessage）
{type: "history", list: [{id, sender, receiver, content, time, status, editedAt, readAt, quoteId, quoteMessage}]}

// 单条实时消息（含可选 quoteId/quoteMessage）
{type: "msg", message: {id, sender, receiver, content, time, status, editedAt, readAt, quoteId, quoteMessage}}

// 消息被编辑
{type: "messageEdited", message: {id, sender, receiver, content, time, status, editedAt, readAt, quoteId, quoteMessage}}

// 消息被撤回
{type: "messageRecalled", message: {id, sender, receiver, content, time, status, editedAt, readAt}}

// 批量已读回执
{type: "messagesRead", messages: [{id, sender, receiver, content, time, status, editedAt, readAt}]}

// 在线用户列表
{type: "online", list: ["user1", "user2", ...]}

// === WebRTC 信令消息（服务端纯转发，附加 from 字段） ===

// 发起通话
{type: "callRequest", to: "peerUID", callType: "audio|video|screen"}

// 接受/拒绝/挂断
{type: "callAccept", from: "peerUID"}
{type: "callReject", from: "peerUID", reason: "busy|declined|error"}
{type: "callEnd", to: "peerUID"}

// 通话中请求重新建立 ICE 媒体路径
{type: "callRestart", to: "peerUID"}
{type: "callRestart", from: "peerUID"}

// SDP 交换
{type: "callOffer", to: "peerUID", sdp: {type: "offer", sdp: "..."}}
{type: "callAnswer", to: "peerUID", sdp: {type: "answer", sdp: "..."}}

// ICE 候选（含 candidateType/protocol 解析）
{type: "iceCandidate", to: "peerUID", candidate: {candidate: "...", sdpMid: "...", sdpMLineIndex: 0, candidateType: "host|srflx|relay", protocol: "udp|tcp"}}
```

## 📅 未来计划

- [ ] 添加端到端加密与隐私保护功能（我也要死吗.png）
- [ ] 实现群组聊天功能
- [ ] 添加消息搜索与过滤
- [ ] 实现对方状态显示（如输入中。。。）
- [ ] 深色主题适配

## 🔒 安全性说明

- 本应用为演示/学习项目，生产环境使用前需进行相应修改
- 建议添加：消息内容验证、用户身份验证、速率限制等
- ID 有 24 小时过期时间，确保会话的相对隐私性

## 📝 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交问题和拉取请求！
