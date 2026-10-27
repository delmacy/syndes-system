import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import { tenantOf } from '../crm-request';
import type { CsvEntity } from './crm-csv.service';
import { CrmCsvService } from './crm-csv.service';

function parseEntity(value: unknown): CsvEntity {
  if (value === 'person' || value === 'organization') return value;
  throw new BadRequestException({ code: 'invalid_entity_type' });
}

@Controller('api/v1/crm/csv')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class CrmCsvController {
  constructor(private readonly csv: CrmCsvService) {}

  @Post('import')
  @HttpCode(200)
  import(
    @Request() request: IdentityRequest & { body: unknown },
    @Query('entityType') entityType: string,
  ) {
    return this.csv.importCsv(
      tenantOf(request),
      parseEntity(entityType),
      request.body,
    );
  }

  @Get('export')
  async export(
    @Request() request: IdentityRequest,
    @Query('entityType') entityType: string,
    @Res() response: Response,
  ): Promise<void> {
    const entity = parseEntity(entityType);
    const content = await this.csv.exportCsv(tenantOf(request), entity);
    response
      .set({
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="crm-${entity}.csv"`,
        'cache-control': 'no-store',
      })
      .send(content);
  }
}
