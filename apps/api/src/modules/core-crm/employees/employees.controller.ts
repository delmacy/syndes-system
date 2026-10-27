import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import {
  parseCreateEmployeeDto,
  parseListQueryParams,
  parseUpdateEmployeeDto,
  parseUuidParam,
} from '../crm-dtos';
import { tenantOf } from '../crm-request';
import {
  EmployeeListResult,
  EmployeeResource,
  EmployeesService,
} from './employees.service';

/**
 * CRM-05 Employee routes: staff/attendant staff profiles. Employee is NOT a
 * login and stores no credentials; reads are member-visible and only
 * `tenant_admin` manages profiles (matches the CRM-00 authorization matrix
 * where membership/customer scopes remain Control Plane state).
 */
@Controller('api/v1/crm/employees')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(
    @Request() request: IdentityRequest,
    @Query() query: Record<string, unknown>,
  ): Promise<EmployeeListResult> {
    const parsed = parseListQueryParams(query);
    return this.employees.list(tenantOf(request), parsed.page, parsed.pageSize);
  }

  @Get(':id')
  get(
    @Request() request: IdentityRequest,
    @Param('id') id: string,
  ): Promise<EmployeeResource> {
    return this.employees.get(
      tenantOf(request),
      parseUuidParam(id, 'employeeId'),
    );
  }

  @Post()
  create(
    @Request() request: IdentityRequest,
    @Body() body: unknown,
  ): Promise<EmployeeResource> {
    return this.employees.create(
      tenantOf(request),
      parseCreateEmployeeDto(body),
    );
  }

  @Patch(':id')
  update(
    @Request() request: IdentityRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<EmployeeResource> {
    return this.employees.update(
      tenantOf(request),
      parseUuidParam(id, 'employeeId'),
      parseUpdateEmployeeDto(body),
    );
  }
}
