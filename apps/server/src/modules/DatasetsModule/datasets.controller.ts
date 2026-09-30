import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DatasetT, DatasetUpdatesT, DatasetsListT } from '../../../types';
import { AdminGuard } from '../AuthModule/guards/admin.guard';
import { DatasetsService } from './datasets.service';
import { DatasetUpdatesService } from './dataset-updates.service';
import { CreateDatasetReqDTO, UpdateDatasetReqDTO } from './dto/DatasetTermsReq.dto';

/**
 * The datasets of the instance (issue #527): admin surface only. The list is
 * the catalog the code ships with what is installed; a dataset is installed
 * from a file of its source (EnDatasetInstall) and its terms are the
 * catalog's. Next to them, the datasets of the instance's own (issue #540):
 * created empty, under the terms the owner states. Creating, installing,
 * activating and deleting need a driver with schemas — on SQLite they answer
 * 409 `datasets_not_supported`.
 */
@ApiTags('Datasets')
@Controller('/api/en/datasets')
export class DatasetsController {
  constructor(
    private readonly datasetsService: DatasetsService,
    private readonly datasetUpdatesService: DatasetUpdatesService,
  ) {}

  @Get()
  @UseGuards(AdminGuard)
  async list(): Promise<DatasetsListT> {
    return this.datasetsService.list();
  }

  /**
   * Whether the sources of the installed datasets have newer files (issue
   * #530): the notice on the card of a dataset. The sources are asked once a
   * day at most; `UPDATE_CHECK=false` asks none
   */
  @Get('updates')
  @UseGuards(AdminGuard)
  async updates(): Promise<DatasetUpdatesT> {
    return this.datasetUpdatesService.check();
  }

  /** An empty dataset of the instance's own (issue #540) */
  @Post()
  @UseGuards(AdminGuard)
  async create(@Body() body: CreateDatasetReqDTO): Promise<DatasetT> {
    return this.datasetsService.create(body);
  }

  /** The terms of a dataset of the owner's; a dataset of the catalog answers 409 `dataset_terms_fixed` */
  @Patch(':name')
  @UseGuards(AdminGuard)
  async update(@Param('name') name: string, @Body() body: UpdateDatasetReqDTO): Promise<DatasetT> {
    return this.datasetsService.updateTerms(name, body);
  }

  @Post(':name/activate')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  async activate(@Param('name') name: string): Promise<DatasetT> {
    return this.datasetsService.activate(name);
  }

  @Delete(':name')
  @UseGuards(AdminGuard)
  async remove(@Param('name') name: string): Promise<{ success: true }> {
    await this.datasetsService.remove(name);
    return { success: true };
  }
}
