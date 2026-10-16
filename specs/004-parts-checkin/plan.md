# Plan de Implementación — Spec 004: Sección de Repuestos en Checkin

## Arquitectura

**Archivo principal:** `src/components/ReceptionCheckinForm.tsx`

**Enfoque:** Extender el formulario existente añadiendo estado local para repuestos (`parts[]`), UI para agregar/eliminar items, y serialización JSON en el payload al crear la orden. Patrón idéntico al checklist existente (`checklist[]`).

## Archivos a tocar

1. **`src/components/ReceptionCheckinForm.tsx`** — Único archivo modificado. Contiene:
   - Tipos: `PartItem` (id, name, quantity, unit_price)
   - Estado: `parts: PartItem[]` en `formData` o estado separado
   - Handlers: `addPart`, `removePart`, validación básica
   - UI: Sección "Repuestos solicitados" entre Checklist y Switch de seguridad
   - Serialización: `parts: JSON.stringify(formData.parts)` en `handleSubmit`

2. **`src/hooks/useCreateOrder.ts`** — Actualizar tipo `CreateOrderPayload` para incluir `parts?: string` (opcional, ya que el backend lo acepta).

## Decisiones de diseño

| Decisión | Alternativa descartada | Justificación |
|---|---|---|
| Estado `parts` dentro de `formData` (un solo objeto de estado) | Estado separado `const [parts, setParts] = useState<PartItem[]>([])` | Consistencia con `checklist` que ya está en `formData`; reset del formulario más simple |
| Validación no bloqueante (warning visual) | Validación bloqueante al submit | Requisito RF-6: "warning no bloqueante, solo aviso visual" |
| `unit_price` como `number | null` en JSON | Omitir campo si vacío | Backend espera `unit_price` nullable; snake_case obligatorio (RF-10) |
| Input de cantidad con `type="number"` + coerción a entero | Input texto + parse manual | Nativo del browser, UX estándar; forzar a 1 si inválido (caso límite) |
| Reutilizar `CustomCard`, `CustomInput`, `CustomButton`, `CustomBadge` | Crear componentes nuevos | RF-8: coherencia visual con checklist |

## Estrategia de tests

- **Sin suite de tests automatizados** (proyecto no tiene tests).
- Verificación manual + `npm run typecheck` + `npm run lint`.
- Casos a verificar manualmente:
  1. Agregar 1 repuesto con todos los campos → aparece en lista
  2. Agregar múltiples repuestos → todos visibles con botón eliminar
  3. Eliminar repuesto → desaparece inmediatamente
  4. Enviar formulario → `parts` llega como JSON string válido en payload
  5. Lista vacía → `parts: "[]"` u omitido
  6. Precio vacío → `unit_price: null` en JSON
  7. Cantidad no numérica → forzar a 1 + aviso visual
  8. Typecheck y lint pasan sin errores

## Cobertura de RF por archivo

| Archivo | RF cubiertos |
|---|---|
| `ReceptionCheckinForm.tsx` | RF-1, RF-2, RF-3, RF-4, RF-5, RF-6, RF-7, RF-8, RF-9, RF-10 |
| `useCreateOrder.ts` | RF-5 (tipo de payload) |

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Payload `parts` no serializado correctamente | Usar `JSON.stringify` igual que `checklist`; probar en devtools Network |
| Conflicto de tipos con `CreateOrderPayload` | Hacer `parts` opcional en el tipo; backend ya lo acepta |
| Re-renders excesivos por estado grande | `formData` ya usa actualizaciones funcionales; `parts` es array pequeño (<20 items típicos) |