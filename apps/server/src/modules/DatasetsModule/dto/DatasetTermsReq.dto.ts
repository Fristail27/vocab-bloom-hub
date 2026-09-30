import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  CUSTOM_LICENSE_NAME_MAX_LENGTH,
  CUSTOM_LICENSE_TEXT_MAX_LENGTH,
  DATASET_ATTRIBUTION_MAX_LENGTH,
  DATASET_TITLE_MAX_LENGTH,
} from '../../../../core/constants/data_licenses';
import { DATASET_NAME_PATTERN } from '../../../../core/constants/datasets';
import { CreateDatasetReqT, DatasetLicenseReqT, UpdateDatasetReqT } from '../../../../types';

// what a link of the terms may be: a page a reader opens
const URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true };

/**
 * The license of a dataset of the instance's own (issue #540): `spdx` of
 * the list, or `name`, `url` and `text` of a license of the owner's own.
 * Which of the two it is, and whether it is complete, the service decides.
 */
export class DatasetLicenseReqDTO implements DatasetLicenseReqT {
  @ApiPropertyOptional({ description: 'A license of the list, by its SPDX identifier' })
  @IsOptional()
  @IsString()
  spdx?: string;

  @ApiPropertyOptional({ description: 'The name of a license of the owner’s own' })
  @IsOptional()
  @IsString()
  @MaxLength(CUSTOM_LICENSE_NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({ description: 'Where a license of the owner’s own is read' })
  @IsOptional()
  @IsUrl(URL_OPTIONS)
  url?: string;

  @ApiPropertyOptional({ description: 'The text of a license of the owner’s own, in full' })
  @IsOptional()
  @IsString()
  @MaxLength(CUSTOM_LICENSE_TEXT_MAX_LENGTH)
  text?: string;
}

export class UpdateDatasetReqDTO implements UpdateDatasetReqT {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(DATASET_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ type: DatasetLicenseReqDTO })
  @IsOptional()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => DatasetLicenseReqDTO)
  license?: DatasetLicenseReqDTO;

  @ApiPropertyOptional({ description: 'The line a consumer of the data has to show' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(DATASET_ATTRIBUTION_MAX_LENGTH)
  attribution?: string;

  @ApiPropertyOptional({ nullable: true, description: 'Where the attribution leads' })
  @IsOptional()
  // an empty string takes the link away, like null
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUrl(URL_OPTIONS)
  attribution_url?: string | null;
}

// the two classes do not extend each other: class-validator merges the
// rules of a class with the ones of its parent, and the optional fields of
// an update would make the ones of a creation optional too
export class CreateDatasetReqDTO implements CreateDatasetReqT {
  @ApiProperty({
    description: 'Lower-case latin, digits and `_`; the tail of the schema and the `source` of the data',
  })
  @IsString()
  @Matches(DATASET_NAME_PATTERN, { message: 'dataset_name_invalid' })
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(DATASET_TITLE_MAX_LENGTH)
  title!: string;

  @ApiProperty({ type: DatasetLicenseReqDTO })
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => DatasetLicenseReqDTO)
  license!: DatasetLicenseReqDTO;

  @ApiProperty({ description: 'The line a consumer of the data has to show' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(DATASET_ATTRIBUTION_MAX_LENGTH)
  attribution!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Where the attribution leads' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUrl(URL_OPTIONS)
  attribution_url?: string | null;
}
