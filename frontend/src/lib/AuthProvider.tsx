import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  user: any | null;
  role: 'ADMIN' | 'ANALYST' | 'GUEST';
  loading: boolean;
  signIn: (email: string) => Promise<{ requiresVerification?: boolean, error?: string }>;
  verifyCode: (email: string, code: string) => Promise<{ success?: boolean, error?: string }>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [role, setRole] = useState<'ADMIN' | 'ANALYST' | 'GUEST'>('GUEST');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('soc_token');
    const storedUser = localStorage.getItem('soc_user');
    
    if (token && storedUser) {
        const u = JSON.parse(storedUser);
        setUser(u);
        setRole(u.role || 'ANALYST');
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string) => {
    try {
        const res = await fetch('/api/login/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        
        if (data.error) return { error: data.error };
        return { requiresVerification: data.requiresVerification };
    } catch (e) {
        console.error("Login init failed", e);
        return { error: 'Connection failed' };
    }
  };

  const verifyCode = async (email: string, code: string) => {
    try {
        const res = await fetch('/api/login/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });
        const data = await res.json();
        
        if (data.error) return { error: data.error };
        
        localStorage.setItem('soc_token', data.token);
        localStorage.setItem('soc_user', JSON.stringify(data.user));
        
        setUser(data.user);
        setRole(data.user.role);
        return { success: true };
    } catch (e) {
        console.error("Login verify failed", e);
        return { error: 'Connection failed' };
    }
  };

  const logOut = async () => {
    localStorage.removeItem('soc_token');
    localStorage.removeItem('soc_user');
    setUser(null);
    setRole('GUEST');
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, verifyCode, logOut }}>
      {children}
    </AuthContext.Provider>
  );
};
