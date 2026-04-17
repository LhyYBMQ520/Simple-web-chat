# Simple-web-chat

这是一款基于 Node.js 和 WebSocket 的简洁高效的网页即时聊天应用，支持实时消息、会话管理、消息历史记录等功能。

# 语言选择

[简体中文](README.md) | [繁體中文](Docs/README.zh-TW.md) | [English](Docs/README.en.md)

## 📋 项目介绍

Simple-web-chat 是一个轻量级的、开箱即用的网页聊天系统。用户无需注册即可快速获得唯一的临时 ID，通过交换 ID 可以与其他用户建立会话并进行实时对话。所有消息均被持久化存储到本地数据库，支持历史消息查看。

## ✨ 主要特性

- **⚡ 实时通信**：基于 WebSocket 的双向实时消息传输
- **🆔 快速入门**：自动生成唯一用户 ID，24 小时有效期
- **💾 消息存储**：使用 SQLite 数据库持久化所有聊天记录
- **📋 会话管理**：支持多会话管理，易于切换
- **👥 在线状态**：实时显示联系人在线/离线状态
- **📝 用户备注**：为联系人设置备注名称，便于识别
- **🔔 未读提醒**：未读消息提示，及时获取新消息通知
- **✏️ 消息编辑与撤回**：支持编辑已发送消息，或将消息撤回为系统提示态
- **✅ 消息已读状态**：每条消息在时间小字旁显示已读/未读状态，阅读状态可实时同步
- **📶 连接状态与延迟**：会话列表标题右侧实时显示与服务器连接状态及网络延迟
- **📱 响应式设计**：完美支持桌面端和移动端的屏幕比例
- **⚙️ 零配置**：开箱即用，无需复杂配置

## 🛠️ 技术栈

- **前端**：HTML5、CSS3、JavaScript、WebSocket
- **后端**：Node.js、Express、WebSocket (ws)
- **数据库**：SQLite3 (better-sqlite3)
- **UI 图标库**：FontAwesome 7.2.0（已本地化）

## 📦 依赖项

```json
{
  "dependencies": {
    "better-sqlite3": "^12.8.0",
    "express": "^5.2.1",
    "ws": "^8.20.0"
  }
}
```

## 🚀 快速开始

### 前置要求

- Node.js 14.0 或以上版本，作者使用的版本为 22
- pnpm（推荐）包管理器

### 安装步骤

1. **克隆或下载项目**

```bash
git clone https://github.com/LhyYBMQ520/Simple-web-chat.git
cd Simple-web-chat
```

2. **安装依赖**

```bash
pnpm i
```

3. **启动服务**

```bash
pnpm start
```

服务将运行在 `21451` 端口

4. **打开浏览器**

访问 `http://IP:21451` 即可使用

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
   - 在右侧聊天窗口输入消息后按 Enter 或点击发送按钮
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
- **消息编辑/撤回**：仅允许操作自己发送的消息；撤回后显示为“你撤回了一条消息/对方撤回了一条消息”
- **消息状态小字**：普通消息显示“时间 · 已读/未读”，已编辑消息显示“编辑时间 · 已编辑 · 已读/未读”
- **撤回消息显示规则**：已撤回消息会清除时间与已读/未读状态显示
- **连接状态显示**：在“会话列表”标题右侧显示连接中/重连中/已断开/已连接等状态图标
- **连接延迟显示**：已连接时显示与服务器的实时延迟（ms）
- **ID 有效期**：ID 有 24 小时有效期，过期后会自动生成新 ID，相当于每个会话的有效期为 24 小时

## 📁 项目结构

```
Simple-web-chat/
├── server.js                 # 后端主入口（服务启动与模块装配）
├── package.json             # 项目配置文件
├── README.md                # 项目说明文档
├── LICENSE                  # 开源许可证
├── db/                      # 对话资料库（自动生成）
├── src/                     # 后端模块目录
│   ├── config/
│   │   └── constants.js     # 后端常量配置
│   ├── services/
│   │   ├── session-db-service.js  # 会话数据库与消息持久化服务
│   │   └── uid-service.js   # UID 生命周期服务
│   └── ws/
│       └── connection-handler.js   # WebSocket 消息处理器
└── public/                  # 前端静态资源
    ├── index.html          # 主页 HTML
    ├── css/
    │   └── style.css       # 样式文件
    ├── js/
   │   ├── app-state.js    # 前端状态模块
   │   ├── uid-module.js   # UID 与复制功能模块
   │   ├── message-module.js  # 消息渲染与状态模块
   │   ├── session-module.js  # 会话与备注管理模块
   │   ├── ws-module.js    # WebSocket 通信与延迟检测模块
   │   └── script.js       # 前端入口与模块装配
    └── fontawesome-free-7.2.0-web/  # 图标库（本地版）
```

## 🔧 核心功能说明

### 后端实现

- **模块化架构**：`server.js` 仅负责启动与装配，核心逻辑拆分到 `src/config`、`src/services`、`src/ws`
- **WebSocket 连接管理**：维护活跃的客户端连接映射
- **用户绑定**：接收并绑定用户 ID 和 WebSocket 连接
- **消息路由**：实现两个用户间的消息转发
- **在线列表广播**：实时推送在线用户列表
- **数据持久化**：所有消息存储到 SQLite 数据库
- **消息编辑/撤回**：提供 `editMessage` 与 `recallMessage` 协议，服务端校验消息归属与会话关系后更新数据库并双向广播变更
- **消息已读同步**：通过 `read_at` 字段标记已读状态；当用户进入会话或正在查看该会话时，自动更新并推送已读状态
- **心跳响应机制**：处理前端 `ping` 心跳并回传 `pong`，用于客户端连接质量与延迟测量
- **UID 生命周期管理**：记录 UID 创建时间，自动计算 24 小时过期时间，前后端统一校验 UID 有效性
- **会话数据库独立存储**：每个会话维度拥有独立数据库文件，存放在 `/db` 目录，file 命名规则为 `uid1,uid2.db`（排序避免重复）
- **自动清理策略**：定时检测 UID 过期状态，过期 UID 对应的数据库文件自动删除（带重试机制，确保文件删除安全）

### 前端实现

- **模块化架构**：`script.js` 仅负责入口装配，核心逻辑拆分至 `app-state`、`uid`、`message`、`session`、`ws` 模块
- **UI 交互**：会话管理、聊天窗口、消息输入等
- **WebSocket 通信**：与服务器建立持久连接
- **本地存储**：使用 localStorage 保存会话、备注和 ID 信息
- **历史加载**：从服务器查询消息历史记录
- **状态同步**：实时更新在线状态和未读计数
- **连接状态可视化**：在侧边栏标题显示连接状态图标（连接中/重连中/已断开/已连接）
- **延迟测量**：通过 WebSocket 心跳（ping/pong）计算并显示当前连接延迟
- **消息操作**：支持对本人消息进行编辑、撤回，界面实时更新消息内容与状态
- **已读回执展示**：在每条消息时间小字旁显示已读/未读，接收 `messagesRead` 推送后即时刷新
- **编辑时间显示**：消息编辑后，小字时间更新为编辑时间并附带“已编辑”标记
- **UID 状态显示**：实时显示 UID 剩余有效期，即将过期时带有警告标识

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

## 🌐 网络协议

### WebSocket 消息格式

所有 WebSocket 消息均采用 JSON 格式，常见类型包括：

```javascript
// 绑定用户
{type: "bind", uid: "user_id"}

// 发送聊天请求
{type: "request", to: "target_id"}

// 同意请求
{type: "accept", from: "requester_id"}

// 发送消息
{type: "message", to: "target_id", content: "message_content"}

// 编辑消息
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
{type: "history", list: [{id, sender, receiver, content, time, status, editedAt, readAt}]}

// 单条实时消息
{type: "msg", message: {id, sender, receiver, content, time, status, editedAt, readAt}}

// 消息被编辑
{type: "messageEdited", message: {id, sender, receiver, content, time, status, editedAt, readAt}}

// 消息被撤回
{type: "messageRecalled", message: {id, sender, receiver, content, time, status, editedAt, readAt}}

// 批量已读回执
{type: "messagesRead", messages: [{id, sender, receiver, content, time, status, editedAt, readAt}]}

// 在线用户列表
{type: "online", list: ["user1", "user2", ...]}
```

## 📅 未来计划

- [ ] 添加端到端加密与隐私保护功能（我也要死吗.png）
- [ ] 支持文件和图片传输
- [ ] 实现群组聊天功能
- [ ] 添加消息搜索与过滤
- [ ] 实现对方状态显示（如输入中。。。）

## 🔒 安全性说明

- 本应用为演示/学习项目，生产环境使用前需进行相应修改
- 建议添加：消息内容验证、用户身份验证、速率限制等
- ID 有 24 小时过期时间，确保会话的相对隐私性

## 📝 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交问题和拉取请求！
