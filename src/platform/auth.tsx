import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  Auth,
  User,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ auth, children }: { auth: Auth; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void setPersistence(auth, browserLocalPersistence).catch(() => {
      setError('This browser could not persist the admin session.');
    });
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    }, () => {
      setError('The authentication service is unavailable.');
      setLoading(false);
    });
  }, [auth]);

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    error,
    async signIn(email, password) {
      setError(null);
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch {
        setError('Sign-in failed. Check your account and try again.');
      }
    },
    async signOut() {
      await signOut(auth);
    },
  }), [auth, error, loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAdminAuth must be used within AuthProvider.');
  return value;
}
