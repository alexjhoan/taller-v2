import { ReceptionCheckinForm } from "@/components/ReceptionCheckinForm";
import { withAuth } from "@/components/withAuth";
import { Layout } from "@/components/Layout";
import { ReceptionCheckinWizard } from "@/components/ReceptionCheckinWizard";

export const dynamic = 'force-dynamic';

function ReceptionCheckinPage() {
  return (
    <Layout>
      <ReceptionCheckinWizard />
    </Layout>
  );
}

export default withAuth(ReceptionCheckinPage, {
  roles: ["admin", "mechanic"],
  redirectTo: "/login",
});
