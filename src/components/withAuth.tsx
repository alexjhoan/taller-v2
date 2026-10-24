import { ComponentType, useEffect } from "react";
import { useRouter } from "next/router";
import { useUserContext } from "@/context/UserContext";
import { AUTH_COOKIE_NAME } from "@/utils/const";

interface WithAuthOptions {
  roles?: Array<"admin" | "mechanic">;
  redirectTo?: string;
}

/**
 * HOC para proteger páginas que requieren autenticación.
 * Verifica JWT en cookie y rol del usuario.
 */
export function withAuth<P extends object>(WrappedComponent: ComponentType<P>, options: WithAuthOptions = {}) {
  const { roles, redirectTo = "/login" } = options;

  function WithAuthWrapper(props: P) {
    const router = useRouter();
    const { isAuthenticated, user, hydrated } = useUserContext();

    // Rol no permitido: no se renderiza el contenido, solo se redirige
    const roleDenied = !!(roles && user && !roles.includes(user.role));

    useEffect(() => {
      // Esperar a que UserContext hidrate la cookie: si no, un refresco redirigiría
      // a /login antes de saber si hay sesión (y login.tsx terminaría en "/")
      if (!hydrated) return;

      const token = document.cookie.split("; ").find((row) => row.startsWith(`${AUTH_COOKIE_NAME}=`));

      if (!token || !isAuthenticated) {
        router.replace(redirectTo);
        return;
      }

      if (roleDenied) {
        router.replace("/unauthorized");
      }
    }, [hydrated, isAuthenticated, roleDenied, router, redirectTo]);

    if (!isAuthenticated || roleDenied) {
      return (
        <div className='flex min-h-dvh items-center justify-center bg-surface-base'>
          <div className='animate-pulse text-sm text-slate-400'>Cargando...</div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  }

  WithAuthWrapper.displayName = `WithAuth(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;

  return WithAuthWrapper;
}
