export const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export const emailRule = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/
export const phoneRule = /^\+?[0-9()\-\s]{10,20}$/

export const CLAIM_STATUSES = ['Created', 'Submitted', 'Acknowledged', 'In Process', 'Denied', 'Appealed', 'Paid']

export const AGING_BUCKETS = [
  { label: '0-30 Days', min: 0, max: 30 },
  { label: '31-60 Days', min: 31, max: 60 },
  { label: '61-90 Days', min: 61, max: 90 },
  { label: '91-120 Days', min: 91, max: 120 },
  { label: '120+ Days', min: 121, max: null },
]

export const formatMoney = (value) =>
  `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const getClaimAgeDays = (claim, today = new Date()) => {
  const dosValue = claim?.dos || claim?.dateOfService
  if (!dosValue) return null

  const dosDate = new Date(`${dosValue}T00:00:00`)
  if (Number.isNaN(dosDate.getTime())) return null

  return Math.max(0, Math.floor((today - dosDate) / (1000 * 60 * 60 * 24)))
}

export function parseCsvLine(line) {
  const cells = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }

  cells.push(current)
  return cells.map((cell) => cell.trim())
}

export function buildManualDashboard(claimList = []) {
  const safeClaims = Array.isArray(claimList) ? claimList : []

  const outstandingAr = safeClaims.reduce((sum, claim) => sum + Number(claim.balance || 0), 0)
  const totalPaid = safeClaims.reduce((sum, claim) => sum + Number(claim.paid || 0), 0)
  const collectionBase = totalPaid + outstandingAr
  const collectionRate = collectionBase > 0 ? (totalPaid / collectionBase) * 100 : 0

  const today = new Date()
  const agingBuckets = AGING_BUCKETS.map((bucket) => {
    let amount = 0
    let weightedProgress = 0
    let claimCount = 0

    safeClaims.forEach((claim) => {
      const ageDays = getClaimAgeDays(claim, today)
      if (ageDays === null) return
      if (ageDays < bucket.min) return
      if (bucket.max !== null && ageDays > bucket.max) return

      const balance = Number(claim.balance || 0)
      amount += balance
      claimCount += 1

      if (bucket.max !== null) {
        const span = bucket.max - bucket.min
        const progress = span > 0 ? (ageDays - bucket.min) / span : 0
        weightedProgress += balance * Math.min(1, progress)
      } else {
        weightedProgress += balance * 0.8
      }
    })

    let progress = amount > 0 ? (weightedProgress / amount) * 100 : 0
    if (amount === 0 && claimCount > 0) {
      progress = bucket.max === null ? 80 : 50
    }

    return { label: bucket.label, value: formatMoney(amount), amount, progress, claimCount }
  })

  return {
    metrics: [
      { label: 'Outstanding AR', value: formatMoney(outstandingAr), trend: '', tone: 'danger' },
      { label: 'Total Collected', value: formatMoney(totalPaid), trend: '', tone: 'success' },
      { label: 'Collection Rate', value: `${collectionRate.toFixed(1)}%`, trend: '', tone: 'success' },
      { label: 'Total Claims', value: String(safeClaims.length), trend: '', tone: 'info' },
    ],
    agingBuckets,
  }
}

export function buildWorkQueueFromClaims(claimList = []) {
  const safeClaims = Array.isArray(claimList) ? claimList : []
  const today = new Date()

  const queueMap = [
    { key: 'new-claims', label: 'New Claims - Review', status: ['Created', 'Submitted'], priority: 'High' },
    { key: 'age-0-30', label: 'Aging - 0-30 Days', aging: [0, 30], priority: 'Medium' },
    { key: 'age-31-60', label: 'Aging - 30-60 Days', aging: [31, 60], priority: 'Medium' },
    { key: 'age-60', label: 'Aging - 60+ Days', aging: [61, null], priority: 'High' },
    { key: 'denials', label: 'Denials - Work', status: ['Denied'], priority: 'Critical' },
    { key: 'appeals-followup', label: 'Appeals - Follow-up', status: ['Appealed'], priority: 'High' },
    { key: 'high-risk', label: 'High Risk - Denial Prevention', aging: [0, null], priority: 'Critical', highRisk: true },
  ]

  return queueMap.map((group) => {
    const filteredClaims = safeClaims.filter((claim) => {
      if (group.highRisk) {
        const ageDays = getClaimAgeDays(claim, today)
        return ageDays !== null && String(claim.status || '').toLowerCase() !== 'paid'
      }
      if (group.status) {
        return group.status.some((status) => String(claim.status || '').toLowerCase() === String(status || '').toLowerCase())
      }
      if (group.aging) {
        const ageDays = getClaimAgeDays(claim, today)
        if (ageDays === null) return false
        const min = group.aging[0]
        const max = group.aging[1]
        if (min !== null && ageDays < min) return false
        if (max !== null && ageDays > max) return false
        return true
      }
      return false
    })
    const total = filteredClaims.reduce((sum, claim) => sum + Number(claim.balance || 0), 0)

    return {
      key: group.key,
      label: group.label,
      priority: group.priority,
      count: filteredClaims.length,
      amount: total,
      claims: filteredClaims,
    }
  })
}

export function getPasswordStrength(value = '') {
  let score = 0

  if (value.length >= 8) score += 1
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1
  if (/\d/.test(value)) score += 1
  if (/[^A-Za-z0-9]/.test(value)) score += 1

  if (!value) return { label: 'No password', level: 'weak', percentage: 0 }
  if (score <= 1) return { label: 'Weak', level: 'weak', percentage: 25 }
  if (score === 2) return { label: 'Fair', level: 'medium', percentage: 50 }
  if (score === 3) return { label: 'Strong', level: 'strong', percentage: 75 }
  return { label: 'Very strong', level: 'very-strong', percentage: 100 }
}

export function validateSignup(values) {
  const errors = {}

  if (values.name.trim().length < 2) {
    errors.name = 'Name must contain at least 2 characters.'
  } else if (!/^[A-Za-z][A-Za-z\s'.-]{1,59}$/.test(values.name.trim())) {
    errors.name = 'Name can contain only letters, spaces, dots, apostrophes, and hyphens.'
  }

  if (!phoneRule.test(values.phone.trim())) {
    errors.phone = 'Enter a valid phone number with 10 to 15 digits.'
  }

  if (!emailRule.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }

  if (!passwordRule.test(values.password)) {
    errors.password = 'Password must be 8+ chars with uppercase, lowercase, number, and symbol.'
  }

  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return errors
}

export function paginate(items, currentPage, pageSize = 10) {
  const safeItems = Array.isArray(items) ? items : []
  const total = safeItems.length
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1
  const safePage = Math.max(1, Math.min(currentPage, totalPages))
  const startIndex = (safePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, total)
  const sliced = safeItems.slice(startIndex, endIndex)

  return {
    items: sliced,
    currentPage: safePage,
    totalPages,
    total,
    pageSize,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
  }
}

