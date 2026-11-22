# Aurora TV v0.1.17

新增 Android 5.0 / 5.1 实验性 legacy TV 包。

## 背景

Redmi L43M7-EA（MiTV-ANTL0）这类老电视是 **Android 5.1.1（API 22）**，
普通电视包最低要求 Android 6.0（API 23），会被「本地应用安装」拦下。

## 新增文件

- `AuroraTV_0.1.17_tv-legacy-armeabi-v7a.apk`
  - `minSdkVersion=21`，支持 Android 5.0 / 5.1；
  - 使用 `tools:overrideLibrary` 绕过 AndroidX lifecycle 的 API 23 限制；
  - 只构建 32 位 armv7，适合老电视盒子；
  - v1 + v2 签名。

## 重要说明

- 这是**实验性包**：Tauri 官方最低支持 Android 7，Android 5.1 属于非官方范围；
- 老电视 WebView 可能太旧，装得上也可能白屏；
- 如果 legacy 包装上白屏，可以尝试在电视上更新「Android System WebView」；
- 普通电视/手机继续用原来的 `tv-` / `phone-` 包，不受影响。

## 包含文件

| 端 | 文件 |
| --- | --- |
| 手机端 64 位 | `AuroraTV_0.1.17_phone-arm64-v8a.apk` |
| 手机端 32 位 | `AuroraTV_0.1.17_phone-armeabi-v7a.apk` |
| 电视端 64 位 | `AuroraTV_0.1.17_tv-arm64-v8a.apk` |
| 电视端 32 位 | `AuroraTV_0.1.17_tv-armeabi-v7a.apk` |
| 电视 legacy（Android 5.x） | `AuroraTV_0.1.17_tv-legacy-armeabi-v7a.apk` |
| Windows 安装版 | `AuroraTV_0.1.17_x64-setup.exe` |
| Windows MSI | `AuroraTV_0.1.17_x64_en-US.msi` |
