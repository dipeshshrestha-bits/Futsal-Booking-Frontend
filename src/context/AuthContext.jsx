import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react'
import { isTokenValid, tokenStore } from '../services/api'

const AuthContext = createContext(null)

// Owner and Admin sessions are stored separately so one never unlocks the other.
function loadInitialState() {
  return {
    owner: tokenStore.read('owner'),
    admin: tokenStore.read('admin'),
  }
}

function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, [action.area]: action.session }
    case 'LOGOUT':
      return { ...state, [action.area]: null }
    case 'UPDATE_USER':
      return state[action.area]
        ? { ...state, [action.area]: { ...state[action.area], user: action.user } }
        : state
    case 'PASSWORD_CHANGED':
      return state[action.area]
        ? { ...state, [action.area]: { ...state[action.area], mustChangePassword: false } }
        : state
    case 'SYNC':
      return loadInitialState()
    default:
      return state
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, undefined, loadInitialState)

  // Keep sessions in sync across browser tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (!e.key || e.key.startsWith('owner_') || e.key.startsWith('admin_')) {
        dispatch({ type: 'SYNC' })
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /** area: 'owner' | 'admin'; response: { token, role, mustChangePassword, user } */
  const login = useCallback((area, response) => {
    const session = tokenStore.write(area, response) // throws on role mismatch
    dispatch({ type: 'LOGIN', area, session })
    return session
  }, [])

  const logout = useCallback((area) => {
    tokenStore.clear(area)
    dispatch({ type: 'LOGOUT', area })
  }, [])

  const markPasswordChanged = useCallback((area) => {
    tokenStore.setMustChangePassword(area, false)
    dispatch({ type: 'PASSWORD_CHANGED', area })
  }, [])

  const updateUser = useCallback((area, user) => {
    try {
      localStorage.setItem(`${area}_user`, JSON.stringify(user ?? null))
    } catch {
      /* storage unavailable: keep in memory only */
    }
    dispatch({ type: 'UPDATE_USER', area, user })
  }, [])

  /** Returns the session only if its token is still valid for that area. */
  const getSession = useCallback(
    (area) => {
      const session = state[area]
      if (!session) return null
      return isTokenValid(session.token, area) ? session : null
    },
    [state]
  )

  const value = useMemo(
    () => ({
      owner: state.owner,
      admin: state.admin,
      getSession,
      isAuthenticated: (area) => Boolean(getSession(area)),
      login,
      logout,
      markPasswordChanged,
      updateUser,
    }),
    [state, getSession, login, logout, markPasswordChanged, updateUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// The hook intentionally shares this module with its provider so both use the
// same private context instance.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
