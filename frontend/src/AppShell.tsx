import type { ReactNode } from 'react';

export function AppShell({
  children,
  slotStatus,
}: {
  children: ReactNode;
  slotStatus?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground font-sans">
      <header
        role="banner"
        className="flex items-center gap-4 border-b border-line-strong px-4 py-3 text-sm"
      >
        <span className="w-exp font-extrabold tracking-tight">FantaAgent</span>
        <div className="ml-auto flex items-center gap-4">{slotStatus}</div>
      </header>
      <main role="main" className="p-4">
        {children}
      </main>
    </div>
  );
}
