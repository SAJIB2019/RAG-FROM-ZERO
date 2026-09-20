import { Body, Controller, Post } from '@nestjs/common';

import { QueryDto } from './dto/query.dto';
import { QueryService } from './query.service';

@Controller('query')
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Post()
  query(@Body() dto: QueryDto) {
    return this.queryService.query(dto);
  }
}
