/**
 * CategoriesController — expose les catégories financières du vocabulaire.
 *
 * MVP Jour 1 (B4) : GET /categories → namespace 'finance' (dîme, offrande…).
 * Le namespace est celui du manifest MFE-JC (INV-005 : config, pas de hardcode).
 *
 * @traceability MVP-JOUR1-SPEC §3 (B4), DOC-012 Aggregate8 (Vocabulary)
 */
import { Controller, Get, Query } from '@nestjs/common';
import { VocabApplicationService } from './application/vocab.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly vocabService: VocabApplicationService) {}

  /** GET /categories?namespace=finance — liste des termes du namespace. */
  @Get()
  async list(@Query('namespace') namespace?: string) {
    return this.vocabService.listTermsByNamespace(namespace ?? 'finance', false);
  }
}
