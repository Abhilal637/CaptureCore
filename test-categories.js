const mongoose = require('mongoose');
const Category = require('./models/category');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/capturecore', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function createSampleCategories() {
  try {
    // Clear existing categories
    await Category.deleteMany({});
    
    // Create main categories
    const cameras = await Category.create({
      name: 'Cameras',
      description: 'Professional and consumer cameras',
      active: true
    });
    
    const lenses = await Category.create({
      name: 'Lenses',
      description: 'Camera lenses and optics',
      active: true
    });
    
    const accessories = await Category.create({
      name: 'Accessories',
      description: 'Camera accessories and equipment',
      active: true
    });
    
    // Create subcategories for Cameras
    await Category.create([
      {
        name: 'DSLR Cameras',
        description: 'Digital Single Lens Reflex cameras',
        parentCategory: cameras._id,
        active: true
      },
      {
        name: 'Mirrorless Cameras',
        description: 'Mirrorless interchangeable lens cameras',
        parentCategory: cameras._id,
        active: true
      },
      {
        name: 'Point & Shoot',
        description: 'Compact digital cameras',
        parentCategory: cameras._id,
        active: true
      }
    ]);
    
    // Create subcategories for Lenses
    await Category.create([
      {
        name: 'Prime Lenses',
        description: 'Fixed focal length lenses',
        parentCategory: lenses._id,
        active: true
      },
      {
        name: 'Zoom Lenses',
        description: 'Variable focal length lenses',
        parentCategory: lenses._id,
        active: true
      },
      {
        name: 'Wide Angle',
        description: 'Wide angle lenses',
        parentCategory: lenses._id,
        active: true
      }
    ]);
    
    // Create subcategories for Accessories
    await Category.create([
      {
        name: 'Tripods',
        description: 'Camera tripods and supports',
        parentCategory: accessories._id,
        active: true
      },
      {
        name: 'Lighting',
        description: 'Studio and portable lighting',
        parentCategory: accessories._id,
        active: true
      },
      {
        name: 'Bags & Cases',
        description: 'Camera bags and protective cases',
        parentCategory: accessories._id,
        active: true
      }
    ]);
    
    console.log('✅ Sample categories created successfully!');
    console.log('\n📋 Category Structure:');
    
    // Display the hierarchy
    const allCategories = await Category.find({}).populate('parentCategory', 'name').sort({ name: 1 });
    
    allCategories.forEach(cat => {
      if (!cat.parentCategory) {
        console.log(`\n📁 ${cat.name}`);
        const subcategories = allCategories.filter(sub => sub.parentCategory && sub.parentCategory._id.toString() === cat._id.toString());
        subcategories.forEach(sub => {
          console.log(`   └─ ${sub.name}`);
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating sample categories:', error);
  } finally {
    mongoose.connection.close();
  }
}

createSampleCategories(); 