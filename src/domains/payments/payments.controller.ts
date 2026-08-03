import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateStripePaymentIntentDto } from './dto/create-stripe-payment-intent.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.create(createPaymentDto);
  }

  @Post('stripe/payment-intents')
  createStripePaymentIntent(
    @Body() createStripePaymentIntentDto: CreateStripePaymentIntentDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.paymentsService.createStripePaymentIntent(
      createStripePaymentIntentDto,
      user?.sub,
      idempotencyKey,
    );
  }

  @Post('stripe/payment-intents/:id/confirm')
  confirmStripePaymentIntent(@Param('id') id: string) {
    return this.paymentsService.confirmStripePaymentIntent(id);
  }

  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePaymentDto: UpdatePaymentDto) {
    return this.paymentsService.update(id, updatePaymentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paymentsService.remove(id);
  }
}
