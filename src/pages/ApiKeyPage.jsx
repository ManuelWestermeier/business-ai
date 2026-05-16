import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppContext } from '../context/AppContext'
import { complete } from '../lib/api'

export default function ApiKeyPage() {
  const { apiKey, setApiKey } = useContext(AppContext)
  const navigate = useNavigate()
  const [input, setInput] = useState(apiKey || '')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    setLoading(true)
    setError('')

    try {
      // Validate key with a minimal test call
      await complete({
        apiKey: input.trim(),
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        maxTokens: 10,
      })
      setApiKey(input.trim())
      navigate('/dashboard')
    } catch (err) {
      setError(err.message?.includes('401') || err.message?.includes('Unauthorized')
        ? 'Invalid API key. Check your NVIDIA key and try again.'
        : `Connection error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSkipValidation = () => {
    if (!input.trim()) return
    setApiKey(input.trim())
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border px-8 py-4 flex items-center gap-3">
        <div className="w-5 h-5 bg-ink flex items-center justify-center">
          <div className="w-3 h-0.5 bg-accent" />
        </div>
        <span className="font-syne font-semibold text-sm tracking-widest uppercase text-ink">BusinessAI</span>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          {/* Header */}
          <div className="mb-10">
            <div className="label mb-4">NVIDIA API Access</div>
            <h1 className="font-syne text-4xl font-bold text-ink mb-3 leading-tight">
              Connect your<br />
              <span className="text-accent">intelligence.</span>
            </h1>
            <p className="text-muted text-sm leading-relaxed">
              Enter your NVIDIA API key to enable DeepSeek V4 Pro. Your key is stored locally — never sent to our servers.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label block mb-2">NVIDIA API Key</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="nvapi-xxxxxxxxxxxxxxxxxxxx"
                  className="input-field pr-12 font-mono text-xs"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                  tabIndex={-1}
                >
                  {show
                    ? <EyeOffIcon />
                    : <EyeIcon />
                  }
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border border-danger/30 bg-danger/5 p-3"
              >
                <p className="text-danger text-xs font-mono">{error}</p>
              </motion.div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="btn-primary flex-1 justify-center"
              >
                {loading ? (
                  <>
                    <LoadingDots />
                    Validating
                  </>
                ) : 'Connect & Validate →'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleSkipValidation}
              disabled={!input.trim()}
              className="w-full text-center text-xs text-muted hover:text-ink transition-colors py-1"
            >
              Skip validation and continue
            </button>
          </form>

          {/* Info */}
          <div className="mt-10 pt-6 border-t border-border">
            <p className="label mb-3">What you get</p>
            <div className="space-y-2">
              {[
                'Deep business analysis powered by DeepSeek V4 Pro',
                'Critical market evaluation — no fluff',
                'Revenue projections with unit economics',
                'Prioritized action plan + execution tracking',
              ].map((item, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-1 h-1 bg-accent mt-2 flex-shrink-0" />
                  <span className="text-xs text-muted">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <a
              href="https://integrate.api.nvidia.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-accent transition-colors underline underline-offset-2"
            >
              Get your NVIDIA API key →
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function LoadingDots() {
  return (
    <span className="flex gap-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1 h-1 bg-ink rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  )
}
