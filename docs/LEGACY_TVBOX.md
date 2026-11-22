# Android 5.x 老电视版（TVBox 原生内核）

这台 Redmi L43M7-EA 是 Android 5.1.1，Aurora TV 的 Tauri 包无法正常运行
（legacy 包能安装，但 WebView 太旧会白屏）。

所以提供了一个 **TVBox 原生客户端** 构建，专门给 Android 5.x 老电视：

- 基于开源项目 [q215613905/TVBoxOS](https://github.com/q215613905/TVBoxOS)（AGPL-3.0）；
- `minSdkVersion=19`，`armeabi-v7a`，Android 5.1 可直接安装；
- 应用名改为 **Aurora TV**；
- 首次启动预置配置：

```text
https://cdn.jsdelivr.net/gh/othellllo/tvbox-multi@main/tvbox-multi.json
```

- 内置 spider 内核，`type: 3` 的 jar/drpy 源也能用；
- 这是 **debug 签名** 的个人测试包，不适合公开分发；
- 源码与构建流程：本仓库 `.github/workflows/build-legacy-tvbox.yml` 和
  `scripts/patch-tvbox-legacy.mjs`，下载的是上游固定 commit，运行时打补丁。

## 安装

1. 把 `AuroraTV_TVBox_legacy_armeabi-v7a.apk` 放 U 盘；
2. 电视用 U 盘安装器安装（允许未知来源）；
3. 打开后会自动加载配置；如果没加载，进入设置 → 配置地址，粘贴上面的 URL。

## 说明

- TVBox 是第三方客户端，只从官方仓库构建，不包含影视内容；
- 修改后的二进制按 AGPL-3.0 使用，源码来自上面的上游仓库；
- 新手机 / Windows / 新电视继续用 Aurora TV 的 Tauri 包。
