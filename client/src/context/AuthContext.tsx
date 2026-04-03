import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from "@/services/api";

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  loginUser: (payload: { email: string; password: string }) => Promise<void>;
  registerUser: (payload: {
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logoutUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const extractUser = (data: any): AuthUser | null => {
  if (!data?.user) {
    return null;
  }

  const { id, name, email } = data.user;
  if (!id || !email) {
    return null;
  }

  return {
    id: String(id),
    name: String(name || ""),
    email: String(email),
  };
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await getCurrentUser();
      setUser(extractUser(data));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await refreshUser();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [refreshUser]);

  const loginUser = useCallback(
    async (payload: { email: string; password: string }) => {
      const data = await loginRequest(payload);
      const authUser = extractUser(data);
      setUser(authUser);
    },
    [],
  );

  const registerUser = useCallback(
    async (payload: { name: string; email: string; password: string }) => {
      await registerRequest(payload);
      await loginUser({ email: payload.email, password: payload.password });
    },
    [loginUser],
  );

  const logoutUser = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Ignore logout request errors and still clear local auth state.
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, loginUser, registerUser, logoutUser, refreshUser }),
    [user, loading, loginUser, registerUser, logoutUser, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};
