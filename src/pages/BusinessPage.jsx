import { useState, useContext, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AppContext } from '../context/AppContext'
import { streamCompletion, safeParseJSON } from '../lib/api'
import * as P from '../lib/prompts'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PHASES = ['describe', 'questions', 'profile', 'analysis', 'clarify', 'optimize', 'revenue', 'plan', 'execute']

const PHASE_META = {
  describe:  { label: 'Describe',    num: '01', desc: 'What is your idea?' },
  questions: { label: 'Clarify',     num: '02', desc: 'Answer AI questions' },
  profile:   { label: 'Profile',     num: '03', desc: 'Business identity' },
  analysis:  { label: 'Market',      num: '04', desc: 'Competitive analysis' },
  clarify:   { label: 'Deep Dive',   num: '05', desc: 'Fill the gaps' },
  optimize:  { label: 'Optimize',    num: '06', desc: 'Strategic improvements' },
  revenue:   { label: 'Revenue',     num: '07', desc: 'Financial projections' },
  plan:      { label: 'Action Plan', num: '08', desc: 'Execution roadmap' },
  execute:   { label: 'Execute',     num: '09', desc: 'Track & get feedback' },
}

const PRIORITY_STYLE = {
  critical: 'bg-ink text-white',
  high:     'bg-surface text-ink border border-ink',
  medium:   'bg-surface text-muted border border-border',
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildContext(biz) {
  const lines = []
  if (biz.initialDescription) lines.push(`Business Description: ${biz.initialDescription}`)
  if (biz.questions?.length) {
    lines.push('Founder Q&A:')
    biz.questions.forEach(q => {
      if (q.answer) lines.push(`  Q: ${q.question}\n  A: ${q.answer}`)
    })
  }
  if (biz.profile) {
    lines.push(`Business Name: ${biz.profile.name}`)
    lines.push(`Tagline: ${biz.profile.tagline}`)
    lines.push(`Description: ${biz.profile.description}`)
    lines.push(`Industry: ${biz.profile.industry}`)
    lines.push(`Target Market: ${biz.profile.targetMarket}`)
    lines.push(`Business Model: ${biz.profile.businessModel}`)
  }
  if (biz.analysis) {
    lines.push(`Market Size: ${biz.analysis.marketSize}`)
    lines.push(`Competition: ${biz.analysis.competition}`)
    lines.push(`Verdict: ${biz.analysis.verdict}`)
  }
  if (biz.clarifyQuestions?.length) {
    lines.push('Deep Dive Q&A:')
    biz.clarifyQuestions.forEach(q => {
      if (q.answer && !q.skipped) lines.push(`  Q: ${q.question}\n  A: ${q.answer}`)
    })
  }
  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function BusinessPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { apiKey, getBusiness, upsertBusiness, newBusiness } = useContext(AppContext)

  // If no API key, redirect
  useEffect(() => { if (!apiKey) navigate('/') }, [apiKey])

  // Hydrate business from context, or create a new one if id is 'new'
  const [biz, setBizState] = useState(() => {
    const found = getBusiness(id)
    if (found) return found
    return {
      id,
      phase: 'describe',
      name: 'New Business',
      initialDescription: '',
      questions: [],
      profile: null,
      analysis: null,
      clarifyQuestions: [],
      optimizeText: '',
      revenueText: '',
      plan: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })

  const bizRef = useRef(biz)
  bizRef.current = biz

  const updateBiz = useCallback((updates) => {
    setBizState(prev => {
      const next = { ...prev, ...updates, updatedAt: new Date().toISOString() }
      upsertBusiness(next)
      return next
    })
  }, [upsertBusiness])

  // ── Streaming state ────────────────────────────────────────────────────────
  const [streaming, setStreaming] = useState(false)
  const [streamBuf, setStreamBuf] = useState('')
  const [streamErr, setStreamErr] = useState('')
  const bufRef = useRef('')
  const abortRef = useRef(false)

  const runStream = useCallback(async (messages, onComplete, opts = {}) => {
    bufRef.current = ''
    setStreamBuf('')
    setStreamErr('')
    setStreaming(true)
    abortRef.current = false

    await streamCompletion({
      apiKey,
      messages,
      maxTokens: opts.maxTokens || 4096,
      temperature: opts.temperature || 0.7,
      onChunk: (c) => {
        if (abortRef.current) return
        bufRef.current += c
        setStreamBuf(bufRef.current)
      },
      onDone: () => {
        if (abortRef.current) return
        setStreaming(false)
        onComplete(bufRef.current)
      },
      onError: (e) => {
        setStreaming(false)
        setStreamErr(e)
      },
    })
  }, [apiKey])

  // ── Phase change scroll ────────────────────────────────────────────────────
  const phaseRef = useRef(null)
  useEffect(() => {
    setTimeout(() => phaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }, [biz.phase])

  // ─── Phase Actions ─────────────────────────────────────────────────────────

  const startQuestions = () => {
    updateBiz({ phase: 'questions' })
    const messages = [
      { role: 'system', content: P.QUESTIONS_SYSTEM },
      { role: 'user', content: `Business idea: ${biz.initialDescription}` },
    ]
    runStream(messages, (text) => {
      const parsed = safeParseJSON(text)
      if (Array.isArray(parsed)) {
        updateBiz({ questions: parsed.map(q => ({ question: q, answer: '' })) })
      } else {
        setStreamErr('Could not parse questions. Please retry.')
      }
    })
  }

  const startProfile = () => {
    updateBiz({ phase: 'profile' })
    const ctx = buildContext(bizRef.current)
    const messages = [
      { role: 'system', content: P.PROFILE_SYSTEM },
      { role: 'user', content: ctx },
    ]
    runStream(messages, (text) => {
      const parsed = safeParseJSON(text)
      if (parsed?.name) {
        updateBiz({ profile: parsed, name: parsed.name })
      } else {
        setStreamErr('Could not parse profile. Please retry.')
      }
    })
  }

  const startAnalysis = () => {
    updateBiz({ phase: 'analysis' })
    const ctx = buildContext(bizRef.current)
    const messages = [
      { role: 'system', content: P.ANALYSIS_SYSTEM },
      { role: 'user', content: ctx },
    ]
    runStream(messages, (text) => {
      const parsed = safeParseJSON(text)
      if (parsed?.verdict) {
        updateBiz({ analysis: parsed })
      } else {
        setStreamErr('Could not parse analysis. Please retry.')
      }
    })
  }

  const startClarify = () => {
    updateBiz({ phase: 'clarify' })
    const ctx = buildContext(bizRef.current)
    const messages = [
      { role: 'system', content: P.CLARIFY_SYSTEM },
      { role: 'user', content: ctx },
    ]
    runStream(messages, (text) => {
      const parsed = safeParseJSON(text)
      if (Array.isArray(parsed)) {
        updateBiz({ clarifyQuestions: parsed.map(q => ({ question: q, answer: '', skipped: false })) })
      } else {
        setStreamErr('Could not parse follow-up questions. Please retry.')
      }
    })
  }

  const startOptimize = () => {
    updateBiz({ phase: 'optimize' })
    const ctx = buildContext(bizRef.current)
    const messages = [
      { role: 'system', content: P.OPTIMIZE_SYSTEM },
      { role: 'user', content: ctx },
    ]
    runStream(messages, (text) => {
      updateBiz({ optimizeText: text })
    })
  }

  const startRevenue = () => {
    updateBiz({ phase: 'revenue' })
    const ctx = buildContext(bizRef.current)
    const messages = [
      { role: 'system', content: P.REVENUE_SYSTEM },
      { role: 'user', content: ctx },
    ]
    runStream(messages, (text) => {
      updateBiz({ revenueText: text })
    })
  }

  const startPlan = () => {
    updateBiz({ phase: 'plan' })
    const ctx = buildContext(bizRef.current)
    const messages = [
      { role: 'system', content: P.PLAN_SYSTEM },
      { role: 'user', content: ctx },
    ]
    runStream(messages, (text) => {
      const parsed = safeParseJSON(text)
      if (Array.isArray(parsed)) {
        updateBiz({
          plan: parsed.map(s => ({ ...s, status: 'pending', notes: '', evaluation: '' })),
        })
      } else {
        setStreamErr('Could not parse action plan. Please retry.')
      }
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const phaseIdx = PHASES.indexOf(biz.phase)
  const isPhase = (p) => biz.phase === p
  const isPast  = (p) => PHASES.indexOf(p) < phaseIdx
  const isFuture = (p) => PHASES.indexOf(p) > phaseIdx

  // ── Step evaluation ────────────────────────────────────────────────────────
  const [evalStep, setEvalStep] = useState(null)
  const [evalNote, setEvalNote] = useState('')
  const [evalStreaming, setEvalStreaming] = useState(false)
  const evalBufRef = useRef('')

  const submitEvaluation = (stepId) => {
    const step = biz.plan.find(s => s.id === stepId)
    if (!step || !evalNote.trim()) return

    const ctx = buildContext(bizRef.current)
    const messages = [
      { role: 'system', content: P.EVALUATE_SYSTEM },
      {
        role: 'user',
        content: `${ctx}\n\nCurrent Step: ${step.title}\nStep Description: ${step.description}\n\nFounder Update:\n${evalNote}`,
      },
    ]

    evalBufRef.current = ''
    setEvalStreaming(true)

    // Update step to in_progress
    updateBiz({
      plan: biz.plan.map(s => s.id === stepId ? { ...s, status: 'in_progress', notes: evalNote } : s),
    })

    streamCompletion({
      apiKey,
      messages,
      maxTokens: 1024,
      temperature: 0.7,
      onChunk: (c) => {
        evalBufRef.current += c
        setBizState(prev => ({
          ...prev,
          plan: prev.plan.map(s => s.id === stepId ? { ...s, evaluation: evalBufRef.current } : s),
        }))
      },
      onDone: () => {
        setEvalStreaming(false)
        upsertBusiness(bizRef.current)
      },
      onError: (e) => {
        setEvalStreaming(false)
        setStreamErr(e)
      },
    })
  }

  const markStepDone = (stepId) => {
    updateBiz({
      plan: biz.plan.map(s => s.id === stepId ? { ...s, status: 'done' } : s),
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phase renderers
  // ─────────────────────────────────────────────────────────────────────────

  const renderDescribe = () => (
    <PhaseSection phase="describe" biz={biz} current={isPhase('describe')} past={isPast('describe')}>
      {isPhase('describe') && (
        <div className="space-y-5">
          <p className="text-sm text-muted leading-relaxed">
            Be specific. The more detail you provide, the better the analysis. Describe your idea, the problem it solves, and who it's for.
          </p>
          <textarea
            value={biz.initialDescription}
            onChange={e => updateBiz({ initialDescription: e.target.value })}
            placeholder="E.g. A B2B SaaS platform that helps logistics companies automate their driver scheduling and compliance reporting. Currently dispatchers spend 3+ hours daily on manual scheduling spreadsheets..."
            rows={6}
            className="textarea-field"
          />
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted">
              {biz.initialDescription.length} chars
            </span>
            <button
              onClick={startQuestions}
              disabled={biz.initialDescription.trim().length < 30}
              className="btn-primary"
            >
              Analyze → 
            </button>
          </div>
          {biz.initialDescription.trim().length < 30 && biz.initialDescription.length > 0 && (
            <p className="text-xs text-muted">Add more detail for a better analysis.</p>
          )}
        </div>
      )}
      {isPast('describe') && (
        <p className="text-sm text-muted line-clamp-2">{biz.initialDescription}</p>
      )}
    </PhaseSection>
  )

  const renderQuestions = () => {
    if (isFuture('questions')) return <LockedPhase phase="questions" />
    const questions = biz.questions || []
    const allAnswered = questions.length > 0 && questions.every(q => q.answer.trim().length > 0)

    return (
      <PhaseSection phase="questions" biz={biz} current={isPhase('questions')} past={isPast('questions')}>
        {isPhase('questions') && (
          <div className="space-y-5">
            {streaming && questions.length === 0 && (
              <LoadingState text="Generating targeted questions..." />
            )}
            {streamErr && questions.length === 0 && (
              <ErrorState msg={streamErr} onRetry={() => { setStreamErr(''); startQuestions() }} />
            )}
            {questions.length > 0 && (
              <>
                <p className="text-sm text-muted">Answer all questions to continue. Be honest and specific.</p>
                <div className="space-y-4">
                  {questions.map((q, i) => (
                    <div key={i} className="space-y-2">
                      <label className="flex gap-3 items-start">
                        <span className="font-mono text-xs text-accent mt-0.5 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                        <span className="text-sm font-medium text-ink">{q.question}</span>
                      </label>
                      <textarea
                        value={q.answer}
                        onChange={e => {
                          const updated = questions.map((qq, ii) =>
                            ii === i ? { ...qq, answer: e.target.value } : qq
                          )
                          updateBiz({ questions: updated })
                        }}
                        rows={3}
                        placeholder="Your answer..."
                        className="textarea-field ml-6"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={startProfile}
                    disabled={!allAnswered}
                    className="btn-primary"
                  >
                    Generate Profile →
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {isPast('questions') && (
          <div className="flex gap-2 flex-wrap">
            {questions.map((q, i) => (
              <span key={i} className="font-mono text-xs border border-border px-2 py-1 text-muted">
                Q{i + 1} answered
              </span>
            ))}
          </div>
        )}
      </PhaseSection>
    )
  }

  const renderProfile = () => {
    if (isFuture('profile')) return <LockedPhase phase="profile" />
    const profile = biz.profile

    return (
      <PhaseSection phase="profile" biz={biz} current={isPhase('profile')} past={isPast('profile')}>
        {isPhase('profile') && (
          <div className="space-y-5">
            {streaming && !profile && (
              <LoadingState text="Building business profile..." />
            )}
            {streamErr && !profile && (
              <ErrorState msg={streamErr} onRetry={() => { setStreamErr(''); startProfile() }} />
            )}
            {profile && (
              <>
                <ProfileCard profile={profile} />
                <div className="flex justify-end">
                  <button onClick={startAnalysis} className="btn-primary">Run Market Analysis →</button>
                </div>
              </>
            )}
          </div>
        )}
        {isPast('profile') && profile && (
          <div>
            <span className="font-syne font-semibold text-ink">{profile.name}</span>
            <span className="text-muted text-sm ml-3">— {profile.tagline}</span>
          </div>
        )}
      </PhaseSection>
    )
  }

  const renderAnalysis = () => {
    if (isFuture('analysis')) return <LockedPhase phase="analysis" />
    const analysis = biz.analysis

    return (
      <PhaseSection phase="analysis" biz={biz} current={isPhase('analysis')} past={isPast('analysis')}>
        {isPhase('analysis') && (
          <div className="space-y-5">
            {streaming && !analysis && (
              <LoadingState text="Analyzing market, competition, risks..." />
            )}
            {streamErr && !analysis && (
              <ErrorState msg={streamErr} onRetry={() => { setStreamErr(''); startAnalysis() }} />
            )}
            {analysis && (
              <>
                <AnalysisCard analysis={analysis} />
                <div className="flex justify-end">
                  <button onClick={startClarify} className="btn-primary">Continue Deep Dive →</button>
                </div>
              </>
            )}
          </div>
        )}
        {isPast('analysis') && analysis && (
          <p className="text-sm italic text-muted border-l-2 border-accent pl-3">{analysis.verdict}</p>
        )}
      </PhaseSection>
    )
  }

  const renderClarify = () => {
    if (isFuture('clarify')) return <LockedPhase phase="clarify" />
    const cqs = biz.clarifyQuestions || []
    const allHandled = cqs.length > 0 && cqs.every(q => q.skipped || q.answer.trim().length > 0)

    return (
      <PhaseSection phase="clarify" biz={biz} current={isPhase('clarify')} past={isPast('clarify')}>
        {isPhase('clarify') && (
          <div className="space-y-5">
            {streaming && cqs.length === 0 && (
              <LoadingState text="Identifying critical gaps..." />
            )}
            {streamErr && cqs.length === 0 && (
              <ErrorState msg={streamErr} onRetry={() => { setStreamErr(''); startClarify() }} />
            )}
            {cqs.length > 0 && (
              <>
                <p className="text-sm text-muted">Answer to improve your analysis, or skip to continue.</p>
                <div className="space-y-4">
                  {cqs.map((q, i) => (
                    <div key={i} className={`border p-4 space-y-3 transition-colors ${q.skipped ? 'border-border opacity-50' : 'border-border hover:border-ink'}`}>
                      <div className="flex gap-3 items-start justify-between">
                        <div className="flex gap-3 items-start">
                          <span className="font-mono text-xs text-accent mt-0.5 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                          <span className="text-sm font-medium text-ink">{q.question}</span>
                        </div>
                        <button
                          onClick={() => {
                            const updated = cqs.map((qq, ii) =>
                              ii === i ? { ...qq, skipped: !qq.skipped, answer: '' } : qq
                            )
                            updateBiz({ clarifyQuestions: updated })
                          }}
                          className="text-xs text-muted hover:text-ink transition-colors flex-shrink-0 font-mono"
                        >
                          {q.skipped ? 'Unskip' : 'Skip'}
                        </button>
                      </div>
                      {!q.skipped && (
                        <textarea
                          value={q.answer}
                          onChange={e => {
                            const updated = cqs.map((qq, ii) =>
                              ii === i ? { ...qq, answer: e.target.value } : qq
                            )
                            updateBiz({ clarifyQuestions: updated })
                          }}
                          rows={2}
                          placeholder="Your answer..."
                          className="textarea-field ml-6"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={startOptimize}
                    disabled={!allHandled}
                    className="btn-primary"
                  >
                    Generate Optimization →
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {isPast('clarify') && (
          <span className="text-sm text-muted">
            {cqs.filter(q => !q.skipped && q.answer).length} answered, {cqs.filter(q => q.skipped).length} skipped
          </span>
        )}
      </PhaseSection>
    )
  }

  const renderOptimize = () => {
    if (isFuture('optimize')) return <LockedPhase phase="optimize" />

    return (
      <PhaseSection phase="optimize" biz={biz} current={isPhase('optimize')} past={isPast('optimize')}>
        {isPhase('optimize') && (
          <div className="space-y-5">
            {(streaming || biz.optimizeText) && (
              <div className="ai-output text-sm leading-relaxed">
                <MarkdownText text={streaming ? streamBuf : biz.optimizeText} streaming={streaming} />
              </div>
            )}
            {!streaming && !biz.optimizeText && (
              <LoadingState text="Generating optimization strategy..." />
            )}
            {streamErr && (
              <ErrorState msg={streamErr} onRetry={() => { setStreamErr(''); startOptimize() }} />
            )}
            {!streaming && biz.optimizeText && (
              <div className="flex justify-end pt-2">
                <button onClick={startRevenue} className="btn-primary">Build Revenue Model →</button>
              </div>
            )}
          </div>
        )}
        {isPast('optimize') && (
          <span className="text-sm text-muted">Optimization strategy complete</span>
        )}
      </PhaseSection>
    )
  }

  const renderRevenue = () => {
    if (isFuture('revenue')) return <LockedPhase phase="revenue" />

    return (
      <PhaseSection phase="revenue" biz={biz} current={isPhase('revenue')} past={isPast('revenue')}>
        {isPhase('revenue') && (
          <div className="space-y-5">
            {(streaming || biz.revenueText) && (
              <div className="ai-output text-sm leading-relaxed">
                <MarkdownText text={streaming ? streamBuf : biz.revenueText} streaming={streaming} />
              </div>
            )}
            {!streaming && !biz.revenueText && (
              <LoadingState text="Modelling revenue scenarios..." />
            )}
            {streamErr && (
              <ErrorState msg={streamErr} onRetry={() => { setStreamErr(''); startRevenue() }} />
            )}
            {!streaming && biz.revenueText && (
              <div className="flex justify-end pt-2">
                <button onClick={startPlan} className="btn-primary">Create Action Plan →</button>
              </div>
            )}
          </div>
        )}
        {isPast('revenue') && (
          <span className="text-sm text-muted">Revenue model complete</span>
        )}
      </PhaseSection>
    )
  }

  const renderPlan = () => {
    if (isFuture('plan')) return <LockedPhase phase="plan" />
    const plan = biz.plan || []

    return (
      <PhaseSection phase="plan" biz={biz} current={isPhase('plan')} past={isPast('plan')}>
        {isPhase('plan') && (
          <div className="space-y-5">
            {streaming && plan.length === 0 && (
              <LoadingState text="Building your execution roadmap..." />
            )}
            {streamErr && plan.length === 0 && (
              <ErrorState msg={streamErr} onRetry={() => { setStreamErr(''); startPlan() }} />
            )}
            {plan.length > 0 && (
              <>
                <PlanList plan={plan} compact />
                <div className="flex justify-end pt-2">
                  <button onClick={() => updateBiz({ phase: 'execute' })} className="btn-primary">
                    Start Executing →
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {isPast('plan') && plan.length > 0 && (
          <span className="text-sm text-muted">{plan.length} steps defined</span>
        )}
      </PhaseSection>
    )
  }

  const renderExecute = () => {
    if (isFuture('execute')) return <LockedPhase phase="execute" />
    const plan = biz.plan || []
    const done = plan.filter(s => s.status === 'done').length

    return (
      <PhaseSection phase="execute" biz={biz} current={isPhase('execute')} past={false}>
        {isPhase('execute') && (
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-0.5 bg-border overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-700"
                  style={{ width: plan.length ? `${(done / plan.length) * 100}%` : '0%' }}
                />
              </div>
              <span className="font-mono text-xs text-muted flex-shrink-0">{done}/{plan.length} done</span>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              {plan.map((step) => (
                <ExecuteStep
                  key={step.id}
                  step={step}
                  isActive={evalStep === step.id}
                  evalNote={evalStep === step.id ? evalNote : ''}
                  evalStreaming={evalStep === step.id && evalStreaming}
                  onToggle={() => {
                    setEvalStep(evalStep === step.id ? null : step.id)
                    setEvalNote(step.notes || '')
                  }}
                  onNoteChange={setEvalNote}
                  onSubmit={() => submitEvaluation(step.id)}
                  onMarkDone={() => markStepDone(step.id)}
                />
              ))}
            </div>
          </div>
        )}
      </PhaseSection>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Layout
  // ─────────────────────────────────────────────────────────────────────────

  const progress = Math.round(((phaseIdx + 1) / PHASES.length) * 100)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <div className="border-b border-border px-6 py-4 flex items-center gap-4 sticky top-0 bg-white z-10">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-muted hover:text-ink transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-4 h-4 bg-ink flex-shrink-0" />
          <h1 className="font-syne font-semibold text-sm truncate">
            {biz.profile?.name || 'New Business'}
          </h1>
          {biz.profile?.tagline && (
            <span className="text-muted text-xs hidden md:block truncate">— {biz.profile.tagline}</span>
          )}
        </div>
        {/* Progress */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-24 h-0.5 bg-border overflow-hidden hidden sm:block">
            <div className="h-full bg-accent transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <span className="font-mono text-xs text-muted">{progress}%</span>
        </div>
      </div>

      {/* Phase tabs */}
      <div className="border-b border-border overflow-x-auto">
        <div className="flex px-6 gap-0 min-w-max">
          {PHASES.map((p, i) => {
            const meta = PHASE_META[p]
            const active = biz.phase === p
            const past = PHASES.indexOf(p) < phaseIdx
            return (
              <div
                key={p}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-mono cursor-default
                  transition-all whitespace-nowrap
                  ${active ? 'border-accent text-ink' : past ? 'border-transparent text-muted' : 'border-transparent text-border'}
                `}
              >
                {past ? (
                  <span className="text-accent">✓</span>
                ) : (
                  <span className={active ? 'text-accent' : ''}>{meta.num}</span>
                )}
                <span className={active ? 'font-semibold text-ink' : ''}>{meta.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 space-y-2">
        <div ref={phaseRef} />
        {renderDescribe()}
        {renderQuestions()}
        {renderProfile()}
        {renderAnalysis()}
        {renderClarify()}
        {renderOptimize()}
        {renderRevenue()}
        {renderPlan()}
        {renderExecute()}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function PhaseSection({ phase, biz, current, past, children }) {
  const meta = PHASE_META[phase]
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`border transition-colors ${current ? 'border-ink' : past ? 'border-border' : 'border-border opacity-30 pointer-events-none'}`}
    >
      <div className={`px-6 py-4 flex items-center gap-3 ${past ? 'border-b border-border' : current ? 'border-b border-ink' : ''}`}>
        <span className={`font-mono text-xs flex-shrink-0 ${current ? 'text-accent' : past ? 'text-muted' : 'text-border'}`}>
          {past ? '✓' : meta.num}
        </span>
        <div className="flex-1">
          <span className={`font-syne font-semibold text-sm ${current ? 'text-ink' : 'text-muted'}`}>
            {meta.label}
          </span>
          {!current && !past && (
            <span className="text-muted text-xs ml-2">{meta.desc}</span>
          )}
        </div>
        {current && (
          <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
        )}
      </div>
      {(current || past) && (
        <div className="px-6 py-5">
          {children}
        </div>
      )}
    </motion.div>
  )
}

function LockedPhase({ phase }) {
  const meta = PHASE_META[phase]
  return (
    <div className="border border-border opacity-20 px-6 py-4 flex items-center gap-3">
      <span className="font-mono text-xs text-border">{meta.num}</span>
      <span className="font-syne text-sm text-muted">{meta.label}</span>
      <span className="text-muted text-xs ml-1">— {meta.desc}</span>
    </div>
  )
}

function LoadingState({ text }) {
  return (
    <div className="flex items-center gap-3 py-4">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 bg-accent animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="font-mono text-xs text-muted">{text}</span>
    </div>
  )
}

function ErrorState({ msg, onRetry }) {
  return (
    <div className="border border-danger/30 bg-danger/5 p-4 flex items-start justify-between gap-4">
      <p className="text-danger text-xs font-mono">{msg}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-danger hover:text-ink transition-colors font-mono flex-shrink-0 underline">
          Retry
        </button>
      )}
    </div>
  )
}

function ProfileCard({ profile }) {
  return (
    <div className="space-y-5">
      <div className="border-b border-border pb-5">
        <div className="label mb-2">Business Identity</div>
        <h2 className="font-syne text-2xl font-bold text-ink">{profile.name}</h2>
        <p className="text-accent font-syne font-semibold mt-1">{profile.tagline}</p>
      </div>
      <p className="text-sm leading-relaxed text-ink">{profile.description}</p>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Industry', value: profile.industry },
          { label: 'Target Market', value: profile.targetMarket },
          { label: 'Business Model', value: profile.businessModel },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="label mb-1">{label}</div>
            <p className="text-sm text-ink">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnalysisCard({ analysis }) {
  return (
    <div className="space-y-6">
      {/* Verdict */}
      <div className="bg-accent-light border border-accent/30 p-4">
        <div className="label mb-2 text-accent">Verdict</div>
        <p className="text-sm font-medium text-ink">{analysis.verdict}</p>
      </div>

      {/* Market */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="label mb-2">Market Size</div>
          <p className="text-sm text-ink">{analysis.marketSize}</p>
        </div>
        <div>
          <div className="label mb-2">Competition</div>
          <p className="text-sm text-ink">{analysis.competition}</p>
        </div>
      </div>

      {/* Pros/Cons */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="label mb-3">Strengths</div>
          <div className="space-y-2">
            {(analysis.pros || []).map((p, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-accent flex-shrink-0 font-mono">+</span>
                <span className="text-ink">{p}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="label mb-3">Weaknesses</div>
          <div className="space-y-2">
            {(analysis.cons || []).map((c, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-danger flex-shrink-0 font-mono">−</span>
                <span className="text-ink">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risks / Opportunities */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="label mb-3">Risks</div>
          <div className="space-y-2">
            {(analysis.risks || []).map((r, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-muted flex-shrink-0 font-mono">!</span>
                <span className="text-muted">{r}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="label mb-3">Opportunities</div>
          <div className="space-y-2">
            {(analysis.opportunities || []).map((o, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-accent flex-shrink-0 font-mono">→</span>
                <span className="text-ink">{o}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function PlanList({ plan, compact }) {
  return (
    <div className="space-y-3">
      {plan.map((step) => (
        <div key={step.id} className="flex gap-4 p-4 border border-border">
          <div className="flex-shrink-0 text-right">
            <span className="font-mono text-xs text-muted">{String(step.id).padStart(2, '0')}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-syne font-semibold text-sm text-ink">{step.title}</span>
              <span className={`font-mono text-xs px-2 py-0.5 ${PRIORITY_STYLE[step.priority]}`}>
                {step.priority}
              </span>
              <span className="font-mono text-xs text-muted ml-auto flex-shrink-0">{step.timeframe}</span>
            </div>
            {!compact && <p className="text-sm text-muted">{step.description}</p>}
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs text-accent">{step.phase}</span>
              {step.deliverable && (
                <span className="font-mono text-xs text-muted">→ {step.deliverable}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ExecuteStep({ step, isActive, evalNote, evalStreaming, onToggle, onNoteChange, onSubmit, onMarkDone }) {
  const statusStyle = {
    pending:     'bg-white',
    in_progress: 'bg-accent-light border-accent/40',
    done:        'bg-surface opacity-60',
  }

  return (
    <div className={`border transition-all ${isActive ? 'border-ink' : 'border-border'} ${statusStyle[step.status]}`}>
      <div
        className="flex items-center gap-4 p-4 cursor-pointer select-none"
        onClick={onToggle}
      >
        {/* Status indicator */}
        <div className={`w-4 h-4 border flex-shrink-0 flex items-center justify-center
          ${step.status === 'done' ? 'bg-accent border-accent' : step.status === 'in_progress' ? 'border-accent' : 'border-border'}`}
        >
          {step.status === 'done' && (
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 3 6 7 2" />
            </svg>
          )}
          {step.status === 'in_progress' && (
            <div className="w-1.5 h-1.5 bg-accent animate-pulse" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-mono text-xs flex-shrink-0 ${step.status === 'done' ? 'text-muted' : 'text-muted'}`}>
              {String(step.id).padStart(2, '0')}
            </span>
            <span className={`font-syne font-semibold text-sm ${step.status === 'done' ? 'line-through text-muted' : 'text-ink'}`}>
              {step.title}
            </span>
            <span className={`font-mono text-xs px-1.5 py-0.5 ${PRIORITY_STYLE[step.priority]}`}>
              {step.priority}
            </span>
            <span className="font-mono text-xs text-muted ml-auto flex-shrink-0">{step.timeframe}</span>
          </div>
        </div>

        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`flex-shrink-0 text-muted transition-transform ${isActive ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {isActive && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-border overflow-hidden"
        >
          <div className="p-4 space-y-4">
            <div>
              <div className="label mb-1">What to do</div>
              <p className="text-sm text-ink">{step.description}</p>
              {step.deliverable && (
                <p className="text-xs text-accent mt-1 font-mono">Deliverable: {step.deliverable}</p>
              )}
            </div>

            {step.status !== 'done' && (
              <div>
                <div className="label mb-2">What did you do? (be specific)</div>
                <textarea
                  value={evalNote}
                  onChange={e => onNoteChange(e.target.value)}
                  rows={4}
                  placeholder="Describe what you actually did, results you got, blockers you hit..."
                  className="textarea-field"
                />
                <div className="flex gap-3 justify-between mt-3">
                  <button
                    onClick={onMarkDone}
                    className="btn-ghost text-xs py-2 px-4"
                  >
                    Mark Done
                  </button>
                  <button
                    onClick={onSubmit}
                    disabled={!evalNote.trim() || evalStreaming}
                    className="btn-primary text-xs py-2 px-4"
                  >
                    {evalStreaming ? (
                      <><span className="animate-pulse">Evaluating</span>···</>
                    ) : 'Get AI Evaluation →'}
                  </button>
                </div>
              </div>
            )}

            {step.evaluation && (
              <div className="border-t border-border pt-4">
                <div className="label mb-2">AI Evaluation</div>
                <div className="ai-output text-sm">
                  <MarkdownText text={step.evaluation} streaming={evalStreaming} />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}

// Minimal markdown renderer — handles ## headers, - lists, **bold**
function MarkdownText({ text, streaming }) {
  if (!text) return null

  const lines = text.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="font-syne font-semibold text-base text-ink mt-5 mb-2 first:mt-0">
          {line.slice(3)}
        </h2>
      )
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="font-syne font-semibold text-sm text-ink mt-4 mb-1">
          {line.slice(4)}
        </h3>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex gap-2 text-sm leading-relaxed">
          <span className="text-accent font-mono flex-shrink-0 mt-0.5">—</span>
          <span className="text-ink" dangerouslySetInnerHTML={{ __html: boldify(line.slice(2)) }} />
        </div>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
    } else {
      elements.push(
        <p key={i} className="text-sm leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: boldify(line) }} />
      )
    }
    i++
  }

  return (
    <div className={`space-y-0.5 ${streaming ? 'stream-cursor' : ''}`}>
      {elements}
    </div>
  )
}

function boldify(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>')
}
