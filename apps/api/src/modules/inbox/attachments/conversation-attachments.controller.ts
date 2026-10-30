import {
  Controller,
  Get,
  Param,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import { parseUuidParam } from '../../core-crm/crm-dtos';
import { tenantOf } from '../../core-crm/crm-request';
import { INBOX_ATTACHMENT_HARD_MAX_BYTES } from './inbox-attachment.config';
import type { InboxUploadFile } from './inbox-attachment.validation';
import { InboxAttachmentsService } from './inbox-attachments.service';

interface UploadedMultipartFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * INBOX-04 upload/list route. `file` is the only accepted multipart part;
 * multer enforces the reviewed hard ceiling before the handler runs (Nest
 * maps `LIMIT_FILE_SIZE` to 413), and the service applies the configured
 * limit and the full allowlist/signature validation. The client filename is
 * display metadata only.
 */
@Controller('api/v1/inbox/conversations')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class ConversationAttachmentsController {
  constructor(private readonly attachments: InboxAttachmentsService) {}

  @Get(':id/attachments')
  list(@Request() request: IdentityRequest, @Param('id') id: string) {
    return this.attachments.list(tenantOf(request), parseUuidParam(id, 'id'));
  }

  @Post(':id/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: INBOX_ATTACHMENT_HARD_MAX_BYTES,
        files: 1,
        fields: 0,
        parts: 2,
      },
    }),
  )
  upload(
    @Request() request: IdentityRequest,
    @Param('id') id: string,
    @UploadedFile() file: UploadedMultipartFile | undefined,
  ) {
    const upload: InboxUploadFile | undefined = file
      ? {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer,
        }
      : undefined;
    return this.attachments.create(
      tenantOf(request),
      parseUuidParam(id, 'id'),
      upload,
    );
  }
}
