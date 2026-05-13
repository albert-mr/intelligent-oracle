import { describe, expect, it } from "vitest";
import {
  buildResolutionSummary,
  pickResolutionTransaction,
} from "@/lib/resolution-timeline";
import type { Address } from "genlayer-js/types";
import type { Oracle, Transaction } from "@/lib/types";

const ORACLE_ADDR = "0x0000000000000000000000000000000000000000" as Address;

function makeOracle(overrides: Partial<Oracle> = {}): Oracle {
  return {
    address: ORACLE_ADDR,
    title: "Will Team A win?",
    description: "Resolves based on the official final score.",
    potential_outcomes: ["Yes", "No"],
    rules: ["Use the official league result after full time."],
    data_source_domains: ["league.example"],
    resolution_urls: [],
    earliest_resolution_date: "2026-06-01",
    ...overrides,
  };
}

function makeResolutionTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    hash: "0xabc",
    statusName: "Finalized",
    created_at: "2026-06-02T12:00:00.000Z",
    consensus_data: {
      final: true,
      leader_receipt: {
        node_config: { address: "0xLEADER", provider: "openai", model: "gpt-5" },
        vote: "Yes",
        execution_result: "The leader read the URL and concluded Yes.",
        eq_outputs: {},
      },
      validators: [
        {
          node_config: { address: "0xV1", provider: "openai", model: "gpt-5" },
          vote: "Yes",
          execution_result: "Validator 1 read the URL and concluded Yes.",
        },
        {
          node_config: { address: "0xV2", provider: "openai", model: "gpt-5" },
          vote: "Yes",
          execution_result: "Validator 2 read the URL and concluded Yes.",
        },
      ],
    },
    ...overrides,
  };
}

describe("buildResolutionSummary", () => {
  it("returns unresolved when the oracle has no outcome and status is not resolved", () => {
    const summary = buildResolutionSummary(makeOracle({ outcome: null }), []);
    expect(summary.status).toBe("unresolved");
    if (summary.status !== "unresolved") return;
    expect(summary.title).toBe("Will Team A win?");
    expect(summary.sources).toEqual([{ kind: "domain", value: "league.example" }]);
    expect(summary.earliestResolutionDate).toBe("2026-06-01");
  });

  it("returns resolved with validators when outcome is set and a resolution tx exists", () => {
    const summary = buildResolutionSummary(
      makeOracle({ outcome: "Yes", status: "Resolved" }),
      [makeResolutionTx()],
    );
    expect(summary.status).toBe("resolved");
    if (summary.status !== "resolved") return;
    expect(summary.outcome).toBe("Yes");
    expect(summary.validators).toHaveLength(3);
    expect(summary.validators[0]).toMatchObject({
      label: "Leader",
      role: "leader",
      vote: "Yes",
      agreedWithOutcome: true,
    });
    expect(summary.validators[1]).toMatchObject({ label: "Validator 1", role: "validator" });
    expect(summary.validators[2]).toMatchObject({ label: "Validator 2", role: "validator" });
    expect(summary.resolvedAt).toBe("2026-06-02T12:00:00.000Z");
  });

  it("recognizes resolution via status alone even when outcome is missing", () => {
    const summary = buildResolutionSummary(
      makeOracle({ outcome: "", status: "Resolved" }),
      [makeResolutionTx()],
    );
    expect(summary.status).toBe("resolved");
    if (summary.status !== "resolved") return;
    expect(summary.outcome).toBe("Unknown");
  });

  it("returns resolved with empty validators when no resolution tx exists", () => {
    const summary = buildResolutionSummary(
      makeOracle({ outcome: "No", status: "Resolved" }),
      [],
    );
    expect(summary.status).toBe("resolved");
    if (summary.status !== "resolved") return;
    expect(summary.validators).toEqual([]);
    expect(summary.outcome).toBe("No");
  });

  it("marks validators that disagree with the outcome", () => {
    const summary = buildResolutionSummary(
      makeOracle({ outcome: "Yes", status: "Resolved" }),
      [
        makeResolutionTx({
          consensus_data: {
            final: true,
            leader_receipt: {
              node_config: { address: "0xLEADER" },
              vote: "Yes",
              execution_result: "Leader said Yes.",
            },
            validators: [
              {
                node_config: { address: "0xV1" },
                vote: "Yes",
                execution_result: "Validator 1 said Yes.",
              },
              {
                node_config: { address: "0xV2" },
                vote: "No",
                execution_result: "Validator 2 disagreed.",
              },
            ],
          },
        }),
      ],
    );
    expect(summary.status).toBe("resolved");
    if (summary.status !== "resolved") return;
    expect(summary.validators[1].agreedWithOutcome).toBe(true);
    expect(summary.validators[2].agreedWithOutcome).toBe(false);
  });

  it("handles a degenerate single-validator resolution", () => {
    const summary = buildResolutionSummary(
      makeOracle({ outcome: "Yes", status: "Resolved" }),
      [
        makeResolutionTx({
          consensus_data: {
            final: true,
            leader_receipt: {
              node_config: { address: "0xLEADER" },
              vote: "Yes",
              execution_result: "Solo run.",
            },
            validators: [],
          },
        }),
      ],
    );
    expect(summary.status).toBe("resolved");
    if (summary.status !== "resolved") return;
    expect(summary.validators).toHaveLength(1);
    expect(summary.validators[0].label).toBe("Leader");
  });

  it("falls back to eq_outputs strings when execution_result is empty", () => {
    const summary = buildResolutionSummary(
      makeOracle({ outcome: "Yes", status: "Resolved" }),
      [
        makeResolutionTx({
          consensus_data: {
            final: true,
            leader_receipt: {
              node_config: { address: "0xLEADER" },
              vote: "Yes",
              execution_result: "",
              eq_outputs: { "0": "encoded-eq-output-string" },
            },
            validators: [],
          },
        }),
      ],
    );
    expect(summary.status).toBe("resolved");
    if (summary.status !== "resolved") return;
    expect(summary.validators[0].reasoning).toBe("encoded-eq-output-string");
  });

  it("collects both domain and url sources separately", () => {
    const summary = buildResolutionSummary(
      makeOracle({
        outcome: null,
        data_source_domains: ["a.example"],
        resolution_urls: ["https://b.example/result"],
      }),
      [],
    );
    expect(summary.status).toBe("unresolved");
    if (summary.status !== "unresolved") return;
    expect(summary.sources).toEqual([
      { kind: "domain", value: "a.example" },
      { kind: "url", value: "https://b.example/result" },
    ]);
  });
});

describe("pickResolutionTransaction", () => {
  it("returns undefined when no transactions have consensus data", () => {
    const result = pickResolutionTransaction([
      { hash: "0x1" },
      { hash: "0x2", data: { contract_address: "0xCREATE" } },
    ]);
    expect(result).toBeUndefined();
  });

  it("ignores creation transactions even if they have consensus data", () => {
    const create = makeResolutionTx({
      hash: "0xCREATE",
      data: { contract_address: "0xANY" },
    });
    const resolve = makeResolutionTx({ hash: "0xRESOLVE" });
    expect(pickResolutionTransaction([create, resolve])?.hash).toBe("0xRESOLVE");
  });

  it("prefers finalized resolution transactions over non-finalized", () => {
    const pending = makeResolutionTx({
      hash: "0xPENDING",
      created_at: "2026-06-03T00:00:00Z",
      consensus_data: {
        final: false,
        leader_receipt: { node_config: {}, execution_result: "x" },
      },
    });
    const finalEarlier = makeResolutionTx({
      hash: "0xFINAL",
      created_at: "2026-06-02T00:00:00Z",
    });
    expect(pickResolutionTransaction([pending, finalEarlier])?.hash).toBe("0xFINAL");
  });

  it("picks the latest among multiple finalized resolution transactions", () => {
    const older = makeResolutionTx({ hash: "0xOLD", created_at: "2026-06-01T00:00:00Z" });
    const newer = makeResolutionTx({ hash: "0xNEW", created_at: "2026-06-05T00:00:00Z" });
    expect(pickResolutionTransaction([older, newer])?.hash).toBe("0xNEW");
  });
});
