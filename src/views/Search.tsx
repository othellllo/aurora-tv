import { useEffect, useRef, useState } from 'react'
import type { CatalogItem, SearchHit } from '../core/types'
import { focusFirst, setNavRoot } from '../core/nav'
import { Card } from '../components/Card'
import { ChevronLeft, CloseIcon, SearchIcon } from '../components/Icons'

interface SearchProps {
  active?: boolean
  demo: boolean
  siteName: string
  search: (keyword: string) => Promise<SearchHit[]>
  onOpen: (item: CatalogItem) => void
  onClose: () => void
}

const HOT = ['电影', '剧集', '动漫', '纪录片', '综艺', '4K']

const KEYS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3',
  '4', '5', '6', '7', '8', '9', ' ', '删', '清',
]

export function Search({ active = true, demo, siteName, search, onOpen, onClose }: SearchProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    setNavRoot(rootRef.current)
    const raf = requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      setNavRoot(null)
      cancelAnimationFrame(raf)
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    const raf = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [active])

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    const keyword = query.trim()
    if (!keyword) {
      setHits([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    timer.current = window.setTimeout(() => {
      search(keyword)
        .then((result) => {
          setHits(result)
          setError(null)
        })
        .catch((err: Error) => {
          setHits([])
          setError(err.message || '搜索失败')
        })
        .finally(() => setLoading(false))
    }, 420)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [query, search])

  const append = (key: string) => {
    setTouched(true)
    if (key === '删') {
      setQuery((q) => q.slice(0, -1))
    } else if (key === '清') {
      setQuery('')
    } else {
      setQuery((q) => q + key)
    }
  }

  return (
    <div className="layer" data-layer="search">
      <div className="search-layer" ref={rootRef}>
        <div className="search-inner">
          <div className="search-bar">
            <SearchIcon width={26} height={26} style={{ color: 'rgba(245,245,247,.5)' }} />
            <input
              ref={inputRef}
              value={query}
              placeholder="搜索影片、剧集、演员"
              onChange={(event) => {
                setTouched(true)
                setQuery(event.target.value)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  onClose()
                }
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  event.currentTarget.blur()
                  requestAnimationFrame(() => focusFirst())
                }
              }}
            />
            {query ? (
              <button type="button" className="icon-btn" data-nav onClick={() => setQuery('')} title="清空">
                <CloseIcon width={16} height={16} />
              </button>
            ) : null}
            <button type="button" className="btn ghost" data-nav onClick={onClose}>
              <ChevronLeft width={16} height={16} />
              返回
            </button>
          </div>

          <div className="search-hint">
            {loading
              ? `正在搜索「${query.trim()}」…`
              : error
                ? error
                : hits.length
                  ? `在「${siteName}」找到 ${hits.length} 个结果`
                  : touched && query
                    ? `在「${siteName}」没有找到相关影片`
                    : demo
                      ? '演示片库：试试「电影」「剧集」「纪录」'
                      : '支持中文输入，也可以用下面的屏幕键盘'}
          </div>

          {!hits.length && !loading ? (
            <div className="keyboard">
              {KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`key ${key === '删' || key === '清' ? 'wide' : ''}`}
                  data-nav
                  onClick={() => append(key)}
                >
                  {key === ' ' ? '空格' : key}
                </button>
              ))}
            </div>
          ) : null}

          {!query && !hits.length ? (
            <div className="search-section-title">热门搜索</div>
          ) : null}
          {!query && !hits.length ? (
            <div className="seg-pills" style={{ marginTop: 12 }}>
              {HOT.map((word) => (
                <button
                  key={word}
                  type="button"
                  className="pill"
                  data-nav
                  onClick={() => {
                    setTouched(true)
                    setQuery(word)
                  }}
                >
                  {word}
                </button>
              ))}
            </div>
          ) : null}

          {hits.length ? (
            <div className="result-grid">
              {hits.map((hit, index) => (
                <Card key={`${hit.item.id}-${index}`} item={hit.item} index={index} onOpen={onOpen} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
