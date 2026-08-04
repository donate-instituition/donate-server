import 'dotenv/config';

import mongoose from 'mongoose';

import { env } from '../src/config/env';
import { Campaign, CampaignSchema } from '../src/domains/campaigns/schemas/campaign.schema';
import { Institution, InstitutionSchema } from '../src/domains/institutions/schemas/institution.schema';

async function main() {
  const [, , campaignId, stripeConnectAccountId] = process.argv;

  if (!campaignId || !stripeConnectAccountId) {
    throw new Error('Usage: npm run stripe:connect:campaign -- <campaignId> <acct_...>');
  }

  if (
    !/^acct_[A-Za-z0-9]+$/.test(stripeConnectAccountId) ||
    stripeConnectAccountId.includes('SEU_ID') ||
    stripeConnectAccountId.includes('TESTE')
  ) {
    throw new Error('Stripe connected account id must be a real test acct_... from Stripe.');
  }

  await mongoose.connect(env.mongodbUri);

  try {
    const CampaignModel = mongoose.model(Campaign.name, CampaignSchema);
    const InstitutionModel = mongoose.model(Institution.name, InstitutionSchema);
    const campaign = await CampaignModel.findById(campaignId).lean().exec();

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found.`);
    }

    const institution = await InstitutionModel.findByIdAndUpdate(
      campaign.institutionId,
      {
        $set: {
          acceptsRecurringDonations: true,
          stripeConnectAccountId,
        },
      },
      { new: true },
    ).lean().exec();

    if (!institution) {
      throw new Error(`Institution ${campaign.institutionId.toString()} not found.`);
    }

    console.log(`Updated institution ${institution._id.toString()}`);
    console.log(`Name: ${institution.displayName || institution.legalName}`);
    console.log(`stripeConnectAccountId: ${institution.stripeConnectAccountId}`);
    console.log(`acceptsRecurringDonations: ${institution.acceptsRecurringDonations}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
