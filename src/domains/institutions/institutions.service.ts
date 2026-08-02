import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { Institution, InstitutionDocument } from './schemas/institution.schema';

@Injectable()
export class InstitutionsService {
  constructor(
    @InjectModel(Institution.name) private readonly institutionModel: Model<InstitutionDocument>,
  ) {}

  private toAppInstitution(institution: InstitutionDocument | any) {
    return {
      id: institution._id?.toString() ?? institution.id,
      name: institution.displayName || institution.legalName,
      category: institution.acceptedDonationTypes?.[0] ?? 'Outros',
      city: institution.address?.city ?? 'São Paulo',
      state: institution.address?.state ?? 'SP',
      activeCampaigns: institution.stats?.campaignsCount ?? 0,
      verified: institution.verification?.isVerified ?? false,
      description: institution.description ?? 'Descrição indisponível.',
    };
  }

  private async ensureSeedData() {
    const existingCount = await this.institutionModel.countDocuments().exec();

    if (existingCount > 0) {
      return;
    }

    await this.institutionModel.create([
      {
        legalName: 'Educação Viva',
        displayName: 'Educação Viva',
        cnpj: '00000000000100',
        email: 'contato@educacaoviva.org.br',
        description: 'Promovemos acesso à educação de qualidade para crianças em situação de vulnerabilidade.',
        status: 'ACTIVE',
        verification: { isVerified: true },
        address: { city: 'São Paulo', state: 'SP' },
        acceptedDonationTypes: ['MONEY'],
        taxReceiptEnabled: true,
      },
      {
        legalName: 'Lar Aconchego',
        displayName: 'Lar Aconchego',
        cnpj: '00000000000200',
        email: 'contato@laraconchego.org.br',
        description: 'Distribuímos cestas básicas e refeições para famílias em insegurança alimentar.',
        status: 'ACTIVE',
        verification: { isVerified: true },
        address: { city: 'Curitiba', state: 'PR' },
        acceptedDonationTypes: ['MONEY'],
        taxReceiptEnabled: true,
      },
    ]);
  }

  async create(createInstitutionDto: CreateInstitutionDto) {
    await this.ensureSeedData();
    return this.institutionModel.create(createInstitutionDto);
  }

  async findAll() {
    await this.ensureSeedData();
    const institutions = await this.institutionModel.find().sort({ createdAt: -1 }).lean().exec();
    return institutions.map((institution) => this.toAppInstitution(institution));
  }

  async findOne(id: string) {
    await this.ensureSeedData();
    const institution = await this.institutionModel.findById(id).lean().exec();

    if (!institution) {
      throw new NotFoundException(`Instituição ${id} não encontrada.`);
    }

    return {
      ...this.toAppInstitution(institution),
      foundedYear: 2010,
      email: institution.email,
      website: institution.website ?? undefined,
      campaigns: [],
    };
  }

  update(id: string, updateInstitutionDto: UpdateInstitutionDto) {
    return this.institutionModel.findByIdAndUpdate(id, updateInstitutionDto, { new: true }).exec();
  }

  remove(id: string) {
    return this.institutionModel.findByIdAndDelete(id).exec();
  }
}
