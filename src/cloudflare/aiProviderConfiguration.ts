import {
  CANDIDATE_PASS_B_MODEL_ID,
  CANDIDATE_PASS_B_MODEL_REVISION,
} from "../analysis/candidatePassBWorkerProtocol";

export const AI_PROVIDER_CONFIGURATION_VERSION = "1.0.0" as const;

export const QWEN_CANDIDATE_MODEL_ID = "qwen3.5-omni-plus" as const;
export const QWEN_CANDIDATE_MODEL_REVISION =
  "qwen3.5-omni-plus-api-reviewed-2026-07-21" as const;
export const DEEPSEEK_CONTEXT_MODEL_ID = "deepseek-v4-pro" as const;
export const DEEPSEEK_CONTEXT_MODEL_REVISION =
  "deepseek-v4-pro-api-reviewed-2026-07-21" as const;

export type CandidateInsightProviderId = "gemini" | "qwen";
export type BroadcastContextProviderId = "disabled" | "deepseek";
export type AiProviderImplementationStatus = "active" | "prepared";
export type QwenRegion = "singapore" | "beijing";

export interface AiProviderDescriptor {
  readonly role: "candidate-insight" | "broadcast-context";
  readonly provider: Exclude<
    CandidateInsightProviderId | BroadcastContextProviderId,
    "disabled"
  >;
  readonly modelId: string;
  readonly modelRevision: string;
  readonly implementationStatus: AiProviderImplementationStatus;
}

/**
 * Public, secret-free provider catalog. `prepared` means the model and
 * credential boundary are reserved, but the production transport is still
 * fail-closed until its request/response adapter has passed a live smoke test.
 */
export const AI_PROVIDER_CATALOG = {
  candidateInsight: {
    gemini: {
      role: "candidate-insight",
      provider: "gemini",
      modelId: CANDIDATE_PASS_B_MODEL_ID,
      modelRevision: CANDIDATE_PASS_B_MODEL_REVISION,
      implementationStatus: "active",
    },
    qwen: {
      role: "candidate-insight",
      provider: "qwen",
      modelId: QWEN_CANDIDATE_MODEL_ID,
      modelRevision: QWEN_CANDIDATE_MODEL_REVISION,
      implementationStatus: "prepared",
    },
  },
  broadcastContext: {
    deepseek: {
      role: "broadcast-context",
      provider: "deepseek",
      modelId: DEEPSEEK_CONTEXT_MODEL_ID,
      modelRevision: DEEPSEEK_CONTEXT_MODEL_REVISION,
      implementationStatus: "prepared",
    },
  },
} as const satisfies {
  readonly candidateInsight: Readonly<
    Record<CandidateInsightProviderId, AiProviderDescriptor>
  >;
  readonly broadcastContext: Readonly<
    Record<"deepseek", AiProviderDescriptor>
  >;
};

export interface AiProviderEnvironment {
  readonly CANDIDATE_INSIGHT_PROVIDER?: string;
  readonly BROADCAST_CONTEXT_PROVIDER?: string;
  readonly GEMINI_API_KEY?: string;
  readonly QWEN_API_KEY?: string;
  readonly QWEN_WORKSPACE_ID?: string;
  readonly QWEN_REGION?: string;
  readonly DEEPSEEK_API_KEY?: string;
}

export type AiProviderConfigurationErrorCode =
  | "INVALID_PROVIDER"
  | "MISSING_CREDENTIALS"
  | "INVALID_WORKSPACE_ID"
  | "INVALID_REGION";

export interface AiProviderConfigurationFailure {
  readonly ok: false;
  readonly code: AiProviderConfigurationErrorCode;
}

export type CandidateInsightConnection =
  | {
      readonly provider: "gemini";
      readonly descriptor: typeof AI_PROVIDER_CATALOG.candidateInsight.gemini;
      readonly endpoint: string;
      readonly apiKey: string;
    }
  | {
      readonly provider: "qwen";
      readonly descriptor: typeof AI_PROVIDER_CATALOG.candidateInsight.qwen;
      readonly endpoint: string;
      readonly apiKey: string;
      readonly workspaceId: string;
      readonly region: QwenRegion;
    };

export type CandidateInsightConnectionResolution =
  | {
      readonly ok: true;
      readonly connection: CandidateInsightConnection;
    }
  | AiProviderConfigurationFailure;

export type BroadcastContextConnection =
  | {
      readonly provider: "disabled";
    }
  | {
      readonly provider: "deepseek";
      readonly descriptor: typeof AI_PROVIDER_CATALOG.broadcastContext.deepseek;
      readonly endpoint: string;
      readonly apiKey: string;
    };

export type BroadcastContextConnectionResolution =
  | {
      readonly ok: true;
      readonly connection: BroadcastContextConnection;
    }
  | AiProviderConfigurationFailure;

export interface AiProviderReadinessManifest {
  readonly schemaVersion: typeof AI_PROVIDER_CONFIGURATION_VERSION;
  readonly candidateInsight: {
    readonly selectedProvider: CandidateInsightProviderId | null;
    readonly modelId: string | null;
    readonly modelRevision: string | null;
    readonly implementationStatus: AiProviderImplementationStatus | null;
    readonly configured: boolean;
    readonly active: boolean;
  };
  readonly broadcastContext: {
    readonly selectedProvider: BroadcastContextProviderId | null;
    readonly modelId: string | null;
    readonly modelRevision: string | null;
    readonly implementationStatus: AiProviderImplementationStatus | "disabled" | null;
    readonly configured: boolean;
    readonly active: boolean;
  };
}

const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${CANDIDATE_PASS_B_MODEL_ID}:generateContent`;
const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEFAULT_QWEN_REGION: QwenRegion = "singapore";
const MAX_API_KEY_LENGTH = 512;
const MAX_WORKSPACE_ID_LENGTH = 63;
const QWEN_REGION_HOSTS: Readonly<Record<QwenRegion, string>> = {
  singapore: "ap-southeast-1.maas.aliyuncs.com",
  beijing: "cn-beijing.maas.aliyuncs.com",
};

function normalizeSecret(value: unknown): string | null {
  if (typeof value !== "string" || /[\p{Cc}\p{Cf}]/u.test(value)) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= MAX_API_KEY_LENGTH
    ? normalized
    : null;
}

function readCandidateProvider(
  value: unknown,
): CandidateInsightProviderId | null {
  if (value === undefined) {
    return "gemini";
  }
  return value === "gemini" || value === "qwen" ? value : null;
}

function readBroadcastContextProvider(
  value: unknown,
): BroadcastContextProviderId | null {
  if (value === undefined) {
    return "disabled";
  }
  return value === "disabled" || value === "deepseek" ? value : null;
}

function normalizeWorkspaceId(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_WORKSPACE_ID_LENGTH) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(normalized)
    ? normalized
    : null;
}

function readQwenRegion(value: unknown): QwenRegion | null {
  if (value === undefined) {
    return DEFAULT_QWEN_REGION;
  }
  return value === "singapore" || value === "beijing" ? value : null;
}

function qwenEndpoint(workspaceId: string, region: QwenRegion): string {
  return `https://${workspaceId}.${QWEN_REGION_HOSTS[region]}/compatible-mode/v1/chat/completions`;
}

function isImplementationActive(
  descriptor: AiProviderDescriptor | null,
): boolean {
  return descriptor?.implementationStatus === "active";
}

export function resolveCandidateInsightConnection(
  environment: AiProviderEnvironment,
): CandidateInsightConnectionResolution {
  const provider = readCandidateProvider(environment.CANDIDATE_INSIGHT_PROVIDER);
  if (provider === null) {
    return { ok: false, code: "INVALID_PROVIDER" };
  }

  if (provider === "gemini") {
    const apiKey = normalizeSecret(environment.GEMINI_API_KEY);
    if (apiKey === null) {
      return { ok: false, code: "MISSING_CREDENTIALS" };
    }
    return {
      ok: true,
      connection: {
        provider,
        descriptor: AI_PROVIDER_CATALOG.candidateInsight.gemini,
        endpoint: GEMINI_ENDPOINT,
        apiKey,
      },
    };
  }

  const apiKey = normalizeSecret(environment.QWEN_API_KEY);
  if (apiKey === null) {
    return { ok: false, code: "MISSING_CREDENTIALS" };
  }
  const workspaceId = normalizeWorkspaceId(environment.QWEN_WORKSPACE_ID);
  if (workspaceId === null) {
    return { ok: false, code: "INVALID_WORKSPACE_ID" };
  }
  const region = readQwenRegion(environment.QWEN_REGION);
  if (region === null) {
    return { ok: false, code: "INVALID_REGION" };
  }
  return {
    ok: true,
    connection: {
      provider,
      descriptor: AI_PROVIDER_CATALOG.candidateInsight.qwen,
      endpoint: qwenEndpoint(workspaceId, region),
      apiKey,
      workspaceId,
      region,
    },
  };
}

export function resolveBroadcastContextConnection(
  environment: AiProviderEnvironment,
): BroadcastContextConnectionResolution {
  const provider = readBroadcastContextProvider(
    environment.BROADCAST_CONTEXT_PROVIDER,
  );
  if (provider === null) {
    return { ok: false, code: "INVALID_PROVIDER" };
  }
  if (provider === "disabled") {
    return { ok: true, connection: { provider } };
  }
  const apiKey = normalizeSecret(environment.DEEPSEEK_API_KEY);
  if (apiKey === null) {
    return { ok: false, code: "MISSING_CREDENTIALS" };
  }
  return {
    ok: true,
    connection: {
      provider,
      descriptor: AI_PROVIDER_CATALOG.broadcastContext.deepseek,
      endpoint: DEEPSEEK_ENDPOINT,
      apiKey,
    },
  };
}

/**
 * Produces only booleans and public model metadata. It is safe to inspect in
 * tests and operations output; credentials, workspace IDs, and endpoints are
 * deliberately absent.
 */
export function createAiProviderReadinessManifest(
  environment: AiProviderEnvironment,
): AiProviderReadinessManifest {
  const candidateProvider = readCandidateProvider(
    environment.CANDIDATE_INSIGHT_PROVIDER,
  );
  const candidateResolution = resolveCandidateInsightConnection(environment);
  const candidateDescriptor = candidateProvider === null
    ? null
    : AI_PROVIDER_CATALOG.candidateInsight[candidateProvider];

  const contextProvider = readBroadcastContextProvider(
    environment.BROADCAST_CONTEXT_PROVIDER,
  );
  const contextResolution = resolveBroadcastContextConnection(environment);
  const contextDescriptor = contextProvider === "deepseek"
    ? AI_PROVIDER_CATALOG.broadcastContext.deepseek
    : null;

  return {
    schemaVersion: AI_PROVIDER_CONFIGURATION_VERSION,
    candidateInsight: {
      selectedProvider: candidateProvider,
      modelId: candidateDescriptor?.modelId ?? null,
      modelRevision: candidateDescriptor?.modelRevision ?? null,
      implementationStatus: candidateDescriptor?.implementationStatus ?? null,
      configured: candidateResolution.ok,
      active: candidateResolution.ok && isImplementationActive(candidateDescriptor),
    },
    broadcastContext: {
      selectedProvider: contextProvider,
      modelId: contextDescriptor?.modelId ?? null,
      modelRevision: contextDescriptor?.modelRevision ?? null,
      implementationStatus:
        contextProvider === "disabled"
          ? "disabled"
          : contextDescriptor?.implementationStatus ?? null,
      configured: contextResolution.ok,
      active: contextResolution.ok && isImplementationActive(contextDescriptor),
    },
  };
}
