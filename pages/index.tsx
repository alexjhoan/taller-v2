import { Wrench } from 'lucide-react';
import { useUserContext } from '@/context/UserContext';
import { withAuth } from '@/components/withAuth';
import { Layout } from '@/components/Layout';

export const dynamic = 'force-dynamic';

function HomePage() {
  const { user } = useUserContext();

  return (
    <Layout>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 shadow-floating">
              <Wrench className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Mecaflow Workshop OS
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Bienvenido, {user?.firstName}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default withAuth(HomePage, {
  roles: ['admin', 'mechanic'],
  redirectTo: '/login',
});
