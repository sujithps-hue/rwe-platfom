import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { Jurisdiction } from '@rwe/compliance-engine';

const JURISDICTIONS: Jurisdiction[] = ['US', 'EU', 'UK', 'AE', 'SA', 'SG', 'CN', 'IN', 'GLOBAL'];
const REGIONS = ['us-east', 'us-west', 'eu-central', 'eu-west', 'uk', 'me-uae', 'me-ksa', 'ap-southeast', 'ap-south', 'cn-north'];

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens' })
  slug!: string;

  @IsIn(REGIONS)
  homeRegion!: string;

  @IsArray()
  @IsIn(JURISDICTIONS, { each: true })
  jurisdictions!: Jurisdiction[];

  @IsOptional()
  @IsIn(['shared_schema', 'dedicated_instance'])
  isolationTier?: 'shared_schema' | 'dedicated_instance';

  @IsOptional()
  @IsString()
  parentTenantId?: string;
}
