import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class ReportsOverviewQueryDto {
  @IsOptional()
  @IsIn(['POS', 'DISTRIBUTOR', 'ONLINE'])
  channel?: 'POS' | 'DISTRIBUTOR' | 'ONLINE';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
