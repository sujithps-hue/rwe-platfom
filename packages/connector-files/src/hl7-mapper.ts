import { ConditionOccurrence, Person, VisitConcept, VisitOccurrence } from '@rwe/common-data-model';
import { Hl7Message, component, findSegment, findSegments } from './hl7v2-parser';

const HL7_PATIENT_CLASS_TO_VISIT_CONCEPT: Record<string, VisitConcept> = {
  I: 'inpatient',
  O: 'outpatient',
  E: 'emergency',
};

export interface Hl7MappedEncounter {
  person: Person;
  visit: VisitOccurrence | null;
  conditions: ConditionOccurrence[];
}

/** Maps one parsed ADT-style HL7v2 message (PID/PV1/DG1 segments) to CDM records. */
export function mapHl7Message(message: Hl7Message, sourceConnectorId: string): Hl7MappedEncounter | null {
  const pid = findSegment(message, 'PID');
  if (!pid) return null; // not a patient-carrying message we handle (e.g. an ACK)

  const sourcePatientId = component(pid.fields[2], 0) ?? pid.fields[2] ?? '';
  if (!sourcePatientId) return null;

  const dob = pid.fields[6]; // YYYYMMDD
  const person: Person = {
    personId: crypto.randomUUID(),
    sourcePatientId,
    genderConcept: pid.fields[7] ?? null,
    birthYear: dob && dob.length >= 4 ? Number(dob.slice(0, 4)) : null,
    raceConcept: pid.fields[9] ?? null,
    ethnicityConcept: null,
    locationRegion: component(pid.fields[10], 3) ?? null, // PID-11 state component
    sourceConnectorId: sourceConnectorId,
    createdAt: new Date(),
  };

  const pv1 = findSegment(message, 'PV1');
  let visit: VisitOccurrence | null = null;
  if (pv1) {
    const classCode = pv1.fields[1] ?? 'O';
    const admitDate = pv1.fields[43]; // PV1-44
    visit = {
      visitOccurrenceId: crypto.randomUUID(),
      personId: person.personId,
      visitConcept: HL7_PATIENT_CLASS_TO_VISIT_CONCEPT[classCode] ?? 'outpatient',
      visitStartDate: formatHl7Date(admitDate) ?? new Date().toISOString().slice(0, 10),
      visitEndDate: formatHl7Date(pv1.fields[44]), // PV1-45 discharge date
      careSite: component(pv1.fields[2], 0) ?? null,
      sourceConnectorId: sourceConnectorId,
    };
  }

  const conditions: ConditionOccurrence[] = findSegments(message, 'DG1').map((dg1) => ({
    conditionOccurrenceId: crypto.randomUUID(),
    personId: person.personId,
    visitOccurrenceId: visit?.visitOccurrenceId ?? null,
    conditionConceptCode: component(dg1.fields[2], 0) ?? 'UNKNOWN',
    conditionConceptName: component(dg1.fields[2], 1) ?? null,
    conditionStartDate: formatHl7Date(dg1.fields[4]) ?? new Date().toISOString().slice(0, 10),
    conditionEndDate: null,
    sourceConnectorId: sourceConnectorId,
  }));

  return { person, visit, conditions };
}

function formatHl7Date(value: string | undefined): string | null {
  if (!value || value.length < 8) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}
