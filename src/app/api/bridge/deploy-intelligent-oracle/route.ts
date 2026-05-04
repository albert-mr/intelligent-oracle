import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { type Address, type GenLayerTransaction, TransactionStatus } from "genlayer-js/types";
import {
  formatValidationError,
  oracleConfigToDeploymentArgs,
  parseOracleConfig,
} from "@/lib/oracle-config";

export const runtime = "nodejs";
export const maxDuration = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response("OK", { headers: corsHeaders });
}

function extractContractAddress(receipt: GenLayerTransaction): Address | null {
  if (receipt.txDataDecoded && "contractAddress" in receipt.txDataDecoded) {
    return (receipt.txDataDecoded.contractAddress as Address | undefined) ?? null;
  }

  const fallback = receipt.data?.contract_address;
  return typeof fallback === "string" ? (fallback as Address) : null;
}

function errorResponse(message: string, status = 400, receipt?: unknown) {
  return Response.json(
    {
      status: "error",
      message,
      ...(receipt ? { receipt } : {}),
    },
    { status, headers: corsHeaders },
  );
}

export async function POST(request: Request) {
  const bridgePrivateKey = process.env.BRIDGE_PRIVATE_KEY as `0x${string}` | undefined;
  const simulatorUrl = process.env.GENLAYER_RPC_URL;
  const registryAddress = process.env.IC_REGISTRY_ADDRESS as Address | undefined;

  if (!bridgePrivateKey || !registryAddress) {
    return errorResponse(
      "BRIDGE_PRIVATE_KEY and IC_REGISTRY_ADDRESS must be configured.",
      500,
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = parseOracleConfig(body);

  if (!parsed.success) {
    return errorResponse(formatValidationError(parsed.error), 400);
  }

  try {
    const account = createAccount(bridgePrivateKey);
    const client = createClient({
      chain: studionet,
      account,
      endpoint: simulatorUrl || undefined,
    });

    const registerContractTransactionHash = await client.writeContract({
      address: registryAddress,
      functionName: "create_new_prediction_market",
      args: oracleConfigToDeploymentArgs(parsed.data) as never[],
      value: BigInt(0),
    });

    const methodCallReceipt = await client.waitForTransactionReceipt({
      hash: registerContractTransactionHash,
      status: TransactionStatus.FINALIZED,
    });

    const triggered = await client.getTriggeredTransactionIds({
      hash: registerContractTransactionHash,
    });

    if (triggered.length === 0) {
      return errorResponse(
        "Registration finalized but no oracle deploy transaction was returned.",
        502,
        methodCallReceipt,
      );
    }

    const intelligentOracleDeployTxHash = triggered[0];
    const intelligentOracleDeployReceipt = await client.waitForTransactionReceipt({
      hash: intelligentOracleDeployTxHash,
      status: TransactionStatus.ACCEPTED,
    });
    const oracleAddress = extractContractAddress(intelligentOracleDeployReceipt);

    if (!oracleAddress) {
      return errorResponse(
        "Oracle deploy transaction finalized without a contract address.",
        502,
        intelligentOracleDeployReceipt,
      );
    }

    return Response.json(
      {
        status: "success",
        message: "Intelligent Oracle deployed successfully",
        oracleAddress,
        receipt: intelligentOracleDeployReceipt,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("Error deploying Intelligent Oracle:", error);
    return errorResponse("An error occurred while deploying the Intelligent Oracle.", 500);
  }
}
