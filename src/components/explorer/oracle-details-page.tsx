"use client";

import { Copy, ExternalLink, RefreshCw, Rocket, X } from "lucide-react";
import type { Address } from "genlayer-js/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AddressText } from "@/components/address";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import type { Oracle, Transaction } from "@/lib/types";
import {
  decodeBase64,
  decodeCalldata,
  formatKey,
  getNodeConfigParticipants,
  normalizeLeaderReceipt,
  parseEqOutput,
  sanitizeTransactionForDisplay,
} from "@/lib/transactions";
import { useGenLayer } from "@/lib/use-genlayer";

interface OracleDetailsPageProps {
  address: string;
}

function formatDate(dateString?: string) {
  if (!dateString) return "Not specified";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function analysisText(analysis: Oracle["analysis"]) {
  if (!analysis) return "No analysis available";
  if (typeof analysis === "string") return analysis;
  const justification = analysis.justification || analysis.reasoning || analysis.raw;
  return typeof justification === "string" ? justification : "No analysis available";
}

export function OracleDetailsPage({ address }: OracleDetailsPageProps) {
  const {
    ready,
    oracles,
    loading,
    lastError,
    fetchOracle,
    fetchTransactions,
    resolveOracle,
  } = useGenLayer();
  const [oracle, setOracle] = useState<Oracle | undefined>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolutionEvidence, setResolutionEvidence] = useState("");
  const [resolutionError, setResolutionError] = useState("");
  const [resolving, setResolving] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    const cached = oracles.find((item) => item.address === address);
    if (cached) setOracle(cached);
  }, [address, oracles]);

  const refreshOracle = useCallback(async () => {
    if (!ready) return;
    const oracleAddress = address as Address;
    const [freshOracle, freshTransactions] = await Promise.all([
      fetchOracle(oracleAddress),
      fetchTransactions(oracleAddress),
    ]);
    setOracle(freshOracle);
    setTransactions(freshTransactions);
  }, [address, fetchOracle, fetchTransactions, ready]);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    const interval = window.setInterval(refresh, 5000);

    async function refresh() {
      if (cancelled) return;
      await refreshOracle();
      if (!cancelled && oracle?.status === "Resolved") {
        window.clearInterval(interval);
      }
    }

    void refresh();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [oracle?.status, ready, refreshOracle]);

  const selectedTransactionObject = useMemo(
    () => sanitizeTransactionForDisplay(selectedTransaction),
    [selectedTransaction],
  );
  const leaderReceipt = useMemo(
    () => normalizeLeaderReceipt(selectedTransaction?.consensus_data?.leader_receipt),
    [selectedTransaction],
  );
  const nodeConfigParticipants = useMemo(
    () => getNodeConfigParticipants(selectedTransaction),
    [selectedTransaction],
  );
  const decodedCalldata = useMemo(
    () => decodeCalldata(selectedTransactionObject?.data?.calldata),
    [selectedTransactionObject],
  );
  const prettyJson = useMemo(
    () => (selectedTransactionObject ? JSON.stringify(selectedTransactionObject, null, 2) : ""),
    [selectedTransactionObject],
  );

  async function copyTransaction() {
    if (!selectedTransaction) return;
    await navigator.clipboard.writeText(JSON.stringify(selectedTransaction, null, 2));
    setCopyStatus("Copied");
    window.setTimeout(() => setCopyStatus(""), 1500);
  }

  function openResolutionModal() {
    if (oracle?.resolution_urls && oracle.resolution_urls.length > 0) {
      void submitResolution("");
      return;
    }
    setResolutionEvidence("");
    setResolutionError("");
    setShowResolutionModal(true);
  }

  async function submitResolution(evidence: string) {
    try {
      setResolving(true);
      setResolutionError("");
      await resolveOracle(address as Address, evidence);
      await refreshOracle();
      setShowResolutionModal(false);
      setResolutionEvidence("");
    } catch (error) {
      console.error("Error resolving oracle:", error);
      setResolutionError(error instanceof Error ? error.message : "Resolution failed.");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-primary-text">
      <AppHeader active="explorer" />

      <main className="mx-auto max-w-7xl px-4 pb-10 pt-24 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary-text">{oracle?.title || "Oracle details"}</h1>
            <p className="mt-2 break-all font-mono text-sm text-secondary-text">
              <AddressText address={address} showFull />
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshOracle()}
              disabled={!ready || loading}
              className="inline-flex items-center gap-2 rounded-md border border-highlight px-4 py-2 text-sm font-medium text-highlight transition hover:bg-highlight hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </button>
            <button
              type="button"
              onClick={openResolutionModal}
              disabled={!oracle || resolving}
              className="inline-flex items-center gap-2 rounded-md bg-highlight px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              <Rocket className="h-4 w-4" aria-hidden />
              {resolving ? "Resolving..." : "Initiate Resolution"}
            </button>
          </div>
        </div>

        {lastError ? (
          <div className="mb-6 rounded-md border border-danger/20 bg-danger-soft p-4 text-sm text-danger">
            {lastError}
          </div>
        ) : null}

        {!oracle ? (
          <div className="rounded-md border border-border bg-surface p-8 text-center text-secondary-text">
            Loading oracle details...
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
            <section className="rounded-md border border-border bg-surface shadow-sm">
              <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold">Market</h2>
                  <p className="mt-1 text-sm text-secondary-text">{oracle.description}</p>
                </div>
                <StatusBadge status={oracle.status} />
              </div>

              <dl className="divide-y divide-border">
                <DetailRow label="Outcome" value={oracle.outcome || "Not yet determined"} show={Boolean(oracle.outcome)} />
                <DetailList label="Potential Outcomes" values={oracle.potential_outcomes} />
                <DetailList label="Rules" values={oracle.rules} />
                <DetailList
                  label="Data Source Domains"
                  values={oracle.data_source_domains}
                  emptyText="This oracle uses fixed resolution URLs."
                />
                <DetailList
                  label="Resolution URLs"
                  values={oracle.resolution_urls}
                  emptyText="This oracle uses dynamic evidence URLs."
                  linkValues
                />
                <DetailRow label="Earliest Resolution Date" value={formatDate(oracle.earliest_resolution_date)} />
                <DetailRow label="Analysis" value={analysisText(oracle.analysis)} multiline />
              </dl>
            </section>

            <section className="rounded-md border border-border bg-surface shadow-sm">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-lg font-semibold">Transactions</h2>
              </div>
              <div className="max-h-[calc(100vh-16rem)] space-y-3 overflow-y-auto p-4">
                {transactions.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-5 text-sm text-secondary-text">
                    No transactions found for this oracle.
                  </p>
                ) : null}
                {transactions.map((tx, index) => (
                  <button
                    type="button"
                    key={tx.hash || index}
                    onClick={() => setSelectedTransaction(tx)}
                    className="block w-full rounded-md border border-border bg-surface-muted p-4 text-left transition hover:border-highlight/40 hover:bg-highlight-soft/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-mono text-sm font-medium text-highlight">{tx.hash || "Unknown hash"}</p>
                      <StatusBadge status={tx.status} />
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-secondary-text">
                      <p>Created at: {formatDate(tx.created_at)}</p>
                      <p>Type: {tx.data?.contract_address ? "Deploy" : "Resolution"}</p>
                    </div>
                    {tx.status !== "PENDING" ? (
                      <div className="mt-3 text-sm">
                        <h3 className="font-medium text-primary-text">Validators and Votes</h3>
                        {tx.consensus_data?.votes && Object.entries(tx.consensus_data.votes).length > 0 ? (
                          <ul className="mt-1 space-y-1 text-secondary-text">
                            {Object.entries(tx.consensus_data.votes).map(([validator, vote]) => (
                              <li key={validator} className="break-all">
                                {validator}: {vote || "No vote"}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-secondary-text">Leader only execution</p>
                        )}
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {selectedTransaction ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-primary-text/50 p-4" onClick={() => setSelectedTransaction(null)}>
          <div className="mx-auto mt-12 max-w-5xl rounded-md border border-border bg-surface p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
              <h2 className="text-lg font-semibold">Transaction Details</h2>
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="rounded-md p-2 text-secondary-text transition hover:bg-surface-muted hover:text-primary-text"
                aria-label="Close transaction details"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="mt-5 space-y-6">
              <ModalSection title="General Information">
                <div className="grid gap-4 rounded-md bg-surface-muted p-4 md:grid-cols-2">
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Type:</span> {selectedTransactionObject?.data?.contract_address ? "Deploy" : "Resolution"}</p>
                    <p><span className="font-medium">Status:</span> {selectedTransactionObject?.status}</p>
                    <p><span className="font-medium">Appealed:</span> {selectedTransactionObject?.appealed ? "Yes" : "No"}</p>
                    <p><span className="font-medium">Created At:</span> {formatDate(selectedTransactionObject?.created_at)}</p>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">Calldata</p>
                    <div className="mt-2 rounded-md bg-surface p-3">
                      {decodedCalldata ? (
                        <>
                          <p><span className="font-medium">Method:</span> {decodedCalldata.method}</p>
                          {decodedCalldata.args ? <p className="mt-1 break-all"><span className="font-medium">Arguments:</span> {decodedCalldata.args}</p> : null}
                        </>
                      ) : (
                        <p className="text-secondary-text">No calldata available</p>
                      )}
                    </div>
                  </div>
                </div>
              </ModalSection>

              <ModalSection title="Leader Execution">
                <div className="rounded-md bg-surface-muted p-4 text-sm">
                  <p><span className="font-medium">Address:</span> {leaderReceipt?.node_config?.address || "Unknown"}</p>
                  <p className="mt-1"><span className="font-medium">Execution Result:</span> {leaderReceipt?.execution_result || "Unknown"}</p>
                  {leaderReceipt?.eq_outputs && Object.keys(leaderReceipt.eq_outputs).length > 0 ? (
                    <div className="mt-4 space-y-3">
                      <p className="font-medium">EQ Outputs</p>
                      {Object.entries(leaderReceipt.eq_outputs).map(([key, output]) => {
                        const decoded = decodeBase64(String(output));
                        const parsed = parseEqOutput(decoded);
                        return (
                          <div key={key} className="rounded-md bg-surface p-3">
                            {parsed ? (
                              <div className="space-y-2">
                                {Object.entries(parsed).map(([parsedKey, value]) => (
                                  <div key={parsedKey} className="border-b border-border pb-2 last:border-0 last:pb-0">
                                    <span className="font-medium">{formatKey(parsedKey)}:</span>
                                    <p className="mt-1 break-words text-secondary-text">{String(value)}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="break-all text-secondary-text">{decoded}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </ModalSection>

              <ModalSection title="Validators">
                <div className="grid gap-3 md:grid-cols-2">
                  {selectedTransactionObject?.consensus_data?.validators?.map((validator, index) => (
                    <div key={validator.node_config.address || index} className="rounded-md bg-surface-muted p-4 text-sm">
                      <p className="break-all"><span className="font-medium">Address:</span> {validator.node_config.address}</p>
                      <p className="mt-1"><span className="font-medium">Vote:</span> {validator.vote || "No vote"}</p>
                      <p className="mt-1"><span className="font-medium">Execution Result:</span> {validator.execution_result || "Unknown"}</p>
                    </div>
                  )) || <p className="text-sm text-secondary-text">No validators available.</p>}
                </div>
              </ModalSection>

              <ModalSection title="Node Configurations">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {nodeConfigParticipants.map((participant, index) => (
                    <div key={participant.node_config.address || index} className="rounded-md bg-surface-muted p-4 text-sm">
                      <p className="font-medium">{participant.mode === "leader" ? "Leader" : "Validator"}</p>
                      <p className="mt-1"><span className="font-medium">Provider:</span> {participant.node_config.provider || "Unknown"}</p>
                      <p className="mt-1"><span className="font-medium">Model:</span> {participant.node_config.model || "Unknown"}</p>
                      <p className="mt-1"><span className="font-medium">Stake:</span> {participant.node_config.stake ?? "Unknown"}</p>
                    </div>
                  ))}
                </div>
              </ModalSection>

              <ModalSection title="Raw Transaction Data">
                <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-primary-text p-4 text-sm text-white">
                  {prettyJson}
                </pre>
              </ModalSection>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => void copyTransaction()}
                  className="inline-flex items-center gap-2 rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent hover:text-white"
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  {copyStatus || "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTransaction(null)}
                  className="rounded-md bg-highlight px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showResolutionModal ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-primary-text/50 p-4" onClick={() => setShowResolutionModal(false)}>
          <div className="mx-auto mt-24 max-w-xl rounded-md border border-border bg-surface p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Provide a URL for resolution</h2>
              <button
                type="button"
                onClick={() => setShowResolutionModal(false)}
                className="rounded-md p-2 text-secondary-text transition hover:bg-surface-muted hover:text-primary-text"
                aria-label="Close resolution dialog"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <input
              value={resolutionEvidence}
              onChange={(event) => setResolutionEvidence(event.target.value)}
              className="mt-5 h-12 w-full rounded-md border border-border bg-surface px-3 outline-none focus:ring-2 focus:ring-highlight/30"
              placeholder="Enter evidence URL"
            />
            {resolutionError ? (
              <div className="mt-3 rounded-md border border-danger/20 bg-danger-soft p-3 text-sm text-danger">
                {resolutionError}
              </div>
            ) : null}
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void submitResolution(resolutionEvidence)}
                disabled={resolving}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                {resolving ? "Submitting..." : "Submit Resolution"}
              </button>
              <button
                type="button"
                onClick={() => setShowResolutionModal(false)}
                className="rounded-md border border-highlight px-4 py-2 text-sm font-medium text-highlight transition hover:bg-highlight hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  show = true,
  multiline = false,
}: {
  label: string;
  value?: string;
  show?: boolean;
  multiline?: boolean;
}) {
  if (!show) return null;
  return (
    <div className="grid gap-2 px-5 py-4 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-secondary-text">{label}</dt>
      <dd className={`text-sm text-primary-text sm:col-span-2 ${multiline ? "whitespace-pre-wrap break-words" : ""}`}>
        {value || "Not specified"}
      </dd>
    </div>
  );
}

function DetailList({
  label,
  values,
  emptyText = "None",
  linkValues = false,
}: {
  label: string;
  values?: string[];
  emptyText?: string;
  linkValues?: boolean;
}) {
  return (
    <div className="grid gap-2 px-5 py-4 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-secondary-text">{label}</dt>
      <dd className="text-sm text-primary-text sm:col-span-2">
        {values && values.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5">
            {values.map((value) => (
              <li key={value} className="break-words">
                {linkValues ? (
                  <a href={value} target="_blank" rel="noreferrer" className="text-highlight hover:underline">
                    {value}
                  </a>
                ) : value}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-secondary-text">{emptyText}</span>
        )}
      </dd>
    </div>
  );
}

function ModalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}
