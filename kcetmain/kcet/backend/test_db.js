require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');

async function run() {
  if (!process.env.MONGO_URI) {
     console.error('No MONGO_URI');
     process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const EngineeringModel = mongoose.model('EngineeringModel', new mongoose.Schema({}, { strict: false }), 'kcet_engineering');
  // Find a record that has year 2026
  const doc2026 = await EngineeringModel.findOne({ year: 2026 });
  const doc2026str = await EngineeringModel.findOne({ year: "2026" });
  
  // Find a record that has round 'Mock' or 'mock'
  const mock1 = await EngineeringModel.findOne({ round: /mock/i });

  console.log('--- 2026 Num ---');
  console.log(JSON.stringify(doc2026, null, 2));
  console.log('--- 2026 Str ---');
  console.log(JSON.stringify(doc2026str, null, 2));
  console.log('--- Mock ---');
  console.log(JSON.stringify(mock1, null, 2));

  process.exit(0);
}
run();
