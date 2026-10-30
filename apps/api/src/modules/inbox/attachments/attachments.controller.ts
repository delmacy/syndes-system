import {
  Controller,
  Get,
  Param,
  Request,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import { parseUuidParam } from '../../core-crm/crm-dtos';
import { tenantOf } from '../../core-crm/crm-request';
import { InboxAttachmentsService } from './inbox-attachments.service';

/**
 * INBOX-04 authorized download. There is no static/public URL for attachment
 * bytes: every request re-runs identity + tenant routing, the attachment
 * metadata is read from the tenant database of that context, and the
 * conversation must remain visible to the acting user/scope. Headers prevent
 * MIME sniffing and caching; the content disposition forces a download with
 * the sanitized display name.
 */
@Controller('api/v1/inbox/attachments')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class AttachmentsController {
  constructor(private readonly attachments: InboxAttachmentsService) {}

  @Get(':id')
  async download(
    @Request() request: IdentityRequest,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { attachment, bytes } = await this.attachments.download(
      tenantOf(request),
      parseUuidParam(id, 'id'),
    );
    response.setHeader('Content-Type', attachment.contentType);
    response.setHeader('Content-Length', String(bytes.byteLength));
    response.setHeader(
      'Content-Disposition',
      contentDisposition(attachment.filename),
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; sandbox",
    );
    return new StreamableFile(bytes);
  }
}

/**
 * RFC 6266/5987 disposition: an ASCII fallback plus the UTF-8 name. Newlines
 * and quotes can never reach the header (filenames are already sanitized).
 */
export function contentDisposition(filename: string): string {
  const fallback = filename
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
