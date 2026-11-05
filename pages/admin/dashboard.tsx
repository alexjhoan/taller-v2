import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { FileText, Users, Loader2, AlertCircle, RefreshCw, UserPlus, Calendar, Clock, Wrench, Users as UsersIcon, Settings, BarChart2, Shield } from "lucide-react";
import { withAuth } from "@/components/withAuth";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomBadge } from "@/components/ui/CustomBadge";
import { CustomButton } from "@/components/ui/CustomButton";
import { Layout } from "@/components/Layout";
import { useWorkOrders, WorkOrder } from "@/hooks/useWorkOrders";
import { useUsers, User } from "@/hooks/useUsers";
import { AdminOrderDetail } from "@/components/AdminOrderDetail";
import { AdminUserDetail } from "@/components/AdminUserDetail";
import { CreateUserModal } from "@/components/CreateUserModal";
import { WorkOrderList } from "@/components/WorkOrderList";

export const dynamic = 'force-dynamic';

type Tab = "orders" | "users";

function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);

  const {
    data: workOrders,
    isLoading: isLoadingOrders,
    error: ordersError,
    refetch: refetchOrders,
    isFetching: isFetchingOrders,
  } = useWorkOrders();
  const {
    data: users,
    isLoading: isLoadingUsers,
    error: usersError,
    refetch: refetchUsers,
    isFetching: isFetchingUsers,
  } = useUsers();

  // Refrescar automáticamente al montar el componente
  useEffect(() => {
    refetchOrders();
    refetchUsers();
  }, [refetchOrders, refetchUsers]);

  // Push history state cuando se selecciona una orden o usuario
  const handleSelectOrder = (order: WorkOrder) => {
    setSelectedOrder(order);
    setSelectedUser(null);
    // Sincronizar URL para que router.back() funcione correctamente
    router.push(`/admin/dashboard?selectedOrderId=${order.id}`, undefined, { shallow: true });
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setSelectedOrder(null);
    router.push(`/admin/dashboard?selectedUserId=${user.id}`, undefined, { shallow: true });
  };

  const handleBackFromDetail = () => {
    setSelectedOrder(null);
    setSelectedUser(null);
    router.back();
  };

  // Restaurar selección desde URL (cuando se vuelve de order-log o navegación atrás)
  useEffect(() => {
    const { selectedOrderId, selectedUserId } = router.query;
    if (selectedOrderId && workOrders) {
      const order = workOrders.find((o) => o.id == Number(selectedOrderId));
      if (order) {
        setSelectedOrder(order);
        setSelectedUser(null);
      }
    } else if (selectedUserId && users) {
      const user = users.find((u) => u.id == Number(selectedUserId));
      if (user) {
        setSelectedUser(user);
        setSelectedOrder(null);
      }
    } else if (!selectedOrderId && !selectedUserId) {
      // Si no hay query params, limpiar selección (navegación atrás natural)
      setSelectedOrder(null);
      setSelectedUser(null);
    }
  }, [router.query, workOrders, users]);

  // Si hay una orden seleccionada, mostrar el detalle
  if (selectedOrder !== null) {
    return (
      <Layout>
        <div className='mx-auto max-w-4xl p-6'>
          <AdminOrderDetail order={selectedOrder} onBack={handleBackFromDetail} />
        </div>
      </Layout>
    );
  }

  // Si hay un usuario seleccionado, mostrar el detalle
  if (selectedUser !== null) {
    return (
      <Layout>
        <div className='mx-auto max-w-4xl p-6'>
          <AdminUserDetail user={selectedUser} onBack={handleBackFromDetail} />
        </div>
      </Layout>
    );
  }

  // Helper para formatear fecha
  const formatDate = (date: Date) => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
  };

  const now = new Date();

  // Items de navegación para la sección inferior
  const navItems = [
    { icon: FileText, label: 'Órdenes', count: workOrders?.length ?? 0, color: 'bg-blue-50 text-blue-600 border-blue-200', iconColor: 'text-blue-600' },
    { icon: UsersIcon, label: 'Usuarios', count: users?.length ?? 0, color: 'bg-green-50 text-green-600 border-green-200', iconColor: 'text-green-600' },
    { icon: Wrench, label: 'Trabajos', count: workOrders?.filter(o => o.status === 'in_progress').length ?? 0, color: 'bg-amber-50 text-amber-600 border-amber-200', iconColor: 'text-amber-600' },
    { icon: Shield, label: 'Configuración', count: 0, color: 'bg-purple-50 text-purple-600 border-purple-200', iconColor: 'text-purple-600' },
  ];

  return (
    <Layout>
      <div className='mx-auto max-w-4xl space-y-6 p-6 pb-8'>
        {/* Header - User Info Section */}
        <CustomCard className='bg-gradient-to-r from-brand-50 to-brand-100 border-brand-200'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
            <div className='flex items-center gap-4'>
              <div className='flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 shadow-lg'>
                <UsersIcon className='h-8 w-8 text-white' />
              </div>
              <div>
                <h1 className='text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900'>
                  Dashboard del Administrador
                </h1>
                <p className='mt-1 text-sm text-slate-600'>
                  Bienvenido, <span className='font-semibold text-slate-900'>{router.query.userName || 'Administrador'}</span>
                </p>
              </div>
            </div>
            <div className='flex flex-col sm:flex-row items-start sm:items-center gap-3 text-right sm:text-left'>
              <div className='flex items-center gap-2 px-3 py-2 rounded-xl bg-white/70 border border-slate-200'>
                <Calendar className='h-4 w-4 text-slate-500' />
                <span className='text-sm font-medium text-slate-700'>{formatDate(now)}</span>
              </div>
              <div className='flex items-center gap-2 px-3 py-2 rounded-xl bg-white/70 border border-slate-200'>
                <Clock className='h-4 w-4 text-slate-500' />
                <span className='text-sm font-medium text-slate-700'>{now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
              </div>
              <CustomBadge variant='brand' dot className='px-3 py-1.5 text-sm'>
                Administrador
              </CustomBadge>
            </div>
          </div>
        </CustomCard>

        {/* Tabs */}
        <div className='flex gap-2 rounded-xl bg-slate-100 p-1.5'>
          <button
            onClick={() => setActiveTab("orders")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all ${
              activeTab === "orders" ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <FileText className='h-4 w-4' />
            Órdenes
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all ${
              activeTab === "users" ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <UsersIcon className='h-4 w-4' />
            Usuarios
          </button>
        </div>

        {/* Contenido */}
        {activeTab === "orders" ? (
          <WorkOrderList
            orders={workOrders ?? []}
            onSelectOrder={handleSelectOrder}
            isLoading={isLoadingOrders}
            error={!!ordersError}
            isFetching={isFetchingOrders}
            onRefresh={() => refetchOrders()}
            showPendingPartsCounter={true}
          />
        ) : (
          <CustomCard>
            <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
              <h3 className='text-sm font-bold text-slate-800'>Lista de Usuarios</h3>
              <div className='flex items-center gap-2'>
                <CustomButton
                  type='button'
                  variant='primary'
                  size='sm'
                  leftIcon={<UserPlus className='h-3.5 w-3.5' />}
                  onClick={() => setIsCreateUserOpen(true)}
                >
                  Nuevo Usuario
                </CustomButton>
                <CustomButton
                  type='button'
                  variant='secondary'
                  size='sm'
                  leftIcon={<RefreshCw className={`h-3 w-3 ${isFetchingUsers ? "animate-spin" : ""}`} />}
                  onClick={() => refetchUsers()}
                  isLoading={isFetchingUsers}
                >
                  Refrescar
                </CustomButton>
              </div>
            </div>

            {isLoadingUsers ? (
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='h-6 w-6 animate-spin text-brand-600' />
                <span className='ml-2 text-sm text-slate-500'>Cargando usuarios...</span>
              </div>
            ) : usersError ? (
              <div className='flex items-center justify-center py-12 text-red-500'>
                <AlertCircle className='h-6 w-6' />
                <span className='ml-2 text-sm'>Error al cargar usuarios</span>
              </div>
            ) : users && users.length > 0 ? (
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b border-slate-100'>
                      <th className='px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500'>
                        Nombre
                      </th>
                      <th className='px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500'>
                        Email
                      </th>
                      <th className='px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500'>
                        Rol
                      </th>
                      <th className='px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500'>
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-slate-50'>
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className='cursor-pointer hover:bg-slate-50'
                        onClick={() => handleSelectUser(user)}
                      >
                        <td className='px-4 py-3'>
                          <span className='font-bold text-slate-800'>
                            {user.first_name} {user.last_name}
                          </span>
                        </td>
                        <td className='px-4 py-3 text-sm text-slate-600'>{user.email}</td>
                        <td className='px-4 py-3'>
                          <CustomBadge variant={user.role === "admin" ? "brand" : "neutral"}>{user.role}</CustomBadge>
                        </td>
                        <td className='px-4 py-3'>
                          <CustomBadge variant={user.active ? "success" : "danger"} dot>
                            {user.active ? "Activo" : "Inactivo"}
                          </CustomBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className='py-12 text-center'>
                <UsersIcon className='mx-auto h-12 w-12 text-slate-300' />
                <p className='mt-3 text-sm font-medium text-slate-400'>No hay usuarios registrados</p>
              </div>
            )}
          </CustomCard>
        )}

        {/* Bottom Navigation Section - Sidebar-like items */}
        <CustomCard className='bg-slate-50 border-slate-200'>
          <h3 className='mb-4 text-sm font-bold text-slate-800 flex items-center gap-2'>
            <BarChart2 className='h-4 w-4 text-brand-600' />
            Accesos Rápidos
          </h3>
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
            {navItems.map((item, index) => (
              <CustomCard
                key={item.label}
                padding='md'
                hoverable
                className={`text-center transition-all duration-200 ${item.color} hover:shadow-md hover:scale-[1.02]`}
              >
                <div className='mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl'>
                  <item.icon className={`h-6 w-6 ${item.iconColor}`} />
                </div>
                <p className='text-sm font-semibold text-slate-800'>{item.label}</p>
                <p className='mt-1 text-2xl font-extrabold text-slate-900'>{item.count}</p>
              </CustomCard>
            ))}
          </div>
        </CustomCard>
      </div>
    </Layout>
  );
}

export default withAuth(AdminDashboardPage, {
  roles: ["admin"],
  redirectTo: "/login",
});