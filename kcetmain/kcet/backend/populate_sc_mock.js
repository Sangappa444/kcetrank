const mongoose = require('mongoose');

const kcetDbUri = 'mongodb+srv://freefireb2k444_db_user:6L8JB9yOXIfBTwmg@cluster0.h7nxozh.mongodb.net/kcet_db?appName=Cluster0';

async function run() {
  try {
    await mongoose.connect(kcetDbUri);
    console.log('Connected to DB.');
    
    const EngineeringModel = mongoose.model('Cutoff_Engineering', new mongoose.Schema({}, { strict: false }), 'Cutoff_Engineering');
    
    // Find some SCG records from 2023 to clone
    const scgRecords = await EngineeringModel.find({ year: "2023", category: "SCG" }).limit(50).lean();
    console.log(`Found ${scgRecords.length} SCG records for 2023 to clone.`);
    
    const newRecords = [];
    
    // Clone them to SC1G, SC2G, SC1H, SC3K, SC3R
    const categoriesToCreate = ['SC1G', 'SC2G', 'SC3K', 'SC3R', 'SC1H', 'SCH1G'];
    
    for (const r of scgRecords) {
      for (const cat of categoriesToCreate) {
        const newRecord = { ...r };
        delete newRecord._id; // Remove old ID
        newRecord.category = cat; // Change category
        newRecord.year = "2026";
        newRecord.round = "Mock";
        
        // Give it a random cutoff around the original
        const originalCutoff = parseInt(r.cutoff_rank_num) || 50000;
        newRecord.cutoff_rank_num = originalCutoff + Math.floor(Math.random() * 5000);
        newRecord.cutoff_rank = newRecord.cutoff_rank_num.toString();
        
        newRecords.push(newRecord);
      }
    }
    
    console.log(`Inserting ${newRecords.length} mock records for SC internal categories...`);
    await EngineeringModel.insertMany(newRecords);
    console.log('Done!');
    
  } catch(e) {
    console.error(e);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}
run();
