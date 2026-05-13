"use client";

import { Check, Globe2, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  ResolutionSource,
  ResolutionSummary,
  ResolutionValidator,
} from "@/lib/resolution-timeline";

interface ResolutionSummaryPanelProps {
  summary: ResolutionSummary;
}

function formatTimestamp(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return date.toLocaleDateString();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString();
}

function SourceChip({ source }: { source: ResolutionSource }) {
  const Icon = source.kind === "domain" ? Globe2 : Link2;
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <Icon className="size-3" aria-hidden />
      <span className="truncate">{source.value}</span>
    </Badge>
  );
}

function ValidatorCard({ validator }: { validator: ResolutionValidator }) {
  const voteLabel = validator.vote?.trim() || "No vote";
  const agreementClass =
    validator.agreedWithOutcome === true
      ? "border-accent-foreground/30 text-accent-foreground"
      : validator.agreedWithOutcome === false
      ? "border-destructive/30 text-destructive"
      : "border-border text-muted-foreground";

  return (
    <article className="flex h-full flex-col justify-between rounded-md border border-border bg-background p-4">
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {validator.label}
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {validator.reasoning}
        </p>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Badge variant="outline" className={`font-normal ${agreementClass}`}>
          Vote: {voteLabel}
        </Badge>
        {validator.address ? (
          <span className="break-all font-mono text-[0.65rem] text-muted-foreground">
            {validator.address}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export function ResolutionSummaryPanel({ summary }: ResolutionSummaryPanelProps) {
  if (summary.status === "unresolved") {
    return (
      <section
        aria-labelledby="resolution-summary-heading"
        className="rounded-lg border border-border bg-card p-6 shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="resolution-summary-heading"
            className="text-2xl font-semibold tracking-tight text-foreground"
          >
            Pending resolution
          </h2>
          {summary.title ? (
            <p className="text-base text-muted-foreground">{summary.title}</p>
          ) : null}
        </div>

        {summary.sources.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {summary.sources.map((source) => (
              <SourceChip key={`${source.kind}:${source.value}`} source={source} />
            ))}
          </div>
        ) : null}

        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-foreground">
          When the resolution date passes, validators independently read these sources and run the
          resolution prompt. The equivalence principle requires their outputs to agree before the
          outcome is recorded on-chain.
        </p>

        {summary.earliestResolutionDate ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Earliest resolution: {summary.earliestResolutionDate}
          </p>
        ) : null}
      </section>
    );
  }

  const { outcome, title, sources, validators, resolvedAt } = summary;
  const timestampLabel = formatTimestamp(resolvedAt);

  return (
    <section
      aria-labelledby="resolution-summary-heading"
      className="rounded-lg border border-border bg-card p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2
            id="resolution-summary-heading"
            className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          >
            Outcome: {outcome}
          </h2>
          {title ? (
            <p className="break-words text-base text-muted-foreground">{title}</p>
          ) : null}
        </div>
        <Badge
          variant="outline"
          aria-label={
            timestampLabel
              ? `Equivalence reached ${timestampLabel}`
              : "Equivalence reached"
          }
          className="shrink-0 gap-1.5 border-accent-foreground/30 bg-accent text-accent-foreground"
        >
          <Check className="size-3" aria-hidden />
          Equivalence reached
          {timestampLabel ? (
            <span className="font-normal text-accent-foreground/80"> · {timestampLabel}</span>
          ) : null}
        </Badge>
      </div>

      {sources.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {sources.map((source) => (
            <SourceChip key={`${source.kind}:${source.value}`} source={source} />
          ))}
        </div>
      ) : null}

      {validators.length === 0 ? (
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Resolved without recorded per-validator outputs (legacy or non-equivalence resolution).
        </p>
      ) : (
        <div
          className={`mt-5 grid gap-3 ${
            validators.length === 1
              ? "grid-cols-1"
              : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {validators.map((validator, idx) => (
            <ValidatorCard key={`${validator.label}-${idx}`} validator={validator} />
          ))}
        </div>
      )}
    </section>
  );
}
