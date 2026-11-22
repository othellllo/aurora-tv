import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CatalogItem, HistoryEntry, PlayGroup, PlaybackState, View } from './core/types'
import {
  DENSITY_WIDTH,
  loadHistory,
  loadSettings,
  merge,
  saveHistory,
  saveSettings,
  type Settings,
  type SyncPayload,
  type SyncSettings,
  upsertHistory,
} from './core/settings'
import { makeSyncDoc, mergeHistory, pullHistory, pushHistory } from './core/sync'
import { setProxy } from './core/net'
import {
  activate,
  focusFirst,
  getNavLock,
  isPhoneUi,
  moveFocus,
  setNavLock,
  startGamepadLoop,
} from './core/nav'
import { paletteFromString } from './core/format'
import { useCatalog } from './hooks/useCatalog'
import { TopBar } from './components/TopBar'
import { MobileTabBar } from './components/MobileTabBar'
import { Home as HomeView } from './views/Home'
import { Detail } from './views/Detail'
import { Player } from './views/Player'
import { SettingsView } from './views/Settings'
import { Sources } from './views/Sources'
import { Search } from './views/Search'
import { HistoryView } from './views/History'
import { SourceRail } from './components/SourceRail'
import { CategoryView } from './views/CategoryView'
import { bindEdgeSwipe } from './core/gestures'

type Overlay = 'search' | 'settings' | 'sources' | null

interface SyncState {
  status: 'idle' | 'syncing' | 'ok' | 'error'
  message?: string
  at?: number
  count?: number
}

const CACHE_PREFIX = 'aurora.cache.'

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [page, setPage] = useState<'home' | 'category' | 'history'>('home')
  const [searchMounted, setSearchMounted] = useState(false)
  const detailReturnOverlay = useRef<'search' | null>(null)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [detail, setDetail] = useState<CatalogItem | null>(null)
  const [playback, setPlayback] = useState<PlaybackState | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  const [toast, setToast] = useState<string | null>(null)
  const [barHidden, setBarHidden] = useState(false)
  const [ambient, setAmbient] = useState<[string, string, string]>(['#24344f', '#5b7fa6', '#0a0f18'])
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' })
  const toastTimer = useRef<number | null>(null)
  const historyRef = useRef(history)
  const syncCfgRef = useRef(settings.sync)
  const syncingRef = useRef(false)
  const syncTimer = useRef<number | null>(null)
  const lastAutoSync = useRef(0)
  const catalog = useCatalog(settings)

  /* ---------------------------------- 设置持久化 --------------------------------- */

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    setProxy(settings.data.proxy)
  }, [settings.data.proxy])

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  /* --------------------------------- 播放记录同步 -------------------------------- */

  useEffect(() => {
    syncCfgRef.current = settings.sync
  }, [settings.sync])

  const updateSyncSettings = useCallback((patch: Partial<SyncSettings>) => {
    setSettings((current) => {
      const next = { ...current, sync: { ...current.sync, ...patch } }
      syncCfgRef.current = next.sync
      return next
    })
  }, [])

  const runSync = useCallback(
    async (manual: boolean) => {
      const cfg = syncCfgRef.current
      if (cfg.provider === 'off') {
        if (manual) showToast('请先在「设置 → 播放记录同步」里开启同步')
        return
      }
      if (syncingRef.current) {
        if (manual) showToast('正在同步，请稍候…')
        return
      }

      syncingRef.current = true
      setSyncState({ status: 'syncing' })

      try {
        const pulled = await pullHistory(cfg)
        let nextCfg = cfg

        if (pulled.gistId && pulled.gistId !== cfg.gistId) {
          nextCfg = { ...nextCfg, gistId: pulled.gistId }
          updateSyncSettings({ gistId: pulled.gistId })
        }

        const merged = mergeHistory(historyRef.current, pulled.doc?.history ?? [])
        historyRef.current = merged
        saveHistory(merged)
        setHistory(merged)

        const pushed = await pushHistory(nextCfg, makeSyncDoc(merged, nextCfg.deviceId))
        if (pushed.gistId && pushed.gistId !== nextCfg.gistId) {
          nextCfg = { ...nextCfg, gistId: pushed.gistId }
          updateSyncSettings({ gistId: pushed.gistId })
        }

        const at = Date.now()
        lastAutoSync.current = at
        updateSyncSettings({ lastSyncAt: at })
        setSyncState({ status: 'ok', at, count: merged.length })
        if (manual) showToast(`同步完成，共 ${merged.length} 条播放记录`)
      } catch (error) {
        const message = (error as Error)?.message || '同步失败'
        setSyncState({ status: 'error', message })
        if (manual) showToast(message)
      } finally {
        syncingRef.current = false
      }
    },
    [showToast, updateSyncSettings],
  )

  const scheduleSync = useCallback(() => {
    const cfg = syncCfgRef.current
    if (cfg.provider === 'off' || !cfg.auto) return
    if (syncTimer.current) window.clearTimeout(syncTimer.current)
    syncTimer.current = window.setTimeout(() => {
      void runSync(false)
    }, 4000)
  }, [runSync])

  // 启动 / 配置变化后自动拉取一次
  useEffect(() => {
    if (settings.sync.provider === 'off' || !settings.sync.auto) return
    const timer = window.setTimeout(() => {
      void runSync(false)
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [settings.sync.provider, settings.sync.auto, settings.sync.endpoint, settings.sync.gistId, runSync])

  // 从后台切回 / 重新聚焦时同步，60 秒节流
  useEffect(() => {
    const maybeSync = () => {
      if (document.visibilityState !== 'visible') return
      const cfg = syncCfgRef.current
      if (cfg.provider === 'off' || !cfg.auto) return
      if (Date.now() - lastAutoSync.current < 60_000) return
      lastAutoSync.current = Date.now()
      void runSync(false)
    }
    document.addEventListener('visibilitychange', maybeSync)
    window.addEventListener('focus', maybeSync)
    return () => {
      document.removeEventListener('visibilitychange', maybeSync)
      window.removeEventListener('focus', maybeSync)
    }
  }, [runSync])

  /* ----------------------------------- 顶栏 ----------------------------------- */

  useEffect(() => {
    if (!settings.layout.autoHideBar) {
      setBarHidden(false)
      return
    }
    // 手机端顶栏保持简洁常驻，避免滚动时状态与片源入口一起消失
    if (isPhoneUi()) {
      setBarHidden(false)
      return
    }
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (y < 60) setBarHidden(false)
      else if (y > lastY + 8) setBarHidden(true)
      else if (y < lastY - 8) setBarHidden(false)
      lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [settings.layout.autoHideBar])

  /* --------------------------------- 全局按键 --------------------------------- */

  const closeDetail = useCallback(() => {
    const back = detailReturnOverlay.current
    detailReturnOverlay.current = null
    setDetail(null)
    if (back) setOverlay(back)
  }, [])

  const closeTop = useCallback(() => {
    // 播放器会把焦点锁在内部，返回键仍应先关闭播放器
    if (playback) {
      setNavLock(false)
      setPlayback(null)
      return
    }
    if (getNavLock()) return
    if (overlay) {
      setOverlay(null)
      return
    }
    if (detail) {
      closeDetail()
      return
    }
    if (page === 'category' || page === 'history') {
      setPage('home')
      window.scrollTo({ top: 0 })
      return
    }
    if (window.scrollY > 40) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [closeDetail, detail, overlay, page, playback])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (getNavLock()) return
      const target = event.target as HTMLElement | null
      const typing =
        Boolean(target) &&
        (target!.tagName === 'INPUT' ||
          target!.tagName === 'TEXTAREA' ||
          target!.isContentEditable)

      if (event.key === 'Escape' || event.key === 'BrowserBack') {
        event.preventDefault()
        if (typing) (target as HTMLElement).blur()
        else closeTop()
        return
      }
      if (typing) return

      if (event.key.startsWith('Arrow')) {
        const dir = event.key.replace('Arrow', '').toLowerCase() as
          | 'up'
          | 'down'
          | 'left'
          | 'right'
        if (moveFocus(dir)) event.preventDefault()
        return
      }
      if (event.key === 'Enter') {
        if (activate()) event.preventDefault()
        return
      }
      if (event.key === ' ') {
        event.preventDefault()
        activate()
      }
    }

    window.addEventListener('keydown', onKey)
    const stopGamepad = startGamepadLoop(() => closeTop())
    return () => {
      window.removeEventListener('keydown', onKey)
      stopGamepad()
    }
  }, [closeTop])

  useEffect(() => {
    const win = window as Window & { onAndroidBackPressed?: () => boolean }
    win.onAndroidBackPressed = () => {
      const hasLayer = !!(playback || detail || overlay || page !== 'home')
      if (!hasLayer) return true
      closeTop()
      return false
    }
    return () => {
      delete win.onAndroidBackPressed
    }
  }, [closeTop, detail, overlay, page, playback])

  useEffect(() => {
    const onBackGesture = () => {
      if (playback) {
        setNavLock(false)
        setPlayback(null)
        return
      }
      closeTop()
    }
    return bindEdgeSwipe(onBackGesture, isPhoneUi)
  }, [closeTop, playback])

  /* --------------------------------- 焦点复位 --------------------------------- */

  useEffect(() => {
    if (catalog.phase !== 'ready' || overlay || detail || playback) return
    if (isPhoneUi()) return
    const timer = window.setTimeout(() => {
      focusFirst()
    }, 650)
    return () => window.clearTimeout(timer)
  }, [catalog.phase, overlay, detail, playback])

  useEffect(() => {
    if (overlay || detail || playback) return
    if (isPhoneUi()) return
    const timer = window.setTimeout(() => focusFirst(), 120)
    return () => window.clearTimeout(timer)
  }, [overlay, detail, playback])

  /* ---------------------------------- 弹层滚动锁 --------------------------------- */

  useEffect(() => {
    const locked = Boolean(overlay || detail || playback)
    document.body.classList.toggle('is-locked', locked)
    return () => document.body.classList.remove('is-locked')
  }, [overlay, detail, playback])

  /* ---------------------------------- 观看历史 --------------------------------- */

  const activeHistory = useMemo(() => history.filter((entry) => !entry.deletedAt), [history])

  const continueRow = useMemo(() => {
    const items: CatalogItem[] = activeHistory
      .filter((entry) => entry.position > 5 && entry.groups?.length)
      .slice(0, 10)
      .map((entry) => ({
        id: entry.mediaKey,
        name: entry.title,
        poster: entry.poster,
        palette: entry.palette,
        remarks: '继续观看',
        typeName: entry.subtitle ?? '继续播放',
        desc: `上次看到 ${formatPercent(entry.position, entry.duration)}`,
        resume: true,
        startTime: entry.position,
        groups: entry.groups,
        siteKey: entry.mediaKey.split('|')[0],
        groupIndex: entry.groupIndex,
        episodeIndex: entry.episodeIndex,
        mediaKey: entry.mediaKey,
      }))
    return items.length
      ? { key: '__continue', title: '播放历史', subtitle: '从上次停下的地方继续', items }
      : null
  }, [activeHistory])

  const highScoreRow = useMemo(() => {
    const seen = new Set<string>()
    const items = catalog.rows
      .flatMap((row) => row.items)
      .filter((item) => (Number.parseFloat(item.score ?? '0') || 0) >= 7.5)
      .filter((item) => {
        const key = `${item.siteKey ?? 'demo'}|${item.id}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => {
        const timeA = a.updatedAt ? Date.parse(a.updatedAt) : 0
        const timeB = b.updatedAt ? Date.parse(b.updatedAt) : 0
        if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeB !== timeA) {
          return timeB - timeA
        }
        return (Number.parseFloat(b.score ?? '0') || 0) - (Number.parseFloat(a.score ?? '0') || 0)
      })
      .slice(0, 24)

    return items.length
      ? { key: '__high', title: '近期高分', subtitle: '评分 7.5+ · 按更新时间', items }
      : null
  }, [catalog.rows])

  const rows = useMemo(() => {
    const list = []
    if (continueRow) list.push(continueRow)
    if (highScoreRow) list.push(highScoreRow)
    return list
  }, [continueRow, highScoreRow])

  const progressOf = useCallback(
    (item: CatalogItem) => {
      if (item.resume) return undefined
      const key = `${item.siteKey ?? 'demo'}|${item.id}`
      const entry = activeHistory.find((h) => h.mediaKey === key)
      if (!entry || !entry.duration) return undefined
      return entry.position / entry.duration
    },
    [activeHistory],
  )

  /* ----------------------------------- 播放 ---------------------------------- */

  const startPlayback = useCallback(
    (groups: PlayGroup[], groupIndex: number, episodeIndex: number, startTime?: number, item?: CatalogItem) => {
      const source = item ?? detail
      if (!source) return
      detailReturnOverlay.current = null
      setDetail(null)
      setOverlay(null)
      setPlayback({
        title: source.name,
        subtitle: source.typeName,
        groups,
        groupIndex,
        episodeIndex,
        poster: source.poster,
        palette: source.palette,
        mediaKey: `${source.siteKey ?? 'demo'}|${source.id}`,
        startTime,
      })
    },
    [detail],
  )

  const handlePlay = useCallback(
    async (item: CatalogItem) => {
      try {
        showToast('正在准备播放…')
        const groups = item.groups?.length ? item.groups : await catalog.loadGroups(item)
        if (!groups.length) throw new Error('没有可用的播放线路')
        setPlayback({
          title: item.name,
          subtitle: item.typeName,
          groups,
          groupIndex: 0,
          episodeIndex: 0,
          poster: item.poster,
          palette: item.palette,
          mediaKey: `${item.siteKey ?? 'demo'}|${item.id}`,
        })
        setDetail(null)
        setOverlay(null)
        detailReturnOverlay.current = null
      } catch (error) {
        showToast((error as Error).message || '播放失败')
      }
    },
    [catalog, showToast],
  )

  const handleOpen = useCallback(
    (item: CatalogItem) => {
      if (item.resume && item.groups) {
        setOverlay(null)
        setPlayback({
          title: item.name,
          subtitle: item.typeName,
          groups: item.groups,
          groupIndex: item.groupIndex ?? 0,
          episodeIndex: item.episodeIndex ?? 0,
          poster: item.poster,
          palette: item.palette,
          mediaKey: item.mediaKey ?? item.id,
          startTime: item.startTime,
        })
        return
      }
      setOverlay(null)
      detailReturnOverlay.current = null
      setDetail(item)
    },
    [],
  )

  const handleSearchOpen = useCallback((item: CatalogItem) => {
    // 搜索层先收起，详情关闭后再回到原搜索结果
    detailReturnOverlay.current = 'search'
    setOverlay(null)
    setDetail(item)
  }, [])

  const handleProgress = useCallback(
    (payload: { groupIndex: number; episodeIndex: number; position: number; duration: number }) => {
      if (!playback) return
      const next = upsertHistory({
        mediaKey: playback.mediaKey,
        title: playback.title,
        subtitle: playback.subtitle,
        poster: playback.poster,
        palette: playback.palette,
        groupIndex: payload.groupIndex,
        episodeIndex: payload.episodeIndex,
        position: payload.position,
        duration: payload.duration,
        updatedAt: Date.now(),
        groups: playback.groups,
      })
      historyRef.current = next
      setHistory(next)
      scheduleSync()
    },
    [playback, scheduleSync],
  )

  const writeHistory = useCallback(
    (next: HistoryEntry[]) => {
      const sorted = [...next]
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
        .slice(0, 60)
      historyRef.current = sorted
      saveHistory(sorted)
      setHistory(sorted)
      scheduleSync()
    },
    [scheduleSync],
  )

  const resumeHistory = useCallback(
    (entry: HistoryEntry) => {
      if (!entry.groups?.length) {
        showToast('这条记录没有可用线路，无法继续播放')
        return
      }
      setOverlay(null)
      setDetail(null)
      setPlayback({
        title: entry.title,
        subtitle: entry.subtitle,
        groups: entry.groups,
        groupIndex: entry.groupIndex,
        episodeIndex: entry.episodeIndex,
        poster: entry.poster,
        palette: entry.palette,
        mediaKey: entry.mediaKey,
        startTime: entry.position,
      })
    },
    [showToast],
  )

  const deleteHistory = useCallback(
    (entry: HistoryEntry) => {
      const now = Date.now()
      const exists = historyRef.current.some((item) => item.mediaKey === entry.mediaKey)
      const base = exists
        ? historyRef.current.map((item) =>
            item.mediaKey === entry.mediaKey ? { ...item, deletedAt: now, updatedAt: now } : item,
          )
        : [{ ...entry, deletedAt: now, updatedAt: now }, ...historyRef.current]
      writeHistory(base)
      showToast('已删除，正在同步到其他端')
    },
    [showToast, writeHistory],
  )

  const clearHistory = useCallback(() => {
    const now = Date.now()
    writeHistory(
      historyRef.current.map((entry) =>
        entry.deletedAt ? entry : { ...entry, deletedAt: now, updatedAt: now },
      ),
    )
    showToast('播放历史已清空，正在同步到其他端')
  }, [showToast, writeHistory])

  /* ---------------------------------- 数据同步 --------------------------------- */

  const applyData = useCallback(
    (configUrl: string, proxy: string) => {
      setSettings((current) => ({
        ...current,
        data: { ...current.data, configUrl, proxy, mode: 'auto' },
      }))
      showToast('已保存，正在重新加载片源…')
    },
    [showToast],
  )

  const importSync = useCallback(
    (payload: SyncPayload) => {
      if (payload.settings) {
        setSettings((current) => merge(current, payload.settings))
      }
      if (payload.history?.length) {
        let next = loadHistory()
        for (const entry of payload.history) next = upsertHistory(entry)
        historyRef.current = next
        setHistory(next)
      }
    },
    [],
  )

  const clearCache = useCallback(() => {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(CACHE_PREFIX))
      .forEach((key) => localStorage.removeItem(key))
  }, [])

  /* ----------------------------------- 样式 ---------------------------------- */

  const style = useMemo<CSSProperties>(() => {
    const theme = settings.theme
    return {
      '--accent': theme.accent,
      '--radius': `${theme.radius}px`,
      '--card-w-base': `${Math.round(DENSITY_WIDTH[theme.density] * theme.scale)}px`,
      '--blur': `${theme.blur}px`,
      '--dim': String(theme.dim),
      '--font-scale': String(theme.font),
      '--ambient-a': ambient[1],
      '--ambient-b': ambient[2],
    } as CSSProperties
  }, [ambient, settings.theme])

  const activeView: View =
    overlay === 'settings' ? 'settings' : overlay === 'search' ? 'search' : page

  const navigate = (view: View) => {
    detailReturnOverlay.current = null
    if (view === 'home') {
      setPage('home')
      setOverlay(null)
      setDetail(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (view === 'category') {
      setPage('category')
      setOverlay(null)
      setDetail(null)
      window.scrollTo({ top: 0 })
      return
    }
    if (view === 'history') {
      setPage('history')
      setOverlay(null)
      setDetail(null)
      window.scrollTo({ top: 0 })
      return
    }
    setDetail(null)
    setOverlay(view)
    if (view === 'search') setSearchMounted(true)
  }

  const sourceLabel = catalog.demo
    ? '演示片库'
    : catalog.site?.name ?? (catalog.booting ? '连接中…' : '未连接')

  const showSourceRail =
    !isPhoneUi() && !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)

  return (
    <div
      className="app"
      style={style}
      data-focus={settings.theme.focus}
      data-titles={settings.layout.showTitles ? 'on' : 'off'}
      data-motion={settings.theme.motion ? 'on' : 'off'}
    >
      <div className="ambient" />
      <div className="vignette" />
      <div className="grain" />

      <TopBar
        view={activeView}
        onNavigate={navigate}
        onOpenSources={() => {
          setDetail(null)
          setOverlay('sources')
        }}
        sourceName={sourceLabel}
        demo={catalog.demo}
        hidden={barHidden}
      />

      {showSourceRail && !overlay && !detail && !playback ? (
        <SourceRail
          sites={catalog.sites}
          sources={catalog.sources}
          activeSite={catalog.site}
          sourceIndex={catalog.sourceIndex}
          loading={catalog.phase === 'loading'}
          onSelectSite={(site) => {
            void catalog.selectSite(site)
            setSettings((current) => ({
              ...current,
              data: { ...current.data, siteKey: site.key },
            }))
          }}
          onSelectSource={(index) => {
            setSettings((current) => ({
              ...current,
              data: { ...current.data, sourceIndex: index },
            }))
            void catalog.selectSource(index)
          }}
          onManage={() => setOverlay('sources')}
        />
      ) : null}

      <main className="stage">
        {page === 'category' ? (
          <CategoryView
            site={catalog.site}
            demo={catalog.demo}
            onOpen={handleOpen}
            onOpenSources={() => setOverlay('sources')}
          />
        ) : page === 'history' ? (
          <HistoryView
            history={history}
            onResume={resumeHistory}
            onDelete={deleteHistory}
            onClear={clearHistory}
          />
        ) : (
          <HomeView
            hero={highScoreRow ? highScoreRow.items.slice(0, 3) : catalog.hero}
            rows={rows}
            loading={catalog.phase === 'loading' && !catalog.rows.length}
            error={catalog.error}
            demo={catalog.demo}
            showHero={settings.layout.hero && !!highScoreRow}
            rotate={settings.layout.rotate}
            onOpen={handleOpen}
            onPlay={handlePlay}
            onTint={setAmbient}
            onRetry={catalog.reload}
            onDemo={catalog.enableDemo}
            onOpenSettings={() => setOverlay('settings')}
            progressOf={progressOf}
          />
        )}
      </main>

      {detail ? (
        <Detail
          item={detail}
          history={activeHistory.find((h) => h.mediaKey === `${detail.siteKey ?? 'demo'}|${detail.id}`)}
          loadGroups={catalog.loadGroups}
          onClose={closeDetail}
          onPlay={(groups, groupIndex, episodeIndex, startTime) =>
            startPlayback(groups, groupIndex, episodeIndex, startTime)
          }
        />
      ) : null}

      {searchMounted ? (
        <div
          className="search-mount"
          style={{ display: overlay === 'search' ? undefined : 'none' }}
        >
          <Search
            active={overlay === 'search'}
            demo={catalog.demo}
            siteName={catalog.site?.name ?? '演示片库'}
            search={catalog.search}
            onOpen={handleSearchOpen}
            onClose={() => setOverlay(null)}
          />
        </div>
      ) : null}

      {overlay === 'settings' ? (
        <SettingsView
          settings={settings}
          history={history}
          syncState={syncState}
          onSyncNow={() => void runSync(true)}
          onChange={setSettings}
          onClose={() => setOverlay(null)}
          onOpenSources={() => setOverlay('sources')}
          onApplyData={applyData}
          onImportSync={importSync}
          onClearCache={clearCache}
          onToast={showToast}
        />
      ) : null}

      {overlay === 'sources' ? (
        <Sources
          sources={catalog.sources}
          sourceIndex={catalog.sourceIndex}
          sites={catalog.sites}
          activeSite={catalog.site}
          parseCount={catalog.parses.length}
          demo={catalog.demo}
          loading={catalog.phase === 'loading'}
          error={catalog.error}
          onSelectSource={(index) => {
            setSettings((current) => ({ ...current, data: { ...current.data, sourceIndex: index } }))
            setOverlay(null)
          }}
          onSelectSite={(site) => {
            void catalog.selectSite(site)
            setSettings((current) => ({ ...current, data: { ...current.data, siteKey: site.key } }))
            setOverlay(null)
          }}
          onAddSite={(name, api) => {
            void catalog.addSite(name, api)
            setOverlay(null)
          }}
          onRefresh={() => {
            clearCache()
            catalog.reload()
          }}
          onDemo={catalog.enableDemo}
          onClose={() => setOverlay(null)}
        />
      ) : null}

      {playback ? (
        <Player
          state={playback}
          autoNext={settings.play.autoNext}
          seekStep={settings.play.seekStep}
          introEnd={settings.play.introEnd ?? 0}
          outroStart={settings.play.outroStart ?? 0}
          onSetIntro={(seconds) =>
            setSettings((current) => ({
              ...current,
              play: { ...current.play, introEnd: seconds },
            }))
          }
          onSetOutro={(seconds) =>
            setSettings((current) => ({
              ...current,
              play: { ...current.play, outroStart: seconds },
            }))
          }
          onClose={() => {
            setNavLock(false)
            setPlayback(null)
          }}
          resolveUrl={catalog.resolvePlay}
          onProgress={handleProgress}
        />
      ) : null}

      {!overlay && !detail && !playback ? (
        <MobileTabBar
          active={page}
          onNavigate={navigate}
          onOpenSources={() => setOverlay('sources')}
        />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}

function formatPercent(position: number, duration: number): string {
  if (!duration) return '上次观看'
  const percent = Math.round((position / duration) * 100)
  return `已观看 ${percent}%`
}
