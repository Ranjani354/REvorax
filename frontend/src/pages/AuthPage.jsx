import { useNavigate } from 'react-router-dom'
import { useRcm, API_BASE_URL, emailRule, passwordRule } from '../context/RcmContext'
import '../App.css'

export default function AuthPage() {
  const {
    loginForm, setLoginForm,
    user, setUser,
    activeNav, setActiveNav,
    screen, setScreen,
    toasts,
    showToast,
  } = useRcm()
  const navigate = useNavigate()

  const handleLogin = async (event) => {
    event.preventDefault()

    const email = loginForm.email.trim()
    const password = loginForm.password.trim()

    if (!email || !password) {
      showToast('Email and password are required.', 'error')
      return
    }

    if (!emailRule.test(email)) {
      showToast('Please enter a valid email address.', 'error')
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Invalid email or password')
      }

        const data = await response.json().catch(() => null)
        if (!data) {
          const text = await response.text().catch(() => '')
          const snippet = text.substring(0, 100).replace(/<[^>]+>/g, '').trim()
          throw new Error(`API returned non-JSON response (${response.status}). ` +
            `This means /api routes aren't reached. Got: "${snippet || '(empty)'}"`)
        }
      localStorage.setItem('rcm_token', data.token)
      try {
        localStorage.setItem('rcm_user', JSON.stringify(data.user))
      } catch (error) {
        console.log('User could not be stored:', error)
      }
      setUser(data.user)
      setActiveNav('dashboard')
      setScreen('dashboard')
      navigate('/dashboard')
      showToast(`Welcome back, ${data.user?.name || 'user'}!`, 'success')
    } catch (error) {
      showToast(error.message || 'Login failed. Please try again.', 'error')
    }
  }

  return (
    <div className="auth-shell">
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      <div className="auth-card centered">
        <div className="brand-block centered">
          <div className="brand-badge">R</div>
          <div>
            <p className="eyebrow">Revenue Operations</p>
            <h1>RevoraX</h1>
          </div>
        </div>

        <h2 className="auth-title centered">Login</h2>

        <form className="auth-form" onSubmit={handleLogin}>
          <label>
            Email 
            <input
              type="email"
              value={loginForm.email}
              onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
              placeholder="you@example.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={loginForm.password}
              onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
              placeholder="Enter your password"
              required
            />
          </label>
          <button type="submit" className="primary-button">Sign in</button>
        </form>
      </div>
    </div>
  )
}
