"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { AddressText } from "@/components/address";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { useGenLayer } from "@/lib/use-genlayer";

function formatDate(dateString?: string) {
  if (!dateString) return "Not specified";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleString();
}

export function ExplorerPage() {
  const { ready, oracles, loading, lastError, refreshOracles } = useGenLayer();

  useEffect(() => {
    if (!ready) return;
    void refreshOracles();
  }, [ready, refreshOracles]);

  const sortedOracles = [...oracles].reverse();

  return (
    <div className="min-h-screen bg-background text-primary-text">
      <AppHeader active="explorer" />

      <main className="mx-auto max-w-7xl px-4 pb-10 pt-24 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal text-primary-text">Intelligent Oracle Explorer</h1>
            <p className="mt-2 text-sm text-secondary-text">
              Monitor registered markets, resolutions, and validator transaction details.
            </p>
          </div>
          <button
            type="button"
            disabled={!ready || loading}
            onClick={() => void refreshOracles()}
            className="inline-flex w-fit items-center gap-2 rounded-md bg-highlight px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        {lastError ? (
          <div className="mt-6 rounded-md border border-danger/20 bg-danger-soft p-4 text-sm text-danger">
            {lastError}
          </div>
        ) : null}

        {sortedOracles.length === 0 && !loading ? (
          <div className="mt-10 rounded-md border border-dashed border-border bg-surface p-8 text-center text-secondary-text">
            No oracles found. Create one from the assistant or configure `NEXT_PUBLIC_IC_REGISTRY_ADDRESS`.
          </div>
        ) : null}

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sortedOracles.map((oracle) => (
            <Link
              key={oracle.address}
              href={`/oracle/${oracle.address}`}
              className="rounded-md border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="line-clamp-2 text-lg font-semibold text-primary-text">
                  {oracle.title || "Untitled oracle"}
                </h2>
                <StatusBadge status={oracle.status} />
              </div>

              <p className="mt-3 text-sm text-secondary-text">
                <AddressText address={oracle.address} />
              </p>

              {oracle.description ? (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold uppercase text-secondary-text">Description</h3>
                  <p className="mt-1 line-clamp-3 text-sm text-primary-text">{oracle.description}</p>
                </div>
              ) : null}

              {oracle.outcome ? (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold uppercase text-secondary-text">Outcome</h3>
                  <p className="mt-1 text-sm text-primary-text">{oracle.outcome}</p>
                </div>
              ) : null}

              <p className="mt-4 text-xs text-secondary-text">
                Earliest resolution: {formatDate(oracle.earliest_resolution_date)}
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
