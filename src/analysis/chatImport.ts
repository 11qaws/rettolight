export type ChatImportFormat = "json" | "jsonl" | "csv" | "unknown";

export type ChatTimestampBasis = "relative" | "rebasedAbsolute" | "unknown";

export type ChatImportDiagnosticSeverity = "warning" | "error";

export type ChatImportDiagnosticCode =
  | "absoluteTimestampRebased"
  | "emptyInput"
  | "invalidContainer"
  | "invalidJsonLine"
  | "invalidRow"
  | "malformedCsv"
  | "missingCsvColumns"
  | "mixedTimestampBasis";

export interface ChatImportDiagnostic {
  readonly severity: ChatImportDiagnosticSeverity;
  readonly code: ChatImportDiagnosticCode;
  readonly message: string;
  readonly rowNumber: number | null;
}

export interface NormalizedChatMessage {
  /** Milliseconds on the imported chat timeline. */
  readonly timestampMs: number;
  /** Needed only inside the local selector. It is never returned as candidate evidence. */
  readonly text: string;
  /** Import-local, non-raw author key. Missing authors stay null. */
  readonly authorId: string | null;
}

export interface ChatImportResult {
  readonly format: ChatImportFormat;
  readonly timestampBasis: ChatTimestampBasis;
  readonly messages: readonly NormalizedChatMessage[];
  readonly totalRowCount: number;
  readonly invalidRowCount: number;
  readonly diagnostics: readonly ChatImportDiagnostic[];
}

interface SourceRow {
  readonly rowNumber: number;
  readonly value: unknown;
}

interface ExtractedRow {
  readonly rowNumber: number;
  readonly timestamp: ParsedTimestamp;
  readonly text: string;
  readonly authorId: string | null;
}

interface ParsedTimestamp {
  readonly basis: "relative" | "absolute";
  readonly milliseconds: number;
}

interface AliasValue {
  readonly normalizedKey: string;
  readonly value: unknown;
}

const TIMESTAMP_ALIASES = [
  "relativeMs",
  "elapsedMs",
  "offsetMs",
  "timeMs",
  "timestampMs",
  "relativeSeconds",
  "elapsedSeconds",
  "offsetSeconds",
  "timeSeconds",
  "timestampSeconds",
  "seconds",
  "relativeTime",
  "videoTime",
  "messageTime",
  "messageTimeRaw",
  "receivedAt",
  "createdAt",
  "timestamp",
  "time",
  "ts",
  "시간",
] as const;

const TEXT_ALIASES = [
  "content",
  "message",
  "messageText",
  "text",
  "body",
  "comment",
  "chat",
  "내용",
  "메시지",
] as const;

const AUTHOR_ALIASES = [
  "senderHash",
  "senderChannelId",
  "authorId",
  "userId",
  "channelId",
  "author",
  "username",
  "nickname",
  "senderName",
  "sender",
  "user",
  "작성자",
  "닉네임",
] as const;

const MILLISECOND_KEYS = new Set(
  ["relativeMs", "elapsedMs", "offsetMs", "timeMs", "timestampMs"].map(normalizeKey),
);

const SECOND_KEYS = new Set(
  [
    "relativeSeconds",
    "elapsedSeconds",
    "offsetSeconds",
    "timeSeconds",
    "timestampSeconds",
    "seconds",
  ].map(normalizeKey),
);

const ABSOLUTE_REBASE_MESSAGE =
  "절대 시각 로그를 첫 번째 유효 메시지 기준 0초로 다시 맞췄습니다.";

export function parseChatImport(input: string): ChatImportResult {
  const normalizedInput = input.replace(/^\uFEFF/, "");
  const trimmed = normalizedInput.trim();

  if (trimmed.length === 0) {
    return {
      format: "unknown",
      timestampBasis: "unknown",
      messages: [],
      totalRowCount: 0,
      invalidRowCount: 0,
      diagnostics: [
        diagnostic("warning", "emptyInput", "가져올 채팅 내용이 비어 있습니다.", null),
      ],
    };
  }

  const parsedSource = parseSourceRows(normalizedInput, trimmed);
  const diagnostics = [...parsedSource.diagnostics];
  const extractedRows: ExtractedRow[] = [];
  const authorAliases = new Map<string, string>();
  let invalidRowCount = parsedSource.invalidRowCount;

  for (const sourceRow of parsedSource.rows) {
    const extracted = extractRow(sourceRow, authorAliases);
    if (extracted === null) {
      invalidRowCount += 1;
      diagnostics.push(
        diagnostic(
          "error",
          "invalidRow",
          "필수 시각 또는 메시지 내용을 읽을 수 없어 이 행을 건너뛰었습니다.",
          sourceRow.rowNumber,
        ),
      );
      continue;
    }
    extractedRows.push(extracted);
  }

  const firstBasis = extractedRows[0]?.timestamp.basis;
  const basisRows: ExtractedRow[] = [];
  let mixedBasisReported = false;

  for (const row of extractedRows) {
    if (firstBasis !== undefined && row.timestamp.basis !== firstBasis) {
      invalidRowCount += 1;
      if (!mixedBasisReported) {
        diagnostics.push(
          diagnostic(
            "warning",
            "mixedTimestampBasis",
            "상대 시각과 절대 시각이 섞여 있어 첫 번째 형식과 다른 행을 건너뛰었습니다.",
            row.rowNumber,
          ),
        );
        mixedBasisReported = true;
      }
      continue;
    }
    basisRows.push(row);
  }

  if (firstBasis === "absolute" && basisRows.length > 0) {
    diagnostics.push(
      diagnostic("warning", "absoluteTimestampRebased", ABSOLUTE_REBASE_MESSAGE, null),
    );
  }

  const absoluteBase =
    firstBasis === "absolute" ? (basisRows[0]?.timestamp.milliseconds ?? 0) : 0;
  const messages = basisRows.map<NormalizedChatMessage>((row) => ({
    timestampMs:
      firstBasis === "absolute"
        ? row.timestamp.milliseconds - absoluteBase
        : row.timestamp.milliseconds,
    text: row.text,
    authorId: row.authorId,
  }));

  return {
    format: parsedSource.format,
    timestampBasis:
      messages.length === 0
        ? "unknown"
        : firstBasis === "absolute"
          ? "rebasedAbsolute"
          : "relative",
    messages,
    totalRowCount: parsedSource.rows.length + parsedSource.invalidRowCount,
    invalidRowCount,
    diagnostics,
  };
}

function parseSourceRows(
  input: string,
  trimmed: string,
): {
  readonly format: ChatImportFormat;
  readonly rows: readonly SourceRow[];
  readonly invalidRowCount: number;
  readonly diagnostics: readonly ChatImportDiagnostic[];
} {
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const rows = rowsFromJsonContainer(parsed);
      if (rows !== null) {
        return { format: "json", rows, invalidRowCount: 0, diagnostics: [] };
      }
      return {
        format: "json",
        rows: [],
        invalidRowCount: 0,
        diagnostics: [
          diagnostic(
            "error",
            "invalidContainer",
            "JSON은 배열이거나 messages 배열을 가진 객체여야 합니다.",
            null,
          ),
        ],
      };
    } catch {
      if (trimmed.startsWith("{")) {
        return parseJsonLines(input);
      }
      return {
        format: "json",
        rows: [],
        invalidRowCount: 1,
        diagnostics: [
          diagnostic("error", "invalidContainer", "JSON 문서 형식을 읽을 수 없습니다.", null),
        ],
      };
    }
  }

  return parseCsv(input);
}

function rowsFromJsonContainer(parsed: unknown): readonly SourceRow[] | null {
  if (Array.isArray(parsed)) {
    const values = parsed as readonly unknown[];
    return values.map((value, index) => ({ rowNumber: index + 1, value }));
  }
  if (!isRecord(parsed)) {
    return null;
  }

  for (const key of ["messages", "chatMessages", "chats", "items"] as const) {
    const value = parsed[key];
    if (Array.isArray(value)) {
      const values = value as readonly unknown[];
      return values.map((row, index) => ({ rowNumber: index + 1, value: row }));
    }
  }
  return null;
}

function parseJsonLines(input: string): {
  readonly format: "jsonl";
  readonly rows: readonly SourceRow[];
  readonly invalidRowCount: number;
  readonly diagnostics: readonly ChatImportDiagnostic[];
} {
  const rows: SourceRow[] = [];
  const diagnostics: ChatImportDiagnostic[] = [];
  let invalidRowCount = 0;
  const lines = input.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined || line.trim().length === 0) {
      continue;
    }
    try {
      const value: unknown = JSON.parse(line);
      rows.push({ rowNumber: index + 1, value });
    } catch {
      invalidRowCount += 1;
      diagnostics.push(
        diagnostic(
          "error",
          "invalidJsonLine",
          "JSONL 행 하나를 읽을 수 없어 건너뛰었습니다.",
          index + 1,
        ),
      );
    }
  }

  return { format: "jsonl", rows, invalidRowCount, diagnostics };
}

function parseCsv(input: string): {
  readonly format: "csv";
  readonly rows: readonly SourceRow[];
  readonly invalidRowCount: number;
  readonly diagnostics: readonly ChatImportDiagnostic[];
} {
  const parsed = parseCsvCells(input);
  const diagnostics: ChatImportDiagnostic[] = [];
  if (parsed.unclosedQuote) {
    diagnostics.push(
      diagnostic(
        "warning",
        "malformedCsv",
        "CSV의 마지막 따옴표가 닫히지 않았습니다. 읽을 수 있는 행만 확인합니다.",
        null,
      ),
    );
  }

  const header = parsed.rows[0];
  if (header === undefined) {
    return { format: "csv", rows: [], invalidRowCount: 0, diagnostics };
  }

  const normalizedHeaders = header.map(normalizeKey);
  const hasTimestamp = normalizedHeaders.some((key) =>
    TIMESTAMP_ALIASES.map(normalizeKey).includes(key),
  );
  const hasText = normalizedHeaders.some((key) => TEXT_ALIASES.map(normalizeKey).includes(key));

  if (!hasTimestamp || !hasText) {
    diagnostics.push(
      diagnostic(
        "error",
        "missingCsvColumns",
        "CSV에서 시각 열과 메시지 내용 열을 찾지 못했습니다.",
        1,
      ),
    );
    return {
      format: "csv",
      rows: [],
      invalidRowCount: Math.max(0, parsed.rows.length - 1),
      diagnostics,
    };
  }

  const rows: SourceRow[] = [];
  for (let rowIndex = 1; rowIndex < parsed.rows.length; rowIndex += 1) {
    const cells = parsed.rows[rowIndex];
    if (cells === undefined || cells.every((cell) => cell.trim().length === 0)) {
      continue;
    }
    const record: Record<string, unknown> = {};
    for (let columnIndex = 0; columnIndex < header.length; columnIndex += 1) {
      const key = header[columnIndex];
      if (key !== undefined && key.trim().length > 0) {
        record[key] = cells[columnIndex] ?? "";
      }
    }
    rows.push({ rowNumber: rowIndex + 1, value: record });
  }

  return { format: "csv", rows, invalidRowCount: 0, diagnostics };
}

function parseCsvCells(input: string): {
  readonly rows: readonly (readonly string[])[];
  readonly unclosedQuote: boolean;
} {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = (): void => {
    row.push(field);
    field = "";
  };
  const pushRow = (): void => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (inQuotes && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (character === "," && !inQuotes) {
      pushField();
      continue;
    }
    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && input[index + 1] === "\n") {
        index += 1;
      }
      pushRow();
      continue;
    }
    field += character ?? "";
  }

  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return { rows, unclosedQuote: inQuotes };
}

function extractRow(
  sourceRow: SourceRow,
  authorAliases: Map<string, string>,
): ExtractedRow | null {
  if (!isRecord(sourceRow.value)) {
    return null;
  }

  const timestampAlias = findAliasValue(sourceRow.value, TIMESTAMP_ALIASES);
  const textAlias = findAliasValue(sourceRow.value, TEXT_ALIASES);
  if (timestampAlias === null || textAlias === null) {
    return null;
  }

  const timestamp = parseTimestamp(timestampAlias.value, timestampAlias.normalizedKey);
  const text = primitiveString(textAlias.value)?.trim();
  if (timestamp === null || text === undefined || text.length === 0) {
    return null;
  }

  const authorAlias = findAliasValue(sourceRow.value, AUTHOR_ALIASES);
  const rawAuthor = authorAlias === null ? undefined : extractAuthorValue(authorAlias.value);

  return {
    rowNumber: sourceRow.rowNumber,
    timestamp,
    text,
    authorId:
      rawAuthor === undefined || rawAuthor.trim().length === 0
        ? null
        : aliasAuthor(rawAuthor.trim(), authorAliases),
  };
}

function parseTimestamp(value: unknown, normalizedKey: string): ParsedTimestamp | null {
  const stringValue = primitiveString(value)?.trim();
  if (stringValue === undefined || stringValue.length === 0) {
    return null;
  }

  const hmsMatch = /^(\d{1,3}):([0-5]\d):([0-5]\d(?:\.\d{1,3})?)$/.exec(stringValue);
  if (hmsMatch !== null) {
    const hours = Number(hmsMatch[1]);
    const minutes = Number(hmsMatch[2]);
    const seconds = Number(hmsMatch[3]);
    return {
      basis: "relative",
      milliseconds: Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000),
    };
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(stringValue)) {
    const parsedDate = Date.parse(stringValue);
    if (Number.isFinite(parsedDate)) {
      return { basis: "absolute", milliseconds: parsedDate };
    }
  }

  if (!/^-?\d+(?:\.\d+)?$/.test(stringValue)) {
    return null;
  }
  const numericValue = Number(stringValue);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const absoluteValue = Math.abs(numericValue);
  if (absoluteValue >= 1_000_000_000_000) {
    return { basis: "absolute", milliseconds: Math.round(numericValue) };
  }
  if (absoluteValue >= 1_000_000_000) {
    return { basis: "absolute", milliseconds: Math.round(numericValue * 1000) };
  }
  if (MILLISECOND_KEYS.has(normalizedKey)) {
    return { basis: "relative", milliseconds: Math.round(numericValue) };
  }
  if (SECOND_KEYS.has(normalizedKey)) {
    return { basis: "relative", milliseconds: Math.round(numericValue * 1000) };
  }

  // Generic numeric timestamps commonly use seconds for short values and milliseconds for long ones.
  return {
    basis: "relative",
    milliseconds: Math.round(absoluteValue > 172_800 ? numericValue : numericValue * 1000),
  };
}

function findAliasValue(
  record: Readonly<Record<string, unknown>>,
  aliases: readonly string[],
): AliasValue | null {
  const normalizedEntries = new Map<string, unknown>();
  for (const [key, value] of Object.entries(record)) {
    const normalized = normalizeKey(key);
    if (!normalizedEntries.has(normalized)) {
      normalizedEntries.set(normalized, value);
    }
  }

  for (const alias of aliases) {
    const normalizedKey = normalizeKey(alias);
    if (normalizedEntries.has(normalizedKey)) {
      return { normalizedKey, value: normalizedEntries.get(normalizedKey) };
    }
  }
  return null;
}

function extractAuthorValue(value: unknown): string | undefined {
  const direct = primitiveString(value);
  if (direct !== undefined) {
    return direct;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const nested = findAliasValue(value, ["id", "channelId", "name", "nickname", "username"]);
  return nested === null ? undefined : primitiveString(nested.value);
}

function primitiveString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function normalizeKey(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/[\s_-]+/g, "");
}

function aliasAuthor(value: string, aliases: Map<string, string>): string {
  const existing = aliases.get(value);
  if (existing !== undefined) {
    return existing;
  }
  const alias = `author_${String(aliases.size + 1).padStart(6, "0")}`;
  aliases.set(value, alias);
  return alias;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function diagnostic(
  severity: ChatImportDiagnosticSeverity,
  code: ChatImportDiagnosticCode,
  message: string,
  rowNumber: number | null,
): ChatImportDiagnostic {
  return { severity, code, message, rowNumber };
}
