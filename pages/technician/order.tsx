import { TechnicianOrderView } from '@/components/TechnicianOrderView';
import { withAuth } from '@/components/withAuth';
import { Layout } from '@/components/Layout';

function TechnicianOrderPage() {
  return (
    <Layout>
      <TechnicianOrderView />
    </Layout>
  );
}

export default withAuth(TechnicianOrderPage, {
  roles: ['admin', 'mechanic'],
  redirectTo: '/login',
});
