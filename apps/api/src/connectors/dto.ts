import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class CreateConnectorDto {
  @IsString()
  @IsNotEmpty()
  connectorType!: string; // must match a type from ConnectorsService.availableConnectorTypes()

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsString()
  @IsNotEmpty()
  credentialSecretId!: string;

  @IsObject()
  settings!: Record<string, unknown>;
}
