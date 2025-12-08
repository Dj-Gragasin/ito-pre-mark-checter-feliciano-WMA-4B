const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Database connection config
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'activecore',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Common navigation/noise words to filter out from ingredients and instructions
const NOISE_WORDS = [
  'skip to',
  'primary navigation',
  'main content',
  'sidebar',
  'new?',
  'start here',
  'all recipes',
  'course',
  'breakfast',
  'lunch',
  'appetizers',
  'dessert',
  'dinner',
  'ingredient',
  'panlasang pinoy',
  'your top source',
  'this post may contain',
  'affiliate links',
  'disclosure policy',
  'submit your question',
  'have a question',
  'comments',
  'document.getelementbyid',
  'vanjo merano',
  'creator of',
  'goal is to introduce',
  'this blog was',
  'says',
  'posted on',
  'at',
  'am',
  'pm',
  'thank you',
  'feedback',
  'sounds like',
  'glad you liked',
  'read more',
  'huge fan of',
  'ultimate showdown',
  'delectable',
  'img',
  'decoding',
  'async',
  'alignnone',
  'size-full',
  'wp-image',
  'src',
  'alt',
  'width',
  'height',
  'srcset',
  'sizes',
  'min-width',
  'calc',
  '100vw',
  'vw',
  'px',
  'jpg',
  'png',
  'gif',
];

// Estimate nutritional values based on dish name and ingredients
function estimateNutrition(name, ingredients) {
  // Default values
  let calories = 350;
  let protein = 20;
  let carbs = 30;
  let fats = 12;

  const lowerName = name.toLowerCase();
  const lowerIngredients = ingredients.toLowerCase();

  // Adjust based on main ingredient
  if (lowerIngredients.includes('chicken') || lowerIngredients.includes('pork') || lowerIngredients.includes('beef')) {
    protein = 28;
    calories = 400;
    if (!lowerIngredients.includes('rice') && !lowerIngredients.includes('noodle')) {
      carbs = 15;
      fats = 18;
    }
  }

  if (lowerIngredients.includes('fish') || lowerIngredients.includes('shrimp') || lowerIngredients.includes('seafood')) {
    protein = 25;
    calories = 280;
    carbs = 10;
    fats = 8;
  }

  if (lowerIngredients.includes('vegetable') || lowerIngredients.includes('salad')) {
    calories = 180;
    protein = 12;
    carbs = 25;
    fats = 5;
  }

  if (lowerIngredients.includes('rice')) {
    carbs = 50;
    fats = 5;
  }

  if (lowerName.includes('soup')) {
    calories = 220;
    protein = 15;
    carbs = 25;
    fats = 5;
  }

  return { calories, protein, carbs, fats };
}

// Extract real ingredients from messy array
function cleanIngredients(ingredientsArray) {
  if (!Array.isArray(ingredientsArray)) return '';

  const cleaned = ingredientsArray
    .filter((item) => {
      if (!item || typeof item !== 'string') return false;
      const lower = item.toLowerCase().trim();
      // Filter out noise words
      return (
        lower.length > 2 &&
        lower.length < 150 &&
        !NOISE_WORDS.some((noise) => lower.includes(noise)) &&
        !/^https?:\/\//.test(lower) &&
        !lower.includes('px') &&
        !lower.includes('img')
      );
    })
    .map((item) => item.trim())
    .slice(0, 10); // Keep first 10 actual ingredients

  return cleaned.join(', ');
}

// Extract actual cooking instructions from messy array
function cleanInstructions(instructionsArray) {
  if (!Array.isArray(instructionsArray)) return '';

  const cleaned = instructionsArray
    .filter((item) => {
      if (!item || typeof item !== 'string') return false;
      const lower = item.toLowerCase().trim();
      // Filter out noise and keep substantial text
      return (
        lower.length > 20 &&
        !NOISE_WORDS.some((noise) => lower.includes(noise)) &&
        !/^https?:\/\//.test(lower) &&
        !lower.includes('px') &&
        !lower.includes('img') &&
        !lower.includes('document.') &&
        !lower.startsWith('<')
      );
    })
    .map((item) => item.trim())
    .slice(0, 5); // Keep first 5 substantial instructions

  return cleaned.join(' ');
}

// Categorize dish based on name and ingredients
function categorizeDish(name, ingredients) {
  const lower = name.toLowerCase();
  const ingLower = ingredients.toLowerCase();

  if (lower.includes('soup')) return 'Soups';
  if (lower.includes('salad')) return 'Salads';
  if (lower.includes('sandwich') || lower.includes('quesadilla')) return 'Sandwiches';
  if (ingLower.includes('fish') || ingLower.includes('shrimp') || ingLower.includes('seafood')) return 'Seafood';
  if (ingLower.includes('pork')) return 'Pork Dishes';
  if (ingLower.includes('beef')) return 'Beef Dishes';
  if (ingLower.includes('chicken')) return 'Chicken Dishes';
  if (lower.includes('vegetable') || lower.includes('vegan') || lower.includes('vegetarian')) return 'Vegetables';
  if (ingLower.includes('rice') || ingLower.includes('noodle')) return 'Rice & Noodles';

  return 'Main Course';
}

// Clean a single recipe entry
function cleanRecipe(recipe) {
  if (!recipe.title || typeof recipe.title !== 'string') return null;

  const name = recipe.title.trim().substring(0, 100);
  const ingredients = cleanIngredients(recipe.ingredients);
  const instructions = cleanInstructions(recipe.instructions);

  // Skip if we couldn't extract meaningful data
  if (!ingredients || !instructions) return null;

  const category = categorizeDish(name, ingredients);
  const { calories, protein, carbs, fats } = estimateNutrition(name, ingredients);

  return {
    name,
    category,
    ingredients,
    instructions,
    calories,
    protein,
    carbs,
    fats,
  };
}

// Main import function
async function importRecipes() {
  const connection = await pool.getConnection();

  try {
    console.log('📖 Reading recipes from JSON file...');
    const filePath = path.join(__dirname, '../../data/recipes.json');
    const rawData = fs.readFileSync(filePath, 'utf8');
    const recipes = JSON.parse(rawData);

    if (!Array.isArray(recipes)) {
      console.error('❌ JSON is not an array');
      process.exit(1);
    }

    console.log(`📊 Found ${recipes.length} recipes in JSON`);

    // Create table if it doesn't exist
    console.log('🗄️  Creating/checking table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS filipino_dishes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        category VARCHAR(100) DEFAULT 'Main Course',
        ingredients LONGTEXT,
        instructions LONGTEXT,
        calories INT DEFAULT 350,
        protein INT DEFAULT 20,
        carbs INT DEFAULT 30,
        fats INT DEFAULT 12,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        INDEX idx_name (name)
      )
    `);

    // Clear existing data
    console.log('🗑️  Clearing existing recipes...');
    await connection.query('TRUNCATE TABLE filipino_dishes');

    let imported = 0;
    let skipped = 0;

    console.log('🧹 Cleaning and importing recipes...');

    for (const recipe of recipes) {
      try {
        const cleaned = cleanRecipe(recipe);

        if (!cleaned) {
          skipped++;
          continue;
        }

        // Insert into database
        await connection.query(
          'INSERT INTO filipino_dishes (name, category, ingredients, instructions, calories, protein, carbs, fats) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            cleaned.name,
            cleaned.category,
            cleaned.ingredients,
            cleaned.instructions,
            cleaned.calories,
            cleaned.protein,
            cleaned.carbs,
            cleaned.fats,
          ]
        );

        imported++;
        if (imported % 10 === 0) {
          console.log(`✅ Imported ${imported}...`);
        }
      } catch (err) {
        // Duplicate name or other error - skip
        skipped++;
      }
    }

    console.log('\n✨ Import complete!');
    console.log(`✅ Imported: ${imported} recipes`);
    console.log(`⏭️  Skipped: ${skipped} recipes`);

    // Show sample of imported data
    const [samples] = await connection.query('SELECT * FROM filipino_dishes LIMIT 3');
    console.log('\n📋 Sample imported dishes:');
    samples.forEach((dish) => {
      console.log(`  - ${dish.name} (${dish.category}) - ${dish.calories} cal`);
    });

    const [count] = await connection.query('SELECT COUNT(*) as total FROM filipino_dishes');
    console.log(`\n📈 Total dishes in database: ${count[0].total}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await connection.release();
    await pool.end();
  }
}

// Run the import
importRecipes();
