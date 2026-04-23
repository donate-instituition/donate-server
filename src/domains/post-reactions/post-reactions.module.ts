import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PostReaction, PostReactionSchema } from './schemas/post-reaction.schema';
import { PostReactionsController } from './post-reactions.controller';
import { PostReactionsService } from './post-reactions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PostReaction.name, schema: PostReactionSchema },
    ]),
  ],
  controllers: [PostReactionsController],
  providers: [PostReactionsService],
})
export class PostReactionsModule {}
