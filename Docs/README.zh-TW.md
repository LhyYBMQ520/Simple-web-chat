# Simple-web-chat

這是一款基於 Node.js 與 WebSocket 的簡潔高效網頁即時聊天應用，支援即時訊息、對話管理、訊息紀錄儲存等功能。

### (本文檔由AI翻譯，AI可能會犯錯)

# 語言選擇

[简体中文](../README.md) | [繁體中文](README.zh-TW.md) | [English](README.en.md)

## 📋 專案介紹

Simple-web-chat 是一套輕量、開箱即用的網頁聊天系統。使用者無須註冊即可快速取得專屬臨時 ID，透過交換 ID 即可與其他使用者建立對話並進行即時溝通。所有訊息皆會持久化儲存至本機資料庫，支援查閱歷史訊息。

## ✨ 主要特色

- **⚡ 即時通訊**：基於 WebSocket 雙向即時訊息傳輸
- **🆔 快速使用**：自動產生專屬使用者 ID，有效期 24 小時
- **💾 訊息儲存**：使用 SQLite 資料庫持久化儲存所有聊天紀錄
- **📋 對話管理**：支援多組對話管理，輕鬆切換
- **👥 線上狀態**：即時顯示聯絡人線上/離線狀態
- **📝 使用者備註**：可為聯絡人設定備註名稱，方便辨識
- **🔔 未讀提醒**：未讀訊息提示，即時接收新訊息通知
- **✏️ 訊息編輯與收回**：支援編輯已送出的訊息，或將訊息收回為系統提示狀態
- **✅ 單則訊息已讀狀態**：每則訊息可在時間小字旁顯示已讀/未讀，並即時同步狀態
- **📶 連線狀態與延遲**：在對話列表標題右側即時顯示與伺服器的連線狀態與網路延遲
- **📱 響應式設計**：完美支援電腦版與行動裝置螢幕比例
- **⚙️ 零設定**：開箱即用，無須複雜設定

## 🛠️ 技術架構

- **前端**：HTML5、CSS3、JavaScript、WebSocket
- **後端**：Node.js、Express、WebSocket (ws)
- **資料庫**：SQLite3 (better-sqlite3)
- **UI 圖示庫**：FontAwesome 7.2.0（本機版）

## 📦 相依套件

```json
{
  "dependencies": {
    "better-sqlite3": "^12.8.0",
    "express": "^5.2.1",
    "ws": "^8.20.0"
  }
}
```

## 🚀 快速開始

### 環境需求

- Node.js 14.0 以上版本，開發者使用版本為 22
- pnpm（建議）套件管理工具

### 安裝步驟

1. **複製或下載專案**

```bash
git clone https://github.com/LhyYBMQ520/Simple-web-chat.git
cd Simple-web-chat
```

2. **安裝相依套件**

```bash
pnpm i
```

3. **啟動服務**

```bash
pnpm start
```

服務將運行於 `21451` 埠號

4. **開啟瀏覽器**

前往 `http://IP:21451` 即可使用

## 💬 使用說明

### 快速開始聊天

1. **取得您的 ID**
   - 進入網頁後，左側欄會自動產生您的專屬 ID（由時間戳與亂數組成）
   - 點擊複製按鈕可快速複製 ID

2. **新增聊天對象**
   - 在左側欄下方輸入框輸入對方 ID
   - 點擊「傳送請求」按鈕
   - 等待對方確認

3. **開始聊天**
   - 對方同意後，對話將自動建立
   - 在右側聊天視窗輸入訊息後按 Enter 或點擊傳送按鈕
   - 所有訊息會自動儲存至資料庫

4. **管理對話**
   - 點擊左側對話列表中的對話可切換聊天對象
   - 右鍵點擊對話可顯示管理選單
   - 支援為對話設定備註名稱
   - 支援刪除不需要的對話

### 功能說明

- **線上狀態顯示**：綠色圓點為線上、紅色圓點為離線
- **未讀訊息計數**：有未讀訊息時會在列表右上角顯示紅色圓點
- **訊息紀錄**：切換對話時自動從伺服器資料庫載入完整訊息紀錄
- **訊息編輯/收回**：僅能操作自己送出的訊息；收回後會顯示為系統提示文字
- **訊息狀態小字**：一般訊息顯示「時間 · 已讀/未讀」，已編輯訊息顯示「編輯時間 · 已編輯 · 已讀/未讀」
- **收回訊息顯示規則**：已收回訊息會清除時間與已讀/未讀狀態顯示
- **連線狀態顯示**：在「對話列表」標題右側顯示連線中/重連中/已斷開/已連線等狀態圖示
- **連線延遲顯示**：已連線時顯示與伺服器的即時延遲（ms）
- **ID 有效期**：ID 有效期為 24 小時，過期後會自動產生新 ID，每組對話有效期同為 24 小時

## 📁 專案結構

```
Simple-web-chat/
├── server.js                 # 後端主進入點（服務啟動與模組裝配）
├── package.json             # 專案設定檔
├── README.md                # 專案說明文件
├── LICENSE                  # 開源授權條款
├── db/                      # 對話資料庫（自動產生）
├── src/                     # 後端模組目錄
│   ├── config/
│   │   └── constants.js     # 後端常數設定
│   ├── services/
│   │   ├── session-db-service.js  # 對話資料庫與訊息持久化服務
│   │   └── uid-service.js   # UID 生命週期服務
│   └── ws/
│       └── connection-handler.js   # WebSocket 訊息處理器
└── public/                  # 前端靜態資源
    ├── index.html          # 首頁 HTML
    ├── css/
    │   └── style.css       # 樣式檔
    ├── js/
   │   ├── app-state.js    # 前端狀態模組
   │   ├── uid-module.js   # UID 與複製功能模組
   │   ├── message-module.js  # 訊息渲染與狀態模組
   │   ├── session-module.js  # 對話與備註管理模組
   │   ├── ws-module.js    # WebSocket 通訊與延遲檢測模組
   │   └── script.js       # 前端入口與模組裝配
    └── fontawesome-free-7.2.0-web/  # 圖示庫（本機版）
```

## 🔧 核心功能說明

### 後端實作

- **模組化架構**：`server.js` 僅負責啟動與裝配，核心邏輯拆分至 `src/config`、`src/services`、`src/ws`
- **WebSocket 連線管理**：維護活躍的用戶端連線對應表
- **使用者綁定**：接收並綁定使用者 ID 與 WebSocket 連線
- **訊息路由**：實現兩位使用者之間的訊息轉發
- **線上清單廣播**：即時推送線上使用者清單
- **資料持久化**：所有訊息儲存至 SQLite 資料庫
- **訊息編輯/收回**：提供 `editMessage` 與 `recallMessage` 協定，後端校驗訊息歸屬與對話關係後更新資料並雙向廣播
- **已讀狀態同步**：使用 `read_at` 欄位持久化已讀狀態；使用者進入對話或正在查看對話時會自動更新並推送已讀狀態
- **心跳回應機制**：處理前端 `ping` 心跳並回傳 `pong`，用於用戶端連線品質與延遲測量
- **UID 生命週期管理**：記錄 UID 建立時間，自動計算 24 小時過期時間，前後端統一校驗 UID 有效性
- **對話維度獨立資料庫儲存**：每組對話維持獨立資料庫檔案，儲存於 `/db` 資料夾，檔名規則為 `uid1,uid2.db`（排序避免重複）
- **自動清理策略**：定期檢測 UID 過期狀態，過期 UID 對應的資料庫檔案自動刪除（帶有重試機制，確保檔案刪除安全）

### 前端實作

- **模組化架構**：`script.js` 僅作為入口裝配層，核心邏輯拆分至 `app-state`、`uid`、`message`、`session`、`ws` 模組
- **UI 互動**：對話管理、聊天視窗、訊息輸入等
- **WebSocket 通訊**：與伺服器建立持久連線
- **本機儲存**：使用 localStorage 儲存對話、備註與 ID 資訊
- **歷史紀錄載入**：從伺服器查詢訊息歷史
- **狀態同步**：即時更新線上狀態與未讀計數
- **連線狀態可視化**：在側邊欄標題顯示連線狀態圖示（連線中/重連中/已斷開/已連線）
- **延遲測量**：透過 WebSocket 心跳（ping/pong）計算並顯示目前連線延遲
- **訊息操作**：支援對自己送出的訊息進行編輯與收回，介面即時更新訊息內容與狀態
- **已讀回執顯示**：在每則訊息時間小字旁顯示已讀/未讀，收到 `messagesRead` 推送後立即刷新
- **編輯時間顯示**：訊息編輯後，小字時間會更新為編輯時間並附帶「已編輯」標記
- **UID 狀態顯示**：即時顯示 UID 剩餘有效期，即將過期時帶有警告標識

## 📊 資料庫設計

### messages 資料表

| 欄位名稱 | 型別 | 說明 |
|---------|------|------|
| id | INTEGER PRIMARY KEY | 訊息 ID（自動遞增） |
| sender | TEXT | 傳送者 ID |
| receiver | TEXT | 接收者 ID |
| content | TEXT | 訊息內容 |
| time | INTEGER | 訊息時間戳 |
| status | TEXT | 訊息狀態（`normal` / `recalled`） |
| edited_at | INTEGER | 編輯時間戳（未編輯為 `NULL`） |
| read_at | INTEGER | 已讀時間戳（未讀為 `NULL`） |

## 🌐 網路通訊協定

### WebSocket 訊息格式

所有 WebSocket 訊息皆使用 JSON 格式，常見類型如下：

```javascript
// 綁定使用者
{type: "bind", uid: "user_id"}

// 傳送聊天請求
{type: "request", to: "target_id"}

// 同意請求
{type: "accept", from: "requester_id"}

// 傳送訊息
{type: "message", to: "target_id", content: "message_content"}

// 編輯訊息
{type: "editMessage", to: "target_id", messageId: 1, content: "new_content"}

// 收回訊息
{type: "recallMessage", to: "target_id", messageId: 1}

// 回報目前正在查看的對話（用於已讀判定）
{type: "activeChat", with: "other_id"}

// 心跳探測（用戶端送出）
{type: "ping", clientTime: 1710000000000}

// 心跳回包（伺服器回傳）
{type: "pong", clientTime: 1710000000000, serverTime: 1710000000100}

// 取得歷史訊息
{type: "getHistory", with: "other_id"}

// 歷史訊息回傳（list 中每筆皆為完整訊息物件）
{type: "history", list: [{id, sender, receiver, content, time, status, editedAt, readAt}]}

// 單筆即時訊息
{type: "msg", message: {id, sender, receiver, content, time, status, editedAt, readAt}}

// 訊息已編輯
{type: "messageEdited", message: {id, sender, receiver, content, time, status, editedAt, readAt}}

// 訊息已收回
{type: "messageRecalled", message: {id, sender, receiver, content, time, status, editedAt, readAt}}

// 批次已讀回執
{type: "messagesRead", messages: [{id, sender, receiver, content, time, status, editedAt, readAt}]}

// 線上使用者清單
{type: "online", list: ["user1", "user2", ...]}
```

## 📅 未來規劃

- [ ] 加入端對端加密與隱私保護功能（我也要死嗎.png）
- [ ] 支援檔案與圖片傳輸
- [ ] 實現群組聊天功能
- [ ] 加入訊息搜尋與過濾
- [ ] 顯示對方狀態（例如輸入中…）
- [ ] 輸入框支援手動換行，貼上進來的文字保留原本格式
- [ ] 深色主題適配

## 🔒 安全性說明

- 本應用為展示/學習專案，用於正式環境前須另行調整
- 建議加入：訊息內容驗證、使用者身分驗證、流量限制等機制
- ID 設有 24 小時過期時間，確保對話具相對隱私性

## 📝 授權條款

MIT License - 詳見 [LICENSE](../LICENSE) 檔案

## 🤝 貢獻

歡迎提交問題與合併請求！
