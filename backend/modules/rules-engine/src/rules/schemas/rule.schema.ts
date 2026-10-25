import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { RuleBlock } from '../rule-block';

@Schema({ timestamps: true })
export class Rule {
  @Prop({ required: true, unique: true })
  key!: string;

  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  /** JSON Schema describing what `execute()`'s `input` should look like — descriptive only, not enforced (the blocks themselves fail clearly if a block's own shape expectation isn't met). */
  @Prop({ type: Object, default: {} })
  inputSchema!: Record<string, unknown>;

  @Prop({ type: [Object], default: [] })
  blocks!: RuleBlock[];

  /** JSON Schema describing the final block's output — descriptive only, same as `inputSchema`. */
  @Prop({ type: Object, default: {} })
  outputFormat!: Record<string, unknown>;

  createdAt!: Date;
  updatedAt!: Date;
}

export type RuleDocument = Rule & Document;
export const RuleSchema = SchemaFactory.createForClass(Rule);
