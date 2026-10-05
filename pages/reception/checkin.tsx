import { ReceptionCheckinForm } from '@/components/ReceptionCheckinForm';
import { withAuth } from '@/components/withAuth';
import { Layout } from '@/components/Layout';

function ReceptionCheckinPage() {
  return (
    <Layout>
      <ReceptionCheckinForm />
    </Layout>
  );
}

export default withAuth(ReceptionCheckinPage, {
  roles: ['admin', 'mechanic'],
  redirectTo: '/login',
});
