import { createContext, useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  API_BASE_URL,
  emailRule,
  passwordRule,
  phoneRule,
  CLAIM_STATUSES,
  AGING_BUCKETS,
  formatMoney,
  getClaimAgeDays,
  parseCsvLine,
  buildManualDashboard,
  buildWorkQueueFromClaims,
  getPasswordStrength,
  validateSignup,
  paginate,
} from '../helpers/rcmHelpers'

const RcmContext = createContext()

export function useRcm() {
  const context = useContext(RcmContext)
  if (!context) {
    throw new Error('useRcm must be used within an RcmProvider')
  }
  return context
}

export {
  API_BASE_URL,
  emailRule,
  passwordRule,
  phoneRule,
  CLAIM_STATUSES,
  AGING_BUCKETS,
  formatMoney,
  getClaimAgeDays,
  parseCsvLine,
  buildManualDashboard,
  buildWorkQueueFromClaims,
  getPasswordStrength,
  validateSignup,
  paginate,
}

export function RcmProvider({ children }) {
  const navigate = useNavigate()
  const [screen, setScreen] = useState('login')
  const [activeNav, setActiveNav] = useState('dashboard')
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('rcm_user')
      if (storedUser) {
        return JSON.parse(storedUser)
      }
    } catch (error) {
      console.log('Stored user could not be parsed:', error)
    }
    return { name: 'Demo User', email: 'demo@example.com', role: 'user' }
  })
  const [claims, setClaims] = useState([])
  const [dashboard, setDashboard] = useState(() => buildManualDashboard([]))
  const [reservations, setReservations] = useState([])
  const [denials, setDenials] = useState([])
  const [payments, setPayments] = useState([])
  const [showCreatePayment, setShowCreatePayment] = useState(false)
  const [showPaymentFilters, setShowPaymentFilters] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    claimId: 'CLM-52',
    amount: '1500.00',
    payer: 'Aetna (ID: 3)',
    postedDate: '2026-10-10',
    remittanceRef: 'RMT482910',
  })
  const [assistantMessages, setAssistantMessages] = useState([
    { id: 1, role: 'assistant', content: 'Ask the assistant about AR, payer performance, totals, or denials.' },
  ])
  const [assistantPrompt, setAssistantPrompt] = useState('')
  const [showCreateClaim, setShowCreateClaim] = useState(false)
  const [showEditClaim, setShowEditClaim] = useState(false)
  const [showCreateDenial, setShowCreateDenial] = useState(false)
  const [showEditDenial, setShowEditDenial] = useState(false)
  const [claimFilters, setClaimFilters] = useState({
    status: 'All Statuses',
    search: '',
    payer: 'All Payers',
    from: '',
    to: '',
  })
  const [claimForm, setClaimForm] = useState({
    patient: 'Patient #1 (MRN126225)',
    provider: 'Dr. Robert Taylor (Orthopedic)',
    payer: 'UnitedHealthcare',
    dos: new Date().toISOString().slice(0, 10),
    charged: '250.00',
    paid: '0.00',
    balance: '250.00',
    status: 'Created',
  })
  const [denialForm, setDenialForm] = useState({
    claimId: 'CLM-316',
    code: 'CO-16',
    description: 'Claim/service lacks information or has invalid details.',
    amount: '2500.00',
    deniedDate: new Date().toISOString().slice(0, 10),
    rootCause: 'Missing Information',
    status: 'Open',
  })
  const [editingClaimId, setEditingClaimId] = useState(null)
  const [editingDenialId, setEditingDenialId] = useState(null)
  const [showFilterPanel, setShowFilterPanel] = useState(true)
  const [showViewClaim, setShowViewClaim] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [signupForm, setSignupForm] = useState({ name: '', phone: '', email: '', password: '', confirmPassword: '' })
  const [signupErrors, setSignupErrors] = useState({})
  const [reservationForm, setReservationForm] = useState({
    guestName: 'Alice Johnson',
    roomType: 'Deluxe Suite',
    checkIn: '2026-10-15',
    checkOut: '2026-10-18',
    guests: 2,
    status: 'Pending',
  })
  const [toasts, setToasts] = useState([])

  const showToast = (message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, message, type }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 3000)
  }

  const handleNavigate = (nextView) => {
    setActiveNav(nextView)
    const paths = {
      dashboard: '/dashboard',
      claims: '/claims',
      'work-queue': '/work-queue',
      denials: '/denials',
      payments: '/payments',
      assistant: '/assistant',
    }
    navigate(paths[nextView] || '/dashboard')
  }

  const handleSignOut = () => {
    localStorage.removeItem('rcm_token')
    localStorage.removeItem('rcm_user')
    setUser({ name: 'Demo User', email: 'demo@example.com', role: 'user' })
    setActiveNav('dashboard')
    setScreen('login')
    navigate('/login')
    showToast('Signed out successfully.', 'success')
  }

  const loadDashboard = async (claimList = null) => {
    const fallbackClaims = Array.isArray(claimList) ? claimList : Array.isArray(claims) ? claims : []
    const token = localStorage.getItem('rcm_token')

    const localDashboard = buildManualDashboard(fallbackClaims)

    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.ok) {
        const data = await response.json()
        const merged = { ...data, metrics: localDashboard.metrics }
        setDashboard(merged)
        return merged
      }
    } catch (error) {
      console.log('Dashboard fallback used:', error)
    }

    setDashboard(localDashboard)
    return localDashboard
  }

  const loadClaims = async (filters = null) => {
    const activeFilters = filters !== null ? filters : claimFilters
    const token = localStorage.getItem('rcm_token')
    const params = new URLSearchParams()

    if (activeFilters.status && activeFilters.status !== 'All Statuses') params.set('status', activeFilters.status)
    if (activeFilters.search) params.set('search', activeFilters.search)
    if (activeFilters.payer && activeFilters.payer !== 'All Payers') params.set('payer', activeFilters.payer)
    if (activeFilters.from) params.set('from', activeFilters.from)
    if (activeFilters.to) params.set('to', activeFilters.to)

    try {
      const response = await fetch(`${API_BASE_URL}/api/claims?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.ok) {
        const data = await response.json()
        setClaims(data)
        await loadDashboard(data)
        return data
      }
    } catch (error) {
      console.log('Claims fallback used:', error)
    }

    setClaims([])
    await loadDashboard([])
    return []
  }

  const loadDenials = async () => {
    const token = localStorage.getItem('rcm_token')
    try {
      const response = await fetch(`${API_BASE_URL}/api/denials`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.ok) {
        const data = await response.json()
        setDenials(data)
        return data
      }
    } catch (error) {
      console.log('Denials fallback used:', error)
    }
    setDenials([])
    return []
  }

  const loadPayments = async () => {
    const token = localStorage.getItem('rcm_token')
    try {
      const response = await fetch(`${API_BASE_URL}/api/payments`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.ok) {
        const data = await response.json()
        setPayments(data)
        return data
      }
    } catch (error) {
      console.log('Payments fallback used:', error)
    }
    setPayments([])
    return []
  }

  const loadReservations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/reservations`)
      if (response.ok) {
        const data = await response.json()
        setReservations(data)
        return data
      }
    } catch (error) {
      console.log('Reservations fallback used:', error)
    }
    setReservations([])
    return []
  }

  const loadCurrentUser = async () => {
    const token = localStorage.getItem('rcm_token')
    if (!token) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        localStorage.removeItem('rcm_token')
        localStorage.removeItem('rcm_user')
        setScreen('login')
        showToast('Session expired. Please log in again.', 'error')
        return
      }

      const data = await response.json()
      if (data && data.user) {
        setUser(data.user)
        try {
          localStorage.setItem('rcm_user', JSON.stringify(data.user))
        } catch (error) {
          console.log('Stored user could not be saved:', error)
        }
      }
    } catch (error) {
      console.log('Current user lookup failed:', error)
      localStorage.removeItem('rcm_token')
      localStorage.removeItem('rcm_user')
      setScreen('login')
    }
  }

  const refreshAllData = async () => {
    const token = localStorage.getItem('rcm_token')

    const runClaimRequest = async () => {
      const params = new URLSearchParams()
      if (claimFilters.status && claimFilters.status !== 'All Statuses') params.set('status', claimFilters.status)
      if (claimFilters.search) params.set('search', claimFilters.search)
      if (claimFilters.payer && claimFilters.payer !== 'All Payers') params.set('payer', claimFilters.payer)
      if (claimFilters.from) params.set('from', claimFilters.from)
      if (claimFilters.to) params.set('to', claimFilters.to)

      const response = await fetch(`${API_BASE_URL}/api/claims?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!response.ok) {
        throw new Error('Unable to load claims')
      }

      const data = await response.json()
      setClaims(data)
      return data
    }

    const runDenialRequest = async () => {
      const response = await fetch(`${API_BASE_URL}/api/denials`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!response.ok) {
        throw new Error('Unable to load denials')
      }

      const data = await response.json()
      setDenials(data)
      return data
    }

    const runReservationRequest = async () => {
      const response = await fetch(`${API_BASE_URL}/api/reservations`)
      if (!response.ok) {
        throw new Error('Unable to load reservations')
      }

      const data = await response.json()
      setReservations(data)
      return data
    }

    const runPaymentRequest = async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!response.ok) {
        throw new Error('Unable to load payments')
      }
      const data = await response.json()
      setPayments(data)
      return data
    }

    try {
      const [claimsResult, denialsResult, reservationsResult, paymentsResult] = await Promise.allSettled([
        runClaimRequest(),
        runDenialRequest(),
        runReservationRequest(),
        runPaymentRequest(),
      ])

      const latestClaims = claimsResult.status === 'fulfilled' ? claimsResult.value : claims
      const dashboardData = await loadDashboard(latestClaims)

      if (claimsResult.status === 'rejected') {
        console.warn('Claim refresh failed:', claimsResult.reason)
      }
      if (denialsResult.status === 'rejected') {
        console.warn('Denial refresh failed:', denialsResult.reason)
      }
      if (reservationsResult.status === 'rejected') {
        console.warn('Reservation refresh failed:', reservationsResult.reason)
      }
      if (paymentsResult.status === 'rejected') {
        console.warn('Payment refresh failed:', paymentsResult.reason)
      }

      if (dashboardData && dashboardData.metrics) {
        showToast('Data refreshed successfully.', 'success')
      }
    } catch (error) {
      console.error('Refresh failed:', error)
      showToast('Refresh failed. Please try again.', 'error')
    }
  }

  const handleApplyClaimFilters = async () => {
    setShowFilterPanel(false)
    await loadClaims(claimFilters)
    showToast('Filters applied.', 'success')
  }

  const handleResetClaimFilters = async () => {
    const nextFilters = {
      status: 'All Statuses',
      search: '',
      payer: 'All Payers',
      from: '',
      to: '',
    }

    setClaimFilters(nextFilters)
    setShowFilterPanel(false)
    await loadClaims(nextFilters)
    showToast('All claims are shown.', 'success')
  }

  const openViewClaim = (claim) => {
    setSelectedClaim(claim)
    setShowViewClaim(true)
  }

  const openEditClaim = (claim) => {
    setEditingClaimId(claim.id)
    setClaimForm({
      patient: claim.patient,
      provider: claim.provider,
      payer: claim.payer,
      dos: claim.dos,
      charged: String(claim.charged ?? 0),
      paid: String(claim.paid ?? 0),
      balance: String(claim.balance ?? Number(claim.charged ?? 0) - Number(claim.paid ?? 0)),
      status: claim.status,
    })
    setShowEditClaim(true)
  }

  const handleCreateClaim = async (event) => {
    event.preventDefault()
    const token = localStorage.getItem('rcm_token')
    const charged = Number(claimForm.charged || 0)
    const paid = Number(claimForm.paid || 0)
    const balance = Number(claimForm.balance ?? charged - paid)

    const payload = {
      patient: claimForm.patient,
      provider: claimForm.provider,
      payer: claimForm.payer,
      dos: claimForm.dos,
      charged,
      paid,
      balance,
      status: claimForm.status,
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Claim creation failed')
      }

      const newClaim = await response.json()
      setClaims((current) => [newClaim, ...current])
      setShowCreateClaim(false)
      showToast('Claim created successfully.', 'success')
      setClaimForm({
        patient: 'Patient #1 (MRN126225)',
        provider: 'Dr. Robert Taylor (Orthopedic)',
        payer: 'UnitedHealthcare',
        dos: new Date().toISOString().slice(0, 10),
        charged: '250.00',
        paid: '0.00',
        balance: '250.00',
        status: 'Created',
      })
      loadDashboard()
      loadClaims()
    } catch (error) {
      console.error(error)
      if (!localStorage.getItem('rcm_token')) {
        const fallbackClaim = {
          id: Date.now(),
          claimId: `CLM-${Date.now()}`,
          patient: payload.patient,
          provider: payload.provider,
          payer: payload.payer,
          dos: payload.dos,
          charged: payload.charged,
          paid: 0,
          balance: payload.charged,
          status: payload.status,
        }
        setClaims((current) => [fallbackClaim, ...current])
        setShowCreateClaim(false)
        showToast('Claim added locally (offline mode).', 'error')
        return
      }
      showToast('Claim could not be saved. Please try again.', 'error')
    }
  }

  const handleEditClaim = async (event) => {
    event.preventDefault()
    const token = localStorage.getItem('rcm_token')
    const charged = Number(claimForm.charged || 0)
    const paid = Number(claimForm.paid || 0)
    const balance = Number(claimForm.balance ?? charged - paid)

    const payload = {
      patient: claimForm.patient,
      provider: claimForm.provider,
      payer: claimForm.payer,
      dos: claimForm.dos,
      charged,
      paid,
      balance,
      status: claimForm.status,
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/claims/${editingClaimId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Claim update failed')
      }

      const updatedClaim = await response.json()
      setClaims((current) => current.map((claim) => (claim.id === updatedClaim.id ? updatedClaim : claim)))
      setShowEditClaim(false)
      setEditingClaimId(null)
      showToast('Claim updated successfully.', 'success')
      loadClaims()
      loadDashboard()
    } catch (error) {
      console.error(error)
      showToast('Claim update failed.', 'error')
    }
  }

  const handleDeleteClaim = async (claimId) => {
    const token = localStorage.getItem('rcm_token')
    try {
      const response = await fetch(`${API_BASE_URL}/api/claims/${claimId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!response.ok) {
        throw new Error('Delete failed')
      }

      setClaims((current) => current.filter((claim) => claim.id !== claimId))
      showToast('Claim deleted successfully.', 'success')
      loadClaims(claimFilters)
      loadDashboard()
    } catch (error) {
      console.error(error)
      showToast('Claim deletion failed.', 'error')
    }
  }

  const handleCreateDenial = async (event) => {
    event.preventDefault()
    const token = localStorage.getItem('rcm_token')

    if (!claims.length) {
      showToast('Create a claim before adding a denial.', 'error')
      return
    }

    const claimExists = claims.some((claim) => String(claim.claimId || claim.id) === String(denialForm.claimId))
    if (!claimExists) {
      showToast('Enter a valid claim ID that exists in the claim list.', 'error')
      return
    }

    const payload = {
      claimId: denialForm.claimId,
      code: denialForm.code,
      description: denialForm.description,
      amount: Number(denialForm.amount || 0),
      deniedDate: denialForm.deniedDate,
      rootCause: denialForm.rootCause,
      status: denialForm.status,
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/denials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Denial creation failed')
      }

      const newDenial = await response.json()
      setDenials((current) => [newDenial, ...current])
      setShowCreateDenial(false)
      setDenialForm({
        claimId: 'CLM-316',
        code: 'CO-16',
        description: 'Claim/service lacks information or has invalid details.',
        amount: '2500.00',
        deniedDate: new Date().toISOString().slice(0, 10),
        rootCause: 'Missing Information',
        status: 'Open',
      })
      showToast('Denial created successfully.', 'success')
    } catch (error) {
      console.error(error)
      showToast('Denial creation failed.', 'error')
    }
  }

  const handleEditDenial = async (event) => {
    event.preventDefault()
    const token = localStorage.getItem('rcm_token')

    const payload = {
      claimId: denialForm.claimId,
      code: denialForm.code,
      description: denialForm.description,
      amount: Number(denialForm.amount || 0),
      deniedDate: denialForm.deniedDate,
      rootCause: denialForm.rootCause,
      status: denialForm.status,
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/denials/${editingDenialId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Denial update failed')
      }

      const updatedDenial = await response.json()
      setDenials((current) => current.map((denial) => (denial.id === updatedDenial.id ? updatedDenial : denial)))
      setShowEditDenial(false)
      setEditingDenialId(null)
      showToast('Denial updated successfully.', 'success')
      loadDenials()
    } catch (error) {
      console.error(error)
      showToast('Denial update failed.', 'error')
    }
  }

  const handleDeleteDenial = async (denialId) => {
    const token = localStorage.getItem('rcm_token')
    try {
      const response = await fetch(`${API_BASE_URL}/api/denials/${denialId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!response.ok) {
        throw new Error('Delete failed')
      }

      setDenials((current) => current.filter((denial) => denial.id !== denialId))
      showToast('Denial deleted successfully.', 'success')
    } catch (error) {
      console.error(error)
      showToast('Denial deletion failed.', 'error')
    }
  }

  const openEditDenial = (denial) => {
    setEditingDenialId(denial.id)
    setDenialForm({
      claimId: denial.claimId || 'CLM-316',
      code: denial.code || 'CO-16',
      description: denial.description || '',
      amount: String(denial.amount ?? 0),
      deniedDate: denial.deniedDate || new Date().toISOString().slice(0, 10),
      rootCause: denial.rootCause || 'Missing Information',
      status: denial.status || 'Open',
    })
    setShowEditDenial(true)
  }

  const exportClaimsToExcel = () => {
    const header = ['Claim ID', 'Patient', 'Provider', 'Payer', 'Date of Service', 'Charged', 'Paid', 'Balance', 'Status']
    const rows = claims.map((claim) => [
      claim.claimId || claim.id,
      claim.patient,
      claim.provider,
      claim.payer,
      claim.dos,
      Number(claim.charged || 0),
      Number(claim.paid || 0),
      Number(claim.balance || 0),
      claim.status,
    ])

    const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const csvContent = [
      header.map(escapeCell).join(','),
      ...rows.map((row) => row.map((cell) => escapeCell(cell)).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'revoraX_claims.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast('Claims exported to Excel-compatible CSV.', 'success')
  }

  const importClaimsFromExcel = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const rows = text.split(/\r?\n/).filter((line) => line.trim())
      if (rows.length < 2) {
        throw new Error('No rows were found in the spreadsheet file.')
      }

      const headers = parseCsvLine(rows[0]).map((header) => header.toLowerCase())
      const importedClaims = rows.slice(1).map((line, index) => {
        const values = parseCsvLine(line)
        const record = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] || '']))

        const claimId = record.claimid || record['claim id'] || `CLM-${Date.now() + index}`
        const patient = record.patient || 'Imported Patient'
        const provider = record.provider || 'Imported Provider'
        const payer = record.payer || 'UnitedHealthcare'
        const dos = record.dos || record['date of service'] || new Date().toISOString().slice(0, 10)
        const charged = Number(String(record.charged ?? 0).replace(/[$,]/g, '') || 0)
        const paid = Number(String(record.paid ?? 0).replace(/[$,]/g, '') || 0)
        const balance = Number(String(record.balance ?? charged - paid).replace(/[$,]/g, '') || 0)
        const status = record.status || 'Pending'

        return {
          id: Date.now() + index + 1,
          claimId,
          patient,
          provider,
          payer,
          dos,
          charged,
          paid,
          balance,
          status,
        }
      })

      if (!importedClaims.length) {
        throw new Error('No rows were found in the spreadsheet file.')
      }

      setClaims((current) => {
        const nextClaims = [...importedClaims, ...current]
        loadDashboard(nextClaims)
        return nextClaims
      })

      const token = localStorage.getItem('rcm_token')
      if (token) {
        let savedCount = 0
        await Promise.allSettled(
          importedClaims.map((claim) =>
            fetch(`${API_BASE_URL}/api/claims`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                patient: claim.patient,
                provider: claim.provider,
                payer: claim.payer,
                dos: claim.dos,
                charged: Number(claim.charged || 0),
                paid: Number(claim.paid || 0),
                balance: Number(claim.balance || 0),
                status: claim.status,
              }),
            }).then((response) => {
              if (response.ok) savedCount += 1
            })
          )
        )
        if (savedCount > 0) {
          showToast(`${savedCount} of ${importedClaims.length} claims saved to the server.`, 'success')
        }
        loadClaims()
        loadDashboard()
      }
      showToast(`${importedClaims.length} claims imported successfully.`, 'success')
    } catch (error) {
      console.error(error)
      showToast(error.message || 'Spreadsheet import failed.', 'error')
    } finally {
      event.target.value = ''
    }
  }

  const handleCreatePayment = async (event) => {
    event.preventDefault()

    if (!claims.length) {
      showToast('Create a claim before posting a payment.', 'error')
      return
    }

    const claimExists = claims.some((claim) => String(claim.claimId || claim.id) === String(paymentForm.claimId))
    if (!claimExists) {
      showToast('Enter a valid claim ID that exists in the claim list.', 'error')
      return
    }

    const amount = Number(String(paymentForm.amount).replace(/[$,]/g, '') || 0)
    const nextPayment = {
      id: Date.now(),
      paymentId: `PMT-${Math.floor(100 + Math.random() * 900)}`,
      claim: paymentForm.claimId || 'CLM-52',
      amount,
      postedDate: paymentForm.postedDate || new Date().toISOString().slice(0, 10),
      remittanceRef: paymentForm.remittanceRef || `RMT${Date.now()}`,
      payer: paymentForm.payer || 'Aetna (ID: 3)',
    }

     setPayments((current) => [nextPayment, ...current])
    setShowCreatePayment(false)
    setPaymentForm({
      claimId: 'CLM-52',
      amount: '1500.00',
      payer: 'Aetna (ID: 3)',
      postedDate: '2026-10-10',
      remittanceRef: 'RMT482910',
    })
    showToast('Payment posted successfully.', 'success')
    navigate('/payments', { replace: true })
    setActiveNav('payments')

    const token = localStorage.getItem('rcm_token')
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            claim: nextPayment.claim,
            amount: nextPayment.amount,
            postedDate: nextPayment.postedDate,
            remittanceRef: nextPayment.remittanceRef,
            payer: nextPayment.payer,
          }),
        })
        loadPayments()
      } catch (error) {
        console.error(error)
      }
    }
  }

  const handleCreateReservation = async (event) => {
    event.preventDefault()

    const payload = {
      guestName: reservationForm.guestName,
      roomType: reservationForm.roomType,
      checkIn: reservationForm.checkIn,
      checkOut: reservationForm.checkOut,
      guests: Number(reservationForm.guests),
      status: reservationForm.status,
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const newReservation = await response.json()
        setReservations((current) => [newReservation, ...current])
        showToast('Reservation saved.', 'success')
        setScreen('dashboard')
        setActiveNav('dashboard')
        return
      }
      throw new Error('Reservation creation failed')
    } catch (error) {
      console.error(error)
      setReservations((current) => [
        { id: Date.now(), ...payload },
        ...current,
      ])
      showToast('Reservation saved locally (offline mode).', 'error')
    }

    setScreen('dashboard')
    setActiveNav('dashboard')
  }

  return (
    <RcmContext.Provider
      value={{
        screen, setScreen,
        activeNav, setActiveNav,
        user, setUser,
        claims, setClaims,
        dashboard, setDashboard,
        reservations, setReservations,
        denials, setDenials,
        payments, setPayments,
        showCreatePayment, setShowCreatePayment,
        showPaymentFilters, setShowPaymentFilters,
        paymentForm, setPaymentForm,
        assistantMessages, setAssistantMessages,
        assistantPrompt, setAssistantPrompt,
        showCreateClaim, setShowCreateClaim,
        showEditClaim, setShowEditClaim,
        showCreateDenial, setShowCreateDenial,
        showEditDenial, setShowEditDenial,
        claimFilters, setClaimFilters,
        claimForm, setClaimForm,
        denialForm, setDenialForm,
        editingClaimId, setEditingClaimId,
        editingDenialId, setEditingDenialId,
        showFilterPanel, setShowFilterPanel,
        showViewClaim, setShowViewClaim,
        selectedClaim, setSelectedClaim,
        loginForm, setLoginForm,
        signupForm, setSignupForm,
        signupErrors, setSignupErrors,
        reservationForm, setReservationForm,
        toasts, setToasts,
        showToast,
        handleNavigate,
        handleSignOut,
        loadDashboard,
        loadClaims,
        loadDenials,
        loadPayments,
        loadReservations,
        loadCurrentUser,
        refreshAllData,
        handleApplyClaimFilters,
        handleResetClaimFilters,
        openViewClaim,
        openEditClaim,
        handleCreateClaim,
        handleEditClaim,
        handleDeleteClaim,
        openEditDenial,
        handleCreateDenial,
        handleEditDenial,
        handleDeleteDenial,
        handleCreatePayment,
        handleCreateReservation,
        exportClaimsToExcel,
        importClaimsFromExcel,
        buildManualDashboard,
        buildWorkQueueFromClaims,
        getAssistantReply,
      }}
    >
      {children}
    </RcmContext.Provider>
  )
}

export function getAssistantReply(input, claimsData, denialsData, paymentsData, userData) {
  const text = String(input || '').toLowerCase()
  const workingClaims = Array.isArray(claimsData) ? claimsData : []
  const workingDenials = Array.isArray(denialsData) ? denialsData : []
  const workingPayments = Array.isArray(paymentsData) ? paymentsData : []
  const totalCharged = workingClaims.reduce((sum, claim) => sum + Number(claim.charged || 0), 0)
  const outstandingAr = workingClaims.reduce((sum, claim) => sum + Number(claim.balance || 0), 0)
  const totalPaid = workingClaims.reduce((sum, claim) => sum + Number(claim.paid || 0), 0)
  const collectionRate = totalCharged > 0 ? (totalPaid / totalCharged) * 100 : 0
  const payerBreakdown = workingClaims.reduce((accumulator, claim) => {
    accumulator[claim.payer] = (accumulator[claim.payer] || 0) + Number(claim.charged || 0)
    return accumulator
  }, {})
  const topPayer = Object.entries(payerBreakdown).sort((left, right) => right[1] - left[1])[0]
  const denialCount = workingDenials.length
  const denialCodeBreakdown = workingDenials.reduce((accumulator, denial) => {
    const code = denial.code || 'Unknown'
    accumulator[code] = (accumulator[code] || 0) + 1
    return accumulator
  }, {})
  const topDenial = Object.entries(denialCodeBreakdown).sort((left, right) => right[1] - left[1])[0]
  const denialByPayer = workingDenials.reduce((accumulator, denial) => {
    const claim = workingClaims.find((item) => String(item.claimId || item.id) === String(denial.claimId || ''))
    const payerKey = claim ? claim.payer : 'Unmapped'
    accumulator[payerKey] = (accumulator[payerKey] || 0) + Number(denial.amount || 0)
    return accumulator
  }, {})
  const payerDenialLeader = Object.entries(denialByPayer).sort((left, right) => right[1] - left[1])[0]
  const totalPayments = workingPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const claimStatusSummary = workingClaims.reduce((accumulator, claim) => {
    accumulator[claim.status] = (accumulator[claim.status] || 0) + 1
    return accumulator
  }, {})
  const statusText = Object.entries(claimStatusSummary).length
    ? Object.entries(claimStatusSummary)
        .map(([status, count]) => `${status}: ${count}`)
        .join(', ')
    : 'No claims available'

  if (!text.trim()) {
    return `I can help with your RCM status. Right now we have ${workingClaims.length} claims, $${outstandingAr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} outstanding, and ${denialCount} denials in the queue.`
  }

  if (text.includes('outstanding') || text.includes('ar ') || text.includes('aging')) {
    return `Outstanding AR is $${outstandingAr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across ${workingClaims.length} active claims.`
  }

  if (text.includes('collection rate') || text.includes('collected') || text.includes('collections') || text.includes('cash')) {
    return `Our collection rate is ${Number.isFinite(collectionRate) ? collectionRate.toFixed(1) : '0.0'}% with $${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} collected out of $${totalCharged.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} charged.`
  }

  if (text.includes('denial') || text.includes('appeal')) {
    return topDenial
      ? `The most common denial code is ${topDenial[0]} with ${topDenial[1]} occurrence(s). We also have ${denialCount} denials total, with ${payerDenialLeader ? `${payerDenialLeader[0]} as the largest payer exposure` : 'no payer exposure yet'}.`
      : 'There are no denials in the current dataset, so there is no denial exposure to review yet.'
  }

  if (text.includes('payer') || text.includes('compare') || text.includes('top payer') || text.includes('performance')) {
    return topPayer
      ? `The highest payer volume is ${topPayer[0]} at $${topPayer[1].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
      : 'No payer data is currently available.'
  }

  if (text.includes('claim') || text.includes('status')) {
    return `Current claims status summary: ${statusText}. Total charged is $${totalCharged.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} and total paid is $${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
  }

  if (text.includes('payment') || text.includes('posted')) {
    return `Total payments posted are $${totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, with ${workingPayments.length} payment records in the current system.`
  }

  if (text.includes('hello') || text.includes('hi ') || text.includes('good')) {
    return `Hi ${userData?.name || 'there'}! I can help with: AR Aging, Denial Rates, Top Denial Codes, Payer Comparison, Collection Rates, Total AR, Claims by Status, and Payments. What would you like to know?`
  }

  if (text.includes('what can you do') || text.includes('help') || text.includes('capable')) {
    return `I can provide data from your RCM system: AR aging, denial rates and codes, payer performance comparisons, collection rates, total AR, claims by status, and payment summaries. Just ask in natural language.`
  }

  if (text.includes('total') && text.includes('ar')) {
    return `Total outstanding AR is $${outstandingAr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across ${workingClaims.length} claims.`
  }

  if (text.includes('average') && (text.includes('claim') || text.includes('balance'))) {
    const avgBalance = workingClaims.length > 0 ? outstandingAr / workingClaims.length : 0
    return `The average claim balance is $${avgBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across ${workingClaims.length} claims.`
  }

  if (text.includes('average') && text.includes('payment')) {
    const avgPayment = workingPayments.length > 0 ? totalPayments / workingPayments.length : 0
    return `The average payment amount is $${avgPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across ${workingPayments.length} payment records.`
  }

  if (text.includes('denial') && text.includes('rate')) {
    const deniedClaims = workingClaims.filter((c) => String(c.status || '').toLowerCase() === 'denied').length
    const rate = workingClaims.length > 0 ? (deniedClaims / workingClaims.length) * 100 : 0
    return `The denial rate is ${rate.toFixed(1)}% — ${deniedClaims} denied claims out of ${workingClaims.length} total.`
  }

  if (text.includes('top denial code')) {
    return topDenial
      ? `The top denial code is ${topDenial[0]} with ${topDenial[1]} occurrence(s).`
      : 'No denial codes have been recorded yet.'
  }

  if (text.includes('compare')) {
    const sortedPayers = Object.entries(payerBreakdown).sort((left, right) => right[1] - left[1])
    if (!sortedPayers.length) return 'No payer comparison data available.'
    const list = sortedPayers.slice(0, 5).map(([payer, amount]) => `${payer}: $${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`).join(', ')
    return `Payer volume comparison (top 5): ${list}.`
  }

  if (text.includes('which payer') && (text.includes('denial') || text.includes('most'))) {
    return payerDenialLeader
      ? `${payerDenialLeader[0]} has the most denials with $${payerDenialLeader[1].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in denied amount.`
      : 'No payer denial data available.'
  }

  return `Based on the live records, we have ${workingClaims.length} claims, $${totalCharged.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} charged, $${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} paid, and $${outstandingAr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} outstanding. The current collection rate is ${Number.isFinite(collectionRate) ? collectionRate.toFixed(1) : '0.0'}%, with ${denialCount} denials and ${workingPayments.length} payment records in the system. Need details on any specific metric?`
}
