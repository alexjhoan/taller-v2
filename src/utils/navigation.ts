import { Car, Users, ClipboardList, LayoutDashboard, History, MessageSquare, DollarSign, LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  adminOnly?: boolean;
}

export const navigationItems: NavItem[] = [
  {
    href: "/admin/dashboard",
    label: "Dashboard Admin",
    description: "Gestión de vehículos y usuarios",
    icon: LayoutDashboard,
    color: "purple",
    adminOnly: true,
  },
  {
    href: "/admin/history",
    label: "Historial de Órdenes",
    description: "Órdenes entregadas",
    icon: History,
    color: "rose",
    adminOnly: true,
  },
  {
    href: "/admin/tickets",
    label: "Tickets (Admin)",
    description: "Gestión de soporte y sugerencias",
    icon: MessageSquare,
    color: "blue",
    adminOnly: true,
  },
  {
    href: "/admin/payments",
    label: "Pagos",
    description: "Historial y totales de ingresos",
    icon: DollarSign,
    color: "emerald",
    adminOnly: true,
  },
  {
    href: "/support/create",
    label: "Soporte / Sugerencia",
    description: "Crear un ticket de ayuda",
    icon: MessageSquare,
    color: "emerald",
  },
  {
    href: "/reception/checkin",
    label: "Recepción de Vehículo",
    description: "Check-in de patio",
    icon: Car,
    color: "brand",
  },
  {
    href: "/technician/order",
    label: "Vista del Técnico",
    description: "Orden de trabajo asignada",
    icon: ClipboardList,
    color: "emerald",
  },
];
