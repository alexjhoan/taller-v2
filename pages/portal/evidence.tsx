import { useRouter } from 'next/router';
import { EvidenceGalleryModal } from '@/components/EvidenceGalleryModal';

export default function EvidencePage() {
  const router = useRouter();
  const { token } = router.query;

  return <EvidenceGalleryModal token={token as string} />;
}
