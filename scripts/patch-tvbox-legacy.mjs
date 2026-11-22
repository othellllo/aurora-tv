#!/usr/bin/env node
/**
 * 给 q215613905/TVBoxOS（TVBox 原生 Android 客户端，AGPL-3.0）打补丁：
 *  - 应用名改为 Aurora TV
 *  - 首次启动预置我们的 tvbox-multi 配置地址
 *  - 保留 java32 变体（minSdk 19 / armeabi-v7a），供 Android 5.x 老电视使用
 *
 * 只修改配置与文案，不分发影视内容；源码来自：
 * https://github.com/q215613905/TVBoxOS
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.argv[2] || 'legacy')
const appJava = path.join(root, 'app/src/main/java/com/github/tvbox/osc/base/App.java')
const strings = path.join(root, 'app/src/main/res/values/strings.xml')
const gradle = path.join(root, 'app/build.gradle')
const configUrl =
  'https://cdn.jsdelivr.net/gh/othellllo/tvbox-multi@main/tvbox-multi.json'

if (!fs.existsSync(appJava)) {
  console.error(`[tvbox] 找不到 ${appJava}`)
  process.exit(1)
}

let java = fs.readFileSync(appJava, 'utf8')
if (!java.includes('tvbox-multi.json')) {
  const marker = 'Hawk.init(this).build();'
  if (!java.includes(marker)) {
    console.error('[tvbox] App.java 结构不符合预期，找不到 Hawk.init')
    process.exit(1)
  }
  java = java.replace(
    marker,
    `${marker}\n        if (!Hawk.contains(HawkConfig.API_URL)) {\n            Hawk.put(HawkConfig.API_URL, "${configUrl}");\n        }`,
  )
  fs.writeFileSync(appJava, java)
  console.log('[tvbox] 默认配置地址已预置')
}

let xml = fs.readFileSync(strings, 'utf8')
xml = xml.replace(/<string name="app_name">[^<]*<\/string>/, '<string name="app_name">Aurora TV</string>')
fs.writeFileSync(strings, xml)

let appGradle = fs.readFileSync(gradle, 'utf8')
appGradle = appGradle.replace(/versionName\s+'[^']*'/, "versionName 'Aurora TV 1.0'")
fs.writeFileSync(gradle, appGradle)

// 用项目图标替换 TVBox 默认图标（同名覆盖，各密度由 Android 缩放）
const icon = path.join(process.cwd(), 'src-tauri', 'icons', 'icon.png')
if (fs.existsSync(icon)) {
  for (const density of ['hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    const target = path.join(root, `app/src/main/res/drawable-${density}/app_icon.png`)
    if (fs.existsSync(path.dirname(target))) fs.copyFileSync(icon, target)
  }
}

console.log('[tvbox] 应用名 / 图标 / 默认源已写入')
