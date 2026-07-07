const mongoose = require('mongoose');
const kcetDbUri = 'mongodb+srv://freefireb2k444_db_user:6L8JB9yOXIfBTwmg@cluster0.h7nxozh.mongodb.net/kcet_db?appName=Cluster0';

async function run() {
  try {
    await mongoose.connect(kcetDbUri);
    const EngineeringModel = mongoose.model('Cutoff_Engineering', new mongoose.Schema({}, { strict: false }), 'Cutoff_Engineering');
    
    // Find 5 random GM records to clone
    const gmRecords = await EngineeringModel.find({ year: "2023", category: "GM" }).limit(5).lean();
    
    const rkCats = ['SC1G', 'SC1K', 'SC1R', 'SC2G', 'SC2K', 'SC2R', 'SC3G', 'SC3K', 'SC3R', 'SC4G', 'SC4K', 'SC4R'];
    const hkCats = ['SCH1G', 'SCH1K', 'SCH1R', 'SCH2G', 'SCH2K', 'SCH2R', 'SCH3G', 'SCH3K', 'SCH3R', 'SCH4G', 'SCH4K', 'SCH4R'];
    const allCats = [...rkCats, ...hkCats];
    
    const newRecords = [];
    
    for (const r of gmRecords) {
      for (const cat of allCats) {
        const newRecord = { ...r };
        delete newRecord._id; 
        newRecord.category = cat; 
        newRecord.year = "2026";
        newRecord.round = "Mock";
        
        const originalCutoff = parseInt(r.cutoff_rank_num) || 50000;
        newRecord.cutoff_rank_num = originalCutoff + Math.floor(Math.random() * 5000);
        newRecord.cutoff_rank = newRecord.cutoff_rank_num.toString();
        
        newRecords.push(newRecord);
      }
    }
    
    console.log(`Inserting ${newRecords.length} records for all new SC categories...`);
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
