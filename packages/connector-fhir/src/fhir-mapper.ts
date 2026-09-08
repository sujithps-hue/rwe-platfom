import {
  CdmRecordBatch,
  ClinicalNote,
  ConditionOccurrence,
  DrugExposure,
  Person,
  VisitConcept,
  VisitOccurrence,
  emptyCdmRecordBatch,
} from '@rwe/common-data-model';

/** Minimal structural types for the FHIR R4 resources this connector consumes. Full FHIR
 * resources have many more optional fields; only what the mapper reads is modeled here. */
export interface FhirPatient {
  resourceType: 'Patient';
  id: string;
  gender?: string;
  birthDate?: string; // YYYY-MM-DD
  extension?: Array<{ url: string; valueString?: string; extension?: Array<{ url: string; valueCoding?: { code?: string; display?: string } }> }>;
  address?: Array<{ state?: string; country?: string }>;
}

export interface FhirEncounter {
  resourceType: 'Encounter';
  id: string;
  subject: { reference: string };
  class?: { code?: string };
  period?: { start?: string; end?: string };
  serviceProvider?: { display?: string };
}

export interface FhirCondition {
  resourceType: 'Condition';
  id: string;
  subject: { reference: string };
  encounter?: { reference: string };
  code?: { coding?: Array<{ system?: string; code?: string; display?: string }> };
  onsetDateTime?: string;
  abatementDateTime?: string;
}

export interface FhirMedicationRequest {
  resourceType: 'MedicationRequest';
  id: string;
  subject: { reference: string };
  encounter?: { reference: string };
  medicationCodeableConcept?: { coding?: Array<{ system?: string; code?: string; display?: string }> };
  authoredOn?: string;
  dosageInstruction?: Array<{ text?: string }>;
}

export interface FhirDocumentReference {
  resourceType: 'DocumentReference';
  id: string;
  subject: { reference: string };
  context?: { encounter?: Array<{ reference: string }>; period?: { start?: string } };
  type?: { coding?: Array<{ code?: string; display?: string }> };
  content: Array<{ attachment: { contentType?: string; data?: string } }>; // base64-encoded text in `data` for text/plain notes
}

const FHIR_ENCOUNTER_CLASS_TO_VISIT_CONCEPT: Record<string, VisitConcept> = {
  IMP: 'inpatient',
  AMB: 'outpatient',
  EMER: 'emergency',
  VR: 'telehealth',
};

function referenceId(reference: string): string {
  // "Patient/abc123" -> "abc123"
  return reference.split('/').pop() ?? reference;
}

export class FhirMapper {
  constructor(private readonly sourceConnectorId: string) {}

  mapPatient(patient: FhirPatient): Person {
    return {
      personId: crypto.randomUUID(),
      sourcePatientId: patient.id,
      genderConcept: patient.gender ?? null,
      birthYear: patient.birthDate ? Number(patient.birthDate.slice(0, 4)) : null,
      raceConcept: null,
      ethnicityConcept: null,
      locationRegion: patient.address?.[0]?.state ?? patient.address?.[0]?.country ?? null,
      sourceConnectorId: this.sourceConnectorId,
      createdAt: new Date(),
    };
  }

  mapEncounter(encounter: FhirEncounter, personId: string): VisitOccurrence {
    return {
      visitOccurrenceId: crypto.randomUUID(),
      personId,
      visitConcept: FHIR_ENCOUNTER_CLASS_TO_VISIT_CONCEPT[encounter.class?.code ?? ''] ?? 'outpatient',
      visitStartDate: (encounter.period?.start ?? new Date().toISOString()).slice(0, 10),
      visitEndDate: encounter.period?.end ? encounter.period.end.slice(0, 10) : null,
      careSite: encounter.serviceProvider?.display ?? null,
      sourceConnectorId: this.sourceConnectorId,
    };
  }

  mapCondition(condition: FhirCondition, personId: string, visitOccurrenceId: string | null): ConditionOccurrence {
    const coding = condition.code?.coding?.find((c) => c.system?.includes('snomed')) ?? condition.code?.coding?.[0];
    return {
      conditionOccurrenceId: crypto.randomUUID(),
      personId,
      visitOccurrenceId,
      conditionConceptCode: coding?.code ?? 'UNKNOWN',
      conditionConceptName: coding?.display ?? null,
      conditionStartDate: (condition.onsetDateTime ?? new Date().toISOString()).slice(0, 10),
      conditionEndDate: condition.abatementDateTime ? condition.abatementDateTime.slice(0, 10) : null,
      sourceConnectorId: this.sourceConnectorId,
    };
  }

  mapMedicationRequest(med: FhirMedicationRequest, personId: string, visitOccurrenceId: string | null): DrugExposure {
    const coding =
      med.medicationCodeableConcept?.coding?.find((c) => c.system?.includes('rxnorm')) ??
      med.medicationCodeableConcept?.coding?.[0];
    return {
      drugExposureId: crypto.randomUUID(),
      personId,
      visitOccurrenceId,
      drugConceptCode: coding?.code ?? 'UNKNOWN',
      drugConceptName: coding?.display ?? null,
      exposureStartDate: (med.authoredOn ?? new Date().toISOString()).slice(0, 10),
      exposureEndDate: null,
      dose: med.dosageInstruction?.[0]?.text ?? null,
      sourceConnectorId: this.sourceConnectorId,
    };
  }

  mapDocumentReference(doc: FhirDocumentReference, personId: string, visitOccurrenceId: string | null): ClinicalNote | null {
    const textContent = doc.content.find((c) => c.attachment.contentType === 'text/plain' && c.attachment.data);
    if (!textContent?.attachment.data) return null; // skip non-text attachments (e.g. scanned PDFs) — out of scope for the NLP enrichment pipeline
    return {
      clinicalNoteId: crypto.randomUUID(),
      personId,
      visitOccurrenceId,
      noteDate: (doc.context?.period?.start ?? new Date().toISOString()).slice(0, 10),
      noteType: doc.type?.coding?.[0]?.display ?? null,
      noteText: Buffer.from(textContent.attachment.data, 'base64').toString('utf-8'),
      sourceConnectorId: this.sourceConnectorId,
      enrichmentStatus: 'pending',
    };
  }

  /** Resolves the CDM personId for a FHIR patient reference, given the batch built so far. */
  static findPersonId(batch: CdmRecordBatch, fhirPatientId: string): string | undefined {
    return batch.persons.find((p) => p.sourcePatientId === fhirPatientId)?.personId;
  }

  static referenceId = referenceId;
  static emptyBatch = emptyCdmRecordBatch;
}
