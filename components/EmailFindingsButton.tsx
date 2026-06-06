'use client';

import { useEffect, useMemo, useState } from 'react';

function buildMailto(subject: string, body: string) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function EmailFindingsButton({
  subject,
  body,
}: {
  subject: string;
  body: string;
}) {
  const [pageUrl, setPageUrl] = useState('');

  useEffect(() => {
    setPageUrl(window.location.href);
  }, []);

  const href = useMemo(() => {
    const footer = pageUrl ? `\n\nDashboard link:\n${pageUrl}` : '';
    return buildMailto(subject, `${body}${footer}`);
  }, [subject, body, pageUrl]);

  return (
    <a
      href={href}
      className="inline-flex items-center rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-ink-soft"
    >
      Email findings
    </a>
  );
}
