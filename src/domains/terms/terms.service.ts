import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { UsersService } from '../users/users.service';
import { CreateTermDto } from './dto/create-term.dto';
import { UpdateTermDto } from './dto/update-term.dto';
import { Term, TermDocument } from './schemas/term.schema';

@Injectable()
export class TermsService {
  constructor(
    @InjectModel(Term.name) private readonly termModel: Model<TermDocument>,
    private readonly usersService: UsersService,
  ) {}

  private async setOnlyCurrent(termId: Types.ObjectId) {
    await this.termModel
      .updateMany({ _id: { $ne: termId } }, { $set: { isCurrent: false } })
      .exec();
    await this.usersService.markTermsPendingForVersionChange();
  }

  async create(createTermDto: CreateTermDto) {
    if (!createTermDto.version?.trim()) {
      throw new BadRequestException('Term version is required');
    }

    if (!createTermDto.content?.trim()) {
      throw new BadRequestException('Term content is required');
    }

    const term = await this.termModel.create({
      title:
        createTermDto.title?.trim() ||
        'Termos de Uso e Política de Privacidade',
      version: createTermDto.version.trim(),
      content: createTermDto.content,
      isCurrent: Boolean(createTermDto.isCurrent),
      publishedAt: createTermDto.isCurrent ? new Date() : undefined,
    });

    if (term.isCurrent) {
      await this.setOnlyCurrent(term._id);
    }

    return term;
  }

  findAll() {
    return this.termModel.find().sort({ createdAt: -1 }).exec();
  }

  async findCurrent() {
    const term = await this.termModel
      .findOne({ isCurrent: true })
      .sort({ publishedAt: -1, createdAt: -1 })
      .exec();

    if (!term) {
      throw new NotFoundException('No current terms found');
    }

    return term;
  }

  async findOne(id: string) {
    const term = await this.termModel.findById(id).exec();

    if (!term) {
      throw new NotFoundException('Term not found');
    }

    return term;
  }

  async update(id: string, updateTermDto: UpdateTermDto) {
    const term = await this.termModel.findById(id).exec();

    if (!term) {
      throw new NotFoundException('Term not found');
    }

    if (updateTermDto.title !== undefined)
      term.title = updateTermDto.title.trim();
    if (updateTermDto.version !== undefined)
      term.version = updateTermDto.version.trim();
    if (updateTermDto.content !== undefined)
      term.content = updateTermDto.content;

    if (updateTermDto.isCurrent !== undefined) {
      term.isCurrent = updateTermDto.isCurrent;
      term.publishedAt = updateTermDto.isCurrent
        ? new Date()
        : term.publishedAt;
    }

    await term.save();

    if (term.isCurrent) {
      await this.setOnlyCurrent(term._id);
    }

    return term;
  }

  async remove(id: string) {
    const term = await this.termModel.findByIdAndDelete(id).exec();

    if (!term) {
      throw new NotFoundException('Term not found');
    }

    return { id };
  }

  async acceptCurrent(userId: string) {
    const currentTerm = await this.findCurrent();
    await this.usersService.acceptTerms(userId, currentTerm.version);

    return {
      acceptedTermsVersion: currentTerm.version,
      termsAccepted: true,
      termsAcceptedAt: new Date().toISOString(),
    };
  }
}
