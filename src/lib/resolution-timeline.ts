import type { Oracle, Transaction, TransactionParticipant } from "@/lib/types";
import { getNodeConfigParticipants, normalizeLeaderReceipt } from "@/lib/transactions";

export interface ResolutionSummaryUnresolved {
  status: "unresolved";
  title?: string;
  description?: string;
  potentialOutcomes: string[];
  sources: ResolutionSource[];
  earliestResolutionDate?: string;
}

export interface ResolutionSummaryResolved {
  status: "resolved";
  title?: string;
  description?: string;
  outcome: string;
  potentialOutcomes: string[];
  sources: ResolutionSource[];
  validators: ResolutionValidator[];
  resolvedAt?: string;
}

export type ResolutionSummary = ResolutionSummaryUnresolved | ResolutionSummaryResolved;

export interface ResolutionSource {
  kind: "domain" | "url";
  value: string;
}

export interface ResolutionValidator {
  label: string;
  address?: string;
  role: "leader" | "validator";
  vote?: string;
  agreedWithOutcome?: boolean;
  reasoning: string;
}

function collectSources(oracle: Oracle): ResolutionSource[] {
  const sources: ResolutionSource[] = [];
  for (const value of oracle.data_source_domains ?? []) {
    if (value.trim()) sources.push({ kind: "domain", value });
  }
  for (const value of oracle.resolution_urls ?? []) {
    if (value.trim()) sources.push({ kind: "url", value });
  }
  return sources;
}

function isResolved(oracle: Oracle): boolean {
  if (typeof oracle.outcome === "string" && oracle.outcome.trim().length > 0) return true;
  return typeof oracle.status === "string" && oracle.status.toLowerCase() === "resolved";
}

function transactionTimestamp(transaction: Transaction): number {
  const candidate = transaction.created_at ?? transaction.createdTimestamp;
  if (!candidate) return 0;
  const date = candidate instanceof Date ? candidate : new Date(candidate);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function isCreationTransaction(transaction: Transaction): boolean {
  const data = transaction.data ?? {};
  const decoded = transaction.txDataDecoded ?? {};
  return Boolean(
    (data as Record<string, unknown>).contract_address ||
      (decoded as Record<string, unknown>).contractAddress,
  );
}

function hasConsensusData(transaction: Transaction): boolean {
  if (!transaction.consensus_data) return false;
  const leader = normalizeLeaderReceipt(transaction.consensus_data.leader_receipt);
  return Boolean(leader);
}

export function pickResolutionTransaction(transactions: Transaction[]): Transaction | undefined {
  const candidates = transactions.filter(
    (tx) => !isCreationTransaction(tx) && hasConsensusData(tx),
  );
  if (candidates.length === 0) return undefined;

  const finalized = candidates.filter((tx) => tx.consensus_data?.final === true);
  const pool = finalized.length > 0 ? finalized : candidates;

  return [...pool].sort((a, b) => transactionTimestamp(b) - transactionTimestamp(a))[0];
}

function votesMatch(vote: string | undefined, outcome: string): boolean | undefined {
  if (!vote) return undefined;
  return vote.trim().toLowerCase() === outcome.trim().toLowerCase();
}

function pickValidatorReasoning(
  participant: TransactionParticipant,
  fallbackEqOutput: string | undefined,
): string {
  const execution = participant.execution_result?.trim();
  if (execution) return execution;
  if (fallbackEqOutput) return fallbackEqOutput;
  return "(no reasoning recorded)";
}

function gatherFallbackEqOutputs(transaction: Transaction): string[] {
  const leader = normalizeLeaderReceipt(transaction.consensus_data?.leader_receipt);
  const outputs = leader?.eq_outputs;
  if (!outputs) return [];
  const list = Array.isArray(outputs)
    ? outputs.map((value) => String(value))
    : Object.values(outputs).map((value) => String(value));
  return list;
}

function buildValidators(
  transaction: Transaction,
  outcome: string,
): ResolutionValidator[] {
  const participants = getNodeConfigParticipants(transaction);
  if (participants.length === 0) return [];

  const eqFallbacks = gatherFallbackEqOutputs(transaction);
  let validatorIndex = 0;

  return participants.map((participant, idx) => {
    const fallback = eqFallbacks[idx];
    const label =
      participant.mode === "leader" ? "Leader" : `Validator ${++validatorIndex}`;
    return {
      label,
      address: participant.node_config.address,
      role: participant.mode,
      vote: participant.vote,
      agreedWithOutcome: votesMatch(participant.vote, outcome),
      reasoning: pickValidatorReasoning(participant, fallback),
    };
  });
}

export function buildResolutionSummary(
  oracle: Oracle,
  transactions: Transaction[],
): ResolutionSummary {
  const sources = collectSources(oracle);
  const potentialOutcomes = oracle.potential_outcomes ?? [];

  if (!isResolved(oracle)) {
    return {
      status: "unresolved",
      title: oracle.title,
      description: oracle.description,
      potentialOutcomes,
      sources,
      earliestResolutionDate: oracle.earliest_resolution_date,
    };
  }

  const outcome = (oracle.outcome ?? "").trim();
  const resolutionTx = pickResolutionTransaction(transactions);
  const validators = resolutionTx ? buildValidators(resolutionTx, outcome) : [];

  let resolvedAt: string | undefined;
  if (resolutionTx) {
    const raw = resolutionTx.created_at ?? resolutionTx.createdTimestamp;
    if (raw) {
      const date = raw instanceof Date ? raw : new Date(raw);
      if (!Number.isNaN(date.getTime())) resolvedAt = date.toISOString();
    }
  }

  return {
    status: "resolved",
    title: oracle.title,
    description: oracle.description,
    outcome: outcome || "Unknown",
    potentialOutcomes,
    sources,
    validators,
    resolvedAt,
  };
}
