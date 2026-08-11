import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CreateDeliveryProofDto } from './dto/create-delivery-proof.dto';
import { UpdateDeliveryProofDto } from './dto/update-delivery-proof.dto';
import { DeliveryProofsService } from './delivery-proofs.service';

@Controller('delivery-proofs')
export class DeliveryProofsController {
  constructor(private readonly deliveryProofsService: DeliveryProofsService) {}

  @Post()
  create(
    @Body() createDeliveryProofDto: CreateDeliveryProofDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.deliveryProofsService.create(createDeliveryProofDto, user);
  }

  @Get()
  findAll() {
    return this.deliveryProofsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deliveryProofsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDeliveryProofDto: UpdateDeliveryProofDto,
  ) {
    return this.deliveryProofsService.update(id, updateDeliveryProofDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deliveryProofsService.remove(id);
  }
}
