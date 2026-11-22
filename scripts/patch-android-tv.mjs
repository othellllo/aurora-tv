#!/usr/bin/env node
/**
 * 把 tauri android init 生成的工程改成对应端的形态：
 *
 *   APP_VARIANT=phone  → 手机：不锁横屏、不加 Leanback 入口、不挂 banner
 *   APP_VARIANT=tv     → 电视：横屏、Leanback 入口、320×180 banner
 *   两者都允许 http 明文（TVBox 片源大量是 http）
 *
 * 在 CI 里于 `tauri android init` 之后、`tauri android build` 之前执行。
 */
import fs from 'node:fs'
import path from 'node:path'

const variant = (process.env.APP_VARIANT || 'tv').toLowerCase() === 'phone' ? 'phone' : 'tv'
const root = process.cwd()
const androidDir = path.join(root, 'src-tauri', 'gen', 'android', 'app', 'src', 'main')
const manifestPath = path.join(androidDir, 'AndroidManifest.xml')

if (!fs.existsSync(manifestPath)) {
  console.error(`[patch-android] 找不到 ${manifestPath}，请先运行 tauri android init`)
  process.exit(1)
}

let manifest = fs.readFileSync(manifestPath, 'utf8')

// Tauri 模板用 ${usesCleartextTraffic} 占位；固定放开
manifest = manifest.replace(/\$\{usesCleartextTraffic\}/g, 'true')

if (variant === 'tv') {
  // 1) 声明电视能力（不是硬性要求，方便同一包也装手机）
  if (!manifest.includes('android.software.leanback')) {
    manifest = manifest.replace(
      /<manifest\b[^>]*>/,
      (tag) =>
        `${tag}\n    <uses-feature android:name="android.software.leanback" android:required="false" />`,
    )
  }

  // 2) MainActivity 横屏
  manifest = manifest.replace(
    /<activity\b[^>]*android:name="\.MainActivity"[^>]*>/s,
    (tag) => {
      if (tag.includes('android:screenOrientation')) return tag
      return tag.replace(/\s*>$/, '\n            android:screenOrientation="landscape">')
    },
  )

  // 3) Leanback 启动入口
  if (!manifest.includes('LEANBACK_LAUNCHER')) {
    manifest = manifest.replace(
      /<category android:name="android\.intent\.category\.LAUNCHER" \/>/,
      (tag) => `${tag}\n                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />`,
    )
  }

  // 4) banner + 明文流量
  manifest = manifest.replace(/<application\b[^>]*>/s, (tag) => {
    let out = tag
    if (!out.includes('android:banner')) {
      out = out.replace(/\s*>$/, '\n        android:banner="@drawable/banner"\n        >')
    }
    if (!out.includes('usesCleartextTraffic')) {
      out = out.replace(/\s*>$/, '\n        android:usesCleartextTraffic="true"\n        >')
    }
    return out
  })

  const bannerSource = path.join(root, 'docs', 'screenshots', 'banner.png')
  const bannerDir = path.join(androidDir, 'res', 'drawable')
  if (fs.existsSync(bannerSource)) {
    fs.mkdirSync(bannerDir, { recursive: true })
    fs.copyFileSync(bannerSource, path.join(bannerDir, 'banner.png'))
  }
} else {
  // 手机：去掉模板里给 TV 准备的 Leanback 入口和横屏锁，并强制竖屏启动
  manifest = manifest.replace(/\s*<category android:name="android\.intent\.category\.LEANBACK_LAUNCHER" \/>/g, '')
  manifest = manifest.replace(/\s*android:screenOrientation="[^"]*"/g, '')
  manifest = manifest.replace(/\s*android:banner="@[^"]*"/g, '')

  // 部分 ROM / 车机模式会把未指定的 Activity 直接按横屏启动，手机端显式锁竖屏
  manifest = manifest.replace(
    /<activity\b[^>]*android:name="\.MainActivity"[^>]*>/s,
    (tag) => tag.replace(/\s*>$/, '\n            android:screenOrientation="portrait">'),
  )

  // 运行时再锁一次竖屏，避免 ROM / 其他库把 Activity 改回横屏
  const javaRoot = path.join(androidDir, 'java')
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name)
      return entry.isDirectory() ? walk(full) : [full]
    })
  }
  const activity = walk(javaRoot).find((file) => file.endsWith('MainActivity.kt'))
  if (activity) {
    let kotlin = fs.readFileSync(activity, 'utf8')
    if (!kotlin.includes('SCREEN_ORIENTATION_PORTRAIT')) {
      if (kotlin.includes('super.onCreate(savedInstanceState)')) {
        kotlin = kotlin.replace(
          'super.onCreate(savedInstanceState)',
          'super.onCreate(savedInstanceState)\n        requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT',
        )
        fs.writeFileSync(activity, kotlin)
        console.log('[patch-android] MainActivity 运行时竖屏已写入')
      }
    }
  }

  if (!manifest.includes('usesCleartextTraffic')) {
    manifest = manifest.replace(/<application\b[^>]*>/s, (tag) =>
      tag.replace(/\s*>$/, '\n        android:usesCleartextTraffic="true"\n        >'),
    )
  }
}

const legacySdk = Number(process.env.LEGACY_MIN_SDK || 0)
if (legacySdk && legacySdk < 23) {
  if (!manifest.includes('xmlns:tools')) {
    manifest = manifest.replace(
      '<manifest ',
      '<manifest xmlns:tools="http://schemas.android.com/tools" ',
    )
  }
  if (!manifest.includes('overrideLibrary')) {
    manifest = manifest.replace(
      /<application\b/,
      '    <uses-sdk tools:overrideLibrary="androidx.lifecycle.livedata.core.ktx,androidx.lifecycle.viewmodel.savedstate,androidx.lifecycle.viewmodel,androidx.lifecycle" />\n\n    <application',
    )
  }
}

fs.writeFileSync(manifestPath, manifest)

// 拦截 Android 返回键：先交给网页处理层级返回，网页不处理时才退出 App
const javaRoot = path.join(androidDir, 'java')
const walk = (dir) => {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}
const activityFile = walk(javaRoot).find((file) => file.endsWith('MainActivity.kt'))
if (activityFile) {
  let kotlin = fs.readFileSync(activityFile, 'utf8')
  if (!kotlin.includes('onAndroidBackPressed')) {
    if (!kotlin.includes('import android.webkit.WebView')) {
      kotlin = kotlin.replace(/^(package .+)$/m, '$1\n\nimport android.webkit.WebView')
    }

    const backHandler = `
  private var auroraWebView: WebView? = null

  override fun onWebViewCreate(webView: WebView) {
    auroraWebView = webView
    super.onWebViewCreate(webView)
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    val webView = auroraWebView
    if (webView == null) {
      finish()
      return
    }
    webView.evaluateJavascript(
      "window.onAndroidBackPressed ? window.onAndroidBackPressed() : true"
    ) { result ->
      if (result == "true") finish()
    }
  }
`
    const closeIndex = kotlin.lastIndexOf('}')
    if (closeIndex > 0) {
      kotlin = kotlin.slice(0, closeIndex) + backHandler + kotlin.slice(closeIndex)
      fs.writeFileSync(activityFile, kotlin)
      console.log('[patch-android] Android 返回键拦截已写入')
    }
  }
}

// 把 targetSdk 降到 34：Android 16 对 targetSdk >= 36 的大屏设备会忽略竖屏锁定
const gradlePath = path.join(root, 'src-tauri', 'gen', 'android', 'app', 'build.gradle.kts')
if (fs.existsSync(gradlePath)) {
  const before = fs.readFileSync(gradlePath, 'utf8')
  let after = before
  if (legacySdk) {
    after = after.replace(/(\bminSdk\s*=\s*)\d+/, (_match, prefix) => `${prefix}${legacySdk}`)
    if (after === before) {
      after = after.replace(
        /(\bminSdkVersion\s*=\s*)\d+/,
        (_match, prefix) => `${prefix}${legacySdk}`,
      )
    }
    console.log(`[patch-android] legacy minSdk: ${legacySdk}`)
  }
  const withSdk = after
  after = after.replace(/(\btargetSdk\s*=\s*)\d+/, (_match, prefix) => `${prefix}34`)
  if (after === withSdk) {
    after = after.replace(/(\btargetSdkVersion\s*=\s*)\d+/, (_match, prefix) => `${prefix}34`)
  }
  if (after !== before) {
    fs.writeFileSync(gradlePath, after)
    console.log('[patch-android] targetSdk: 34')
  } else {
    console.log('[patch-android] targetSdk 未在 build.gradle.kts 中找到，保持默认')
  }
}
console.log(
  `[patch-android] variant=${variant}：${variant === 'tv' ? 'leanback / landscape / banner' : 'portrait / no leanback'} / cleartext`,
)