# ESPECIFICACIÓN TÉCNICA FRONTEND: MECAFLOW WORKSHOP OS
**Versión:** 1.0.0  
**Stack Recomendado:** Next.js (App Router) / React + Tailwind CSS + Lucide Icons + Radix UI / Headless UI  
**Diseño Base:** Sistema "Industrial Precision" (Primary: `#1D4ED8`, Neutrales fríos, tipografía Plus Jakarta Sans).

---

## 1. Visión General del Producto y Roles

Mecaflow es un SaaS operativo para talleres mecánicos enfocado en transparencia, trazabilidad y control en tiempo real mediante interfaces Mobile-First y Desktop.

### Roles y Vistas Clave:
1. **Asesor de Patio / Recepción (Mobile Check-in):** Captura ágil de datos de cliente, placa colombiana, odómetro, combustible, checklist de trabajos iniciales y nota de voz.
2. **Mecánico de Taller (Mobile Fosa/Bahía):** Visualización de labor asignada, checklist de ejecución, registro de repuestos requeridos (sin visibilidad de costos/márgenes COP) y carga de evidencias.
3. **Cliente / Propietario (Mobile-First Web App sin login):** Acceso por token único (link de WhatsApp) para seguimiento de estatus, cotizador interactivo en COP (aprobar, declinar o preguntar por repuestos) y visor de evidencias fotográficas/voz.
4. **Administrador de Taller (Web Desktop / Mobile Tab):** Monitoreo global de flujo de órdenes, estados de bahías, facturación y aprobaciones.

---

## 2. Design System & Configuración Tailwind CSS

### `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#1d4ed8', // Color Primario Mecaflow
          700: '#1e40af',
          900: '#1e3a8a',
        },
        surface: {
          base: '#faf8ff',
          card: '#ffffff',
          dim: '#f2f3ff',
          border: '#e2e8f0',
        },
        status: {
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          info: '#0284c7',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 10px -2px rgba(0, 0, 0, 0.05), 0 1px 3px -1px rgba(0, 0, 0, 0.03)',
        floating: '0 10px 25px -5px rgba(29, 78, 216, 0.15)',
      },
      borderRadius: {
        card: '0.875rem', // 14px
      }
    },
  },
  plugins: [],
}
```

---

## 3. Modelo de Datos (TypeScript Interfaces)

```typescript
export type OrderStatus = 'RECEPCION' | 'DIAGNOSTICO' | 'TALLER' | 'CALIDAD' | 'ENTREGA' | 'FINALIZADO';
export type FuelLevel = 'E' | '1/4' | '1/2' | '3/4' | 'F';
export type PartApprovalStatus = 'APROBADO' | 'PENDIENTE' | 'RECHAZADO';
export type PartCriticality = 'CRITICO' | 'PREVENTIVO' | 'RECOMENDADO';

export interface Customer {
  id: string;
  name: string;
  documentType: 'CC' | 'NIT' | 'CE' | 'PASAPORTE';
  documentNumber: string;
  phoneWhatsapp: string;
  email: string;
  isFrequentOrFleet: boolean;
}

export interface Vehicle {
  plate: string;          // Ej: "FVM309"
  city: string;           // Ej: "Bogotá D.C."
  brandLine: string;      // Ej: "Mazda CX-5 Grand Touring"
  year: number;
  color: string;
  odometer: number;       // En KM
  fuelLevel: FuelLevel;
}

export interface WorkChecklistItem {
  id: string;
  title: string;
  category: 'FRENOS' | 'DIAGNOSTICO' | 'MANTENIMIENTO' | 'SUSPENSION' | 'ELECTRICO';
  estimatedMinutes?: number;
  priority: 'ALTA' | 'MEDIA' | 'BAJA';
  completed: boolean;
}

export interface RequiredPart {
  id: string;
  name: string;
  reference: string;
  quantity: number;
  unitPriceCOP: number;   // Visible solo para Admin y Cliente, NUNCA para técnico
  criticality: PartCriticality;
  approvalStatus: PartApprovalStatus;
  requestedByTechnician: boolean;
  notes?: string;
}

export interface PhotoEvidence {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  criticality: 'CRITICO' | 'RECOMENDADO' | 'INFORMATIVO';
  timestamp: string;
  metricComparison?: {
    measured: string;     // Ej: "1.4mm"
    safeMinimum: string;  // Ej: "3.5mm"
    percentageWear: number;
  };
  linkedPartId?: string;
}

export interface WorkOrder {
  id: string;
  orderNumber: string;    // Ej: "OT-1098"
  customer: Customer;
  vehicle: Vehicle;
  status: OrderStatus;
  entryReason: string;
  audioNoteUrl?: string;
  audioDuration?: string;
  audioTranscription?: string;
  checklist: WorkChecklistItem[];
  requiredParts: RequiredPart[];
  laborCostCOP: number;
  taxRate: number;        // 0.19 para Colombia (IVA 19%)
  assignedBay: string;
  assignedTechnician: {
    id: string;
    name: string;
    specialty: string;
    avatarUrl?: string;
  };
  publicToken: string;    // Token de acceso para link de cliente sin login
}
```

---

## 4. Pantallas y Reglas de Negocio por Componente

### Pantalla 1: Check-in Móvil de Recepción (`/reception/checkin`)
* **Header:** Tag con `#OT-XXXX`, reloj en tiempo real, badge de estado y progreso (50% - Paso 1).
* **Tarjeta de Placa Colombiana:** Visual styling amarillo de placa vehicular (`bg-amber-300 text-neutral-900 border-2 border-neutral-900 font-extrabold`).
  * Botón: *Escanear Placa con Cámara (OCR)* -> Debe integrar hook de captura de imagen o API OCR.
* **Fuel Level Picker:** 5 segmentos interactivos (`E`, `1/4`, `1/2`, `3/4`, `F`). Solo 1 activo a la vez.
* **Grabador de Audio / Dictado:** Integrar Web MediaStream Audio Recording para capturar la queja o ruido del vehículo; preview con reproducción y duración.
* **Checklist Dinámico:**
  * Input de texto + Selector de categoría + Botón `+ Agregar`.
  * Quick-chips de patio (1 solo clic para añadir: *+ Revisión de Frenos*, *+ Escaneo OBD2*, etc.).
  * Switch: *"Ocultar costos comerciales a técnicos"* (Default: `true`).

---

### Pantalla 2: Vista del Mecánico (`/technician/order/[id]`)
* **REGLA DE ORO DE SEGURIDAD (Backend & Frontend):** 
  * El endpoint o props de esta vista **NO deben incluir** valores monetarios en COP (`unitPriceCOP`, márgenes, totales de mano de obra). El técnico únicamente ve nombres de piezas, referencias, cantidades y estatus de aprobación.
* **Sección "Repuestos Necesarios & Solicitados":**
  * Listado con estado: `Aprobado por Cliente ✓`, `Pendiente Aprobación Cliente 💬`.
  * Botón táctil: `+ Solicitar Nuevo Repuesto Necesario`. Abre modal rápido con nombre de repuesto, cantidad y foto/motivo técnico. Al enviar, pasa al estado `PENDIENTE` y notifica al cliente.
* **Checklist de Ejecución Técnica:** Checkboxes táctiles grandes para marcar labores terminadas durante el desarme.
* **Carga de Evidencias:** Botón directo para tomar foto o video con la cámara del teléfono e indexarla a la orden.

---

### Pantalla 3: Portal Web del Cliente - Cotizador y Diagnóstico (`/portal/[token]`)
* **Acceso Tokenizado:** Sin login ni credenciales; el `token` valida la sesión contra la orden activa.
* **Vehicle Tracker:** Barra de 5 pasos tipo stepper con estado actual resaltado.
* **Banner de Evidencias:** 
  * No mezclar fotos invasivas dentro del cotizador; incluir banner prominente: *"Inspección & Evidencias del Taller (X Novedades)"* con botón que abre la vista/modal de evidencias.
* **Cotizador Interactivo en COP:**
  * Cada repuesto/servicio cuenta con 3 acciones:
    1. **Aprobar:** Switch activado. Suma automáticamente al subtotal.
    2. **Declinar:** Switch desactivado. Descuenta el valor en tiempo real y marca badge "Omitido".
    3. **Preguntar / Consultar:** Botón `💬 ¿Dudas? Preguntar sobre este repuesto`. Abre enlace de WhatsApp directo:
       ```typescript
       const buildWhatsAppUrl = (phone: string, partName: string, orderNumber: string) => {
         const text = encodeURIComponent(`Hola Carlos, tengo una duda sobre el repuesto "${partName}" de mi orden #${orderNumber}. ¿Me puedes brindar más detalles?`);
         return `https://wa.me/${phone}?text=${text}`;
       };
       ```
* **Cálculo Financiero Dinámico (COP):**
  * `Subtotal = ManoDeObra + Suma(RepuestosAprobados)`
  * `IVA = Subtotal * 0.19`
  * `Total = Subtotal + IVA`
  * Formateador de moneda: `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`.
* **Sticky Footer Bar:** Muestra el total aprobado y CTA primario: *"Aceptar y Continuar Presupuesto"*.

### Pantalla 4: Visor de Evidencias Multimedia (`/portal/[token]/evidence`)
* **Diagnóstico Oficial:** Ficha con odómetro, hora de inspección y nivel de severidad.
* **Audio del Mecánico:** Reproductor de nota de voz con visualizador de ondas y transcripción textual automática.
* **Tarjetas Fotográficas de Hallazgos:**
  * Fotografía ampliable (Lightbox / pinch-to-zoom).
  * Comparador métrico visual: barra de desgaste con tolerancia mínima segura.
  * Botón de vinculación con la pieza de presupuesto asociada.
