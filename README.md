# Simple-web-chat

这是一款基于 Node.js、WebSocket 和 WebRTC 的轻量级网页即时聊天应用，支持实时消息、会话管理、消息历史、文件传输及音视频通话。

## 📋 项目介绍

用户无需注册即可获得唯一的临时 ID，通过交换 ID 建立会话并实时对话。消息按双方 ID 分库存入服务端 SQLite 数据库，在临时 ID 的生命周期内可加载历史记录；任一 ID 过期后，相关会话数据库会被清理。

## ✨ 主要特性

- **⚡ 实时通信**：基于 WebSocket 的双向实时消息传输
- **🆔 临时身份**：自动生成唯一用户 ID，有效期为 24 小时，到期后自动换新并清理关联会话数据
- **💾 消息存储**：使用 SQLite 数据库持久化聊天记录
- **📋 会话管理**：支持多会话管理，易于切换
- **👥 在线状态**：实时显示联系人在线/离线状态
- **📝 用户备注**：为联系人设置备注名称，便于识别
- **🔔 未读提醒**：未读消息提示，及时获取新消息通知
- **✏️ 消息编辑与撤回**：点击编辑按钮一键回填至输入框，修改后发送即可更新消息；或撤回为系统提示态
- **⌨️ 多行输入框**：支持桌面 Enter 发送、移动端 Enter 换行，Ctrl/Shift/Cmd+Enter 手动换行；粘贴文本保留原始换行，输入框自动增高至 3 行后滚动
- **😊 表情选择器**：输入框旁表情按钮，弹出面板支持分类浏览和关键词搜索，点击表情插入光标位置
- **💬 引用回复**：点击消息旁的引用按钮，输入栏上方显示被引用消息预览，发送后可点击引用跳转到原消息并高亮
- **✅ 消息已读状态**：每条消息在时间小字旁显示已读/未读状态，阅读状态可实时同步
- **🖼️ 图片与文件传输**：配置 Cloudflare R2 后可发送图片（支持灯箱预览）和文件，文件流由浏览器直传/直下，不经过应用服务器
- **📶 连接状态与延迟**：会话列表标题右侧实时显示与服务器连接状态及网络延迟
- **📱 响应式设计**：适配桌面端和移动端布局（尽量吧。。。移动端的不确定性太多了），并针对窄屏调整会话与输入交互
- **📞 音视频通话**：基于 WebRTC 的实时语音、视频和屏幕共享（浏览器支持时可共享系统音频），支持静音、摄像头开关、前后摄像头切换、可用音频输出选择、连接模式显示（LAN/P2P/UDP 中继/TCP 中继）、强制 TURN 中继及 RTT 延迟；通话中切换网络时自动执行 ICE restart 恢复媒体连接
- **⚙️ 核心功能零配置**：不配置 R2 或 TURN 也能使用文字聊天；文件传输和复杂网络下的通话中继需另行配置

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

- **Node.js** 20、22 或 24（推荐当前 LTS 版本 24；`better-sqlite3 12.x` 不支持 Node.js 18）
- **pnpm**（推荐）包管理器

> 安装 Node.js：[官网下载](https://nodejs.org/) 或使用 [nvm-windows](https://github.com/coreybutler/nvm-windows)（Windows）/ [nvm](https://github.com/nvm-sh/nvm)（macOS/Linux）
>
> 安装 pnpm：`npm install -g pnpm`

### 安装步骤

#### 1. 克隆项目

```bash
git clone https://github.com/LhyYBMQ520/Simple-web-chat.git
cd Simple-web-chat
```

#### 2. 安装依赖

```bash
pnpm install
```

#### 3. 配置文件传输（可选，需要文件/图片功能时配置）

项目当前以 Cloudflare R2 作为对象存储。底层使用 S3 API，但其他 S3 兼容服务的端点、公开 URL 和路径风格可能需要额外适配。复制并编辑配置文件：

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

`TURN_SERVER_URLS` 支持使用分号、逗号或空格分隔多个 `turn:` / `turns:` 地址，建议同时配置 UDP 和 TCP 地址。

> **获取 R2 凭据**：Cloudflare 控制台 → R2 → 创建存储桶 → 管理 API 令牌。Access Key 和 Secret Key 在 API 令牌页面获取。

配置完成后，还需在 R2 控制台处理以下两项：

#### 3.1 配置公开读取地址（图片预览需要）

开发环境可开启存储桶的 Public Development URL（`r2.dev`，有速率限制），生产环境建议绑定自定义域名，并将该地址填入 `STORAGE_PUBLIC_URL`。普通文件下载使用预签名 GET URL，不依赖公开读取权限。

#### 3.2 配置 CORS 策略

存储桶 → Settings → CORS Policy → Add CORS Policy → 切换到 **JSON** 标签页，粘贴：

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

> R2 CORS 策略必须使用 JSON 格式。建议让 `AllowedOrigins` 精确匹配实际来源（仅包含 `scheme://host[:port]`，不要带路径或末尾 `/`）：本地开发填 `http://localhost:21451`，部署后改为你的 HTTPS 域名。浏览器使用预签名 URL 直传时，CORS 是必需的。

若不配置对象存储，纯文本聊天功能不受影响。

---

### 开发模式

`tsx` 直接运行 TypeScript 源码，无需预编译，修改代码后重启即可生效：

```bash
pnpm dev
```

服务将运行在 `http://localhost:21451`。端口目前固定为 `21451`。

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

生产部署应在应用前配置 HTTPS 反向代理，并正确转发 WebSocket Upgrade。除 `localhost` 外，摄像头、麦克风和屏幕共享等浏览器媒体 API 通常只允许在安全上下文（HTTPS）中使用；页面使用 HTTPS 后，WebSocket 会自动连接为 WSS。

---

### 其他命令

```bash
pnpm typecheck      # 仅检查 TypeScript 类型，不产出文件
```

### 打开浏览器

本机访问 `http://localhost:21451`。局域网可用 `http://IP:21451` 测试文字聊天；音视频及屏幕共享应通过 HTTPS 域名访问。

> **💡 提示**：如果你没有安装 pnpm，也可以使用 npm：
>
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
   - 在右侧聊天窗口输入消息；桌面端按 Enter 发送，移动端 Enter 仅换行；Ctrl/Shift/Cmd+Enter 手动换行；空内容时发送按钮禁用
   - 消息会在临时 ID 生命周期内自动保存到服务端数据库

4. **管理会话**
   - 点击左侧会话列表中的会话可切换聊天对象
   - 右键点击会话可显示管理菜单
   - 支持为会话添加备注名称
   - 支持从本机列表删除不需要的会话（不会立即删除服务端历史；历史会在临时 ID 到期后清理）

### 功能说明

- **在线状态指示**：绿色圆点表示在线，红色圆点表示离线
- **未读消息计数**：有未读消息时会在列表右上角显示红色小圆点
- **消息历史**：切换会话时自动从服务端数据库加载该临时 ID 生命周期内的消息历史
- **消息编辑/撤回**：点击消息旁的编辑按钮，原文即刻回填到输入框，修改后按 Enter 或点击发送直接更新消息；撤回后显示为“你撤回了一条消息/对方撤回了一条消息”
- **引用回复**：点击消息旁的引用按钮，输入栏上方出现蓝色引用预览条，显示被引用消息的发送者和内容摘要；发送后消息气泡内展示引用预览，点击可跳转到原消息并高亮所在行
- **输入框交互**：桌面端 Enter 发送、移动端 Enter 换行；Ctrl/Shift/Cmd+Enter 手动换行；粘贴保留完整换行格式；输入框自动增高至 3 行后出现滚动条；空内容时发送按钮禁用并提示“不能发送空消息”；Esc 依次取消引用状态和编辑回填；输入框左侧表情按钮点击弹出表情选择器
- **消息状态小字**：普通消息显示“时间 · 已读/未读”，已编辑消息显示“编辑时间 · 已编辑 · 已读/未读”
- **撤回消息显示规则**：已撤回消息会清除时间与已读/未读状态显示
- **连接状态显示**：在“会话列表”标题右侧显示连接中/重连中/已断开/已连接等状态图标
- **连接延迟显示**：已连接时显示与服务器的实时延迟（ms）
- **ID 有效期**：ID 有 24 小时有效期，过期后页面会自动生成新 ID
- **通话功能**：会话标题栏右侧的通话下拉菜单可选择语音通话、视频通话或屏幕共享，并设置自动/省流/标准/高清质量档位及麦克风回声消除、降噪、自动增益（部分移动浏览器不支持主动共享屏幕，不支持时会显示明确提示）；每次通话的模式在发起时固定，如需换模式必须先挂断；通话浮层显示当前会话，语音通话可最小化为状态胶囊，视频和屏幕共享可最小化为跟随主画面比例的悬浮窗或通过 Fullscreen API 进入浏览器真全屏；连接信息区显示 ICE 模式、RTT、实际发送或接收码率、分辨率、帧率、质量限制原因、丢包和抖动；网络切换时自动重新协商，无需挂断重拨
- **强制中继**：TURN 配置有效时，会话标题栏的“中继”开关可让本端发起的新通话仅使用 TURN；开关只影响发起方，不影响本端接听的来电，且通话中会锁定以避免误以为当前连接策略可即时切换

### 强制 TURN 中继

- 先在 `.env` 中完整配置 `TURN_SERVER_URLS`、`TURN_USERNAME` 和 `TURN_CREDENTIAL`，然后重启服务并刷新页面
- 发起方打开会话标题栏的“中继”开关后再发起语音、视频或屏幕共享，当前 `RTCPeerConnection` 使用 `iceTransportPolicy: relay`
- 接听方无需打开开关；连接建立后，两端都应显示“UDP 中继”或“TCP 中继”，而不是 LAN/P2P
- 开关偏好保存在浏览器本地，仅对开启开关的一端随后发起的新通话生效；已有通话和本端接听的来电仍使用自动策略
- 未配置 TURN 时开关不可用；TURN 配置存在但服务器不可达或凭据错误时，强制中继通话将无法建立，不会自动回退到直连

### 通话质量与麦克风处理

通话质量默认为“自动”；菜单中的质量设置会保存到浏览器，并应用于本端随后建立的新通话：

| 档位 | 摄像头目标 | 屏幕共享目标 | 摄像头码率 | 屏幕码率 | 麦克风单声道 | 系统音频立体声 |
| ------ | ------------ | -------------- | -------------- | ------------ | ---------------- | ------------------ |
| 自动 | 1280×720 / 30fps | 1920×1080 / 30fps | 浏览器自动 | 浏览器自动 | 浏览器自动 | 浏览器自动 |
| 省流 | 854×480 / 15fps | 1280×720 / 15fps | 500kbps | 700kbps | 24kbps | 64kbps |
| 标准 | 1280×720 / 30fps | 1920×1080 / 30fps | 2Mbps | 3Mbps | 48kbps | 128kbps |
| 高清 | 1920×1080 / 30fps | 1920×1080 / 60fps | 6Mbps | 10Mbps | 96kbps | 192kbps |

- 麦克风统一请求 48kHz / 16bit / 单声道，使用 `speech` 语音内容提示，默认开启回声消除、降噪和自动增益；三项处理仍可在通话菜单中分别关闭
- 屏幕系统音频统一请求 48kHz / 16bit / 双声道，使用 `music` 内容提示并关闭回声消除、降噪和自动增益
- 仅系统音频对应的 Opus 媒体段协商 `stereo=1;sprop-stereo=1`；麦克风媒体段主动移除立体声参数
- WebRTC 仍会在弱网、编码器过载或浏览器限制时自动降低实际码率与帧率
- 屏幕共享使用 `maintain-framerate` 帧数优先降级策略，网络或编码压力较大时优先降低分辨率/画面质量；摄像头仍使用 `balanced`
- 采集约束是目标值，浏览器可能根据设备能力选择较低分辨率或帧率
- 通话浮层优先显示本端实际发送质量；屏幕共享观看端没有本地视频轨时显示实际接收质量；控制台同时记录浏览器最终采用的媒体参数
- 屏幕内容变化少时，浏览器会主动少编码帧；发送端统计若显示“CPU 限制”或“带宽限制”，表示编码器或拥塞控制未能达到预设上限
- 前后摄像头切换需浏览器枚举到至少两个视频输入；听筒/免提上拉菜单受浏览器的 `setSinkId()` 和设备枚举能力限制，不支持时需使用系统音频设置

### 通话中网络切换

- Wi-Fi 与移动网络互相切换时，原 ICE 候选对会失效，界面短暂显示“重连中…”属于正常现象
- WebSocket 重新连接并完成 UID 绑定后，客户端会自动执行完整 ICE restart，现有音视频或屏幕共享 track 不会重新采集
- 恢复后连接标签会重新读取实际候选对：私网显示“LAN 直连”，同 `/64` 全局 IPv6 显示“IPv6 LAN”，跨 IPv6 前缀显示“IPv6 P2P”，其他公网直连显示“P2P 直连”，使用 TURN 时显示 UDP/TCP 中继
- 如果运营商 NAT 无法建立 P2P 且服务端未配置 TURN，切换到移动网络后可能无法恢复；此时需要配置 TURN 作为兜底

## 📁 项目结构

```text
Simple-web-chat/
├── server.ts                       # Express + WebSocket 入口及 HTTP API
├── .env.example                    # R2、上传限制和 TURN 配置模板
├── package.json                    # 依赖与运行脚本
├── pnpm-lock.yaml                  # pnpm 锁文件
├── package-lock.json               # npm 锁文件
├── tsconfig.json                   # TypeScript 编译配置
├── README.md                       # 项目说明
├── LICENSE                         # MIT 许可证
├── db/                             # 会话数据库目录（运行时生成）
├── src/                            # 服务端 TypeScript 模块
│   ├── config/
│   │   ├── constants.ts            # 路径、存储和 TURN 等配置
│   │   └── webrtc-config.ts        # STUN/TURN ICE 服务器配置
│   ├── services/
│   │   ├── session-db-service.ts   # 会话数据库与消息持久化
│   │   ├── uid-service.ts          # UID 生命周期
│   │   └── storage-service.ts      # R2/S3 预签名 URL
│   └── ws/
│       ├── connection-handler.ts   # WebSocket 消息路由
│       └── signaling-handler.ts    # WebRTC 信令转发
└── public/                         # 前端静态资源
    ├── index.html                  # SPA 页面
    ├── css/
    │   └── style.css               # 全局样式
    ├── js/
    │   ├── app-state.js             # 前端状态
    │   ├── uid-module.js            # UID 生成与展示
    │   ├── message-module.js        # 消息渲染
    │   ├── session-module.js        # 会话与备注管理
    │   ├── ws-module.js             # WebSocket 通信与心跳
    │   ├── file-upload-module.js    # 文件预签名直传
    │   ├── webrtc-module.js         # WebRTC 核心
    │   ├── webrtc-ui-module.js      # WebRTC 通话 UI
    │   ├── emoji-data.js            # 表情数据
    │   ├── emoji-module.js          # 表情选择器
    │   └── script.js                # 入口与模块装配
    └── fontawesome-free-7.2.0-web/ # 本地图标库
```

## 🔧 核心功能说明

### 后端实现

- **模块化架构**：`server.ts` 仅负责启动与装配，核心逻辑拆分到 `src/config`、`src/services`、`src/ws`，全部使用 TypeScript 编写，具备完整的类型定义
- **WebSocket 连接管理**：维护活跃的客户端连接映射
- **用户绑定**：接收并绑定用户 ID 和 WebSocket 连接
- **消息路由**：实现两个用户间的消息转发
- **在线列表广播**：实时推送在线用户列表
- **数据持久化**：消息在临时 ID 生命周期内存储到 SQLite 数据库
- **消息编辑/撤回**：提供 `editMessage` 与 `recallMessage` 协议，服务端校验消息归属与会话关系后更新数据库并双向广播变更
- **消息已读同步**：通过 `read_at` 字段标记已读状态；当用户进入会话或正在查看该会话时，自动更新并推送已读状态
- **心跳响应机制**：处理前端 `ping` 心跳并回传 `pong`，用于客户端连接质量与延迟测量
- **UID 生命周期管理**：记录 UID 创建时间，自动计算 24 小时过期时间，前后端统一校验 UID 有效性；过期时自动删除关联的会话 DB 文件
- **会话数据库独立存储**：每对用户拥有独立数据库文件，存放在 `/db` 目录，文件按排序后的 `uid1,uid2.db` 命名以避免重复
- **对象存储服务**：以 Cloudflare R2 为默认实现，提供预签名上传 URL、带 `response-content-disposition` 的预签名下载 URL（307 重定向，不经过应用服务器传输文件流），并在撤回文件消息时请求删除对象
- **文件上传校验**：前后端双重校验文件大小，限制值由 `MAX_FILE_SIZE` 环境变量统一控制，通过 `/js/config.js` 动态注入前端
- **动态前端配置**：`/js/config.js` 由服务端动态生成并禁用缓存，向浏览器注入 `MAX_FILE_SIZE`、WebRTC ICE 服务器及 TURN 可用状态
- **WebRTC 信令转发**：支持 8 种信令消息类型（callRequest/callAccept/callReject/callEnd/callRestart/callOffer/callAnswer/iceCandidate），服务端纯转发 + 详细日志（ICE 重启请求、ICE 候选类型/协议、SDP 协商阶段）

### 前端实现

- **模块化架构**：`script.js` 负责入口装配，核心逻辑拆分至状态、UID、消息、会话、WebSocket、文件、表情和 WebRTC 模块
- **UI 交互**：会话管理、聊天窗口、消息输入等
- **WebSocket 通信**：与服务器建立持久连接
- **本地存储**：使用 localStorage 保存会话、备注、ID、通话质量和麦克风处理设置
- **历史加载**：从服务器查询消息历史记录
- **状态同步**：实时更新在线状态和未读计数
- **连接状态可视化**：在侧边栏标题显示连接状态图标（连接中/重连中/已断开/已连接）
- **延迟测量**：通过 WebSocket 心跳（ping/pong）计算并显示当前连接延迟
- **消息操作**：支持对本人消息进行编辑、撤回；编辑采用输入框回填方式，无需弹窗；界面实时更新消息内容与状态
- **已读回执展示**：在每条消息时间小字旁显示已读/未读，接收 `messagesRead` 推送后即时刷新
- **编辑时间显示**：消息编辑后，小字时间更新为编辑时间并附带“已编辑”标记
- **UID 状态显示**：实时显示 UID 剩余有效期，即将过期时带有警告标识
- **输入框交互**：桌面 Enter 发送 / 移动端 Enter 换行；粘贴保留原始换行格式；自动高度扩展；空内容禁用发送；表情面板支持搜索和分类；引用回复支持
- **文件上传**：支持图片和文件上传，预签名 URL 直传 R2；前端预检文件大小、类型，超限直接拦截；未知类型回退为 `application/octet-stream`；上传期间切换会话不会发错目标（入口会固定目标 ID）
- **WebRTC 通话**：语音/视频/屏幕共享三种固定通话模式；当前会话标题、语音状态胶囊、按主画面比例自适应的视频/共享悬浮窗及浏览器真全屏；自动/省流/标准/高清采集和发送档位；原生麦克风处理开关；前后摄像头和可用音频输出切换；通过 `RTCRtpSender.setParameters()` 控制码率与帧率上限；实时显示连接模式、RTT、发送/接收码率、分辨率、帧率、丢包和抖动；使用完整 ICE restart 自动恢复 Wi-Fi/移动网络切换

## 📊 数据库设计

### messages 表

| 字段名 | 类型 | 说明 |
| ------- | ------ | ------ |
| id | INTEGER PRIMARY KEY | 消息 ID（自增） |
| sender | TEXT | 发送者 ID |
| receiver | TEXT | 接收者 ID |
| content | TEXT | 消息内容 |
| time | INTEGER | 消息时间戳 |
| status | TEXT | 消息状态（`normal` / `recalled`） |
| edited_at | INTEGER | 编辑时间戳（未编辑为 `NULL`） |
| read_at | INTEGER | 已读时间戳（未读为 `NULL`） |
| msg_type | TEXT | 消息类型（`text` / `image` / `file`） |
| file_key | TEXT | 对象存储 Key，用于撤回时清理文件 |
| quote_id | INTEGER | 引用的消息 ID（未引用为 `NULL`） |

## 🌐 网络协议

### 文件上传与下载流程

文件采用**预签名 URL 直传**方式，上传和下载均不经过应用服务器中转文件流量：

#### 上传

1. 前端检查 `file.size` 是否超限，超限直接拦截
2. 客户端 `POST /api/upload/presign` 获取预签名上传 URL（后端也会校验 fileSize）
3. 客户端 `PUT` 文件到对象存储（直传 R2）
4. 客户端发送 `file_message` WebSocket 消息通知接收方

#### 下载

1. 接收方点击文件卡片，发起 `GET /api/download?key=...&name=...`（同源请求）
2. 后端生成带 `response-content-disposition` 的 R2 预签名 GET URL，返回 307 Redirect
3. 浏览器跟随重定向直连 R2 下载，R2 返回文件流和正确文件名

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

// 编辑自己发送的消息
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

// 历史消息返回（list 中每条消息均为完整消息对象）
{type: "history", list: [{id, sender, receiver, content, time, status, editedAt, readAt, msgType, fileKey, quoteId, quoteMessage}]}

// 单条实时消息（含可选 quoteId/quoteMessage）
{type: "msg", message: {id, sender, receiver, content, time, status, editedAt, readAt, msgType, fileKey, quoteId, quoteMessage}}

// 消息被编辑
{type: "messageEdited", message: {id, sender, receiver, content, time, status, editedAt, readAt, msgType, fileKey, quoteId, quoteMessage}}

// 消息被撤回
{type: "messageRecalled", message: {id, sender, receiver, content, time, status, editedAt, readAt, msgType, fileKey, quoteId, quoteMessage}}

// 批量已读回执
{type: "messagesRead", messages: [{id, sender, receiver, content, time, status, editedAt, readAt, msgType, fileKey, quoteId, quoteMessage}]}

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

// ICE 候选（relay 候选额外携带 relayProtocol，供两端统一显示中继协议）
{type: "iceCandidate", to: "peerUID", candidate: {candidate: "...", sdpMid: "...", sdpMLineIndex: 0, candidateType: "host|srflx|relay", protocol: "udp|tcp", relayProtocol: "udp|tcp|tls"}}
```

## 📅 未来计划

- [ ] 添加端到端加密与隐私保护功能（暂缓）
- [ ] 实现群组聊天功能
- [ ] 添加消息搜索与过滤
- [ ] 实现对方状态显示（如“正在输入”）
- [ ] 深色主题适配
- [ ] 实现可自定义的id过期时长

## 🔒 安全性说明

- 本应用面向演示与学习场景，当前没有账号认证、端到端加密、速率限制或完善的内容校验，不应直接用于敏感通信
- 临时 ID 是访问身份凭据；获得某个 ID 的人可能冒用该身份，24 小时过期机制只是生命周期控制，不构成隐私或身份安全保证
- 聊天内容以明文存储在服务端 SQLite；WebRTC 媒体由浏览器加密传输，但信令与普通消息仍需依赖 HTTPS/WSS 保护传输链路
- 若启用 R2 公开读取，拥有对象 URL 的人可能直接访问文件；生产环境应评估私有对象、鉴权下载、内容校验、CSP 和限流方案

## 📝 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交问题和拉取请求！
