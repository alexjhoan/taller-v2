import { ReactNode, createContext, useContext, useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import { AUTH_COOKIE_NAME } from '@/utils/const';
import { setApiToken } from '@/services/api';

export type UserRole = 'admin' | 'mechanic';

export interface User {
  id: number;
  firstName: string;
  role: UserRole;
}

interface UserContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

const initialContext: UserContextType = {
  user: null,
  token: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
};

const UserContext = createContext<UserContextType>(initialContext);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [cookies, setCookie, removeCookie] = useCookies([AUTH_COOKIE_NAME]);

  // Cargar sesión desde cookie al montar
  useEffect(() => {
    const savedToken = cookies[AUTH_COOKIE_NAME];
    if (savedToken) {
      setToken(savedToken);
      setApiToken(savedToken);
      // Aquí podrías decodificar el JWT para obtener el usuario
      // o hacer una petición al backend para validar el token
      setUser({
        id: 1,
        firstName: 'Usuario',
        role: 'admin',
      });
    }
  }, [cookies]);

  const login = (userData: User, userToken: string) => {
    setUser(userData);
    setToken(userToken);
    setApiToken(userToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setApiToken(null);
    removeCookie(AUTH_COOKIE_NAME, { path: '/' });
  };

  const globalState: UserContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    login,
    logout,
  };

  return <UserContext.Provider value={globalState}>{children}</UserContext.Provider>;
}

export const useUserContext = () => useContext(UserContext);
