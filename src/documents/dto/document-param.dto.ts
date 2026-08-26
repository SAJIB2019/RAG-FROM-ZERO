import { IsUUID } from 'class-validator';

export class DocumentParamDto {
  @IsUUID()
  id!: string;
}
