/**
 * TemplateController - Endpoint REST pour le Template Management
 * @traceable TEMPLATE-MANAGEMENT-SPEC.md §API
 *
 * Note (Phase C) : les guards OrgGuard/PermissionGuard n'existaient pas —
 * la protection RBAC sera branchée via le CapabilityEngine (ADR-018) quand
 * les guards communs seront en place.
 */

import { Controller, Post, Get, Put, Delete, Param, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TemplateService } from './template-service';

export class TemplateCreateInput {
  name: string;
  description?: string;
  dataSourceType: string;
  query: unknown; // QueryExpression sérialisé
  isPublic?: boolean;
}

export class TemplateUpdateInput {
  name?: string;
  description?: string;
  isPublic?: boolean;
  query?: unknown;
}

@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  /** POST /templates - Créer un nouveau template */
  @Post()
  async create(@Body() input: TemplateCreateInput, @Req() req: Request) {
    const { userId, orgId } = this.context(req);
    return await this.templateService.create(userId, orgId, input);
  }

  /** GET /templates - Lister les templates */
  @Get()
  async list(@Req() req: Request) {
    const { userId, orgId } = this.context(req);
    return await this.templateService.list(userId, orgId);
  }

  /** GET /templates/:id - Charger un template */
  @Get(':id')
  async load(@Param('id') id: string, @Req() req: Request) {
    const { userId, orgId } = this.context(req);
    return await this.templateService.load(userId, orgId, id);
  }

  /** PUT /templates/:id - Mettre à jour un template */
  @Put(':id')
  async update(@Param('id') id: string, @Body() input: TemplateUpdateInput, @Req() req: Request) {
    const { userId, orgId } = this.context(req);
    return await this.templateService.update(userId, orgId, id, input);
  }

  /** DELETE /templates/:id - Supprimer un template */
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request) {
    const { userId, orgId } = this.context(req);
    await this.templateService.delete(userId, orgId, id);
    return { success: true };
  }

  /** POST /templates/:id/execute - Exécuter un template pour générer un rapport */
  @Post(':id/execute')
  async execute(@Param('id') id: string, @Req() req: Request) {
    const { userId, orgId } = this.context(req);
    return await this.templateService.execute(userId, orgId, id);
  }

  /** POST /templates/:id/copy - Copier un template */
  @Post(':id/copy')
  async copy(@Param('id') id: string, @Body('name') newName: string, @Req() req: Request) {
    const { userId, orgId } = this.context(req);
    return await this.templateService.copy(userId, orgId, id, newName);
  }

  /** Extraire le contexte utilisateur/org de la requête (middleware auth). */
  private context(req: Request): { userId: string; orgId: string } {
    const user = (req as Request & { user?: { id?: string; orgId?: string } }).user;
    return {
      userId: user?.id ?? '',
      orgId: user?.orgId ?? '',
    };
  }
}

export default TemplateController;
