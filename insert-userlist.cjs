const fs = require('fs');
let content = fs.readFileSync('src/components/ReceptionCheckinWizard.tsx', 'utf-8');

// Insert userListContent before the return statement
const insertCode = `
  // Renderizar lista de usuarios para el modal (evita ternarios inline problemáticos)
  const userListContent = usersLoading ? (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      <span className="ml-2 text-slate-500">Cargando usuarios...</span>
    </div>
  ) : filteredUsers && filteredUsers.length === 0 ? (
    <p className="text-center text-slate-500 py-4">No hay usuarios disponibles con este filtro</p>
  ) : (
    <>
      {filteredUsers?.map((user) => {
        const isAssigned = formData.assigned_user_id.includes(user.id);
        return (
          <label
            key={user.id}
            className={\`flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer \${isAssigned ? "border-brand-300 bg-brand-50" : "border-slate-100 hover:bg-slate-50"}\`}
          >
            <input
              type="checkbox"
              checked={isAssigned}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  assigned_user_id: e.target.checked
                    ? [...prev.assigned_user_id, user.id]
                    : prev.assigned_user_id.filter((id) => id !== user.id),
                }));
              }}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-800 truncate">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <CustomBadge
              variant={user.role === "admin" ? "brand" : "info"}
              className="whitespace-nowrap"
            >
              {user.role === "admin" ? "Admin" : "Mecánico"}
            </CustomBadge>
          </label>
        );
      })}
    </>
  );

`;

const lines = content.split('\n');
const returnIdx = lines.findIndex(l => l.trim() === 'return (');
if (returnIdx >= 0) {
  lines.splice(returnIdx, 0, insertCode);
  fs.writeFileSync('src/components/ReceptionCheckinWizard.tsx', lines.join('\n'));
  console.log('Inserted userListContent before return at line', returnIdx + 1);
} else {
  console.log('Could not find return statement');
}