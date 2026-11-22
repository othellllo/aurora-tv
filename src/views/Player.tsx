import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TouchEvent as ReactTouchEvent } from 'react'
import Hls from 'hls.js'
import type { PlaybackState } from '../core/types'
import { isPhoneUi, setNavLock } from '../core/nav'
import { formatTime, isMediaUrl } from '../core/format'
import {
  Back10Icon,
  ChevronLeft,
  CloseIcon,
  FitIcon,
  Forward10Icon,
  FullscreenIcon,
  HdIcon,
  PauseIcon,
  PlayIcon,
  RotateIcon,
  SkipNextIcon,
  SpeedIcon,
  VolumeHighIcon,
  VolumeMuteIcon,
} from '../components/Icons'

interface PlayerProps {
  state: PlaybackState
  autoNext: boolean
  seekStep: number
  introEnd: number
  outroStart: number
  onSetIntro?: (seconds: number) => void
  onSetOutro?: (seconds: number) => void
  onClose: () => void
  resolveUrl?: (url: string) => Promise<string>
  onProgress: (payload: {
    groupIndex: number
    episodeIndex: number
    position: number
    duration: number
  }) => void
}

type MenuKind = 'speed' | 'quality' | null

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function Player({
  state,
  autoNext,
  seekStep,
  introEnd,
  outroStart,
  onSetIntro,
  onSetOutro,
  onClose,
  resolveUrl,
  onProgress,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const hideTimer = useRef<number | null>(null)
  const lastSave = useRef(0)
  const menuRef = useRef<MenuKind>(null)
  const introSkippedRef = useRef(false)
  const outroHandledRef = useRef(false)

  const [groupIndex, setGroupIndex] = useState(state.groupIndex)
  const [episodeIndex, setEpisodeIndex] = useState(state.episodeIndex)
  const [playing, setPlaying] = useState(true)
  const [showUi, setShowUi] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [focusIndex, setFocusIndex] = useState(-1)
  const [reloadKey, setReloadKey] = useState(0)
  const [resolvedUrl, setResolvedUrl] = useState('')
  const [resolving, setResolving] = useState(false)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [levels, setLevels] = useState<Array<{ index: number; label: string }>>([])
  const [level, setLevel] = useState(-1)
  const [menu, setMenu] = useState<MenuKind>(null)
  const [landscape, setLandscape] = useState(false)
  const [forceRotate, setForceRotate] = useState(false)
  const [fit, setFit] = useState<'contain' | 'cover'>('contain')
  const [fullscreen, setFullscreen] = useState(false)
  const [brightness, setBrightness] = useState(1)
  const [gesture, setGesture] = useState<{ kind: 'seek' | 'volume' | 'brightness'; text: string } | null>(
    null,
  )
  const gestureRef = useRef<{
    x: number
    y: number
    mode: 'seek' | 'volume' | 'brightness' | null
    startTime: number
    startVolume: number
    startBrightness: number
  } | null>(null)
  const [notice, setNotice] = useState('')
  const phoneLayout = isPhoneUi()
  const handheld = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
  const showLandscape = phoneLayout && handheld && !/Windows/i.test(navigator.userAgent)

  const group = state.groups[groupIndex]
  const episode = group?.episodes[episodeIndex]
  const rawUrl = episode?.url ?? ''

  menuRef.current = menu

  const releaseOrientation = useCallback(() => {
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        unlock?: () => void
      }
      orientation?.unlock?.()
    } catch {
      /* ignore */
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    }
  }, [])

  const reveal = useCallback(() => {
    setShowUi(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      if (menuRef.current) return
      setShowUi(false)
      setFocusIndex(-1)
    }, 4200)
  }, [])

  useEffect(() => {
    setNavLock(true)
    reveal()
    const onMove = () => reveal()
    window.addEventListener('mousemove', onMove)
    return () => {
      setNavLock(false)
      window.removeEventListener('mousemove', onMove)
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      hlsRef.current?.destroy()
      hlsRef.current = null
      releaseOrientation()
    }
  }, [reveal, releaseOrientation])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement)
      if (!document.fullscreenElement) {
        setLandscape(false)
        setForceRotate(false)
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  // 解析非直链地址（TVBox parses）
  useEffect(() => {
    let alive = true
    setError(null)
    if (!rawUrl) {
      setResolvedUrl('')
      return
    }
    if (isMediaUrl(rawUrl) || !resolveUrl) {
      setResolvedUrl(rawUrl)
      setResolving(false)
      return
    }

    setResolving(true)
    setResolvedUrl('')
    const video = videoRef.current
    if (video) {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
    resolveUrl(rawUrl)
      .then((next) => {
        if (!alive) return
        setResolvedUrl(next || rawUrl)
        setResolving(false)
      })
      .catch(() => {
        if (!alive) return
        setResolvedUrl(rawUrl)
        setResolving(false)
      })

    return () => {
      alive = false
    }
  }, [rawUrl, resolveUrl])

  // 加载视频
  useEffect(() => {
    const video = videoRef.current
    if (!video || !resolvedUrl) return
    setError(null)
    setPlaying(true)
    setLevels([])
    setLevel(-1)
    setMenu(null)

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    if (/\.mp4(\?|#|$)/i.test(resolvedUrl) || video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = resolvedUrl
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        backBufferLength: 30,
      })
      hlsRef.current = hls
      hls.loadSource(resolvedUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const list = hls.levels.map((item, index) => ({
          index,
          label: item.height ? `${item.height}P` : `${Math.round((item.bitrate || 0) / 1000)}K`,
        }))
        setLevels(list)
      })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return
        const message =
          data.type === Hls.ErrorTypes.NETWORK_ERROR
            ? '视频流加载失败，可能是线路受限或需要代理。'
            : data.type === Hls.ErrorTypes.MEDIA_ERROR
              ? '视频编码不受支持，换一条线路试试。'
              : '播放器遇到未知错误。'
        setError(message)
      })
    } else {
      video.src = resolvedUrl
    }

    const isInitial = groupIndex === state.groupIndex && episodeIndex === state.episodeIndex
    const start = isInitial ? state.startTime ?? 0 : 0
    const onLoaded = () => {
      video.volume = volume
      video.muted = muted
      video.playbackRate = rate
      if (start > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(start, Math.max(0, video.duration - 3))
      }
      void video.play().catch(() => setPlaying(false))
    }
    video.addEventListener('loadedmetadata', onLoaded, { once: true })

    return () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedUrl, reloadKey])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = volume
    video.muted = muted
  }, [volume, muted, resolvedUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = rate
  }, [rate, resolvedUrl])

  useEffect(() => {
    const hls = hlsRef.current
    if (!hls || !hls.levels.length) return
    hls.currentLevel = level
  }, [level])

  const saveProgress = useCallback(
    (force = false) => {
      const video = videoRef.current
      if (!video) return
      const now = Date.now()
      if (!force && now - lastSave.current < 5000) return
      lastSave.current = now
      onProgress({
        groupIndex,
        episodeIndex,
        position: video.currentTime,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
      })
    },
    [groupIndex, episodeIndex, onProgress],
  )

  useEffect(() => {
    return () => saveProgress(true)
  }, [saveProgress])

  const closePlayer = useCallback(() => {
    saveProgress(true)
    releaseOrientation()
    onClose()
  }, [onClose, releaseOrientation, saveProgress])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void video.play()
      setPlaying(true)
    } else {
      video.pause()
      setPlaying(false)
    }
    reveal()
  }, [reveal])

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      if (current) {
        if (volume === 0) setVolume(0.8)
        return false
      }
      return true
    })
    reveal()
  }, [reveal, volume])

  const changeVolume = useCallback(
    (next: number) => {
      const value = Math.min(1, Math.max(0, next))
      setVolume(value)
      setMuted(value === 0)
      reveal()
    },
    [reveal],
  )

  const toggleLandscape = useCallback(async () => {
    reveal()
    setMenu(null)
    if (landscape) {
      releaseOrientation()
      setLandscape(false)
      setForceRotate(false)
      return
    }

    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      }
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (value: string) => Promise<void>
      }
      if (orientation?.lock) {
        await orientation.lock('landscape')
        setForceRotate(false)
      } else {
        setForceRotate(true)
      }
    } catch {
      // 部分 WebView 不支持方向锁定，用 CSS 旋转兜底
      setForceRotate(true)
      setNotice('当前环境不支持自动横屏，已旋转画面，请横过来拿手机')
    }
    setLandscape(true)
  }, [landscape, releaseOrientation, reveal])

  const toggleFullscreen = useCallback(async () => {
    reveal()
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      } else {
        setNotice('当前环境不支持全屏')
      }
    } catch {
      setNotice('全屏切换失败，请用系统窗口全屏')
    }
  }, [reveal])

  const toggleFit = useCallback(() => {
    setFit((current) => (current === 'cover' ? 'contain' : 'cover'))
    reveal()
  }, [reveal])

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current
      if (!video) return
      const max = Number.isFinite(video.duration) ? video.duration : 0
      video.currentTime = Math.min(Math.max(0, video.currentTime + delta), Math.max(0, max - 1))
      reveal()
    },
    [reveal],
  )

  const playEpisode = useCallback(
    (next: number) => {
      if (next < 0 || next >= group.episodes.length) return
      setEpisodeIndex(next)
      reveal()
    },
    [group, reveal],
  )

  const nextEpisode = useCallback(() => {
    if (!autoNext) return
    const hasNext =
      (group && episodeIndex < group.episodes.length - 1) ||
      groupIndex < state.groups.length - 1
    if (!hasNext) return
    if (groupIndex < state.groups.length - 1 && episodeIndex >= group.episodes.length - 1) {
      setGroupIndex(groupIndex + 1)
      setEpisodeIndex(0)
    } else {
      setEpisodeIndex(episodeIndex + 1)
    }
    reveal()
  }, [autoNext, episodeIndex, group, groupIndex, reveal, state.groups.length])

  const cycleRate = useCallback(() => {
    const index = RATES.indexOf(rate)
    setRate(RATES[(index + 1) % RATES.length])
    reveal()
  }, [rate, reveal])

  const cycleQuality = useCallback(() => {
    if (!levels.length) {
      setNotice('当前线路只有单码率')
      return
    }
    const index = levels.findIndex((item) => item.index === level)
    const next =
      level === -1
        ? levels[0].index
        : index >= 0 && index < levels.length - 1
          ? levels[index + 1].index
          : -1
    setLevel(next)
    reveal()
  }, [level, levels, reveal])

  const markIntro = useCallback(() => {
    const time = Math.floor(videoRef.current?.currentTime ?? 0)
    if (time <= 0) {
      setNotice('先播放几秒，再点「片头」标记')
      return
    }
    onSetIntro?.(time)
    introSkippedRef.current = true
    setNotice(`片头结束：${formatTime(time)}`)
    reveal()
  }, [onSetIntro, reveal])

  const markOutro = useCallback(() => {
    const time = Math.floor(videoRef.current?.currentTime ?? 0)
    if (time <= 0) {
      setNotice('先播放到片尾附近，再点「片尾」标记')
      return
    }
    onSetOutro?.(time)
    outroHandledRef.current = true
    setNotice(`片尾开始：${formatTime(time)}`)
    reveal()
  }, [onSetOutro, reveal])

  const buttons = useMemo(() => {
    const list = [
      { id: 'play', label: playing ? '暂停' : '播放', run: togglePlay },
      { id: 'back', label: '-10 秒', run: () => seekBy(-seekStep) },
      { id: 'forward', label: '+10 秒', run: () => seekBy(seekStep) },
      { id: 'next', label: '下一集', run: () => playEpisode(episodeIndex + 1) },
      { id: 'mute', label: muted ? '取消静音' : '静音', run: toggleMute },
      { id: 'speed', label: `倍速 ${rate}x`, run: cycleRate },
      { id: 'quality', label: '切换清晰度', run: cycleQuality },
      { id: 'intro', label: '标记片头', run: markIntro },
      { id: 'outro', label: '标记片尾', run: markOutro },
    ]
    if (showLandscape) {
      list.push({ id: 'rotate', label: landscape ? '竖屏' : '横屏', run: () => void toggleLandscape() })
    } else {
      list.push(
        {
          id: 'fullscreen',
          label: fullscreen ? '退出全屏' : '全屏',
          run: () => void toggleFullscreen(),
        },
        { id: 'fit', label: fit === 'cover' ? '适应' : '铺满', run: toggleFit },
      )
    }
    list.push({ id: 'close', label: '退出', run: closePlayer })
    return list
  }, [
    closePlayer,
    cycleQuality,
    cycleRate,
    episodeIndex,
    fit,
    fullscreen,
    landscape,
    markIntro,
    markOutro,
    muted,
    playEpisode,
    playing,
    rate,
    seekBy,
    seekStep,
    showLandscape,
    toggleFit,
    toggleFullscreen,
    toggleLandscape,
    toggleMute,
    togglePlay,
  ])

  const toolFocused = (id: string) =>
    focusIndex === buttons.findIndex((button) => button.id === id)

  // 播放器专用按键：方向键调进度，上/下切换按钮，回车执行
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key
      if (key === 'Escape' || key === 'BrowserBack') {
        event.preventDefault()
        closePlayer()
        return
      }
      if (key === ' ' || key === 'Enter') {
        event.preventDefault()
        if (focusIndex >= 0) {
          buttons[focusIndex]?.run()
        } else {
          togglePlay()
        }
        return
      }
      if (key === 'ArrowLeft') {
        event.preventDefault()
        seekBy(-seekStep)
        return
      }
      if (key === 'ArrowRight') {
        event.preventDefault()
        seekBy(seekStep)
        return
      }
      if (key === 'ArrowUp') {
        event.preventDefault()
        reveal()
        setFocusIndex((current) => (current + 1) % buttons.length)
        return
      }
      if (key === 'ArrowDown') {
        event.preventDefault()
        reveal()
        setFocusIndex((current) => (current <= 0 ? buttons.length - 1 : current - 1))
        return
      }
      if (key === 'n' || key === 'N') {
        playEpisode(episodeIndex + 1)
      }
      if (key === 'f' || key === 'F') {
        if (showLandscape) void toggleLandscape()
        else void toggleFullscreen()
      }
      if (key === 'm' || key === 'M') {
        toggleMute()
      }
      reveal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    buttons,
    closePlayer,
    episodeIndex,
    focusIndex,
    playEpisode,
    reveal,
    saveProgress,
    seekBy,
    seekStep,
    showLandscape,
    toggleFullscreen,
    toggleLandscape,
    toggleMute,
    togglePlay,
  ])

  useEffect(() => {
    introSkippedRef.current = false
    outroHandledRef.current = false
  }, [resolvedUrl, episodeIndex])

  const onTimeUpdate = () => {
    const video = videoRef.current
    if (!video) return

    if (
      introEnd > 0 &&
      video.currentTime > 1 &&
      video.currentTime < introEnd &&
      !introSkippedRef.current
    ) {
      video.currentTime = introEnd
      introSkippedRef.current = true
      setNotice(`已跳过片头 ${formatTime(introEnd)}`)
    }

    if (
      outroStart > 0 &&
      video.currentTime >= outroStart &&
      !outroHandledRef.current
    ) {
      outroHandledRef.current = true
      if (autoNext) {
        nextEpisode()
      } else {
        setNotice(`已到片尾 ${formatTime(outroStart)}`)
      }
    }

    setCurrentTime(video.currentTime)
    if (video.buffered.length) {
      setBuffered(video.buffered.end(video.buffered.length - 1))
    }
    saveProgress()
  }

  const onSeekPointer = (clientX: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const video = videoRef.current
    if (video && Number.isFinite(video.duration)) {
      video.currentTime = ratio * video.duration
      reveal()
    }
  }

  const onVideoTap = () => {
    if (!showUi) {
      reveal()
      return
    }
    if (menu) {
      setMenu(null)
      return
    }
    if (isPhoneUi()) {
      setShowUi(false)
      return
    }
    togglePlay()
  }

  const onTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isPhoneUi() || event.touches.length !== 1) return
    const target = event.target as HTMLElement
    if (target.closest('button, input, .timeline, .player-menu')) return
    const touch = event.touches[0]
    if (touch.clientX <= 28 || touch.clientX >= window.innerWidth - 28) return
    const video = videoRef.current
    gestureRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      mode: null,
      startTime: video?.currentTime ?? 0,
      startVolume: volume,
      startBrightness: brightness,
    }
  }

  const onTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const state = gestureRef.current
    if (!state || event.touches.length !== 1) return
    const touch = event.touches[0]
    const dx = touch.clientX - state.x
    const dy = touch.clientY - state.y
    if (!state.mode) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return
      state.mode =
        Math.abs(dx) > Math.abs(dy)
          ? 'seek'
          : touch.clientX < window.innerWidth / 2
            ? 'brightness'
            : 'volume'
    }

    const video = videoRef.current
    if (state.mode === 'seek' && video) {
      const max = Number.isFinite(video.duration) ? video.duration : 0
      const delta = Math.round((dx / window.innerWidth) * 120)
      const target = Math.min(Math.max(0, state.startTime + delta), Math.max(0, max - 1))
      video.currentTime = target
      setGesture({
        kind: 'seek',
        text: `${delta >= 0 ? '快进' : '后退'} ${formatTime(Math.abs(delta))} · ${formatTime(target)}`,
      })
      return
    }

    if (state.mode === 'volume') {
      const next = Math.min(1, Math.max(0, state.startVolume - dy / 300))
      setVolume(next)
      setMuted(next === 0)
      setGesture({ kind: 'volume', text: `音量 ${Math.round(next * 100)}%` })
      return
    }

    if (state.mode === 'brightness') {
      const next = Math.min(1.6, Math.max(0.3, state.startBrightness - dy / 300))
      setBrightness(next)
      setGesture({ kind: 'brightness', text: `亮度 ${Math.round(next * 100)}%` })
    }
  }

  const onTouchEnd = () => {
    if (gestureRef.current?.mode) reveal()
    gestureRef.current = null
    window.setTimeout(() => setGesture(null), 500)
  }

  const qualityLabel =
    level < 0 ? '自动' : levels.find((item) => item.index === level)?.label ?? '清晰度'
  const progress = duration > 0 ? currentTime / duration : 0
  const volumeValue = muted ? 0 : volume

  return (
    <div
      className={`player ${forceRotate ? 'force-landscape' : ''} ${fit === 'cover' ? 'fit-cover' : ''}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <video
        ref={videoRef}
        playsInline
        style={brightness !== 1 ? { filter: `brightness(${brightness})` } : undefined}
        onTimeUpdate={onTimeUpdate}
        onSeeked={onTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={nextEpisode}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onError={() => setError('视频加载失败，请换一条线路或稍后再试。')}
        onClick={onVideoTap}
      />

      {resolving ? (
        <div className="player-error">
          <div className="box">
            <span className="spinner" />
            <h3 style={{ color: '#fff', fontSize: 18, marginBottom: 10 }}>正在解析播放地址</h3>
            <p>尝试配置里的解析线路，可能需要几秒…</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="player-error">
          <div className="box">
            <h3 style={{ color: '#fff', fontSize: 18, marginBottom: 10 }}>无法播放</h3>
            <p>{error}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setError(null)
                  setReloadKey((key) => key + 1)
                  reveal()
                }}
              >
                重试
              </button>
              <button type="button" className="btn ghost" onClick={closePlayer}>
                返回
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {notice ? <div className="player-notice">{notice}</div> : null}

      {gesture ? <div className={`player-gesture ${gesture.kind}`}>{gesture.text}</div> : null}

      <div
        className={`player-ui ${showUi ? 'show' : ''}`}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return
          setMenu(null)
          setShowUi(false)
        }}
      >
        <div className="player-top">
          <div className="player-top-left">
            <button type="button" className="player-back" onClick={closePlayer}>
              <ChevronLeft width={20} height={20} />
              返回
            </button>
            <div className="player-heading">
              <h2>{state.title}</h2>
              <p>
                {episode?.name}
                {state.groups.length > 1 ? ` · ${group?.name}` : ''}
                {state.subtitle ? ` · ${state.subtitle}` : ''}
              </p>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={closePlayer} title="关闭">
            <CloseIcon />
          </button>
        </div>

        <div className="player-bottom">
          <div
            className={`timeline ${focusIndex === 0 ? 'is-focused' : ''}`}
            onClick={(event) => onSeekPointer(event.clientX, event.currentTarget)}
          >
            <div className="timeline-track">
              <div
                className="timeline-buffer"
                style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }}
              />
              <div className="timeline-fill" style={{ width: `${progress * 100}%` }} />
              {duration > 0 && introEnd > 0 && introEnd < duration ? (
                <span
                  className="timeline-marker intro"
                  style={{ left: `${(introEnd / duration) * 100}%` }}
                  title={`片头结束 ${formatTime(introEnd)}`}
                />
              ) : null}
              {duration > 0 && outroStart > 0 && outroStart < duration ? (
                <span
                  className="timeline-marker outro"
                  style={{ left: `${(outroStart / duration) * 100}%` }}
                  title={`片尾开始 ${formatTime(outroStart)}`}
                />
              ) : null}
              <div className="timeline-knob" style={{ left: `${progress * 100}%` }} />
            </div>
          </div>

          <div className="player-row">
            <div className="player-buttons">
              <button
                type="button"
                className={`pbtn ${focusIndex === 0 ? 'is-focused' : ''}`}
                onClick={togglePlay}
              >
                {playing ? <PauseIcon width={17} height={17} /> : <PlayIcon width={17} height={17} />}
                {playing ? '暂停' : '播放'}
              </button>
              <button
                type="button"
                className={`pbtn ${focusIndex === 1 ? 'is-focused' : ''}`}
                onClick={() => seekBy(-seekStep)}
              >
                <Back10Icon width={17} height={17} />
                {seekStep}s
              </button>
              <button
                type="button"
                className={`pbtn ${focusIndex === 2 ? 'is-focused' : ''}`}
                onClick={() => seekBy(seekStep)}
              >
                <Forward10Icon width={17} height={17} />
                {seekStep}s
              </button>
              <button
                type="button"
                className={`pbtn ${focusIndex === 3 ? 'is-focused' : ''}`}
                onClick={() => playEpisode(episodeIndex + 1)}
                disabled={episodeIndex >= (group?.episodes.length ?? 1) - 1}
              >
                <SkipNextIcon width={17} height={17} />
                下一集
              </button>
            </div>
            <div className="player-time">
              {formatTime(currentTime)} <span style={{ opacity: 0.4 }}>/ {formatTime(duration)}</span>
            </div>
          </div>

          <div className="player-tools">
            <div className="volume-control">
              <button
                type="button"
                className={`pbtn ${toolFocused('mute') ? 'is-focused' : ''}`}
                onClick={toggleMute}
                aria-label={muted ? '取消静音' : '静音'}
              >
                {muted || volume === 0 ? (
                  <VolumeMuteIcon width={18} height={18} />
                ) : (
                  <VolumeHighIcon width={18} height={18} />
                )}
              </button>
              <input
                className="volume-range"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volumeValue}
                aria-label="音量"
                onChange={(event) => changeVolume(Number(event.target.value))}
              />
            </div>

            <button
              type="button"
              className={`pbtn ${toolFocused('speed') ? 'is-focused' : ''}`}
              onClick={() => {
                setMenu(menu === 'speed' ? null : 'speed')
                reveal()
              }}
            >
              <SpeedIcon width={17} height={17} />
              {rate}x
            </button>

            <button
              type="button"
              className={`pbtn ${toolFocused('quality') ? 'is-focused' : ''}`}
              disabled={!levels.length}
              onClick={() => {
                setMenu(menu === 'quality' ? null : 'quality')
                reveal()
              }}
            >
              <HdIcon width={17} height={17} />
              {levels.length ? qualityLabel : '清晰度'}
            </button>

            <button
              type="button"
              className={`pbtn ${toolFocused('intro') ? 'is-focused' : ''}`}
              onClick={markIntro}
              title={`片头结束：${introEnd ? formatTime(introEnd) : '未设置'}`}
            >
              片头
            </button>

            <button
              type="button"
              className={`pbtn ${toolFocused('outro') ? 'is-focused' : ''}`}
              onClick={markOutro}
              title={`片尾开始：${outroStart ? formatTime(outroStart) : '未设置'}`}
            >
              片尾
            </button>

            {showLandscape ? (
              <button
                type="button"
                className={`pbtn ${toolFocused('rotate') ? 'is-focused' : ''}`}
                onClick={() => void toggleLandscape()}
              >
                <RotateIcon width={17} height={17} />
                {landscape ? '竖屏' : '横屏'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={`pbtn ${toolFocused('fullscreen') ? 'is-focused' : ''}`}
                  onClick={() => void toggleFullscreen()}
                >
                  <FullscreenIcon width={17} height={17} />
                  {fullscreen ? '退出全屏' : '全屏'}
                </button>
                <button
                  type="button"
                  className={`pbtn ${toolFocused('fit') ? 'is-focused' : ''}`}
                  onClick={toggleFit}
                >
                  <FitIcon width={17} height={17} />
                  {fit === 'cover' ? '适应' : '铺满'}
                </button>
              </>
            )}

            <button
              type="button"
              className={`pbtn ${toolFocused('close') ? 'is-focused' : ''}`}
              onClick={closePlayer}
            >
              <ChevronLeft width={17} height={17} />
              返回
            </button>
          </div>
        </div>

        {menu ? (
          <div className={`player-menu ${menu}`} onClick={(event) => event.stopPropagation()}>
            <div className="player-menu-title">{menu === 'speed' ? '播放速度' : '清晰度'}</div>
            <div className="player-menu-list">
              {menu === 'speed'
                ? RATES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`menu-item ${rate === value ? 'is-active' : ''}`}
                      onClick={() => {
                        setRate(value)
                        setMenu(null)
                        reveal()
                      }}
                    >
                      {value}x
                    </button>
                  ))
                : [
                    <button
                      key="auto"
                      type="button"
                      className={`menu-item ${level === -1 ? 'is-active' : ''}`}
                      onClick={() => {
                        setLevel(-1)
                        setMenu(null)
                        reveal()
                      }}
                    >
                      自动
                    </button>,
                    ...levels.map((item) => (
                      <button
                        key={item.index}
                        type="button"
                        className={`menu-item ${level === item.index ? 'is-active' : ''}`}
                        onClick={() => {
                          setLevel(item.index)
                          setMenu(null)
                          reveal()
                        }}
                      >
                        {item.label}
                      </button>
                    )),
                  ]}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
