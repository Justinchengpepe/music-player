# Vinyl Discography Player

一个 **3D 黑胶唱片架**风格的音乐播放器。在浏览器里把唱片铺成一面墙，点击封面即可翻看曲目、播放歌曲，配合网易云音乐 API 解锁完整播放。

前端是纯手写的 Three.js 场景 + 原生 ES Module，**没有任何构建步骤**；后端是一个零框架的 Node.js 服务，负责代理网易云 API、抓取专辑封面、签发 Apple MusicKit Token。

---

## 功能特性

- **3D 唱片墙** — Three.js 渲染的专辑封面墙，支持悬停高亮、点击翻面、镜头推进
- **艺人切换** — 内置 30 位说唱 / R&B 艺人的正式录音室专辑清单（Kanye West、Drake、Kendrick Lamar、Frank Ocean、Tyler The Creator、Travis Scott 等）
- **一行命令加歌手** — `npm run add-artist "歌手名"` 自动补齐 ID、专辑、封面、头像、主题色
- **曲目面板** — 侧滑面板展示曲目列表，支持播放中高亮、进度条拖拽、播放/暂停
- **歌词场景** — 独立黑胶歌词页，唱针随进度从外圈移向内圈
- **双主题** — 亮色 / 暗色一键切换，配色随艺人主色动态变化
- **移动端适配** — 响应式布局，窄屏下曲目面板自动改为底部抽屉
- **扫码登录** — 通过二维码登录网易云账号，解锁 999kbps 高码率播放
- **封面自动匹配** — 用 iTunes Lookup API 按专辑名归一化匹配 600×600 高清封面，网易云封面作为兜底

---

## 目录结构

```
.
├── server.js              # Node 服务：静态文件 + API 代理 + MusicKit 签名
├── artists.json           # ★ 艺人数据，唯一来源。加歌手只改这个文件
├── package.json
├── ye.html                # 唯一页面：3D 唱片架 + 曲目面板 + 歌词场景
├── lib/
│   ├── music.js           # 专辑名归一化、版本标记判断、主题色推导（纯函数）
│   └── sources.js         # 网易云 / iTunes 数据源封装
├── scripts/
│   └── add-artist.js      # 命令行加歌手工具
├── js/
│   └── three.module.js    # Three.js 运行时（本地内置，不走 CDN）
├── vinyl.jpg / vinyl.png  # 黑胶唱片纹理
├── deploy.sh              # Ubuntu / Oracle Cloud 一键部署脚本
├── .railwayignore         # Railway 部署忽略规则
├── musickit.example.json  # MusicKit 配置模板
└── .gitignore
```

---

## 快速开始

```bash
npm install
npm start
```

打开 http://localhost:8088 即可。

需要 Node.js 18+（推荐 20）。

---

## 分享给别人 / 别人怎么用

**这个项目不是静态网页**，页面要调网易云 API（浏览器直接调会被 CORS 挡死），
所以必须有一个 Node 服务在后面转发。这意味着：

- ❌ 不能部署到 GitHub Pages / 静态托管
- ❌ 不能直接双击 `ye.html` 打开（会白屏）
- ✅ 必须把仓库 clone 下来跑起来

别人拿到你的仓库地址后，三步就能用：

```bash
git clone https://github.com/<你的用户名>/music-player.git
cd music-player
npm install && npm start
```

然后浏览器打开 http://localhost:8088，点右上角「登录」，用**自己的**网易云 App 扫码。

### 登录态是按人隔离的

这是本项目一个重要的设计：**服务器上不保存任何账号凭证。**

- 扫码拿到的 Cookie 只写进**访客自己的浏览器**（localStorage）
- 每次请求通过 `X-Netease-Cookie` 请求头带给服务端，服务端用完即弃
- 服务端进程本身永远是「未登录」状态

所以就算部署到公网，也是**谁登录就是谁的账号**，彼此完全看不到对方。
换一台设备、换一个浏览器都要重新扫码 —— 这是预期行为。

---

## 加一位歌手

### 方式一：命令行（推荐）

```bash
npm run add-artist "Kendrick Lamar"
```

工具会自动完成：

1. 搜网易云拿到艺人 ID
2. 拉取全部专辑，排除单曲、deluxe、现场、混音、重复版本，按发行时间排序
3. 查 iTunes 拿到 `itunesId`（用于高清封面）
4. 取网易云头像
5. 推导主题色

常用参数：

```bash
npm run add-artist "Kendrick Lamar" --dry-run          # 只看结果，不写文件
npm run add-artist "Kendrick Lamar" --id 37995         # 直接指定网易云艺人 ID
npm run add-artist "Kendrick Lamar" --force            # 已存在时覆盖
npm run add-artist "Kendrick Lamar" --include-singles  # 连单曲一起列出来
npm run add-artist --list                              # 列出当前所有艺人
```

### 方式二：直接编辑 `artists.json`

```json
{
  "artists": [
    {
      "id": "37995",
      "name": "Kendrick Lamar",
      "albums": ["Section.80", "good kid, m.A.A.d city", "To Pimp a Butterfly", "DAMN."],
      "color": "#2c3e50",
      "itunesId": 368183298,
      "avatar": "https://p3.music.126.net/....jpg?param=300y300"
    }
  ]
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✅ | 网易云艺人 ID，从 `music.163.com/#/artist?id=xxx` 的 URL 里拿 |
| `name` | ✅ | 显示名 |
| `albums` | ✅ | 专辑名列表，按发行顺序排列 |
| `color` | | 主题色。不写则按名字稳定推导 |
| `itunesId` | | iTunes 艺人 ID。不写则启动时按名字自动搜 |
| `avatar` | | 头像 URL。不写则从网易云艺人详情自动取 |

> 改完 `artists.json` 重启服务即可生效，**不需要动任何代码**。

### 关于 `albums` 的匹配规则

`albums` 里写的是**专辑名**，服务启动后会拿去和网易云实际返回的专辑列表做匹配：

- 归一化后完全相等才算命中（忽略大小写、括号内容、非字母数字字符）
- 带 `(Deluxe)` / `(Live)` / `(Remix)` 等标记的版本会优先匹配同样带标记的那张
- **匹配不上的专辑不会被静默丢弃** —— 会在服务端日志里打出 `⚠` 警告，同时通过接口的 `unmatched` 字段返回

所以专辑名打错时你能立刻发现，而不是过几天才注意到少了一张。

---

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `8088` | 服务监听端口 |
| `NETEASE_PROXY` | 无 | 网易云 API 请求代理地址，海外服务器部署时建议设置 |

```bash
PORT=3000 NETEASE_PROXY=http://127.0.0.1:7890 npm start
```

---

## 配置 MusicKit（可选）

只在使用 Apple Music 相关能力时才需要：

```bash
cp musickit.example.json musickit.json
```

填入你自己的 `teamId` / `keyId` / `privateKey`。该文件已在 `.gitignore` 中，不会被提交。

## 登录网易云（可选）

不登录也能播放试听片段；登录后可解锁完整音质。点击右上角「登录」，用网易云 App 扫码即可。

Cookie 会保存在**你自己浏览器**的 localStorage 里，重启服务不丢，但换浏览器 / 换设备要重新扫码。
已登录时点右上角胶囊可以退出登录。

> 服务端**不会**把 Cookie 写到磁盘。早期版本会把 Cookie 存成 `.netease_cookie` 文件，
> 一旦部署到公网就会导致「谁先扫码、之后所有访客都变成那个账号」—— 该行为已移除。

---

## API 接口

所有接口以 `/api/` 开头，返回 JSON。

需要登录态的接口（`song/url`、`album`、`lyric`、`search`、`login/status`）会读取请求头
`X-Netease-Cookie`（URL 编码后的网易云 Cookie）。不带这个头就是匿名访问，服务端不会替你兜底。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/artists` | 艺人列表（前端开场轮播用），含自动补全的 `color` / `avatar` |
| GET | `/api/artist/albums?id=<艺人ID>` | 某位艺人的专辑（含 iTunes 高清封面）与未匹配清单 `unmatched` |
| GET | `/api/album?id=<专辑ID>` | 专辑详情与曲目列表 |
| GET | `/api/song/url?id=<歌曲ID>` | 歌曲播放地址（带 Cookie 时返回 999kbps） |
| GET | `/api/lyric?id=<歌曲ID>` | 歌词 |
| GET | `/api/search?keywords=<关键词>&type=1` | 搜索 |
| GET | `/api/login/qr/key` | 生成登录二维码 |
| GET | `/api/login/qr/check?key=<key>` | 轮询扫码状态。`code=803` 时**在响应里返回 `cookie` 与 `nickname`**，由前端自行保存 |
| GET | `/api/login/status` | 查询当前登录状态（读请求头，现查一次） |
| GET | `/api/musickit/token` | 签发 Apple MusicKit Developer Token（ES256 JWT） |

---

## 部署

### 通用 Linux 服务器

仓库内提供了 `deploy.sh`，基于 Node 20 + PM2：

```bash
scp -r . user@your-server:/opt/vinyl-player
ssh user@your-server
cd /opt/vinyl-player && bash deploy.sh
```

### Railway

仓库内已包含 `.railwayignore`，直接连接 GitHub 仓库即可部署。记得配置 `NETEASE_PROXY`。

> **可以放心部署到公网。** 登录态按访客隔离，服务器不落盘任何账号凭证。
> 只需确认 `musickit.json`（你的 Apple 私钥）没有被一并上传 —— 它已在 `.gitignore` 中排除。
>
> 建议用 HTTPS：Cookie 是通过请求头传给服务端的，明文 HTTP 下可能被中间人截获。

---

## 说明与免责

- 本项目仅用于个人学习与技术研究，音乐内容版权归各唱片公司及平台所有。
- 网易云音乐接口通过开源库 [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) 调用，请遵守对应平台的服务条款。
- 界面文案分工：主界面为英文，登录流程与播放提示为中文（涉及网易云账号与版权信息）。

## License

ISC
