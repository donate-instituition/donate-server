import { Injectable } from '@nestjs/common';

import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

const CAMPAIGNS = [
  {
    id: '1',
    title: 'Material Escolar 2026',
    institution: 'Educação Viva',
    institutionId: 'inst-1',
    category: 'Educação',
    goalFormatted: 'R$ 5.000',
    raisedFormatted: 'R$ 3.200',
    goalCents: 500000,
    raisedCents: 320000,
    progress: 64,
    active: true,
    endsAt: '2026-07-31',
  },
  {
    id: '2',
    title: 'Cestas de Inverno',
    institution: 'Lar Aconchego',
    institutionId: 'inst-2',
    category: 'Alimentação',
    goalFormatted: 'R$ 8.000',
    raisedFormatted: 'R$ 5.600',
    goalCents: 800000,
    raisedCents: 560000,
    progress: 70,
    active: true,
    endsAt: '2026-08-15',
  },
  {
    id: '3',
    title: 'Mutirão de Saúde Comunitária',
    institution: 'Saúde Para Todos',
    institutionId: 'inst-3',
    category: 'Saúde',
    goalFormatted: 'R$ 3.000',
    raisedFormatted: 'R$ 900',
    goalCents: 300000,
    raisedCents: 90000,
    progress: 30,
    active: true,
    endsAt: '2026-09-01',
  },
];

const CAMPAIGN_DETAILS: Record<string, { description: string; donorsCount: number; itemsNeeded?: string[] }> = {
  '1': {
    description:
      'A campanha visa fornecer material escolar completo para 200 crianças de escolas públicas de periferia.',
    donorsCount: 128,
    itemsNeeded: ['Cadernos', 'Lápis e borracha', 'Mochila', 'Uniforme escolar'],
  },
  '2': {
    description:
      'Distribuímos cestas básicas para famílias em situação de insegurança alimentar.',
    donorsCount: 224,
    itemsNeeded: ['Arroz', 'Feijão', 'Óleo', 'Macarrão'],
  },
  '3': {
    description:
      'Organizamos um mutirão com triagem, vacinação e consultas médicas gratuitas.',
    donorsCount: 36,
  },
};

@Injectable()
export class CampaignsService {
  create(createCampaignDto: CreateCampaignDto) {
    return createCampaignDto;
  }

  findAll() {
    return CAMPAIGNS;
  }

  findOne(id: string) {
    const base = CAMPAIGNS.find((campaign) => campaign.id === id);

    if (!base) {
      return { id, message: 'Campanha não encontrada.' };
    }

    return {
      ...base,
      ...CAMPAIGN_DETAILS[id],
    };
  }

  update(id: string, updateCampaignDto: UpdateCampaignDto) {
    return {
      id,
      ...updateCampaignDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
