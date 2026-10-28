import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RegisterFrontendActionDto } from './dto/actions.dto';
import { FrontendAction, FrontendActionDocument } from './schemas/frontend-action.schema';

export interface FrontendActionDescriptor {
  key: string;
  name: string;
  description: string;
  category?: string;
  inputSchema: Record<string, unknown>;
  requiredPermission?: string;
  target: 'frontend';
}

@Injectable()
export class FrontendActionsService {
  constructor(
    @InjectModel(FrontendAction.name)
    private readonly model: Model<FrontendActionDocument>,
  ) {}

  async upsert(dto: RegisterFrontendActionDto): Promise<FrontendActionDescriptor> {
    const doc = await this.model
      .findOneAndUpdate(
        { key: dto.key },
        { ...dto, updatedAt: new Date() },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean();
    return toDescriptor(doc!);
  }

  async list(): Promise<FrontendActionDescriptor[]> {
    const docs = await this.model.find().lean();
    return docs.map(toDescriptor);
  }

  async findOne(key: string): Promise<FrontendActionDescriptor | null> {
    const doc = await this.model.findOne({ key }).lean();
    return doc ? toDescriptor(doc) : null;
  }
}

function toDescriptor(doc: FrontendAction): FrontendActionDescriptor {
  return {
    key: doc.key,
    name: doc.name,
    description: doc.description,
    category: doc.category,
    inputSchema: doc.inputSchema,
    requiredPermission: doc.requiredPermission,
    target: 'frontend',
  };
}
