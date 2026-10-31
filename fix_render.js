const fs = require('fs');
const content = fs.readFileSync('src/components/WorkOrderList.tsx', 'utf8');

const oldCode = `) : visibleOrders.length > 0 ? (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onSelect={onSelectOrder}
              dateLabel='created'
              assignedUsers={toNumericIdArray(order.assigned_user_id)
                .map((id) => usersMap.get(id))
                .filter((u): u is UserType => !!u)}
            />
          ))}
        </div>
      ) : (
        <div className='py-12 text-center'>
          <FileText className='mx-auto h-12 w-12 text-slate-300' />
          <p className='mt-3 text-sm font-medium text-slate-400'>
            {query
              ? 'No se encontraron órdenes'
              : statusFilter !== ALL_STATUSES_VALUE && orders.length > 0
                ? 'No hay órdenes con este estado'
                : 'No hay órdenes de trabajo'}
          </p>
        </div>
      )}`;

const newCode = `) : filteredOrders.length > 0 ? (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onSelect={onSelectOrder}
              dateLabel='created'
              assignedUsers={toNumericIdArray(order.assigned_user_id)
                .map((id) => usersMap.get(id))
                .filter((u): u is UserType => !!u)}
            />
          ))}
        </div>
      ) : (
        <div className='py-12 text-center'>
          <FileText className='mx-auto h-12 w-12 text-slate-300' />
          <p className='mt-3 text-sm font-medium text-slate-400'>
            {query
              ? 'No se encontraron órdenes'
              : pendingFilter
                ? 'No hay órdenes con solicitudes pendientes'
                : statusFilter !== ALL_STATUSES_VALUE && orders.length > 0
                  ? 'No hay órdenes con este estado'
                  : 'No hay órdenes de trabajo'}
          </p>
        </div>
      )}`;

const newContent = content.replace(oldCode, newCode);
fs.writeFileSync('src/components/WorkOrderList.tsx', newContent, 'utf8');
console.log('Done');