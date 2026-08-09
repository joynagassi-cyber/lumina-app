/**
 * OrgUnitService - Manages organizational units within organizations.
 */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { OrgUnit } from './org-unit.entity';
import { OrganizationService } from '../organization.service';
import { OrgHierarchyResolver } from './services/org-hierarchy-resolver.service';
import { AuditService, AuditAction } from '../../shared/audit/audit.service';

@Injectable()
export class OrgUnitService {
  constructor(
    @InjectRepository(OrgUnit) private readonly orgUnitRepository: Repository<OrgUnit>,
    private readonly organizationService: OrganizationService,
    private readonly hierarchyResolver: OrgHierarchyResolver,
    private readonly auditService: AuditService,
  ) {}

  async createOrgUnit(
    organizationId: string,
    name: string,
    parentId?: string,
    createdBy: string,
    type: string = 'department',
  ): Promise<OrgUnit> {
    // Validate organization exists
    await this.organizationService.getOrganization(organizationId);

    // Validate name
    if (!name || name.trim().length === 0) {
      throw new ForbiddenException('Le nom de l\'unité est requis');
    }

    // Validate parent if provided
    if (parentId) {
      const parent = await this.orgUnitRepository.findOneBy({ id: parentId });
      if (!parent) {
        throw new NotFoundException(`Unité parente non trouvée: ${parentId}`);
      }
      if (parent.organizationId !== organizationId) {
        throw new ForbiddenException('L\'unité parente n\'appartient pas à cette organisation');
      }
      // Validate no cycle would be created
      await this.hierarchyResolver.validateHierarchyAddition(parentId, name);
    }

    // Calculate depth
    const parentDepth = parentId ? await this.hierarchyResolver.getDepth(parentId) : 0;
    const newDepth = parentDepth + 1;
    this.hierarchyResolver.validateMaxDepth(newDepth);

    const unit = this.orgUnitRepository.create({
      organizationId,
      name: name.trim(),
      type,
      parentId: parentId || null,
      niveau_profondeur: newDepth,
      status: 'active',
      createdBy,
    });

    const savedUnit = await this.orgUnitRepository.save(unit);

    // Log audit event
    await this.auditService.logAction(createdBy, {
      action: AuditAction.ORG_UNIT_CREATED,
      entity_id: savedUnit.id,
      after: { name: savedUnit.name, parentId, type, depth: newDepth },
    });

    return savedUnit;
  }

  async getOrgUnit(id: string): Promise<OrgUnit> {
    const unit = await this.orgUnitRepository.findOneBy({ id });
    if (!unit) {
      throw new NotFoundException('Unité organisationnelle non trouvée');
    }
    return unit;
  }

  async listOrgUnits(organizationId: string): Promise<OrgUnit[]> {
    return await this.orgUnitRepository.find({ where: { organizationId, status: 'active' } });
  }

  async updateOrgUnit(id: string, updates: { name?: string; type?: string; parentId?: string }, updatedBy: string): Promise<OrgUnit> {
    const unit = await this.getOrgUnit(id);
    const oldParentId = unit.parentId;

    if (updates.name !== undefined) unit.name = updates.name;
    if (updates.type !== undefined) unit.type = updates.type;
    if (updates.parentId !== undefined) {
      // Validate hierarchy change
      const newParentId = updates.parentId || null;
      if (newParentId !== oldParentId) {
        const newParent = newParentId ? await this.orgUnitRepository.findOneBy({ id: newParentId }) : null;
        if (newParent && newParent.organizationId !== unit.organizationId) {
          throw new ForbiddenException('L\'unité parente n\'appartient pas à cette organisation');
        }
        await this.hierarchyResolver.validateHierarchyAddition(newParentId || '', id);
        const newDepth = newParentId ? (await this.hierarchyResolver.getDepth(newParentId)) + 1 : 0;
        this.hierarchyResolver.validateMaxDepth(newDepth);
        unit.parentId = newParentId;
        unit.niveau_profondeur = newDepth;
      }
    }

    await this.orgUnitRepository.save(unit);

    // Log audit event
    await this.auditService.logAction(updatedBy, {
      action: AuditAction.ORG_UNIT_UPDATED,
      entity_id: id,
      before: { parentId: oldParentId, type: unit.type },
      after: { parentId: unit.parentId, type: unit.type },
    });

    return unit;
  }

  async deleteOrgUnit(id: string, deletedBy: string): Promise<void> {
    const unit = await this.getOrgUnit(id);
    unit.status = 'archived';
    await this.orgUnitRepository.save(unit);

    // Log audit event
    await this.auditService.logAction(deletedBy, {
      action: AuditAction.ORG_UNIT_DELETED,
      entity_id: id,
      after: { status: 'archived' },
    });
  }
}
