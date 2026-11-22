import { useEffect, useRef, useState } from 'react'
import type { HistoryEntry } from '../core/types'
import {
  ACCENTS,
  DEFAULT_SETTINGS,
  decodeSync,
  encodeSync,
  stripSyncSecrets,
  type Settings,
  type SyncPayload,
} from '../core/settings'
import { focusFirst, isPhoneUi, setNavRoot } from '../core/nav'
import { ChevronLeft, RefreshIcon } from '../components/Icons'
import { Support } from '../components/Support'

interface SettingsViewProps {
  settings: Settings
  history: HistoryEntry[]
  syncState: {
    status: 'idle' | 'syncing' | 'ok' | 'error'
    message?: string
    at?: number
    count?: number
  }
  onSyncNow: () => void
  onChange: (next: Settings) => void
  onClose: () => void
  onOpenSources: () => void
  onApplyData: (configUrl: string, proxy: string) => void
  onImportSync: (payload: SyncPayload) => void
  onClearCache: () => void
  onToast: (message: string) => void
}

export function SettingsView({
  settings,
  history,
  syncState,
  onSyncNow,
  onChange,
  onClose,
  onOpenSources,
  onApplyData,
  onImportSync,
  onClearCache,
  onToast,
}: SettingsViewProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [configUrl, setConfigUrl] = useState(settings.data.configUrl)
  const [proxy, setProxy] = useState(settings.data.proxy)
  const [syncBox, setSyncBox] = useState('')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [supportOpen, setSupportOpen] = useState(false)

  useEffect(() => {
    setNavRoot(rootRef.current)
    const raf = isPhoneUi()
      ? 0
      : requestAnimationFrame(() => focusFirst())
    return () => {
      setNavRoot(null)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const theme = settings.theme
  const layout = settings.layout
  const play = settings.play

  const updateTheme = (patch: Partial<Settings['theme']>) =>
    onChange({ ...settings, theme: { ...theme, ...patch } })
  const updateLayout = (patch: Partial<Settings['layout']>) =>
    onChange({ ...settings, layout: { ...layout, ...patch } })
  const updatePlay = (patch: Partial<Settings['play']>) =>
    onChange({ ...settings, play: { ...play, ...patch } })
  const updateData = (patch: Partial<Settings['data']>) =>
    onChange({ ...settings, data: { ...settings.data, ...patch } })
  const updateSync = (patch: Partial<Settings['sync']>) =>
    onChange({ ...settings, sync: { ...settings.sync, ...patch } })

  const makeCode = () => {
    const code = encodeSync({
      app: 'aurora-tv',
      version: 1,
      settings: stripSyncSecrets(settings),
      history,
      exportedAt: Date.now(),
    })
    setSyncBox(code)
    setSyncError(null)
    return code
  }

  const importCode = () => {
    try {
      const payload = decodeSync(syncBox)
      onImportSync(payload)
      setSyncError(null)
      onToast('同步码已导入')
    } catch (error) {
      setSyncError((error as Error).message || '同步码无法解析')
    }
  }

  const syncStatusText =
    settings.sync.provider === 'off'
      ? '同步已关闭'
      : syncState.status === 'syncing'
        ? '正在同步…'
        : syncState.status === 'error'
          ? `同步失败：${syncState.message ?? '请检查配置'}`
          : syncState.status === 'ok'
            ? `上次同步 ${formatClock(syncState.at)} · ${syncState.count ?? history.length} 条`
            : settings.sync.lastSyncAt
              ? `上次同步 ${formatClock(settings.sync.lastSyncAt)}`
              : '尚未同步'

  return (
    <div className="layer" data-layer="settings">
      <div className="panel" ref={rootRef}>
        <div className="panel-inner">
          <div className="panel-head">
            <div>
              <h1>设置</h1>
              <p>外观、布局、播放与片源，都保存在本地；用同步码可在三端之间搬移。</p>
            </div>
            <div className="actions">
              <button type="button" className="btn ghost" data-nav onClick={onOpenSources}>
                片源管理
              </button>
              <button type="button" className="btn primary" data-nav onClick={onClose}>
                完成
              </button>
            </div>
          </div>

          <div className="group">
            <div className="group-title">外观</div>

            <Row label="强调色" hint="用于焦点描边、标签与进度">
              <div className="swatches">
                {ACCENTS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    title={color.name}
                    aria-label={color.name}
                    className={`swatch ${theme.accent === color.value ? 'is-on' : ''}`}
                    style={{ background: color.value }}
                    data-nav
                    onClick={() => updateTheme({ accent: color.value })}
                  />
                ))}
              </div>
            </Row>

            <Row label="卡片密度" hint="每屏能完整看到的海报数量">
              <Seg
                value={theme.density}
                options={[
                  { value: 'compact', label: '紧凑' },
                  { value: 'cozy', label: '标准' },
                  { value: 'roomy', label: '宽松' },
                ]}
                onChange={(value) => updateTheme({ density: value as Settings['theme']['density'] })}
              />
            </Row>

            <Row label="卡片缩放" hint="在标准尺寸上整体放大或缩小">
              <Stepper
                value={theme.scale}
                min={0.85}
                max={1.2}
                step={0.05}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(value) => updateTheme({ scale: value })}
              />
            </Row>

            <Row label="圆角" hint="海报与面板的圆润程度">
              <Stepper
                value={theme.radius}
                min={0}
                max={28}
                step={2}
                format={(v) => `${v} px`}
                onChange={(value) => updateTheme({ radius: value })}
              />
            </Row>

            <Row label="焦点样式" hint="遥控器选中时的反馈方式">
              <Seg
                value={theme.focus}
                options={[
                  { value: 'ring', label: '白环' },
                  { value: 'glow', label: '光晕' },
                  { value: 'minimal', label: '纯缩放' },
                ]}
                onChange={(value) => updateTheme({ focus: value as Settings['theme']['focus'] })}
              />
            </Row>

            <Row label="字号" hint="整体界面字号">
              <Stepper
                value={theme.font}
                min={0.85}
                max={1.2}
                step={0.05}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(value) => updateTheme({ font: value })}
              />
            </Row>

            <Row label="动画效果" hint="关闭后更省电，也更适合低配电视盒子">
              <Toggle checked={theme.motion} onChange={(checked) => updateTheme({ motion: checked })} />
            </Row>
          </div>

          <div className="group">
            <div className="group-title">布局</div>
            <Row label="顶部大图" hint="首页顶部的精选推荐区">
              <Toggle checked={layout.hero} onChange={(checked) => updateLayout({ hero: checked })} />
            </Row>
            <Row label="自动轮播" hint="精选内容每 9 秒切换一次">
              <Toggle checked={layout.rotate} onChange={(checked) => updateLayout({ rotate: checked })} />
            </Row>
            <Row label="显示卡片标题" hint="关闭后只在选中时显示片名，更接近 Apple TV">
              <Toggle
                checked={layout.showTitles}
                onChange={(checked) => updateLayout({ showTitles: checked })}
              />
            </Row>
            <Row label="顶栏自动隐藏" hint="向下滚动时收起导航，向上滚动再出现">
              <Toggle
                checked={layout.autoHideBar}
                onChange={(checked) => updateLayout({ autoHideBar: checked })}
              />
            </Row>
          </div>

          <div className="group">
            <div className="group-title">播放</div>
            <Row label="自动下一集" hint="当前集播完后自动续播">
              <Toggle checked={play.autoNext} onChange={(checked) => updatePlay({ autoNext: checked })} />
            </Row>
            <Row label="快进步长" hint="左右方向键每次跳转的时长">
              <Stepper
                value={play.seekStep}
                min={5}
                max={30}
                step={5}
                format={(v) => `${v} 秒`}
                onChange={(value) => updatePlay({ seekStep: value })}
              />
            </Row>
            <Row label="片头结束" hint="播放到该秒数自动跳过；0 为关闭">
              <input
                className="field"
                type="number"
                min={0}
                max={3600}
                step={1}
                style={{ maxWidth: 110 }}
                value={play.introEnd}
                onChange={(event) =>
                  updatePlay({ introEnd: Math.max(0, Number(event.target.value) || 0) })
                }
              />
              <span className="tag">秒</span>
            </Row>
            <Row label="片尾开始" hint="播放到该秒数自动下一集；0 为关闭">
              <input
                className="field"
                type="number"
                min={0}
                max={14400}
                step={1}
                style={{ maxWidth: 110 }}
                value={play.outroStart}
                onChange={(event) =>
                  updatePlay({ outroStart: Math.max(0, Number(event.target.value) || 0) })
                }
              />
              <span className="tag">秒</span>
            </Row>
          </div>

          <div className="group">
            <div className="group-title">片源</div>
            <Row label="运行模式" hint="自动模式会尝试连接你的 tvbox-multi 配置">
              <Seg
                value={settings.data.mode}
                options={[
                  { value: 'auto', label: '在线源' },
                  { value: 'demo', label: '演示片库' },
                ]}
                onChange={(value) => updateData({ mode: value as Settings['data']['mode'] })}
              />
            </Row>

            <div style={{ padding: '17px 0', borderBottom: '1px solid rgba(255,255,255,.055)' }}>
              <div className="label" style={{ marginBottom: 8 }}>
                配置文件地址
              </div>
              <div className="inline-field">
                <input
                  className="field"
                  value={configUrl}
                  spellCheck={false}
                  onChange={(event) => setConfigUrl(event.target.value)}
                  placeholder="https://…/tvbox-multi.json"
                />
                <button
                  type="button"
                  className="btn ghost"
                  data-nav
                  onClick={() => onApplyData(configUrl.trim(), proxy.trim())}
                >
                  <RefreshIcon width={15} height={15} />
                  应用
                </button>
              </div>
            </div>

            <div style={{ padding: '17px 0', borderBottom: '1px solid rgba(255,255,255,.055)' }}>
              <div className="label" style={{ marginBottom: 8 }}>
                本地代理（仅浏览器需要）
              </div>
              <div className="inline-field">
                <input
                  className="field"
                  value={proxy}
                  spellCheck={false}
                  onChange={(event) => setProxy(event.target.value)}
                  placeholder="http://127.0.0.1:8787"
                />
                <button
                  type="button"
                  className="btn ghost"
                  data-nav
                  onClick={() => {
                    updateData({ proxy: proxy.trim() })
                    onToast('代理地址已保存，重新加载后生效')
                  }}
                >
                  保存
                </button>
              </div>
              <div className="hint" style={{ marginTop: 8 }}>
                浏览器直连会被 CORS 拦截；Windows / Android 客户端走原生请求，不需要代理。
              </div>
            </div>

            <Row label="本地缓存" hint="站点列表、首页数据会缓存 3 小时">
              <button
                type="button"
                className="btn ghost"
                data-nav
                onClick={() => {
                  onClearCache()
                  onToast('缓存已清除')
                }}
              >
                清除缓存
              </button>
            </Row>
          </div>

          <div className="group">
            <div className="group-title">播放记录自动同步</div>

            <Row label="同步方式" hint="只同步观看进度；片源、外观和账号不会同步">
              <Seg
                value={settings.sync.provider}
                options={[
                  { value: 'off', label: '关闭' },
                  { value: 'http', label: '局域网' },
                  { value: 'webdav', label: 'WebDAV' },
                  { value: 'gist', label: 'Gist' },
                ]}
                onChange={(value) =>
                  updateSync({ provider: value as Settings['sync']['provider'] })
                }
              />
            </Row>

            {settings.sync.provider === 'http' ? (
              <>
                <SyncField
                  label="服务器地址"
                  hint="在常开的电脑上运行 npm run sync，三端都填这台电脑的局域网地址"
                >
                  <input
                    className="field"
                    value={settings.sync.endpoint}
                    onChange={(event) => updateSync({ endpoint: event.target.value })}
                    placeholder="http://192.168.1.10:8788"
                    spellCheck={false}
                    inputMode="url"
                  />
                </SyncField>
                <SyncField
                  label="同步密钥"
                  hint="服务端启动时设置了 SYNC_TOKEN 才需要；留空使用 default"
                >
                  <input
                    className="field"
                    type="password"
                    value={settings.sync.password}
                    onChange={(event) => updateSync({ password: event.target.value })}
                    placeholder="可留空"
                    autoComplete="off"
                  />
                </SyncField>
              </>
            ) : null}

            {settings.sync.provider === 'webdav' ? (
              <>
                <SyncField
                  label="WebDAV 目录"
                  hint="例如坚果云 https://dav.jianguoyun.com/dav/AuroraTV/，会自动创建 aurora-tv-history.json"
                >
                  <input
                    className="field"
                    value={settings.sync.endpoint}
                    onChange={(event) => updateSync({ endpoint: event.target.value })}
                    placeholder="https://dav.example.com/dav/AuroraTV/"
                    spellCheck={false}
                    inputMode="url"
                  />
                </SyncField>
                <SyncField label="用户名" hint="WebDAV 登录账号">
                  <input
                    className="field"
                    value={settings.sync.username}
                    onChange={(event) => updateSync({ username: event.target.value })}
                    placeholder="账号"
                    autoComplete="username"
                  />
                </SyncField>
                <SyncField label="应用密码" hint="坚果云需要单独生成应用密码，不要用登录密码">
                  <input
                    className="field"
                    type="password"
                    value={settings.sync.password}
                    onChange={(event) => updateSync({ password: event.target.value })}
                    placeholder="应用密码"
                    autoComplete="off"
                  />
                </SyncField>
              </>
            ) : null}

            {settings.sync.provider === 'gist' ? (
              <>
                <SyncField
                  label="GitHub Token"
                  hint="在 GitHub → Settings → Developer settings → Personal access tokens 创建，勾选 gist"
                >
                  <input
                    className="field"
                    type="password"
                    value={settings.sync.token}
                    onChange={(event) => updateSync({ token: event.target.value })}
                    placeholder="ghp_…"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </SyncField>
                <SyncField
                  label="Gist ID"
                  hint="留空会自动创建一个私密 Gist，并把 ID 回填到这里"
                >
                  <input
                    className="field"
                    value={settings.sync.gistId}
                    onChange={(event) => updateSync({ gistId: event.target.value })}
                    placeholder="自动创建"
                    spellCheck={false}
                  />
                </SyncField>
              </>
            ) : null}

            <Row label="自动同步" hint="进度变化 4 秒后上传；切回应用时自动拉取">
              <Toggle
                checked={settings.sync.auto}
                onChange={(checked) => updateSync({ auto: checked })}
              />
            </Row>

            <div className="sync-actions">
              <button
                type="button"
                className="btn primary"
                data-nav
                disabled={settings.sync.provider === 'off'}
                onClick={onSyncNow}
              >
                <RefreshIcon width={15} height={15} />
                立即同步
              </button>
              <span className={`sync-status ${syncState.status === 'error' ? 'is-error' : ''}`}>
                {syncStatusText}
              </span>
            </div>

            <div className="hint" style={{ paddingBottom: 16 }}>
              同步凭证只保存在本机，不会写进「同步码」。
            </div>
          </div>

          <div className="group">
            <div className="group-title">手动同步码</div>
            <div style={{ padding: '10px 0 16px' }}>
              <div className="hint" style={{ marginBottom: 10 }}>
                在一台设备点「生成同步码」，把整段文字发到另一台设备粘贴后点「导入」，即可同步设置、片源与观看进度。
              </div>
              <textarea
                className="field"
                value={syncBox}
                onChange={(event) => setSyncBox(event.target.value)}
                placeholder="同步码会显示在这里；也可以粘贴另一台设备生成的同步码"
                spellCheck={false}
              />
              {syncError ? (
                <div className="hint" style={{ color: '#ff8a8a', marginTop: 8 }}>
                  {syncError}
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button type="button" className="btn ghost" data-nav onClick={makeCode}>
                  生成同步码
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  data-nav
                  onClick={() => {
                    const code = makeCode()
                    navigator.clipboard
                      ?.writeText(code)
                      .then(() => onToast('同步码已复制到剪贴板'))
                      .catch(() => onToast('请手动复制文本框里的同步码'))
                  }}
                >
                  生成并复制
                </button>
                <button type="button" className="btn primary" data-nav onClick={importCode}>
                  导入
                </button>
              </div>
            </div>
          </div>

          <div className="group">
            <div className="group-title">关于</div>
            <Row label="Aurora TV" hint="0.1.18 · Tauri 2 + React · 手机 / Windows / Android TV">
              <span className="tag">开源原型</span>
            </Row>
            <Row label="支持开发" hint="微信 / 支付宝赞赏码 · 完全自愿，不影响任何功能">
              <button
                type="button"
                className="btn primary"
                data-nav
                onClick={() => setSupportOpen(true)}
              >
                支持一下
              </button>
            </Row>
            <Row
              label="屏幕"
              hint={`${window.innerWidth}×${window.innerHeight} · DPR ${window.devicePixelRatio} · ${
                window.matchMedia('(orientation: portrait)').matches ? '竖屏' : '横屏'
              }`}
            >
              <span />
            </Row>
            <Row label="快捷键" hint="方向键移动 · 回车确认 · ESC 返回 · 空格播放/暂停">
              <button
                type="button"
                className="btn quiet"
                data-nav
                onClick={() => onChange(structuredClone(DEFAULT_SETTINGS))}
              >
                恢复默认设置
              </button>
            </Row>
          </div>

          <div style={{ textAlign: 'center', color: 'rgba(245,245,247,.25)', fontSize: 11, marginTop: 26 }}>
            仅用于播放你拥有合法访问权限的内容
          </div>
        </div>
        {supportOpen ? <Support onClose={() => setSupportOpen(false)} /> : null}
      </div>
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rowline">
      <div>
        <div className="label">{label}</div>
        {hint ? <div className="hint">{hint}</div> : null}
      </div>
      <div className="control">{children}</div>
    </div>
  )
}

function SyncField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="sync-field">
      <div className="label">{label}</div>
      {hint ? <div className="hint">{hint}</div> : null}
      {children}
    </div>
  )
}

function formatClock(timestamp?: number): string {
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`switch ${checked ? 'is-on' : ''}`}
      data-nav
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  )
}

function Seg({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <div className="seg">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'is-on' : ''}
          data-nav
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Stepper({
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next * 100) / 100))
  return (
    <div className="stepper">
      <button type="button" data-nav onClick={() => onChange(clamp(value - step))} aria-label="减小">
        −
      </button>
      <span className="value">{format(value)}</span>
      <button type="button" data-nav onClick={() => onChange(clamp(value + step))} aria-label="增大">
        +
      </button>
    </div>
  )
}
