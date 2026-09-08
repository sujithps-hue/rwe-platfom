import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { VocabularyService } from './vocabulary.service';

@Controller('vocabulary')
@UseGuards(JwtAuthGuard)
export class VocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  @Get('concepts/search')
  search(@Query('q') q: string, @Query('domain') domain?: string, @Query('vocabulary') vocabulary?: string) {
    return this.vocabularyService.search(q ?? '', { domainId: domain, vocabularyId: vocabulary });
  }
}
