import { Module } from '@nestjs/common';
import { DatasetsModule } from '../DatasetsModule/datasets.module';
import { PublicApiModule } from '../PublicApiModule/public-api.module';
import { DictReaderService } from './dict-reader.service';
import { DictServerService } from './dict-server.service';

@Module({
  imports: [DatasetsModule, PublicApiModule],
  providers: [DictReaderService, DictServerService],
})
export class DictModule {}
