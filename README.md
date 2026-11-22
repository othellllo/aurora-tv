# Aurora TV

[![Build](https://github.com/othellllo/aurora-tv/actions/workflows/build.yml/badge.svg)](https://github.com/othellllo/aurora-tv/actions/workflows/build.yml)

> 苹果 TV 风格的跨端 TVBox 客户端：**Android 手机 · Windows · Android TV**，一套 React 界面 + Tauri 2 原生壳。

![首页](docs/screenshots/home.png)

## 这是什么

你有一份自己的 TVBox 多源配置（[tvbox-multi.json](https://cdn.jsdelivr.net/gh/othellllo/tvbox-multi@main/tvbox-multi.json)）。
Aurora TV 把它做成了一个「看起来像 Apple TV」的播放器：

- **克制、暗色、大留白**的界面，海报墙 + 精选 Hero + 毛玻璃面板；
- **遥控器优先**的空间导航：方向键在卡片、按钮、选集之间自由移动，选中项放大并浮起；
- **高度可自定义**：强调色、卡片密度/缩放、圆角、焦点样式、字号、动效、Hero 开关、顶栏自动隐藏、快进步长……全部本地持久化；
- **三端同一套代码**：浏览器 / PWA 预览，Tauri 打包 Windows 与 Android（手机 + 电视）。

真实片源已验证可用：首页、详情、选集、HLS 播放、搜索、续播都能跑通（测试站点为 `type 1` CMS 接口）。

| 详情页 | 设置 | 搜索 |
| --- | --- | --- |
| ![详情](docs/screenshots/detail.png) | ![设置](docs/screenshots/settings.png) | ![搜索](docs/screenshots/search.png) |

| 播放器 | 手机 | 遥控器焦点 |
| --- | --- | --- |
| ![播放器](docs/screenshots/player.png) | ![手机](docs/screenshots/mobile.png) | ![焦点](docs/screenshots/focus.png) |

### 手机端

手机不是把桌面缩小，而是单独的一层版式：

- **底部五栏导航**（首页 / 分类 / 搜索 / 片库 / 设置），拇指可达，打开详情或播放器时自动收起；
- **左右边缘滑动返回**：从屏幕左/右边缘向内滑，关闭详情、搜索、设置、片库，分类页返回首页；
- **播放器手势**：横向滑动快进/后退，左半屏上下调亮度、右半屏上下调音量，点按显隐控制条；
- 适配 **刘海 / 灵动岛 / 底部手势条**，顶栏、面板、播放器都带安全区；
- Hero 改为「顶部悬浮海报 + 底部标题」，矮屏（≤ 640px 高）自动隐藏海报、收紧按钮；
- 详情页 **4 列选集**、粘性返回按钮 + 顶部渐变遮罩，滚动时不丢失返回入口；
- 播放器点按显隐控制条，手机端提供音量、静音、倍速、清晰度、横屏 / 竖屏切换和返回按钮；
- 电视 / Windows 端不显示横屏，改为 **全屏 / 退出全屏** 和 **铺满 / 适应**（铺满会裁掉黑边、占满屏幕）；
- 电视遥控在播放器内用 ↑ / ↓ 选择全部控制项（含音量、倍速、清晰度、全屏、铺满），回车执行；
- 触屏不再触发电视焦点环，输入框 16px 防止 iOS 自动放大；
- 打开面板时锁定背景滚动，关闭后恢复。

| 手机首页 | 手机详情 | 手机设置 |
| --- | --- | --- |
| ![手机首页](docs/screenshots/mobile.png) | ![手机详情](docs/screenshots/mobile-detail.png) | ![手机设置](docs/screenshots/mobile-settings.png) |

| 手机播放器 | 小屏 320px |
| --- | --- |
| ![手机播放器](docs/screenshots/mobile-player.png) | ![小屏](docs/screenshots/mobile-320.png) |

| 分类页（手机） | 分类页（桌面） |
| --- | --- |
| ![分类手机](docs/screenshots/category-mobile.png) | ![分类桌面](docs/screenshots/category.png) |

| 播放历史 |
| --- |
| ![播放历史](docs/screenshots/history-mobile.png) |

## 现在能做什么

- 读取 `tvbox-multi.json` 的 `urls` 列表，逐个加载聚合源；
- **自动探测**可用源与站点（跳过全 spider 的源），优先上次成功的站点，首次启动约 10–20 秒；
- 首页只保留 **播放历史** 和 **近期高分** 两行：播放历史来自本机继续观看记录，近期高分筛选评分 ≥ 7.5 的影片按更新时间排序，不再堆叠一堆分类行；
- **独立「历史」页**：完整播放记录、进度、单条删除、清空全部；删除和清空会写墓碑同步到三端；
- **分类页**：电影 / 电视剧 / 动漫 / 短剧 / 动漫短剧 / 综艺，海报网格 + 加载更多，手机 3 列、桌面自适应；
- 分类支持 **默认 / 时间 / 评分 / 人气 / 热度** 排序，按当前已加载内容重新排列；
- 站点搜索、搜索结果海报墙、屏幕键盘（电视遥控可输入字母/数字）；
- 详情页：简介、线路切换、选集、续播；
- HLS（hls.js）+ MP4 播放、进度记忆、自动下一集、10 秒快进/快退；
- **解析线路**：CMS 返回网页播放地址时，自动调用配置里的 `parses` 解析成 m3u8 直链（最多 5 条、9 秒超时）；
- 「继续观看」行、播放进度写入本地；
- 设置面板 20+ 项可调，实时生效并持久化；
- **内置 5 个 CMS 站点**（电影天堂 / 非凡 / 光速 / 量子 / 素博），不依赖 tvbox-multi 配置，配置源全挂也能播；
- **三端播放记录自动同步**：局域网 / WebDAV / GitHub Gist 三种方式，观看进度自动合并；
- **手动同步码**：把设置 + 片源 + 观看进度打包成一段文本，离线也能搬到另一台设备；
- Windows / Android 使用 Tauri 原生 `fetch`，**不依赖浏览器代理、不受 CORS 限制**。

## 重要边界（先读）

你的配置里有 6 个聚合源，绝大多数站点是 **type 3（spider / jar / drpy）**，这类站点需要 Java 或 JS 内核才能解析。
本项目当前直连 **type 1（苹果 CMS JSON）** 站点，因此：

| 站点类型 | 例子 | 当前状态 |
| --- | --- | --- |
| type 1 · CMS JSON | 小马源里的「量子[直连]」「采集」，老刘备源里的采集站 | ✅ 可用 |
| type 3 · spider / drpy | 大多数 `csp_*` / `jar` / `drpy2.min.js` 站点 | ⛔ 暂不支持，需要内核 |
| type 0 · XML | 少见 | ⛔ 未实现 |

启动时如果某个源全是 spider，会自动跳过，换下一个源；全都不行则进入内置演示片库。
后续把 `csp_*` 内核接到 Tauri 端（Rust + QuickJS 或内置本地服务）即可补齐，前端协议已经按同一份数据模型预留（见 `docs/ARCHITECTURE.md`）。

浏览器模式还有一个额外限制：CMS 接口和图片需要经本地代理（`npm run proxy`），HLS 分片则要求源站允许跨域；Windows / Android 客户端没有这个问题。

## 内置片源

除了读取你的 tvbox-multi 配置，App 还内置了 5 个常用苹果 CMS 站点：

| 站点 | 接口 |
| --- | --- |
| 电影天堂 | `caiji.dyttzyapi.com` |
| 非凡资源 | `api.ffzyapi.com` |
| 光速资源 | `api.guangsuapi.com` |
| 量子资源 | `cj.lziapi.com` |
| 素博资源 | `subocaiji.com` |

它们不依赖任何配置文件：即使 tvbox-multi 打不开，启动后也会自动选中其中一个可用的内置站点。
在「片库」里可以看到带「内置」标签的条目，随时切换；聚合源里同接口的站点会自动去重。

内置站点大多同时提供「分享页」和「m3u8」两条线路，App 会优先选直链 m3u8。

## 鸿蒙 HarmonyOS

- **HarmonyOS 4.x / 4.2**：系统兼容 Android 应用，直接安装上面的**手机端 APK**；
- **HarmonyOS NEXT 5.x**：不再支持 APK，需要 HAP。仓库当前不提供 HAP 安装包，
  可以用网页 / PWA 方式把手机当客户端：

```bash
npm run build
npm run share
# 手机浏览器打开终端里打印的 http://电脑IP:4173
```

完整步骤、代理设置和限制见 **[docs/HARMONY.md](docs/HARMONY.md)**。

> 为什么没有直接给 HAP：HAP 需要 DevEco Studio + HarmonyOS SDK 编译，并用华为签名证书 / Profile 签名，
> 这些必须在你自己的华为开发者账号下完成。原生 ArkWeb 容器的方案已经写在文档里，可以在 DevEco 里继续。

## 快速开始

### 下载现成安装包

- **Releases**：<https://github.com/othellllo/aurora-tv/releases>
- 或 Actions → [Build](https://github.com/othellllo/aurora-tv/actions/workflows/build.yml) → 最新运行 → Artifacts

| 端 | 适用设备 | 文件 |
| --- | --- | --- |
| **手机端** | 64 位安卓手机 | `AuroraTV_0.1.17_phone-arm64-v8a.apk` |
| **手机端** | 32 位老手机 | `AuroraTV_0.1.17_phone-armeabi-v7a.apk` |
| **电视端** | 64 位电视 / 盒子 | `AuroraTV_0.1.17_tv-arm64-v8a.apk` |
| **电视端** | 32 位老电视盒子 | `AuroraTV_0.1.17_tv-armeabi-v7a.apk` |
| **电视 legacy** | Android 5.0 / 5.1 老电视（实验性） | `AuroraTV_0.1.17_tv-legacy-armeabi-v7a.apk` |
| **Windows 端** | Win10 / Win11 安装版 | `AuroraTV_0.1.17_x64-setup.exe` |
| **Windows 端** | MSI 部署包 | `AuroraTV_0.1.17_x64_en-US.msi` |
| **鸿蒙 4.x** | 兼容 Android 的华为手机 | 安装上面的**手机端 APK** |
| **鸿蒙 NEXT 5.x** | 纯血鸿蒙 | 暂用网页 / PWA，见 [docs/HARMONY.md](docs/HARMONY.md) |

手机端和电视端是**两个不同的 APK**：

- 手机端：不锁横屏、不注册 Leanback，装完从手机桌面启动；
- 电视端：强制横屏、注册 Leanback 入口、带 320×180 banner，会出现在电视的「应用」行。

两者包名相同（`com.auroratv.app`）、签名相同，同一台设备只需装其中一个；从手机版换电视版会直接覆盖安装。
APK 均已用项目自带 keystore 做 release 签名；从 **0.1.11** 起同时带 v1（JAR）和 v2 签名，最低支持 **Android 6.0（API 23）**，老电视请优先试 `tv-armeabi-v7a`。
Android 5.0 / 5.1 的老电视（如 Redmi L43M7-EA）可以试 `tv-legacy-armeabi-v7a` 实验包；Tauri 官方最低是 Android 7，legacy 包的 WebView 兼容性不保证。

### 0. 环境

- Node.js ≥ 20（本项目用 24 验证）
- 浏览器预览：无需其他依赖
- Windows 打包：Rust + Visual Studio Build Tools（C++ 桌面开发）
- Android：Rust + Android Studio（SDK / NDK），详见 [docs/BUILD.md](docs/BUILD.md)

> **不想在本机装工具链？** 仓库自带 GitHub Actions：推到 `main` 或手动触发
> [Build workflow](https://github.com/othellllo/aurora-tv/actions/workflows/build.yml)，
> 就能在 Artifacts 里直接下载 Windows 安装包和 Android APK。打 `v*` 标签还会自动创建 Release。

### 1. 浏览器里跑起来

```bash
npm install

# 终端 1：本地代理（解决 CORS / 图片防盗链）
npm run proxy

# 终端 2：开发服务器
npm run dev
# 打开 http://127.0.0.1:5173
```

也可以直接跑构建产物：

```bash
npm run build
npm run preview   # http://127.0.0.1:4173
```

### 2. Windows 客户端

```bash
npm run tauri:dev     # 开发
npm run tauri:build   # 生成 MSI / NSIS 安装包
```

产物在 `src-tauri/target/release/bundle/`。

### 3. Android 手机 / Android TV

```bash
npx tauri android init      # 首次生成 android/ 工程
npx tauri android dev       # 连真机调试
npx tauri android build --apk
```

电视遥控/横屏/Leanback 的清单改法见 [docs/BUILD.md](docs/BUILD.md#android-tv-适配)。

> 本仓库在开发环境里**没有** Rust / Android SDK，因此 Windows 安装包与 APK 未在此机器上实际编译；前端与真实片源链路已在 Chromium 中验证。首次打包按文档安装工具链即可。

### 4. 手机浏览器 / PWA

构建后把 `dist/` 部署到任意静态站点，用手机浏览器打开，可「添加到主屏幕」。
注意手机浏览器同样需要能访问一个代理地址；生产环境建议直接用 Android APK。

## 界面与操作

| 操作 | 键盘 | 遥控器 |
| --- | --- | --- |
| 移动焦点 | 方向键 | 方向键 / 左摇杆 |
| 确认 | Enter | OK / A |
| 返回 / 关闭面板 | Esc | 返回键 / B |
| 播放暂停 | 空格 | 播放键 |
| 快进 / 快退 | 播放器内 ← → | 播放器内 ← → |
| 搜索输入 | 直接打字 | 屏幕键盘 / 外接键盘 |

首页焦点默认落在「立即播放」。选中卡片会放大 7.5%、亮起描边并显示片名；左右键在海报行内滚动，上下键跨行。

## 高度自定义

设置 → 外观/布局/播放，所有项即时生效并写入 `localStorage`：

- **强调色**：月光白、珊瑚红、冰川蓝、薄荷绿、暮光紫、暖金
- **卡片密度**：紧凑 / 标准 / 宽松（对应 168 / 192 / 220 px 基准宽度）
- **卡片缩放**：85% – 120%
- **圆角**：0 – 28 px
- **焦点样式**：白环 / 光晕 / 纯缩放
- **字号**：85% – 120%
- **动画效果**：可关闭（低配电视盒子更省电）
- **Hero 大图 / 自动轮播 / 卡片标题 / 顶栏自动隐藏**
- **自动下一集 / 快进步长**
- **在线源 / 演示片库**切换
- **配置文件地址 / 本地代理地址 / 手动添加站点 / 清除缓存**

想改得更深：所有设计变量集中在 `src/styles.css` 顶部的 `:root`（`--accent`、`--radius`、`--card-w`、`--ease` 等），布局调整看 `src/views/Home.tsx` 与 `src/components/Shelf.tsx`。

## 三端播放记录同步

手机、Windows、Android TV 共用一份「继续观看」。设置 → **播放记录自动同步**，选一种方式，三端填同一套配置即可：

| 方式 | 适合 | 需要 |
| --- | --- | --- |
| 局域网 | 家里三端连同一个 Wi-Fi | 电脑跑 `npm run sync`，填 `http://电脑IP:8788` |
| WebDAV | 随时随地 | 坚果云 / Nextcloud 的一个目录 + 应用密码 |
| Gist | 有 GitHub | Token（勾选 gist），首次自动创建私密 Gist |

![同步设置](docs/screenshots/sync.png)

- 只同步观看进度，不同步片源 / 外观 / 账号；
- 进度变化 **4 秒后**自动上传，启动和切回应用时自动拉取，也可以手动「立即同步」；
- 冲突按 `updatedAt` 取最新，时间相同取进度更靠后的；删除记录会写墓碑并同步到三端；
- 同步凭证只保存在本机，不会写进下面的同步码。

局域网方式最快：

```bash
npm run sync        # http://0.0.0.0:8788，数据在 .sync-data/
```

完整配置（坚果云应用密码、Gist Token、鉴权、冲突规则、接口）见 **[docs/SYNC.md](docs/SYNC.md)**。

## 手动同步码（离线）

设置 → 手动同步码 → **生成同步码**，把整段 Base64 文本发到另一台设备，粘贴后 **导入**。
同步内容包括：

- 全部外观/布局/播放设置
- 片源模式、配置地址、站点选择
- 最近 60 条观看记录（含线路、集数、进度）

数据存储：浏览器 `localStorage`，Tauri 使用 WebView 的持久化存储，卸载应用才会清空。
同步码不包含任何 WebDAV / Gist / 局域网密码。

## 目录结构

```
aurora-tv/
├─ src/
│  ├─ App.tsx                 # 路由式面板编排、播放状态、键盘与手柄入口
│  ├─ styles.css              # 设计系统（Apple TV 风格的全部视觉规则）
│  ├─ core/
│  │  ├─ types.ts             # TVBox / 影片 / 播放模型
│  │  ├─ settings.ts          # 设置、历史、同步码
│  │  ├─ sync.ts              # 播放记录同步（HTTP / WebDAV / Gist + 合并）
│  │  ├─ net.ts               # 代理 / Tauri 原生 fetch、容错 JSON
│  │  ├─ tvbox.ts             # 多源配置、CMS 列表/详情/搜索、线路解析
│  │  ├─ nav.ts               # 空间焦点导航（方向键 / 手柄）
│  │  └─ demo.ts              # 内置演示片库
│  ├─ hooks/useCatalog.ts     # 源探测、站点选择、搜索、详情加载
│  ├─ components/             # Hero、Shelf、Card、Artwork、TopBar、图标
│  └─ views/                  # Home、Detail、Player、Search、Settings、Sources
├─ server/proxy.mjs           # 浏览器开发代理（/proxy、/img、/health）
├─ server/sync.mjs            # 局域网播放记录同步服务（:8788）
├─ src-tauri/                 # Tauri 2 壳 + Rust 原生 fetch
│  ├─ src/lib.rs              # #[tauri::command] fetch_text / http_request
│  ├─ tauri.conf.json
│  └─ capabilities/default.json
├─ tools/make-icons.py        # 生成 PNG / ICO 图标
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ BUILD.md
│  ├─ SYNC.md
│  ├─ HARMONY.md
│  └─ screenshots/
└─ index.html / vite.config.mjs
```

## 常见问题

**Q：一直停在「正在探测可用片源」？**
首次启动会依次加载最多 4 个聚合源（每个约 1 MB）并探测最多 8 个站点。若超过 40 秒仍无内容：
1. 确认 `npm run proxy` 在运行（浏览器模式）；
2. 设置 → 片源 → 切换到「小马」源，里面有「量子[直连]」「采集」等 CMS 站；
3. 或在「手动添加站点」里填一个可用的 CMS 接口。

**Q：为什么很多站点显示不出来？**
它们是 type 3（spider），需要内核；当前只索引 type 1。见上文「重要边界」。

**Q：画面黑屏但有声音 / 报编码错误？**
该线路的编码 WebView 不支持，换一条线路；或者换站点。

**Q：Windows 打包报 `Access is denied`（esbuild 临时文件）？**
少数安全软件会锁 esbuild 的临时文件。本项目已改用 terser 压缩，并把 Vite 配置加载器切到 `runner`；如果仍遇到，把项目目录加入安全软件白名单即可。

## 路线图

- [ ] spider 内核（Rust + QuickJS，兼容 `csp_*` / drpy2）
- [ ] 直播（`lives`）与 EPG
- [ ] 海报墙「全部」页、分类筛选
- [ ] 播放器手势（手机）、画中画、后台音频
- [ ] 同步二维码配对（免手输地址/Token）
- [ ] 真正的电视遥控按键映射（`KeyEvent.KEYCODE_DPAD_*`）与开机横屏
- [ ] 豆瓣/ TMDB 元数据补全

## 支持开发

Aurora TV 是免费开源的。如果它帮到了你，可以扫码请作者喝杯咖啡；**完全自愿，不影响任何功能**。

| 微信赞赏 | 支付宝 |
| --- | --- |
| ![微信赞赏码](public/donate/wechat.png) | ![支付宝收款码](public/donate/alipay.png) |

也可以用 App 内 **设置 → 关于 → 支持开发** 打开同样的二维码。

## 免责声明

本项目只提供播放器界面与协议适配，不存储、不传播任何影视资源。
请仅用于播放你拥有合法访问权限的内容，遵守当地法律法规与内容平台条款。
