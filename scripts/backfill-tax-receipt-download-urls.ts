import 'dotenv/config';

import { createHmac } from 'crypto';

import mongoose from 'mongoose';

const mongodbUri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET || 'dev-secret';

function createPdfDownloadPath(receiptId: string) {
  const token = createHmac('sha256', jwtSecret)
    .update(`tax-receipt-pdf:${receiptId}`)
    .digest('base64url');

  return `/tax-receipts/${receiptId}/pdf?token=${encodeURIComponent(token)}`;
}

async function main() {
  if (!mongodbUri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(mongodbUri);
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error('MongoDB connection is not ready');
  }

  const receipts = await db
    .collection('tax_receipts')
    .find({})
    .project({ _id: 1, documentUrl: 1 })
    .toArray();

  let updated = 0;

  for (const receipt of receipts) {
    const nextDocumentUrl = createPdfDownloadPath(receipt._id.toString());

    if (receipt.documentUrl === nextDocumentUrl) {
      continue;
    }

    await db
      .collection('tax_receipts')
      .updateOne(
        { _id: receipt._id },
        { $set: { documentUrl: nextDocumentUrl } },
      );
    updated += 1;
  }

  console.log(`Updated ${updated} tax receipt download URL(s).`);
  await mongoose.disconnect();
}

void main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
