# Constitución Mecaflow Workshop OS

1. **Stack fijo**: Next.js 14 Pages Router + React 18 + TypeScript + Tailwind CSS. No añadir librerías UI ni frameworks de estado sin aprobación.
2. **Spec primero**: Toda funcionalidad nace en API_FRONTEND.md o uix.md. El código refleja la spec; si diverge, se actualiza la spec.
3. **Separación estricta**: Componentes en `src/components/`, lógica de datos en `src/services/`, estado global en `src/context/`. Un componente nunca hace fetch directo.
4. **Sin tests automatizados**: Verificación obligatoria con `npm run lint && npm run typecheck`. Ningún PR se fusiona si falla.
5. **Español en el código**: Comentarios, variables, textos UI y commits en español. Nombres técnicos en inglés cuando sea convención (useEffect, props).
6. **API en snake_case**: Los payloads usan exactamente los nombres de columnas MySQL. Prohibido camelCase en datos de API.
