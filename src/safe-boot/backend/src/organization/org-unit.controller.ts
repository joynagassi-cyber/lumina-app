/**
 * OrgUnit Controller - REST API for organizational unit management.
 */

import { Controller, Post, Get, Param, Patch, Delete, Request, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';

import { OrgUnitService } from './org-unit.service';
import { CreateOrgUnitDTO, UpdateOrgUnitDTO } from './dto/orgunit.dto';

@ApiTags('Organizational Units')
@Controller('org-units')
export class OrgUnitController {
  constructor(private readonly orgUnitService: OrgUnitService) {}

  /**
   * Create a new organizational unit within an organization.
   * Endpoint: POST /org-units
   */
  @ApiOperation({ summary: 'Créer une nouvelle unité organisationnelle' })
  @ApiBody({ type: CreateOrgUnitDTO })
  @ApiResponse({ status: 201, description: 'Unité créée avec succès' })
  @Post()
  async createOrgUnit(@Body() createData: CreateOrgUnitDTO, @Request() req) {
    const currentUser = req.user;
    // Only admins/superadmin can create org units
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'superadmin') {
      throw new ForbiddenException('Seuls les admins/superadmin peuvent créer des unités');
    }
    const unit = await this.orgUnitService.createOrgUnit(
      createData.organizationId,
      createData.name,
      createData.parentId,
      currentUser.sub,
      createData.type,
    );
    return { success: true, data: unit };
  }

  /**
   * Get an organizational unit by ID.
   * Endpoint: GET /org-units/:id
   */
  @ApiOperation({ summary: 'Obtenir une unité organisationnelle par son ID' })
  @ApiParam({ name: 'id', description: 'ID de l\'unité' })
  @Get(':id')
  async getOrgUnit(@Param('id') id: string) {
    const unit = await this.orgUnitService.getOrgUnit(id);
    return { success: true, data: unit };
  }

  /**
   * List all org units within an organization.
   * Endpoint: GET /org-units?organizationId=:id
   */
  @ApiOperation({ summary: 'Lister toutes les unités d\'une organisation' })
  @Get()
  async listOrgUnits(@Request() req) {
    const organizationId = req.query.organizationId as string;
    if (!organizationId) {
      throw new NotFoundException('Paramètre organizationId requis');
    }
    const units = await this.orgUnitService.listOrgUnits(organizationId);
    return { success: true, data: units };
  }

  /**
   * Update an organizational unit.
   * Endpoint: PATCH /org-units/:id
   */
  @ApiOperation({ summary: 'Mettre à jour une unité organisationnelle' })
  @ApiParam({ name: 'id', description: 'ID de l\'unité' })
  @ApiBody({ type: UpdateOrgUnitDTO })
  @Patch(':id')
  async updateOrgUnit(@Param('id') id: string, @Body() updateData: UpdateOrgUnitDTO, @Request() req) {
    const currentUser = req.user;
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'superadmin') {
      throw new ForbiddenException('Seuls les admins/superadmin peuvent mettre à jour');
    }
    const unit = await this.orgUnitService.updateOrgUnit(id, updateData, currentUser.sub);
    return { success: true, data: unit };
  }

  /**
   * Delete (archive) an organizational unit.
   * Endpoint: DELETE /org-units/:id
   */
  @ApiOperation({ summary: 'Archiver une unité organisationnelle' })
  @Delete(':id')
  async deleteOrgUnit(@Param('id') id: string, @Request() req) {
    const currentUser = req.user;
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'superadmin') {
      throw new ForbiddenException('Seuls les admins/superadmin peuvent archiver');
    }
    await this.orgUnitService.deleteOrgUnit(id, currentUser.sub);
    return { success: true, message: 'Unité archivée avec succès' };
  }
}
