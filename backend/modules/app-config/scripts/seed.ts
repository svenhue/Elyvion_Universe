import mongoose from 'mongoose';
import { AppConfig, AppConfigSchema } from '../src/app-configs/schemas/app-config.schema';

async function main() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/elyvion_app_config';
  await mongoose.connect(uri);
  const Model = mongoose.model(AppConfig.name, AppConfigSchema);

  const doc = await Model.findOneAndUpdate(
    { applicationId: 'default' },
    {
      applicationId: 'default',
      name: 'Default App',
      version: '1.0.0',
      rootComponentId: 'root',
      components: [
        {
          id: 'root',
          name: 'button',
          attributes: {
            label: 'Hallo Elyvion!',
            variant: 'primary',
            style: { margin: '2rem' },
          },
          children: [],
        },
      ],
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  console.log(`Seeded app config "${doc?.applicationId}" with ${doc?.components.length} component(s)`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
