import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '../../auth/decorators/public.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateStripePaymentIntentDto } from './dto/create-stripe-payment-intent.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentsService } from './payments.service';

function enqueueStripeWebhook(
  paymentsService: PaymentsService,
  request: RawBodyRequest<Request>,
  signature?: string,
) {
  return paymentsService.enqueueStripeWebhookEvent(
    request.rawBody,
    signature,
    request.body,
  );
}

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

  @Post('stripe/subscriptions/:id/cancel')
  cancelStripeSubscription(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser | undefined) {
    return this.paymentsService.cancelStripeSubscription(id, user?.sub);
  }

  @Get('stripe/config')
  @Public()
  getStripeConfig() {
    return this.paymentsService.getStripeConfig();
  }

  @Post('stripe/webhook')
  @HttpCode(200)
  @Public()
  handleStripeWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return enqueueStripeWebhook(this.paymentsService, request, signature);
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

@Controller('stripe')
export class StripeWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook')
  @HttpCode(200)
  @Public()
  handleStripeWebhookAlias(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return enqueueStripeWebhook(this.paymentsService, request, signature);
  }
}
