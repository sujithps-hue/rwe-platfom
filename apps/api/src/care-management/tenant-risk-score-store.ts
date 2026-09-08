import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RiskScore } from '@rwe/common-data-model';
import { RiskScoreStore } from '@rwe/predictive-models';
import { PrismaService } from '../common/prisma.service';

const SCHEMA_NAME_RE = /^tenant_[a-z0-9_]+$/;

@Injectable()
export class TenantRiskScoreStore implements RiskScoreStore {
  constructor(private readonly prisma: PrismaService) {}

  async save(tenantId: string, scores: RiskScore[]): Promise<void> {
    if (scores.length === 0) return;
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    await this.saveToSchema(tenant.schemaName, scores);
  }

  async saveToSchema(schemaName: string, scores: RiskScore[]): Promise<void> {
    if (!SCHEMA_NAME_RE.test(schemaName)) {
      throw new Error(`Refusing to write risk scores to schema "${schemaName}": failed validation`);
    }
    const schema = Prisma.raw(`"${schemaName}"`);
    for (const s of scores) {
      await this.prisma.$executeRaw`
        INSERT INTO ${schema}.risk_score (risk_score_id, person_id, model_id, score, score_band, computed_at, explanation)
        VALUES (gen_random_uuid(), ${s.personId}::uuid, ${s.modelId}, ${s.score}, ${s.scoreBand}, ${s.computedAt}, ${JSON.stringify(s.explanation)}::jsonb)
      `;
    }
  }

  async listForPatient(schemaName: string, personId: string): Promise<RiskScore[]> {
    if (!SCHEMA_NAME_RE.test(schemaName)) {
      throw new Error(`Refusing to read risk scores from schema "${schemaName}": failed validation`);
    }
    const schema = Prisma.raw(`"${schemaName}"`);
    const rows = await this.prisma.$queryRaw<
      { risk_score_id: string; person_id: string; model_id: string; score: number; score_band: string; computed_at: Date; explanation: unknown }[]
    >`
      SELECT risk_score_id, person_id, model_id, score, score_band, computed_at, explanation
      FROM ${schema}.risk_score WHERE person_id = ${personId}::uuid
      ORDER BY computed_at DESC
    `;
    return rows.map((r) => ({
      riskScoreId: r.risk_score_id,
      personId: r.person_id,
      modelId: r.model_id,
      score: r.score,
      scoreBand: r.score_band as RiskScore['scoreBand'],
      computedAt: r.computed_at,
      explanation: r.explanation as Record<string, number> | null,
    }));
  }
}
