import type { MultiUrl, Site } from '../core/types'

interface SourceRailProps {
  sites: Site[]
  sources: MultiUrl[]
  activeSite: Site | null
  sourceIndex: number
  loading: boolean
  onSelectSite: (site: Site) => void
  onSelectSource: (index: number) => void
  onManage: () => void
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export function SourceRail({
  sites,
  sources,
  activeSite,
  sourceIndex,
  loading,
  onSelectSite,
  onSelectSource,
  onManage,
}: SourceRailProps) {
  return (
    <aside className="source-rail" aria-label="播放源">
      <div className="rail-head">
        <div>
          <span className="eyebrow">播放源</span>
          <strong>{activeSite?.name ?? '未连接'}</strong>
        </div>
        <span className={`rail-dot ${loading ? 'is-loading' : ''}`} />
      </div>

      <div className="rail-scroll">
        <div className="rail-label">站点</div>
        {sites.map((site) => (
          <button
            key={site.key}
            type="button"
            className={`rail-item ${activeSite?.key === site.key ? 'is-active' : ''}`}
            data-nav
            onClick={() => onSelectSite(site)}
          >
            <span>{site.name}</span>
            <small>{site.sourceIndex === -1 ? '内置' : hostOf(site.api)}</small>
          </button>
        ))}
        {!sites.length ? <p className="rail-empty">暂无可用站点</p> : null}

        <div className="rail-label">聚合源</div>
        {sources.map((source, index) => (
          <button
            key={source.url}
            type="button"
            className={`rail-item compact ${index === sourceIndex ? 'is-active' : ''}`}
            data-nav
            onClick={() => onSelectSource(index)}
          >
            <span>{source.name}</span>
            {loading && index === sourceIndex ? <small>加载中…</small> : null}
          </button>
        ))}
      </div>

      <button type="button" className="rail-manage" data-nav onClick={onManage}>
        管理片源 / 手动添加
      </button>
    </aside>
  )
}
