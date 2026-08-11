import mongoose from 'mongoose';

import { env } from '../src/config/env';

async function main() {
  await mongoose.connect(env.mongodbUri);
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error('MongoDB connection is not ready');
  }

  const users = await db
    .collection('users')
    .find({})
    .project({ _id: 1, settings: 1 })
    .toArray();

  let updated = 0;

  for (const user of users) {
    const notifications = user.settings?.notifications;

    if (
      notifications &&
      'donations' in notifications &&
      'campaigns' in notifications &&
      'conversations' in notifications &&
      'emailDigestEnabled' in notifications
    ) {
      continue;
    }

    const pushWasEnabled = notifications?.push !== false;

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          'settings.notifications': {
            donations: pushWasEnabled,
            campaigns: true,
            conversations: pushWasEnabled,
            emailDigestEnabled: false,
          },
        },
      },
    );
    updated += 1;
  }

  console.log(`Updated ${updated} user notification setting(s).`);
  await mongoose.disconnect();
}

void main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
