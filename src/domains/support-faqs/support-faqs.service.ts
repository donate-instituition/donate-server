import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { CreateSupportFaqDto, SupportFaqItemDto } from './dto/create-support-faq.dto';
import { UpdateSupportFaqDto } from './dto/update-support-faq.dto';
import { SupportFaq, SupportFaqDocument, SupportFaqItem } from './schemas/support-faq.schema';

function normalizeItems(items?: SupportFaqItemDto[]): SupportFaqItem[] {
  if (!items?.length) {
    throw new BadRequestException('Support FAQ items are required');
  }

  return items
    .map((item, index) => ({
      answer: item.answer?.trim() ?? '',
      order: item.order ?? index,
      question: item.question?.trim() ?? '',
    }))
    .filter((item) => item.question && item.answer)
    .sort((a, b) => a.order - b.order);
}

@Injectable()
export class SupportFaqsService {
  constructor(
    @InjectModel(SupportFaq.name)
    private readonly supportFaqModel: Model<SupportFaqDocument>,
  ) {}

  private async setOnlyCurrent(faqId: Types.ObjectId) {
    await this.supportFaqModel
      .updateMany({ _id: { $ne: faqId } }, { $set: { isCurrent: false } })
      .exec();
  }

  async create(createSupportFaqDto: CreateSupportFaqDto) {
    if (!createSupportFaqDto.version?.trim()) {
      throw new BadRequestException('Support FAQ version is required');
    }

    const items = normalizeItems(createSupportFaqDto.items);

    const supportFaq = await this.supportFaqModel.create({
      title: createSupportFaqDto.title?.trim() || 'Perguntas frequentes',
      version: createSupportFaqDto.version.trim(),
      items,
      isCurrent: Boolean(createSupportFaqDto.isCurrent),
      publishedAt: createSupportFaqDto.isCurrent ? new Date() : undefined,
    });

    if (supportFaq.isCurrent) {
      await this.setOnlyCurrent(supportFaq._id);
    }

    return supportFaq;
  }

  findAll() {
    return this.supportFaqModel.find().sort({ createdAt: -1 }).exec();
  }

  async findCurrent() {
    const supportFaq = await this.supportFaqModel
      .findOne({ isCurrent: true })
      .sort({ publishedAt: -1, createdAt: -1 })
      .exec();

    if (!supportFaq) {
      throw new NotFoundException('No current support FAQ found');
    }

    return supportFaq;
  }

  async findOne(id: string) {
    const supportFaq = await this.supportFaqModel.findById(id).exec();

    if (!supportFaq) {
      throw new NotFoundException('Support FAQ not found');
    }

    return supportFaq;
  }

  async update(id: string, updateSupportFaqDto: UpdateSupportFaqDto) {
    const supportFaq = await this.supportFaqModel.findById(id).exec();

    if (!supportFaq) {
      throw new NotFoundException('Support FAQ not found');
    }

    if (updateSupportFaqDto.title !== undefined) supportFaq.title = updateSupportFaqDto.title.trim();
    if (updateSupportFaqDto.version !== undefined) supportFaq.version = updateSupportFaqDto.version.trim();
    if (updateSupportFaqDto.items !== undefined) supportFaq.items = normalizeItems(updateSupportFaqDto.items);

    if (updateSupportFaqDto.isCurrent !== undefined) {
      supportFaq.isCurrent = updateSupportFaqDto.isCurrent;
      supportFaq.publishedAt = updateSupportFaqDto.isCurrent ? new Date() : supportFaq.publishedAt;
    }

    await supportFaq.save();

    if (supportFaq.isCurrent) {
      await this.setOnlyCurrent(supportFaq._id);
    }

    return supportFaq;
  }

  async remove(id: string) {
    const supportFaq = await this.supportFaqModel.findByIdAndDelete(id).exec();

    if (!supportFaq) {
      throw new NotFoundException('Support FAQ not found');
    }

    return { id };
  }
}
