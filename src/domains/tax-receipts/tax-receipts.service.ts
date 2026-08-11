import { createHmac, timingSafeEqual } from 'crypto';

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { env } from '../../config/env';
import { ObjectStorageService } from '../../storage/object-storage.service';
import { CreateTaxReceiptDto } from './dto/create-tax-receipt.dto';
import { UpdateTaxReceiptDto } from './dto/update-tax-receipt.dto';
import { TaxReceipt, TaxReceiptDocument } from './schemas/tax-receipt.schema';

// Receipt generation (generateForPayment/generatePdf, triggered by the
// receipt.generate queue) moved to donate-workers — it writes the same
// `tax_receipts` collection this service reads. `createPdfDownloadPath`'s
// token format must stay identical between the two repos: donate-workers
// signs it, this service's getPdfObject verifies it.
@Injectable()
export class TaxReceiptsService {
  static createPdfDownloadPath(receiptId: string) {
    const token = TaxReceiptsService.signPdfDownloadToken(receiptId);
    return `/tax-receipts/${receiptId}/pdf?token=${encodeURIComponent(token)}`;
  }

  private static signPdfDownloadToken(receiptId: string) {
    return createHmac('sha256', env.jwtSecret)
      .update(`tax-receipt-pdf:${receiptId}`)
      .digest('base64url');
  }

  constructor(
    @InjectModel(TaxReceipt.name)
    private readonly taxReceiptModel: Model<TaxReceiptDocument>,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  create(createTaxReceiptDto: CreateTaxReceiptDto) {
    return this.taxReceiptModel.create(createTaxReceiptDto);
  }

  findAll() {
    return this.taxReceiptModel.find().sort({ issuedAt: -1 }).exec();
  }

  async findOne(id: string) {
    const receipt = await this.taxReceiptModel.findById(id).exec();

    if (!receipt) {
      throw new NotFoundException('Tax receipt not found');
    }

    return receipt;
  }

  update(id: string, updateTaxReceiptDto: UpdateTaxReceiptDto) {
    return this.taxReceiptModel
      .findByIdAndUpdate(id, updateTaxReceiptDto, { returnDocument: 'after' })
      .exec();
  }

  remove(id: string) {
    return this.taxReceiptModel.findByIdAndDelete(id).exec();
  }

  async getPdfObject(id: string, token?: string) {
    this.assertValidPdfDownloadToken(id, token);
    const receipt = await this.findOne(id);
    const objectKey = receipt.metadata?.storageObjectKey;

    if (!objectKey) {
      throw new NotFoundException('Tax receipt PDF not generated yet');
    }

    const object = await this.objectStorage.getObjectStream(objectKey);

    return {
      ...object,
      contentType:
        object.contentType ??
        receipt.metadata?.storageContentType ??
        'application/pdf',
      filename: `${receipt.receiptNumber}.pdf`,
    };
  }

  private assertValidPdfDownloadToken(receiptId: string, token?: string) {
    if (!token) {
      throw new ForbiddenException('Receipt download token is required.');
    }

    const expected = TaxReceiptsService.signPdfDownloadToken(receiptId);
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(token);

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new ForbiddenException('Invalid receipt download token.');
    }
  }
}
