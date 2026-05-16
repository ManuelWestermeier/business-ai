import { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppContext } from '../context/AppContext'

const PHASE_LABELS = {
  describe: 'Describing',
  questions: 'Clarifying',
  profile: 'Profiling',
  analysis: 'Analysing',
  clarify: 'Deep Dive',
  optimize: 'Optimizing',
  revenue: 'Revenue',
  plan: 'Planning',
  execute: 'Executing',
}

const PHASES_ORDER = ['describe', 'questions', 'profile', 'analysis', 'clarify', 'optimize', 'revenue', 'plan', 'execute']

function phaseProgress(phase) {
  const idx = PHASES_ORDER.indexOf(phase)
  return Math.round(((idx + 1) / PHASES_ORDER.length) * 100)
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DashboardPage() {
  const { apiKey, businesses, newBusiness, deleteBusiness, setApiKey } = useContext(AppContext)
  const navigate = useNavigate()

  if (!apiKey) {
    navigate('/')
    return null
  }

  const handleNew = () => {
    const id = newBusiness()
    navigate(`/business/${id}`)
  }

  const handleOpen = (id) => navigate(`/business/${id}`)

  const handleDelete = (e, id) => {
    e.stopPropagation()
    if (confirm('Delete this business? This cannot be undone.')) {
      deleteBusiness(id)
    }
  }

  const handleChangeKey = () => {
    setApiKey('')
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top nav */}
      <div className="border-b border-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 bg-ink flex items-center justify-center">
            <div className="w-3 h-0.5 bg-accent" />
          </div>
          <span className="font-syne font-semibold text-sm tracking-widest uppercase text-ink">BusinessAI</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-muted hidden sm:block">
            {apiKey.slice(0, 12)}···
          </span>
          <button
            onClick={handleChangeKey}
            className="text-xs text-muted hover:text-ink transition-colors font-mono"
          >
            Change key
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-8 py-12">
        {/* Header row */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="label mb-2">Your Portfolio</div>
            <h1 className="font-syne text-3xl font-bold text-ink">Businesses</h1>
          </div>
          <button onClick={handleNew} className="btn-primary">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="7" y1="1" x2="7" y2="13" />
              <line x1="1" y1="7" x2="13" y2="7" />
            </svg>
            New Business
          </button>
        </div>

        {/* Business list */}
        {businesses.length === 0 ? (
          <EmptyState onNew={handleNew} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {businesses.map((biz, i) => (
              <motion.div
                key={biz.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
                onClick={() => handleOpen(biz.id)}
                className="card cursor-pointer hover:border-ink transition-colors group relative"
              >
                {/* Delete */}
                <button
                  onClick={e => handleDelete(e, biz.id)}
                  className="absolute top-4 right-4 text-muted hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                    <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>

                {/* Phase badge */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-1.5 bg-accent flex-shrink-0" />
                  <span className="label text-accent">{PHASE_LABELS[biz.phase] || biz.phase}</span>
                </div>

                {/* Name */}
                <h2 className="font-syne font-semibold text-lg text-ink mb-1 pr-6 truncate">
                  {biz.profile?.name || biz.name || 'Untitled Business'}
                </h2>
                {biz.profile?.tagline && (
                  <p className="text-muted text-xs mb-4 line-clamp-1">{biz.profile.tagline}</p>
                )}
                {!biz.profile?.tagline && biz.initialDescription && (
                  <p className="text-muted text-xs mb-4 line-clamp-2">{biz.initialDescription}</p>
                )}
                {!biz.profile?.tagline && !biz.initialDescription && (
                  <p className="text-muted text-xs mb-4 italic">No description yet</p>
                )}

                {/* Progress */}
                <div className="mt-auto">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs text-muted">{phaseProgress(biz.phase)}% complete</span>
                    <span className="font-mono text-xs text-muted">{formatDate(biz.updatedAt || biz.createdAt)}</span>
                  </div>
                  <div className="h-0.5 bg-border w-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-700"
                      style={{ width: `${phaseProgress(biz.phase)}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Add card */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: businesses.length * 0.06 + 0.1 }}
              onClick={handleNew}
              className="border border-dashed border-border p-6 cursor-pointer hover:border-accent hover:bg-accent-light transition-colors flex flex-col items-center justify-center gap-3 min-h-[180px]"
            >
              <div className="w-8 h-8 border border-border flex items-center justify-center text-muted hover:border-accent hover:text-accent transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="8" y1="2" x2="8" y2="14" />
                  <line x1="2" y1="8" x2="14" y2="8" />
                </svg>
              </div>
              <span className="label">New Business</span>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ onNew }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="w-12 h-12 bg-surface border border-border flex items-center justify-center mb-6">
        <div className="w-5 h-5 border-2 border-accent" />
      </div>
      <h2 className="font-syne text-2xl font-semibold text-ink mb-3">Start your first business</h2>
      <p className="text-muted text-sm max-w-sm mb-8 leading-relaxed">
        Describe your idea and let AI tear it apart, rebuild it, and give you a clear path to revenue.
      </p>
      <button onClick={onNew} className="btn-primary">
        Create Business →
      </button>
    </motion.div>
  )
}
