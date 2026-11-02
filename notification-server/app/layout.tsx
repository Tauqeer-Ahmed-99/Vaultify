import type { ReactNode } from 'react';

// Framework shell for Next.js error responses; this application exposes APIs only.
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
