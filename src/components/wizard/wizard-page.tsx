"use client";

import { useChat } from "@ai-sdk/react";
import confetti from "canvas-confetti";
import { DefaultChatTransport, generateId, type UIMessage } from "ai";
import { Copy, ExternalLink, Plus, Rocket, RotateCcw, Send, Square } from "lucide-react";
import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { extractJsonFromText } from "@/lib/json-extraction";
import { getMessageText, normalizeStoredMessage } from "@/lib/messages";
import { parseOracleConfig } from "@/lib/oracle-config";
import type { DeployResponse, OracleConfig } from "@/lib/types";

const CONVERSATION_STORAGE_KEY = "io-wizard.conversation";
const CHAT_ID_STORAGE_KEY = "io-wizard.chatId";

enum DeploymentStatus {
  None = "NONE",
  Deploying = "DEPLOYING",
  Deployed = "DEPLOYED",
  Failed = "FAILED",
}

interface ChatSession {
  id: string;
  messages: UIMessage[];
}

interface FormattedMessage {
  beforeJson: string;
  afterJson: string;
  jsonContent?: unknown;
  prettyJson?: string;
  parsedConfig?: OracleConfig;
  validationError?: string;
}

function getDeployButtonText(status: DeploymentStatus) {
  if (status === DeploymentStatus.Deploying) return "Deploying...";
  if (status === DeploymentStatus.Deployed) return "Deployed";
  if (status === DeploymentStatus.Failed) return "Deployment Failed";
  return "Deploy";
}

function loadSession(): ChatSession {
  let messages: UIMessage[] = [];
  const storedId = window.localStorage.getItem(CHAT_ID_STORAGE_KEY);
  const storedConversation = window.localStorage.getItem(CONVERSATION_STORAGE_KEY);

  if (storedConversation) {
    try {
      const parsed = JSON.parse(storedConversation);
      messages = Array.isArray(parsed) ? parsed.map(normalizeStoredMessage) : [];
    } catch {
      window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
    }
  }

  return {
    id: storedId || generateId(),
    messages,
  };
}

function saveSession(messages: UIMessage[], id: string) {
  window.localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(messages));
  window.localStorage.setItem(CHAT_ID_STORAGE_KEY, id);
}

function clearSession() {
  window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
  window.localStorage.removeItem(CHAT_ID_STORAGE_KEY);
}

function formatMessage(content: string): FormattedMessage {
  const extraction = extractJsonFromText(content);
  if (!extraction) return { beforeJson: content, afterJson: "" };

  const prettyJson = JSON.stringify(extraction.parsed, null, 2);
  const parsedConfig = parseOracleConfig(extraction.parsed);
  const jsonIndex = content.indexOf(extraction.raw);
  const beforeJson = jsonIndex >= 0 ? content.slice(0, jsonIndex).replace(/```json\s*$/i, "").trim() : "";
  const afterJson = jsonIndex >= 0
    ? content.slice(jsonIndex + extraction.raw.length).replace(/^```/, "").trim()
    : "";

  return {
    beforeJson,
    afterJson,
    jsonContent: extraction.parsed,
    prettyJson,
    parsedConfig: parsedConfig.success ? parsedConfig.data : undefined,
    validationError: parsedConfig.success ? undefined : parsedConfig.error.issues.map((issue) => issue.message).join(" "),
  };
}

function WizardChat({ session, onReset }: { session: ChatSession; onReset: (session: ChatSession) => void }) {
  const [inputText, setInputText] = useState("");
  const [configCopied, setConfigCopied] = useState(false);
  const [deployedOracleAddress, setDeployedOracleAddress] = useState("");
  const [deploymentStatus, setDeploymentStatus] = useState(DeploymentStatus.None);
  const [deploymentError, setDeploymentError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);

  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
    regenerate,
  } = useChat<UIMessage>({
    id: session.id,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    messages: session.messages,
    onFinish: ({ messages: finishedMessages }) => {
      saveSession(finishedMessages, session.id);
      window.setTimeout(() => {
        inputRef.current?.focus();
        scrollToBottom();
      }, 0);
    },
    onError: (chatError) => {
      console.error("Chat error:", chatError);
    },
  });

  const isLoading = status === "submitted" || status === "streaming";
  const disabled = isLoading || error != null;

  const displayMessages = useMemo(() => messages.slice(1), [messages]);
  const lastJsonMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const formatted = formatMessage(getMessageText(messages[index]));
      if (formatted.jsonContent) return messages[index].id;
    }
    return null;
  }, [messages]);

  function scrollToBottom() {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  useEffect(() => {
    if (startedRef.current || messages.length > 0) return;
    startedRef.current = true;
    const timeout = window.setTimeout(() => {
      void sendMessage({ text: "__start__" });
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [messages.length, sendMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function autoResize(textarea: HTMLTextAreaElement) {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    setDeploymentStatus(DeploymentStatus.None);
    setDeploymentError("");
    void sendMessage({ text });
    setInputText("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setConfigCopied(true);
    window.setTimeout(() => setConfigCopied(false), 1500);
  }

  async function deployIntelligentContract(config: OracleConfig) {
    try {
      setDeploymentStatus(DeploymentStatus.Deploying);
      setDeploymentError("");
      const response = await fetch("/api/bridge/deploy-intelligent-oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const result = (await response.json()) as DeployResponse;
      if (!response.ok || result.status === "error") {
        throw new Error(result.status === "error" ? result.message : `HTTP error ${response.status}`);
      }

      setDeployedOracleAddress(result.oracleAddress);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      setDeploymentStatus(DeploymentStatus.Deployed);
    } catch (deployError) {
      console.error("Error deploying Intelligent Contract:", deployError);
      setDeploymentError(deployError instanceof Error ? deployError.message : "Deployment failed.");
      setDeploymentStatus(DeploymentStatus.Failed);
    }
  }

  function resetConversation() {
    clearSession();
    setDeployedOracleAddress("");
    setDeploymentStatus(DeploymentStatus.None);
    setDeploymentError("");
    onReset({ id: generateId(), messages: [] });
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="assistant" oracleAddress={deployedOracleAddress} />

      <div className="mx-auto flex max-w-3xl justify-end px-4 pt-24">
        <button
          type="button"
          onClick={resetConversation}
          className="inline-flex items-center gap-2 rounded-md bg-highlight px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Create New Oracle
        </button>
      </div>

      <div
        ref={messagesContainerRef}
        className="hide-scrollbar mx-auto flex h-[calc(100vh-12rem)] w-full max-w-3xl flex-col overflow-y-auto px-4 pt-4 text-primary-text"
      >
        <div className="pb-28 pt-8">
          {displayMessages.map((message) => {
            const content = getMessageText(message);
            const formatted = formatMessage(content);
            const isLastJson = message.id === lastJsonMessageId;

            return (
              <article key={message.id} className="mb-5 whitespace-pre-wrap leading-7">
                <span className={`font-semibold ${message.role === "user" ? "" : "text-highlight"}`}>
                  {message.role === "user" ? "You: " : "Intelligent Oracle Assistant: "}
                </span>
                {formatted.beforeJson ? <span>{formatted.beforeJson}</span> : null}
                {formatted.prettyJson ? (
                  <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-primary-text p-4 text-sm leading-6 text-white">
                    <code>{formatted.prettyJson}</code>
                  </pre>
                ) : null}
                {formatted.afterJson ? <span>{`\n${formatted.afterJson}`}</span> : null}

                {isLastJson ? (
                  <div className="mt-4 flex flex-col gap-3 whitespace-normal">
                    {formatted.validationError ? (
                      <div className="rounded-md border border-danger/20 bg-danger-soft p-3 text-sm text-danger">
                        {formatted.validationError}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!formatted.prettyJson}
                        onClick={() => formatted.prettyJson && void copyToClipboard(formatted.prettyJson)}
                        className="inline-flex items-center gap-2 rounded-md border border-highlight px-4 py-2 text-sm font-medium text-highlight transition hover:bg-highlight hover:text-white disabled:opacity-50"
                      >
                        <Copy className="h-4 w-4" aria-hidden />
                        {configCopied ? "Copied" : "Copy"}
                      </button>
                      <button
                        type="button"
                        disabled={
                          !formatted.parsedConfig ||
                          deploymentStatus === DeploymentStatus.Deploying ||
                          deploymentStatus === DeploymentStatus.Deployed
                        }
                        onClick={() => formatted.parsedConfig && void deployIntelligentContract(formatted.parsedConfig)}
                        className="inline-flex items-center gap-2 rounded-md bg-highlight px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        <Rocket className="h-4 w-4" aria-hidden />
                        {getDeployButtonText(deploymentStatus)}
                      </button>
                    </div>

                    {deploymentError ? (
                      <div className="rounded-md border border-danger/20 bg-danger-soft p-3 text-sm text-danger">
                        {deploymentError}
                      </div>
                    ) : null}

                    {deployedOracleAddress ? (
                      <div className="rounded-md border border-accent/30 bg-accent-soft p-4 text-accent">
                        <p className="text-sm font-medium">Your Intelligent Oracle has been deployed.</p>
                        <p className="mt-2 break-all font-mono text-sm">{deployedOracleAddress}</p>
                        <Link
                          href={`/oracle/${deployedOracleAddress}`}
                          className="mt-4 inline-flex items-center gap-2 rounded-md bg-highlight px-4 py-2 text-sm font-medium text-white"
                        >
                          View in explorer
                          <ExternalLink className="h-4 w-4" aria-hidden />
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}

          {isLoading ? (
            <div className="mt-4 text-secondary-text">
              <div>Loading...</div>
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 rounded-md border border-highlight px-4 py-2 text-sm font-medium text-highlight transition hover:bg-highlight hover:text-white"
                onClick={() => void stop()}
              >
                <Square className="h-4 w-4" aria-hidden />
                Stop
              </button>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4">
              <div className="text-danger">An error occurred.</div>
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 rounded-md border border-highlight px-4 py-2 text-sm font-medium text-highlight transition hover:bg-highlight hover:text-white"
                onClick={() => void regenerate()}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Retry
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="fixed bottom-0 left-1/2 mb-8 flex w-full max-w-3xl -translate-x-1/2 gap-2 px-4">
        <textarea
          ref={inputRef}
          className="max-h-52 min-h-12 flex-1 resize-none overflow-hidden rounded-md border border-highlight bg-surface p-4 text-primary-text shadow-lg outline-none placeholder:text-secondary-text focus:ring-2 focus:ring-highlight/30"
          value={inputText}
          placeholder="Say something..."
          disabled={disabled}
          onChange={(event) => {
            setInputText(event.target.value);
            autoResize(event.target);
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex h-12 items-center gap-2 rounded-md bg-highlight px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden />
          Send
        </button>
      </form>
    </div>
  );
}

export function WizardPage() {
  const [session, setSession] = useState<ChatSession | null>(null);

  useEffect(() => {
    setSession(loadSession());
  }, []);

  if (!session) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader active="assistant" />
        <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 text-secondary-text">
          Loading assistant...
        </main>
      </div>
    );
  }

  return <WizardChat key={session.id} session={session} onReset={setSession} />;
}
