import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import { RcmProvider, useRcm } from './context/RcmContext'
import AuthPage from './pages/AuthPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ClaimsPage from './pages/ClaimsPage.jsx'
import DenialsPage from './pages/DenialsPage.jsx'
import PaymentsPage from './pages/PaymentsPage.jsx'
import WorkQueuePage from './pages/WorkQueuePage.jsx'
import AssistantPage from './pages/AssistantPage.jsx'

function AppRoutes() {
  const { screen } = useRcm()

  const routes = [
    { path: '/login', element: <AuthPage /> },
    { path: '/dashboard', element: <DashboardPage /> },
    { path: '/claims', element: <ClaimsPage /> },
    { path: '/denials', element: <DenialsPage /> },
    { path: '/payments', element: <PaymentsPage /> },
    { path: '/work-queue', element: <WorkQueuePage /> },
    { path: '/assistant', element: <AssistantPage /> },
  ]

  return (
    <Routes>
      {routes.map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
      <Route path="/" element={<Navigate to={screen === 'login' ? '/login' : '/dashboard'} replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function AppContent() {
  const navigate = useNavigate()
    const { setScreen, setActiveNav } = useRcm()
  const { loadDashboard, loadCurrentUser, refreshAllData, loadReservations, loadClaims, loadDenials, loadPayments } = useRcm()

  useEffect(() => {
    const refreshOnMount = async () => {
      const token = localStorage.getItem('rcm_token')
      if (token) {
        await loadCurrentUser()
        const refreshResult = await refreshAllData()
        setScreen('dashboard')
        setActiveNav('dashboard')
      } else {
        setScreen('login')
        await Promise.all([
          loadDashboard([]),
          loadReservations(),
          loadClaims(),
          loadDenials(),
          loadPayments(),
        ])
      }
    }

    refreshOnMount()
  }, [])

  return <AppRoutes />
}

export default function App() {
  return (
    <RcmProvider>
      <AppContent />
    </RcmProvider>
  )
}
