import { PartialType } from '@nestjs/swagger';
import { AddColumnDto } from './add-column.dto';

export class UpdateColumnDto extends PartialType(AddColumnDto) {}
