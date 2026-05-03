import type { DeviceSupport, SupportStatus, TransportType } from '@thermal-label/contracts';
import type { Connection, EngineSlotState } from '@/stores/printer';
import type { PrinterFamily } from '@/lib/printer/registry';

export interface EffectiveSupport {
  /** Worst of chassis vs engine; drives chip colour and CTA wording. */
  status: SupportStatus;
  /** Underlying chassis support record from the device entry. */
  support: DeviceSupport;
  /** Engine-specific status if this slot's role has its own entry. */
  engineStatus?: SupportStatus;
}

const STATUS_RANK: Record<SupportStatus, number> = {
  verified: 0,
  partial: 1,
  untested: 2,
  broken: 3,
};

function worse(a: SupportStatus, b: SupportStatus): SupportStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

/**
 * Plan §1.5: if a slot's role is in `support.engines` and worse than
 * the chassis status, surface the worse one. Connections without a
 * `device` entry default to `untested` so the corpus-recruitment CTA
 * still appears.
 */
export function getEffectiveSupport(
  connection: Connection,
  slot: EngineSlotState,
): EffectiveSupport {
  const support: DeviceSupport = connection.device?.support ?? { status: 'untested' };
  const engineStatus = support.engines?.[slot.role];
  const status = engineStatus ? worse(support.status, engineStatus) : support.status;
  return { status, support, engineStatus };
}

const DEFAULT_REPORT_URLS: Record<PrinterFamily, string> = {
  'brother-ql': 'https://github.com/thermal-label/brother-ql/issues/new',
  labelwriter: 'https://github.com/thermal-label/labelwriter/issues/new',
  labelmanager: 'https://github.com/thermal-label/labelmanager/issues/new',
};

function envKeyFor(family: PrinterFamily): string {
  return `VITE_REPORT_URL_${family.replace(/-/g, '_').toUpperCase()}`;
}

/**
 * Resolves the GitHub issue URL for filing a verification report.
 * Per-family `VITE_REPORT_URL_*` env vars override the built-in
 * defaults so self-hosters can redirect reports without code changes.
 */
export function reportUrlBaseFor(family: PrinterFamily): string {
  const env = (import.meta.env as Record<string, string | undefined>)[envKeyFor(family)];
  return env ?? DEFAULT_REPORT_URLS[family];
}

export type ReportResult = 'verified' | 'partial' | 'broken';

const RESULT_GLYPH: Record<ReportResult, string> = {
  verified: '✅ printed cleanly',
  partial: '⚠️ printed with issues',
  broken: '❌ failed to print',
};

export interface BuildReportBodyInput {
  family: PrinterFamily;
  model: string;
  packageVersion?: string;
  transport: TransportType;
  os: string;
  browser: string;
  result: ReportResult;
  notes: string;
  diagnosticSnapshot?: string;
}

const FAMILY_PACKAGE_NAME: Record<PrinterFamily, string> = {
  'brother-ql': '@thermal-label/brother-ql-web',
  labelwriter: '@thermal-label/labelwriter-web',
  labelmanager: '@thermal-label/labelmanager-web',
};

const FAMILY_HINT: Record<PrinterFamily, string> = {
  'brother-ql':
    'Brother QL: if you can read the firmware revision (a four-character code from the printer LCD or P-touch Editor), include it in the notes.',
  labelwriter:
    'LabelWriter: if the chassis label has a serial-string LED suffix (e.g. "B-XX"), include it in the notes.',
  labelmanager:
    'LabelManager: please mention whether the cartridge was a genuine Dymo cartridge or a third-party / refilled one.',
};

/**
 * Build the markdown body for a pre-filled GitHub verification report.
 * Diagnostic snapshot, when present, is rendered in a `<details>` block
 * so reviewers can read the summary first.
 */
export function buildReportBody(input: BuildReportBodyInput): string {
  const pkg = input.packageVersion
    ? `${FAMILY_PACKAGE_NAME[input.family]}@${input.packageVersion}`
    : FAMILY_PACKAGE_NAME[input.family];
  const lines: string[] = [
    `- Family: ${input.family}`,
    `- Model: ${input.model}`,
    `- Package version: ${pkg}`,
    `- Transport: ${input.transport}`,
    `- OS: ${input.os}`,
    `- Browser: ${input.browser}`,
    `- Result: ${RESULT_GLYPH[input.result]}`,
    '',
    'Reported via burnmark label-maker.',
    '',
    `Notes:`,
    `> ${input.notes.trim() || '(no notes)'}`,
    '',
    `_${FAMILY_HINT[input.family]}_`,
  ];
  if (input.diagnosticSnapshot && input.diagnosticSnapshot.trim().length > 0) {
    lines.push(
      '',
      '<details><summary>Diagnostic snapshot</summary>',
      '',
      '```',
      input.diagnosticSnapshot.trim(),
      '```',
      '',
      '</details>',
    );
  }
  return lines.join('\n');
}

const REPORT_TITLE_PREFIX = 'verification';

export function buildReportTitle(
  family: PrinterFamily,
  model: string,
  transport: TransportType,
): string {
  return `${REPORT_TITLE_PREFIX}: ${family} ${model} on ${transport}`;
}

/**
 * Final URL to open in a new tab. The user reviews and submits on
 * GitHub; we never POST.
 */
export function buildReportUrl(family: PrinterFamily, title: string, body: string): string {
  const base = reportUrlBaseFor(family);
  const params = new URLSearchParams({
    title,
    body,
    labels: 'verification',
  });
  return `${base}?${params.toString()}`;
}

/**
 * Allowlisted diagnostic capture. Pulls structured fields known to be
 * non-PII; never serialises the whole status object verbatim. Returns
 * an empty string if nothing safe is available.
 */
export function captureDiagnostic(connection: Connection, slot: EngineSlotState): string {
  const lines: string[] = [];
  const status = connection.status;
  if (status) {
    lines.push(`status.ready: ${status.ready}`);
    if (status.errors.length > 0) {
      lines.push(`status.errors: ${status.errors.map(e => e.code).join(', ')}`);
    }
  }
  const detected = slot.detectedMedia;
  if (detected) {
    const dims =
      detected.heightMm == null
        ? `${detected.widthMm}mm continuous`
        : `${detected.widthMm}×${detected.heightMm}mm`;
    lines.push(`detectedMedia: ${detected.name} (${dims})`);
  }
  const selected = slot.selectedMedia;
  if (selected && selected.id !== detected?.id) {
    const dims =
      selected.heightMm == null
        ? `${selected.widthMm}mm continuous`
        : `${selected.widthMm}×${selected.heightMm}mm`;
    lines.push(`selectedMedia: ${selected.name} (${dims})`);
  }
  const engine = slot.engine;
  lines.push(
    `engine.role: ${engine.role}`,
    `engine.protocol: ${engine.protocol}`,
    `engine.dpi: ${engine.dpi}`,
    `engine.headDots: ${engine.headDots}`,
  );
  return lines.join('\n');
}

export function detectOs(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  return 'unknown';
}

export function detectBrowser(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  const edge = ua.match(/Edg\/(\d+)/);
  if (edge) return `Edge ${edge[1]}`;
  const chrome = ua.match(/Chrome\/(\d+)/);
  if (chrome) return `Chrome ${chrome[1]}`;
  const firefox = ua.match(/Firefox\/(\d+)/);
  if (firefox) return `Firefox ${firefox[1]}`;
  const safari = ua.match(/Version\/(\d+).*Safari/);
  if (safari) return `Safari ${safari[1]}`;
  return 'unknown';
}

/** Available transports for a connected device, for the picker UI. */
export function availableTransports(connection: Connection): TransportType[] {
  const transports = connection.device?.transports;
  if (!transports) return ['usb'];
  return (Object.keys(transports) as TransportType[]).filter(k => transports[k] !== undefined);
}
