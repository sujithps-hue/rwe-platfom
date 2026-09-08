/**
 * Minimal HL7v2 pipe-delimited message parser (ADT^A01/A04/A08 admit/register/update, and
 * ORU^R01 observation results — the two message types most legacy EHRs/lab systems export).
 * Not a full HL7v2 implementation (no escape-sequence decoding beyond `\F\`/`\S\`/`\T\`/`\R\`,
 * no Z-segment support) — sufficient to extract PID (patient), PV1 (visit), DG1 (diagnosis), and
 * OBX (observation/result) segments into a normalized shape the connector maps to the CDM.
 */

export interface Hl7Segment {
  id: string;
  fields: string[]; // fields[0] is the segment id itself is NOT included; fields[1] is the first field after the id
}

export interface Hl7Message {
  segments: Hl7Segment[];
}

const FIELD_SEP = '|';
const COMPONENT_SEP = '^';

export function parseHl7Message(raw: string): Hl7Message {
  const lines = raw
    .replace(/\r\n/g, '\r')
    .split(/[\r\n]/)
    .map((l) => l.trim())
    .filter(Boolean);

  const segments: Hl7Segment[] = lines.map((line) => {
    const fields = line.split(FIELD_SEP);
    return { id: fields[0], fields: fields.slice(1) };
  });

  return { segments };
}

export function component(field: string | undefined, index: number): string | undefined {
  return field?.split(COMPONENT_SEP)[index];
}

export function findSegments(message: Hl7Message, id: string): Hl7Segment[] {
  return message.segments.filter((s) => s.id === id);
}

export function findSegment(message: Hl7Message, id: string): Hl7Segment | undefined {
  return message.segments.find((s) => s.id === id);
}

/** Parses an HL7v2 batch file (multiple messages, separated by MSH segments) into individual messages. */
export function splitHl7Batch(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, '\r').split(/[\r\n]/);
  const messages: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.startsWith('MSH') && current.length > 0) {
      messages.push(current.join('\r'));
      current = [];
    }
    if (line.trim()) current.push(line);
  }
  if (current.length > 0) messages.push(current.join('\r'));
  return messages;
}
