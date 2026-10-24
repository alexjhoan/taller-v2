/**
 * Helpers puros del flujo de aprobación de repuestos (spec 008).
 *
 * Toda la lógica de negocio sobre `parts` (visibilidad en el portal,
 * permisos del técnico, botones de aprobación, precio al aprobar,
 * contador de pendientes e id de respaldo) vive aquí para poder testearla con
 * `node --test` sin backend y evitar nuevas copias en los componentes
 * (hoy ya hay 3 copias de getPartStatusBadge y 2 de serializeParts).
 */

/**
 * Forma estructural mínima de un repuesto que necesitan los helpers.
 *
 * `PartItem` (useWorkOrders) hoy declara approvalStatus y
 * requestedByTechnician como requeridos, pero la realidad es que los
 * repuestos de checkin/legacy NO los traen (RF-10 interim). Aquí van
 * OPCIONALES para que las comparaciones contra undefined compilen hoy y
 * sigan compilando cuando T-3 los haga opcionales en PartItem.
 */
export interface PartLike {
  unit_price?: number | null;
  approvalStatus?: string;
  requestedByTechnician?: boolean;
}

/**
 * Forma mínima de orden que necesita el contador del dashboard:
 * compatible con WorkOrder (cuyo `parts` es `PartItem[] | string`,
 * normalizado a array por parseWorkOrder).
 */
export interface OrderWithParts {
  parts?: PartLike[] | string | null;
}

/**
 * RF-7/RF-6 — Regla de visibilidad en el portal del cliente:
 * visible SI approvalStatus es undefined (legacy/checkin, que son parte
 * de la cotización inicial) O "accepted" (aceptado por el admin);
 * "pending" y "rejected" se ocultan.
 */
export function isPartVisibleInPortal(part: PartLike): boolean {
  return part.approvalStatus === undefined || part.approvalStatus === "accepted";
}

/**
 * RF-13/D2 — El técnico solo puede eliminar un repuesto SI fue él quien
 * lo solicitó (requestedByTechnician === true) Y no está aceptado por el
 * admin; nunca borra repuestos aceptados ni los agregados por el
 * admin/recepción.
 */
export function canTechnicianDeletePart(part: PartLike): boolean {
  return part.requestedByTechnician === true && part.approvalStatus !== "accepted";
}

/**
 * RF-2/RF-4 — Esquema de botones de estado por repuesto:
 * - "pending"  → Aceptar y Rechazar.
 * - "accepted" → solo Rechazar (deshacer la aceptación).
 * - "rejected" → solo Aceptar (deshacer el rechazo).
 * - undefined u otro (legacy/checkin) → ninguno (solo Editar/Eliminar).
 */
export function getPartActions(approvalStatus: string | undefined): {
  canApprove: boolean;
  canReject: boolean;
} {
  switch (approvalStatus) {
    case "pending":
      return { canApprove: true, canReject: true };
    case "accepted":
      return { canApprove: false, canReject: true };
    case "rejected":
      return { canApprove: true, canReject: false };
    default:
      return { canApprove: false, canReject: false };
  }
}

/**
 * RF-3 — El precio es necesario para el total del portal: si el repuesto
 * no tiene unit_price (undefined/null) o vale 0, hay que pedirlo antes
 * de aceptar.
 */
export function partNeedsPrice(part: PartLike): boolean {
  return part.unit_price === undefined || part.unit_price === null || part.unit_price === 0;
}

/**
 * Normaliza `parts` recibido de una orden a array de repuestos.
 * Tolerancias (RF-8): puede llegar como array (ya normalizado por
 * parseWorkOrder), como JSON string (columna TEXT sin parsear) o corrupto
 * → lista vacía, nunca lanza.
 */
function parseParts(value: unknown): PartLike[] {
  let list: unknown;

  if (Array.isArray(value)) {
    list = value;
  } else if (typeof value === "string") {
    try {
      list = JSON.parse(value);
    } catch {
      // JSON corrupto: degradar a vacío sin tumbar el contador.
      return [];
    }
  } else {
    return [];
  }

  if (!Array.isArray(list)) return [];
  // Descartar elementos que no sean objetos (arrays con basura).
  return list.filter((item): item is PartLike => typeof item === "object" && item !== null);
}

/**
 * RF-8 — Badge/contador del dashboard admin: número de órdenes que tienen
 * al menos un repuesto en approvalStatus "pending". Se calcula en
 * frontend con las órdenes ya cargadas (sin endpoint de notificación) y
 * se recalcula al refrescar la lista.
 */
export function countOrdersWithPendingParts(orders: readonly OrderWithParts[]): number {
  let count = 0;
  for (const order of orders) {
    const parts = parseParts(order.parts);
    if (parts.some((part) => part.approvalStatus === "pending")) {
      count += 1;
    }
  }
  return count;
}

/**
 * Serializa los repuestos para el payload descartando campos obsoletos
 * (reference). Conserva el resto de propiedades (unit_price, notes, etc.).
 * `reference` es un campo de display del frontend que NUNCA viaja al
 * backend; aquí vive unificado (antes duplicado en AdminOrderDetail y
 * TechnicianOrderDetail).
 */
export function serializeParts<T>(items: T[]): string {
  return JSON.stringify(
    items.map((item) => {
      const copy = { ...(item as Record<string, unknown>) };
      delete copy.reference;
      return copy;
    }),
  );
}

/**
 * T-14 — Asigna un id de respaldo a cada repuesto que llega sin él.
 *
 * El backend aún reconstruye `parts` y se queda solo con name/quantity/
 * unit_price/notes (RF-10 pendiente), así que una lista cargada puede
 * traer TODOS los repuestos con id undefined. Como las acciones por
 * repuesto del admin y del técnico comparan por p.id (filter/map), sin
 * este respaldo un solo clic borraría o editaría la lista entera.
 *
 * Se llama UNA sola vez en el useState inicial de AdminOrderDetail y
 * TechnicianOrderDetail: cada repuesto recibe un id estable para toda la
 * sesión y las acciones acierten siempre al suyo.
 *
 * - No muta el array de entrada: devuelve uno nuevo.
 * - Los items que ya traen id (también el numérico legacy) se conservan
 *   tal cual, por lo que el comportamiento no cambia cuando el backend sí
 *   lo devuelve ni para los repuestos creados por admin/técnico.
 * - `generateId` se inyecta (generateShortUid en los componentes y en los
 *   tests) porque parts.ts no puede importarlo: los tests cargan este
 *   archivo con el type stripping de Node, que no resuelve imports sin
 *   extensión, y tsc rechaza el sufijo `.ts` (TS5097) sin cambiar tsconfig.
 */
export function assignFallbackPartIds<T extends { id?: string }>(
  items: T[],
  generateId: () => string,
): T[] {
  return items.map((item) => {
    const id = item.id as unknown;
    // Sin id: ausente, null, "" o solo espacios. Cualquier otro valor
    // (string no vacío o id numérico legacy) se respeta.
    const sinId = id === undefined || id === null || (typeof id === "string" && id.trim() === "");
    return sinId ? ({ ...item, id: generateId() } as T) : item;
  });
}
