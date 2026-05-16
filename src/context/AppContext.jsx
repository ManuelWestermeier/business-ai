import { createContext, useState, useCallback } from 'react'

export const AppContext = createContext(null)

const STORAGE_KEY = 'businessai_data'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { apiKey: '', businesses: [] }
    return JSON.parse(raw)
  } catch {
    return { apiKey: '', businesses: [] }
  }
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

function createBusiness(id) {
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
}

export function AppProvider({ children }) {
  const initial = loadFromStorage()
  const [apiKey, setApiKeyState] = useState(initial.apiKey || '')
  const [businesses, setBusinesses] = useState(initial.businesses || [])

  const setApiKey = useCallback((key) => {
    setApiKeyState(key)
    saveToStorage({ apiKey: key, businesses })
  }, [businesses])

  const getBusiness = useCallback((id) => {
    return businesses.find(b => b.id === id) || null
  }, [businesses])

  const upsertBusiness = useCallback((biz) => {
    setBusinesses(prev => {
      const exists = prev.find(b => b.id === biz.id)
      const next = exists
        ? prev.map(b => b.id === biz.id ? { ...b, ...biz, updatedAt: new Date().toISOString() } : b)
        : [...prev, biz]
      saveToStorage({ apiKey, businesses: next })
      return next
    })
  }, [apiKey])

  const deleteBusiness = useCallback((id) => {
    setBusinesses(prev => {
      const next = prev.filter(b => b.id !== id)
      saveToStorage({ apiKey, businesses: next })
      return next
    })
  }, [apiKey])

  const newBusiness = useCallback(() => {
    const id = `biz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const biz = createBusiness(id)
    setBusinesses(prev => {
      const next = [...prev, biz]
      saveToStorage({ apiKey, businesses: next })
      return next
    })
    return id
  }, [apiKey])

  return (
    <AppContext.Provider value={{
      apiKey,
      setApiKey,
      businesses,
      getBusiness,
      upsertBusiness,
      deleteBusiness,
      newBusiness,
    }}>
      {children}
    </AppContext.Provider>
  )
}
