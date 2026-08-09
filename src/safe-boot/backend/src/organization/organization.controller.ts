/**
 * Organization Controller - REST API for organization management.
 */

import { Controller, Post, Get, Param, Delete, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';

import { OrganizationService } from '../organization.service';
import { CreateOrganizationDTO } from './dto/organization.dto';

@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @ApiOperation({ summary: 'Créer une nouvelle organisation' })
  @ApiBody({ type: CreateOrganizationDTO })
  @ApiResponse({ status: 201, description: 'Organisation créée avec succès' })
  @Post()
  async createOrganization(@Body() createData: CreateOrganizationDTO, @Request() req) {
    const currentUser = req.user;
    if (currentUser?.role !== 'superadmin') {
      throw new ForbiddenException('Seul un superadmin peut créer des organisations');
    }
    const organization = await this.organizationService.createOrganization(createData.name, currentUser.sub);
    return { success: true, data: organization };
  }

  @ApiOperation({ summary: 'Obtenir une organisation par son ID' })
  @ApiParam({ name: 'id', description: 'ID de l\'organisation' })
  @Get(':id')
  async getOrganization(@Param('id') id: string) {
    const organization = await this.organizationService.getOrganization(id);
    return { success: true, data: organization };
  }
}
