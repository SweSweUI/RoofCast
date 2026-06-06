import { MethodologyContent } from '@/components/MethodologyContent';

// Methodology is no longer a primary nav tab — it lives inside Settings as
// supporting documentation. This route stays so existing deep-links and the
// inline "Methodology" references keep resolving; both render the same content.
export default function MethodologyPage() {
  return <MethodologyContent />;
}
