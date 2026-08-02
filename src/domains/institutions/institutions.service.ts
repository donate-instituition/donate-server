import { Injectable } from '@nestjs/common';

import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';

const INSTITUTIONS = [
  {
    id: 'inst-1',
    name: 'Educação Viva',
    category: 'Educação',
    city: 'São Paulo',
    state: 'SP',
    activeCampaigns: 2,
    verified: true,
    description: 'Promovemos acesso à educação de qualidade para crianças em situação de vulnerabilidade.',
  },
  {
    id: 'inst-2',
    name: 'Lar Aconchego',
    category: 'Alimentação',
    city: 'Curitiba',
    state: 'PR',
    activeCampaigns: 1,
    verified: true,
    description: 'Distribuímos cestas básicas e refeições para famílias em insegurança alimentar.',
  },
  {
    id: 'inst-3',
    name: 'Saúde Para Todos',
    category: 'Saúde',
    city: 'Belo Horizonte',
    state: 'MG',
    activeCampaigns: 1,
    verified: false,
    description: 'Oferecemos atendimento médico gratuito em comunidades de periferia.',
  },
];

const INSTITUTION_DETAILS: Record<string, { foundedYear: number; email: string; website?: string }> = {
  'inst-1': { foundedYear: 2010, email: 'contato@educacaoviva.org.br', website: 'https://educacaoviva.org.br' },
  'inst-2': { foundedYear: 2015, email: 'contato@laraconchego.org.br' },
  'inst-3': { foundedYear: 2018, email: 'saude@saudeparatodos.org.br', website: 'https://saudeparatodos.org.br' },
};

@Injectable()
export class InstitutionsService {
  create(createInstitutionDto: CreateInstitutionDto) {
    return createInstitutionDto;
  }

  findAll() {
    return INSTITUTIONS;
  }

  findOne(id: string) {
    const base = INSTITUTIONS.find((institution) => institution.id === id);

    if (!base) {
      return { id, message: 'Instituição não encontrada.' };
    }

    return {
      ...base,
      ...INSTITUTION_DETAILS[id],
      campaigns: [
        { id: '1', title: 'Material Escolar 2026', active: true },
        { id: '2', title: 'Cestas de Inverno', active: true },
      ].filter((campaign) => campaign.id !== '3' || id === 'inst-3'),
    };
  }

  update(id: string, updateInstitutionDto: UpdateInstitutionDto) {
    return {
      id,
      ...updateInstitutionDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
