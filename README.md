# Vinyl Discography Player

一个 **3D 黑胶唱片架**风格的音乐播放器。在浏览器里把唱片铺成一面墙，点击封面即可翻看曲目、播放歌曲，配合网易云音乐 API 解锁完整播放。

前端是纯手写的 Three.js 场景 + 原生 ES Module，没有任何构建步骤；后端是一个零框架的 Node.js 服务，负责代理网易云 API、抓取专辑封面、签发 Apple MusicKit Token。

---

## 功能特性

- **3D 唱片墙** — Three.js 渲染的专辑封面墙，支持悬停高亮、点击翻面、镜头推进
- **艺人切换** — 内置 30 位说唱 / R&B 艺人的正式录音室专辑清单（Kanye West、Drake、Kendrick Lamar、Frank Ocean、Tyler The Creator、Travis Scott 等）
- **曲目面板** — 侧滑面板展示曲目列表，支持播放中高亮、进度条拖拽、播放/暂停
- **双主题** — 亮色 / 暗色一键切换，配色随专辑主色动态变化
- **唱片纹理** — 黑胶唱片表面使用 `vinyl.jpg` / `vinyl.png` 纹理贴图
- **移动端适配** — 响应式布局，窄屏下曲目面板自动改为底部抽屉
- **扫码登录** — 通过二维码登录网易云账号，解锁 999kbps 高码率播放
- **封面自动匹配** — 用 iTunes Lookup API 按专辑名归一化匹配 600×600 高清封面，网易云封面作为兜底

---

## 目录结构

```
.
├── server.js              # Node 服务：静态文件 + API 代理 + MusicKit 签名
├── package.json
├── ye.html                # 主页面（Vinyl Discography），服务端默认返回此页
├── index.html             # 3D 专辑墙 + 网易云 iframe 播放器
├── player.html            # 早期版本：单艺人黑胶播放器
├── test.html              # 调试页
├── js/
│   ├── main.js            # Three.js 场景入口（专辑墙）
│   ├── album-shelf.js     # 唱片架几何体与交互
│   ├── library.js         # 专辑数据与状态管理
│   ├── three.module.js    # Three.js 运行时（本地内置）
│   └── three.min.js       # Three.js 压缩版
├── vinyl.jpg / vinyl.png  # 黑胶唱片纹理
├── deploy.sh              # Ubuntu / Oracle Cloud 一键部署脚本
├── .railwayignore         # Railway 部署忽略规则
├── musickit.example.json  # MusicKit 配置模板
└── .gitignore
```

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

需要 Node.js 18+（推荐 20）。

### 2. 配置 MusicKit（可选）

只在使用 Apple Music 相关能力时才需要。复制模板并填入你自己的信息：

```bash
cp musickit.example.json musickit.json
```

```json
{
  "teamId": "你的 Team ID",
  "keyId": "你的 Key ID",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
}
```

> `musickit.json` 已在 `.gitignore` 中，不会被提交。

### 3. 启动

```bash
npm start
# 或
node server.js
```

打开 http://localhost:8088 即可。

### 4. 登录网易云（可选）

不登录也能播放试听片段；登录后可解锁完整音质。在页面上调用 `/api/login/qr/key` 拿到二维码，用网易云 App 扫码，登录成功后 Cookie 会自动写入 `.netease_cookie`，重启不丢。

---

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `8088` | 服务监听端口 |
| `NETEASE_PROXY` | 无 | 网易云 API 请求代理地址，海外服务器部署时建议设置 |

```bash
PORT=3000 NETEASE_PROXY=http://127.0.0.1:7890 node server.js
```

---

## API 接口

所有接口以 `/api/` 开头，返回 JSON。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/artist/albums?id=<艺人ID>` | 获取艺人精选录音室专辑（含 iTunes 高清封面） |
| GET | `/api/album?id=<专辑ID>` | 专辑详情与曲目列表 |
| GET | `/api/song/url?id=<歌曲ID>` | 获取歌曲播放地址（登录后返回 999kbps） |
| GET | `/api/lyric?id=<歌曲ID>` | 歌词 |
| GET | `/api/search?keywords=<关键词>&type=1` | 搜索 |
| GET | `/api/login/qr/key` | 生成登录二维码 |
| GET | `/api/login/qr/check?key=<key>` | 轮询扫码状态，`code=803` 表示登录成功 |
| GET | `/api/login/status` | 查询当前登录状态 |
| GET | `/api/musickit/token` | 签发 Apple MusicKit Developer Token（ES256 JWT） |

---

## 部署

### 通用 Linux 服务器

仓库内提供了 `deploy.sh`，基于 Node 20 + PM2 部署：

```bash
scp -r . user@your-server:/opt/vinyl-player
ssh user@your-server
cd /opt/vinyl-player && bash deploy.sh
```

脚本会自动安装 Node 20、PM2，安装依赖并以 `music-player` 为名启动守护进程。

### Railway

仓库内已包含 `.railwayignore`，直接连接 GitHub 仓库即可部署。记得在平台的环境变量里配置 `PORT`（Railway 会自动注入）与 `NETEASE_PROXY`。

> 部署到公网前请确认 `.netease_cookie` 与 `musickit.json` 没有被一并上传 —— 这两个文件包含账号凭证，已在 `.gitignore` 中排除。

---

## 说明与免责

- 本项目仅用于个人学习与技术研究，音乐内容版权归各唱片公司及平台所有。
- 网易云音乐接口通过开源库 [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) 调用，请遵守对应平台的服务条款。
- 艺人专辑清单维护在 `server.js` 顶部的 `CURATED` 与 `ARTIST_META` 常量中，按发行顺序手动排列；新增艺人时补充这两处即可。

## License

ISC
