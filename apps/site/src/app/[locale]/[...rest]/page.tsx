import { notFound } from 'next/navigation';

// Funnels every unmatched URL under [locale] into the localized not-found
// page (issue #350): without this catch-all, unknown routes fall through to
// Next's default unstyled 404
export default function CatchAllPage() {
  notFound();
}
