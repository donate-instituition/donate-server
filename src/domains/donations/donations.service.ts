import { Injectable } from '@nestjs/common';

import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto';

const DONATIONS = [
  {
    id: 'don-1',
    campaignId: '1',
    campaignTitle: 'Material Escolar 2026',
    institutionName: 'Educação Viva',
    amountCents: 8000,
    amountFormatted: 'R$ 80,00',
    status: 'completed',
    createdAt: '2026-04-15T10:00:00Z',
  },
  {
    id: 'don-2',
    campaignId: '2',
    campaignTitle: 'Cestas de Inverno',
    institutionName: 'Lar Aconchego',
    amountCents: 4500,
    amountFormatted: 'R$ 45,00',
    status: 'cancelled',
    createdAt: '2026-04-01T14:30:00Z',
  },
];

@Injectable()
export class DonationsService {
  create(createDonationDto: CreateDonationDto) {
    const donation = {
      id: `don-${Date.now()}`,
      campaignId: createDonationDto.campaignId,
      campaignTitle: 'Campanha',
      institutionName: 'Instituição',
      amountCents: createDonationDto.amountCents,
      amountFormatted: `R$ ${(createDonationDto.amountCents / 100).toFixed(2).replace('.', ',')}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    return { donation };
  }

  findAll() {
    return DONATIONS;
  }

  findMyDonations() {
    return DONATIONS;
  }

  findOne(id: string) {
    return DONATIONS.find((donation) => donation.id === id) ?? { id };
  }

  update(id: string, updateDonationDto: UpdateDonationDto) {
    return {
      id,
      ...updateDonationDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
