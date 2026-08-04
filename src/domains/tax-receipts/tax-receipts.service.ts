import { createHmac, timingSafeEqual } from 'crypto';

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import PDFDocument from 'pdfkit';

import { env } from '../../config/env';
import { EmailJobsService } from '../../notifications/email/email-jobs.service';
import { ObjectStorageService } from '../../storage/object-storage.service';
import { Campaign, CampaignDocument } from '../campaigns/schemas/campaign.schema';
import { Donation, DonationDocument } from '../donations/schemas/donation.schema';
import { Institution, InstitutionDocument } from '../institutions/schemas/institution.schema';
import { NotificationType } from '../notifications/models';
import { Notification, NotificationDocument } from '../notifications/schemas/notification.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { TaxReceiptType } from './models';
import { CreateTaxReceiptDto } from './dto/create-tax-receipt.dto';
import { UpdateTaxReceiptDto } from './dto/update-tax-receipt.dto';
import { TaxReceipt, TaxReceiptDocument } from './schemas/tax-receipt.schema';

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
    @InjectModel(TaxReceipt.name) private readonly taxReceiptModel: Model<TaxReceiptDocument>,
    @InjectModel(Donation.name) private readonly donationModel: Model<DonationDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Campaign.name) private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(Institution.name) private readonly institutionModel: Model<InstitutionDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
    private readonly emailJobsService: EmailJobsService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  private formatCurrency(amount: number) {
    return `R$ ${amount.toFixed(2).replace('.', ',')}`;
  }

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
    return this.taxReceiptModel.findByIdAndUpdate(id, updateTaxReceiptDto, { new: true }).exec();
  }

  remove(id: string) {
    return this.taxReceiptModel.findByIdAndDelete(id).exec();
  }

  async getPdfDownloadUrl(id: string, token?: string) {
    this.assertValidPdfDownloadToken(id, token);
    const receipt = await this.findOne(id);
    const objectKey = receipt.metadata?.storageObjectKey;

    if (!objectKey) {
      throw new NotFoundException('Tax receipt PDF not generated yet');
    }

    return this.objectStorage.getSignedDownloadUrl({
      contentType: receipt.metadata?.storageContentType ?? 'application/pdf',
      filename: `${receipt.receiptNumber}.pdf`,
      key: objectKey,
    });
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

  async generateForPayment(donationId: string, paymentId: string) {
    const [donation, payment] = await Promise.all([
      this.donationModel.findById(donationId).exec(),
      this.paymentModel.findById(paymentId).exec(),
    ]);

    if (!donation || !payment) {
      throw new NotFoundException('Donation or payment not found for receipt generation');
    }

    const [campaign, institution, donor] = await Promise.all([
      this.campaignModel.findById(donation.campaignId).lean().exec(),
      this.institutionModel.findById(donation.institutionId).lean().exec(),
      this.userModel.findById(donation.donorUserId).lean().exec(),
    ]);

    if (!institution || !donor) {
      throw new NotFoundException('Institution or donor not found for receipt generation');
    }

    const serviceFeeAmount = Number((payment.gatewayPayload as any)?.serviceFeeAmount ?? 0) / 100;
    const serviceFeeBps = Number((payment.gatewayPayload as any)?.serviceFeeBps ?? 0);
    const grossAmount = payment.amount / 100;
    const netAmount = Math.max(grossAmount - serviceFeeAmount, 0);
    const receiptNumber = `ED-${new Date().getFullYear()}-${payment._id.toString().slice(-8).toUpperCase()}`;

    let receipt = await this.taxReceiptModel
      .findOne({ 'metadata.paymentId': payment._id.toString() })
      .exec();

    if (!receipt) {
      receipt = await this.taxReceiptModel.create({
        amount: grossAmount,
        donationId: donation._id,
        donorUserId: donation.donorUserId,
        institutionId: donation.institutionId,
        issuedAt: new Date(),
        metadata: {
          campaignTitle: campaign?.title ?? 'Campanha',
          donationKind: (payment.gatewayPayload as any)?.donationKind ?? 'single',
          donorCpfMasked: donor.cpf ? `***.${donor.cpf.slice(-6, -3)}.${donor.cpf.slice(-3)}` : undefined,
          grossAmount,
          institutionCnpj: institution.cnpj,
          netAmount,
          paymentId: payment._id.toString(),
          serviceFeeAmount,
          serviceFeeBps,
          year: new Date().getFullYear(),
        },
        receiptNumber,
        type: TaxReceiptType.DONATION_RECEIPT,
      });
    }

    const storedObject = await this.generatePdf(receipt, {
      campaignTitle: campaign?.title ?? 'Campanha',
      donorName: donor.fullName ?? donor.email,
      grossAmount,
      institutionId: donation.institutionId.toString(),
      institutionName: institution.displayName || institution.legalName,
      netAmount,
      serviceFeeAmount,
      serviceFeeBps,
    });

    receipt.documentUrl = TaxReceiptsService.createPdfDownloadPath(receipt._id.toString());
    receipt.metadata = {
      ...(receipt.metadata ?? {}),
      storageBucket: storedObject.bucket,
      storageChecksum: storedObject.checksum,
      storageContentType: storedObject.contentType,
      storageObjectKey: storedObject.key,
      storageProvider: storedObject.provider,
      storageSize: storedObject.size,
    };
    await receipt.save();

    await this.notifyDonor(donor, receipt, {
      campaignTitle: campaign?.title ?? 'Campanha',
      grossAmount,
      institutionName: institution.displayName || institution.legalName,
    });

    return receipt;
  }

  private async generatePdf(
    receipt: TaxReceiptDocument,
    input: {
      campaignTitle: string;
      donorName: string;
      grossAmount: number;
      institutionId: string;
      institutionName: string;
      netAmount: number;
      serviceFeeAmount: number;
      serviceFeeBps: number;
    },
  ) {
    const filename = `${receipt.receiptNumber}.pdf`;
    const objectKey = `receipts/${receipt.issuedAt.getFullYear()}/${input.institutionId}/${filename}`;

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc
        .fontSize(22)
        .fillColor('#167A5A')
        .text('EloDoar', { continued: false })
        .moveDown(0.4);
      doc
        .fontSize(16)
        .fillColor('#102A24')
        .text('Recibo de doação', { continued: false })
        .moveDown();

      doc.fontSize(11).fillColor('#5E6E68');
      doc.text(`Recibo: ${receipt.receiptNumber}`);
      doc.text(`Emitido em: ${receipt.issuedAt.toLocaleString('pt-BR')}`);
      doc.moveDown();

      doc.fontSize(13).fillColor('#102A24');
      doc.text(`Doador: ${input.donorName}`);
      doc.text(`Instituição beneficiada: ${input.institutionName}`);
      doc.text(`Campanha: ${input.campaignTitle}`);
      doc.moveDown();

      doc.fontSize(12);
      doc.text(`Valor pago pelo doador: ${this.formatCurrency(input.grossAmount)}`);
      doc.text(`Taxa de serviço EloDoar: ${this.formatCurrency(input.serviceFeeAmount)} (${(input.serviceFeeBps / 100).toFixed(2).replace('.', ',')}%)`);
      doc.text(`Valor destinado à instituição: ${this.formatCurrency(input.netAmount)}`);
      doc.moveDown();

      doc
        .fontSize(10)
        .fillColor('#5E6E68')
        .text('Pagamento processado pela Stripe. A doação é destinada diretamente à conta conectada da instituição, com retenção da taxa de serviço da plataforma quando aplicável.');

      doc.end();
    });

    return this.objectStorage.putObject({
      body: pdfBuffer,
      contentDisposition: `inline; filename="${filename}"`,
      contentType: 'application/pdf',
      key: objectKey,
    });
  }

  private async notifyDonor(
    donor: UserDocument | any,
    receipt: TaxReceiptDocument,
    input: {
      campaignTitle: string;
      grossAmount: number;
      institutionName: string;
    },
  ) {
    if (donor.settings?.notifications?.push !== false) {
      await this.notificationModel.updateOne(
        { 'data.receiptNumber': receipt.receiptNumber },
        {
          $setOnInsert: {
            body: `Sua doação para ${input.campaignTitle} foi confirmada.`,
            data: {
              donationId: receipt.donationId.toString(),
              receiptId: receipt._id.toString(),
              receiptNumber: receipt.receiptNumber,
            },
            title: 'Doação confirmada',
            type: NotificationType.DONATION_STATUS_UPDATED,
            userId: receipt.donorUserId,
          },
        },
        { upsert: true },
      ).exec();
    }

    if (donor.settings?.notifications?.email !== false) {
      await this.emailJobsService.sendDonationReceiptEmail({
        amountFormatted: this.formatCurrency(input.grossAmount),
        campaignTitle: input.campaignTitle,
        institutionName: input.institutionName,
        name: donor.fullName ?? donor.email,
        receiptNumber: receipt.receiptNumber,
        to: donor.email,
        userId: donor._id.toString(),
      });
    }
  }
}
