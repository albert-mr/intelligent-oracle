import Image from "next/image";
import Link from "next/link";

interface AppHeaderProps {
  active: "assistant" | "explorer";
  oracleAddress?: string;
}

export function AppHeader({ active, oracleAddress }: AppHeaderProps) {
  const explorerHref = oracleAddress ? `/oracle/${oracleAddress}` : "/explorer";

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3" aria-label="Intelligent Oracle assistant">
          <Image src="/intelligent-oracle-logo.svg" alt="" width={168} height={32} priority className="h-8 w-auto" />
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/"
            className={active === "assistant" ? "font-semibold text-primary-text" : "text-secondary-text hover:text-primary-text"}
          >
            Assistant
          </Link>
          <Link
            href={explorerHref}
            className={active === "explorer" ? "font-semibold text-primary-text" : "text-secondary-text hover:text-primary-text"}
          >
            Explorer
          </Link>
        </nav>
      </div>
    </header>
  );
}
