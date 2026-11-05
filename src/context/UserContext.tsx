import { ReactNode, createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useCookies } from 'react-cookie';
import { AUTH_COOKIE_NAME, SESSION_USER_COOKIE_NAME } from '@/utils/const';
import { setApiToken, setApiUser, setGlobalLogoutHandler } from '@/services/api';
import { restoreSessionUser, SESSION_MAX_AGE } from '@/utils/session';

export type UserRole = 'admin' | 'mechanic';

export interface User {
  /** Opcional: una sesión restaurada puede no traer el id (p.ej. JWT antiguo) */
  id?: number;
  firstName: string;
  /** Opcional: el endpoint de login puede no devolverlo */
  lastName?: string;
  role: UserRole;
}

interface UserContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  /** true cuando ya se leyó la cookie de sesión (evita redirecciones prematuras en refrescos) */
  hydrated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

const initialContext: UserContextType = {
  user: null,
  token: null,
  isAuthenticated: false,
  hydrated: false,
  login: () => {},
  logout: () => {},
};

const UserContext = createContext<UserContextType>(initialContext);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [cookies, setCookie, removeCookie] = useCookies([AUTH_COOKIE_NAME, SESSION_USER_COOKIE_NAME]);

  // Opciones idénticas para ambas cookies de sesión (token y datos de usuario)
  const sessionCookieOptions = { path: '/', maxAge: SESSION_MAX_AGE, sameSite: 'strict' } as const;

  // Función para limpiar completamente la sesión (estado + cookies + API)
  const clearSession = useCallback(() => {
    setUser(null);
    setToken(null);
    setApiToken(null);
    setApiUser(null);
    removeCookie(AUTH_COOKIE_NAME, { path: '/' });
    removeCookie(SESSION_USER_COOKIE_NAME, { path: '/' });
  }, []);

  // Registrar handler global de logout para que la API pueda limpiar la sesión en 401/403
  useEffect(() => {
    // El handler global debe limpiar TODO: estado + cookies + API
    const handleGlobalLogout = () => {
      setUser(null);
      setToken(null);
      setApiToken(null);
      setApiUser(null);
      // Limpiar cookies directamente (no usar removeCookie del hook para evitar dependencias)
      if (typeof document !== 'undefined') {
        document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict`;
        document.cookie = `${SESSION_USER_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict`;
      }
    };
    
    setGlobalLogoutHandler(handleGlobalLogout);
    
    return () => {
      setGlobalLogoutHandler(() => {});
    };
  }, []);

  // Restaurar sesión desde las cookies al montar
  useEffect(() => {
    const savedToken = cookies[AUTH_COOKIE_NAME];
    const token = typeof savedToken === 'string' ? savedToken : null;

    if (token) {
      // JWT (payload decodificado) + datos persistidos en el login → usuario real.
      // Si no hay datos recuperables NO se inventa usuario/rol: la sesión queda
      // inválida y withAuth redirige a /login.
      const restored = restoreSessionUser(token, cookies[SESSION_USER_COOKIE_NAME]);
      if (restored) {
        setUser(restored);
        setToken(token);
        setApiToken(token);
        setApiUser(restored);
      } else {
        // Token inválido o expirado: limpiar todo y no restaurar sesión
        // No redirigir aquí, dejar que withAuth maneje la redirección
        setUser(null);
        setToken(null);
        setApiToken(null);
        setApiUser(null);
        removeCookie(AUTH_COOKIE_NAME, { path: '/' });
        removeCookie(SESSION_USER_COOKIE_NAME, { path: '/' });
      }
    }
    setHydrated(true);
  }, [cookies]);

  const login = (userData: User, userToken: string) => {
    setUser(userData);
    setToken(userToken);
    setApiToken(userToken);
    setApiUser(userData);
    // Cookies de sesión en un solo lugar: el JWT para el backend y los datos
    // del usuario para restaurar nombre/rol al refrescar (F5).
    setCookie(AUTH_COOKIE_NAME, userToken, sessionCookieOptions);
    setCookie(SESSION_USER_COOKIE_NAME, userData, sessionCookieOptions);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setApiToken(null);
    setApiUser(null);
    removeCookie(AUTH_COOKIE_NAME, { path: '/' });
    removeCookie(SESSION_USER_COOKIE_NAME, { path: '/' });
  };

  const globalState: UserContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    hydrated,
    login,
    logout,
  };

  return <UserContext.Provider value={globalState}>{children}</UserContext.Provider>;
}

export const useUserContext = () => useContext(UserContext);