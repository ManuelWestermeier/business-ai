import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import ApiKeyPage from './pages/ApiKeyPage'
import DashboardPage from './pages/DashboardPage'
import BusinessPage from './pages/BusinessPage'

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ApiKeyPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/business/:id" element={<BusinessPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}

export default App
