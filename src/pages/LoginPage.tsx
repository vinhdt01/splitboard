import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) navigate('/boards')
  }, [user, loading, navigate])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-2xl">
            ÷
          </div>
          <h1 className="text-3xl font-display font-semibold text-white">Nhà Chung Thanh Đa</h1>
        </div>
        <p className="text-slate-400 text-base max-w-xs">
          Track shared overhead costs, split bills automatically, and get monthly debt reminders.
        </p>
      </div>

      {/* Card */}
      <div className="card p-8 w-full max-w-sm">
        <h2 className="text-xl font-display font-semibold text-white mb-2">Sign in to continue</h2>
        <p className="text-slate-400 text-sm mb-6">
          Create or join a board with your team to start splitting costs.
        </p>

        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-medium px-4 py-3 rounded-lg transition-all active:scale-95 disabled:opacity-60"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="mt-6 pt-6 border-t border-slate-700">
          <ul className="space-y-3 text-sm text-slate-400">
            {['Join or create shared cost boards', 'Split bills between 1–3 people', 'Monthly email reminders for open debts'].map(f => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span> {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-600">
        Your data is stored securely in Supabase.
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.29-8.16 2.29-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}
