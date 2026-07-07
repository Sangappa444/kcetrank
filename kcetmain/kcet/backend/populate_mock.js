const mongoose = require('mongoose');

const kcetDbUri = 'mongodb+srv://freefireb2k444_db_user:6L8JB9yOXIfBTwmg@cluster0.h7nxozh.mongodb.net/kcet_db?appName=Cluster0';

async function run() {
  try {
    await mongoose.connect(kcetDbUri);
    console.log('Connected to DB.');
    
    const EngineeringModel = mongoose.model('Cutoff_Engineering', new mongoose.Schema({}, { strict: false }), 'Cutoff_Engineering');
    
    // Find all 2023 data
    const records2023 = await EngineeringModel.find({ year: "2023" }).lean();
    console.log(`Found ${records2023.length} records for 2023.`);
    
    if (records2023.length === 0) {
      console.log('No 2023 data found to clone.');
      process.exit(0);
    }
    
    // Check if 2026 Mock already exists to avoid duplicates
    const existingMock = await EngineeringModel.countDocuments({ year: "2026", round: "Mock" });
    if (existingMock > 0) {
      console.log(`2026 Mock already has ${existingMock} records. Deleting them to replace...`);
      await EngineeringModel.deleteMany({ year: "2026", round: "Mock" });
    }
    
    const mockRecords = records2023.map(r => {
      const newRecord = { ...r };
      delete newRecord._id; // Remove old ID
      newRecord.year = "2026";
      newRecord.round = "Mock";
      return newRecord;
    });
    
    console.log(`Inserting ${mockRecords.length} mock records...`);
    await EngineeringModel.insertMany(mockRecords);
    console.log('Done! 2026 Mock data is now populated.');
    
  } catch(e) {
    console.error(e);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}
run();
