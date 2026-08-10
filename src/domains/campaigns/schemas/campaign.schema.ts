import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import {
  CampaignDonationType,
  CampaignItemCategory,
  CampaignStatus,
  CampaignVisibility,
} from '../models';
import type {
  CampaignAcceptedItem,
  CampaignAddress,
  CampaignGoal,
  CampaignProgress,
  CampaignStats,
} from '../models';

export type CampaignDocument = HydratedDocument<Campaign>;

@Schema({
  collection: 'campaigns',
  timestamps: true,
  versionKey: false,
})
export class Campaign {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Institution' })
  institutionId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  createdByUserId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true })
  bannerUrl?: string;

  @Prop({
    required: true,
    enum: CampaignStatus,
    type: String,
    default: CampaignStatus.DRAFT,
  })
  status!: CampaignStatus;

  @Prop({
    required: true,
    type: [String],
    enum: CampaignDonationType,
    default: [],
  })
  donationTypes!: CampaignDonationType[];

  @Prop({
    type: [
      raw({
        category: {
          type: String,
          enum: CampaignItemCategory,
        },
        name: {
          type: String,
          trim: true,
        },
        description: {
          type: String,
          trim: true,
        },
      }),
    ],
    default: [],
  })
  acceptedItems!: CampaignAcceptedItem[];

  @Prop({
    type: raw({
      moneyTarget: {
        type: Number,
        default: 0,
      },
      itemsTarget: {
        type: Number,
        default: 0,
      },
    }),
    default: {
      moneyTarget: 0,
      itemsTarget: 0,
    },
  })
  goal?: CampaignGoal;

  @Prop({
    type: raw({
      moneyRaised: {
        type: Number,
        default: 0,
      },
      itemsRaised: {
        type: Number,
        default: 0,
      },
    }),
    default: {
      moneyRaised: 0,
      itemsRaised: 0,
    },
  })
  progress?: CampaignProgress;

  @Prop({
    required: true,
    enum: CampaignVisibility,
    type: String,
    default: CampaignVisibility.PUBLIC,
  })
  visibility!: CampaignVisibility;

  @Prop()
  startAt?: Date;

  @Prop()
  endAt?: Date;

  @Prop({
    type: raw({
      sameAsInstitution: {
        type: Boolean,
        default: true,
      },
      street: {
        type: String,
        trim: true,
      },
      number: {
        type: String,
        trim: true,
      },
      district: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
      state: {
        type: String,
        trim: true,
      },
      zipCode: {
        type: String,
        trim: true,
      },
      country: {
        type: String,
        trim: true,
      },
      location: {
        type: MongooseSchema.Types.Mixed,
        default: {
          type: 'Point',
          coordinates: [],
        },
      },
    }),
    default: {
      sameAsInstitution: true,
    },
  })
  address?: CampaignAddress;

  @Prop({
    type: [String],
    default: [],
  })
  tags!: string[];

  @Prop({
    type: raw({
      followersCount: {
        type: Number,
        default: 0,
      },
      likesCount: {
        type: Number,
        default: 0,
      },
      commentsCount: {
        type: Number,
        default: 0,
      },
      sharesCount: {
        type: Number,
        default: 0,
      },
      donationsCount: {
        type: Number,
        default: 0,
      },
      postsCount: {
        type: Number,
        default: 0,
      },
    }),
    default: {
      followersCount: 0,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      donationsCount: 0,
      postsCount: 0,
    },
  })
  stats?: CampaignStats;

  createdAt!: Date;

  updatedAt!: Date;
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);
