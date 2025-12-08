const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'activecore',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Nutritional data for common Filipino dishes
const NUTRITION_DATA = {
  'chicken adobo': { calories: 250, protein: 30, carbs: 5, fats: 12 },
  'sinigang': { calories: 180, protein: 25, carbs: 12, fats: 6 },
  'pancit': { calories: 280, protein: 12, carbs: 35, fats: 10 },
  'fried rice': { calories: 300, protein: 10, carbs: 40, fats: 12 },
  'lumpia': { calories: 150, protein: 8, carbs: 18, fats: 6 },
  'nilagang baboy': { calories: 220, protein: 28, carbs: 8, fats: 9 },
  'tinola': { calories: 160, protein: 22, carbs: 6, fats: 6 },
  'kare-kare': { calories: 320, protein: 28, carbs: 20, fats: 15 },
  'bistek tagalog': { calories: 280, protein: 32, carbs: 10, fats: 12 },
  'bulalo': { calories: 240, protein: 26, carbs: 15, fats: 10 },
  'pinakbet': { calories: 140, protein: 12, carbs: 15, fats: 5 },
  'lumpiang shanghai': { calories: 160, protein: 9, carbs: 16, fats: 7 },
  'tapa': { calories: 200, protein: 28, carbs: 2, fats: 10 },
  'longanisa': { calories: 280, protein: 16, carbs: 3, fats: 22 },
  'dinuguan': { calories: 220, protein: 24, carbs: 8, fats: 11 },
  'lapu-lapu': { calories: 160, protein: 28, carbs: 0, fats: 5 },
  'tilapia': { calories: 140, protein: 26, carbs: 0, fats: 3 },
  'inihaw na isda': { calories: 180, protein: 28, carbs: 2, fats: 7 },
  'adobong pusit': { calories: 200, protein: 25, carbs: 6, fats: 9 },
  'tortang talong': { calories: 180, protein: 12, carbs: 15, fats: 8 },
  'vegetable soup': { calories: 120, protein: 8, carbs: 18, fats: 2 },
  'chicken wings': { calories: 220, protein: 24, carbs: 0, fats: 13 },
  'pork chops': { calories: 260, protein: 32, carbs: 0, fats: 14 },
  'beef steak': { calories: 280, protein: 35, carbs: 0, fats: 15 },
  'fried chicken': { calories: 320, protein: 28, carbs: 15, fats: 16 },
  'grilled chicken': { calories: 200, protein: 32, carbs: 0, fats: 8 },
  'rice bowl': { calories: 240, protein: 5, carbs: 50, fats: 1 },
  'noodle soup': { calories: 200, protein: 10, carbs: 30, fats: 5 },
  'vegetable salad': { calories: 100, protein: 5, carbs: 15, fats: 2 },
  'egg roll': { calories: 140, protein: 8, carbs: 16, fats: 5 },
  'spring roll': { calories: 130, protein: 7, carbs: 15, fats: 5 },
};

// Helper function to clean text
function cleanText(text) {
  if (!text) return '';
  return String(text)
    .replace(/Skip to [a-z\s]+/gi, '')
    .replace(/New\? Start Here/gi, '')
    .replace(/All Recipes/gi, '')
    .replace(/Course[A-Za-z\n]+(Breakfast|Lunch|Appetizers|Dessert|Dinner)/g, '')
    .replace(/Ingredient[A-Za-z\n]+(Chicken|Pork|Beef|Turkey|Vegetable|Fish|Rice|Egg|Tofu|Noodles)/g, '')
    .replace(/(Breakfast|Lunch|Appetizers|Dessert|Dinner|Chicken|Pork|Beef|Turkey|Vegetable|Fish|Rice|Egg|Tofu|Noodles)(?=[A-Z])/g, '$1 ')
    .replace(/Panlasang Pinoy/gi, '')
    .replace(/Your Top Source of Filipino Recipes/gi, '')
    .replace(/This post may contain affiliate links[^.]*\./gi, '')
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Function to extract dish name from title
function extractDishName(title) {
  if (!title) return '';
  // Remove common prefixes/suffixes
  let name = title
    .replace(/^How to Cook\s+/i, '')
    .replace(/^How to Make\s+/i, '')
    .replace(/^The\s+/i, '')
    .replace(/\s+(Recipe|Experiment|Guide|Tutorial)$/i, '')
    .replace(/\s+Quesadilla$/i, '')
    .trim();
  return name;
}

// Function to detect category based on dish name or ingredients
function detectCategory(dishName, ingredients) {
  const name = dishName.toLowerCase();
  
  if (/breakfast|aloo|eggs?|hash|oatmeal|pancake|waffle|toast|cereal/i.test(name)) return 'Breakfast';
  if (/appetizer|lumpia|spring roll|egg roll|dimsum|pork rinds|calamari|squid/i.test(name)) return 'Appetizers';
  if (/dessert|cake|pudding|brownie|cookie|candy|chocolate/i.test(name)) return 'Dessert';
  if (/salad|soup|vegetable|greens/i.test(name)) return 'Salads & Vegetables';
  if (/sandwich|burger|wrap|quesadilla|taco/i.test(name)) return 'Sandwiches';
  if (/noodle|pancit|pasta|ramen|spaghetti/i.test(name)) return 'Noodle Dishes';
  if (/rice|fried rice|risotto/i.test(name)) return 'Rice Dishes';
  if (/fish|seafood|lapu|tilapia|shrimp|squid|crab|lobster|tuna|salmon/i.test(name)) return 'Seafood';
  if (/chicken|poultry/i.test(name)) return 'Chicken Dishes';
  if (/beef|steak|bistek|pork|ham|bacon|sausage|longanisa|tapa/i.test(name)) return 'Meat Dishes';
  
  // Default based on ingredients
  const ingredientsText = Array.isArray(ingredients) ? ingredients.join(' ').toLowerCase() : '';
  if (/seafood|fish|shrimp|crab/i.test(ingredientsText)) return 'Seafood';
  if (/chicken|poultry/i.test(ingredientsText)) return 'Chicken Dishes';
  if (/beef|pork/i.test(ingredientsText)) return 'Meat Dishes';
  if (/vegetable|salad/i.test(ingredientsText)) return 'Salads & Vegetables';
  
  return 'Lunch'; // Default
}

// Function to get nutrition data
function getNutritionData(dishName) {
  const name = dishName.toLowerCase();
  for (const [key, value] of Object.entries(NUTRITION_DATA)) {
    if (name.includes(key) || key.includes(name.split(' ')[0])) {
      return value;
    }
  }
  // Return default values
  return { calories: 200, protein: 15, carbs: 20, fats: 8 };
}

// Main import function
async function importRecipes() {
  let connection;
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(DB_CONFIG);
    
    console.log('📄 Reading recipes.json...');
    const recipesPath = path.join(__dirname, '../..', 'data', 'recipes.json');
    const rawData = fs.readFileSync(recipesPath, 'utf8');
    const recipes = JSON.parse(rawData);
    
    console.log(`📦 Found ${recipes.length} recipes to process\n`);
    
    // Create table if not exists
    console.log('🛠️  Creating/Updating table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS filipino_dishes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        category VARCHAR(100),
        diet_type VARCHAR(100) DEFAULT 'omnivore',
        calories INT DEFAULT 200,
        protein DECIMAL(10,2) DEFAULT 15.00,
        carbs DECIMAL(10,2) DEFAULT 20.00,
        fats DECIMAL(10,2) DEFAULT 8.00,
        fiber DECIMAL(10,2) DEFAULT 2.00,
        ingredients TEXT,
        preparation_time INT,
        image_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Clear existing data (optional - uncomment if you want fresh start)
    // await connection.execute('TRUNCATE TABLE filipino_dishes');
    
    let successCount = 0;
    let duplicateCount = 0;
    let skippedCount = 0;
    
    for (const recipe of recipes) {
      try {
        const title = recipe.title || '';
        const dishName = extractDishName(title);
        
        // Skip if dish name is empty or too generic
        if (!dishName || dishName.length < 3 || /^[a-z\s]*$/.test(dishName)) {
          skippedCount++;
          continue;
        }
        
        // Clean ingredients and instructions
        let ingredients = Array.isArray(recipe.ingredients) 
          ? recipe.ingredients.filter(i => i && String(i).length > 2 && !/skip to|new\?|all recipes|course|ingredient/i.test(i))
          : [];
        
        let instructions = Array.isArray(recipe.instructions)
          ? recipe.instructions.filter(i => i && String(i).length > 10)
          : [];
        
        ingredients = ingredients.map(cleanText).filter(i => i.length > 0);
        instructions = instructions.map(cleanText).filter(i => i.length > 0);
        
        // Join into strings
        const ingredientsStr = ingredients.join(' | ');
        const instructionsStr = instructions.join(' ');
        
        // Skip if no valid ingredients or instructions
        if (ingredientsStr.length < 5 || instructionsStr.length < 20) {
          skippedCount++;
          continue;
        }
        
        const category = detectCategory(dishName, ingredients);
        const nutrition = getNutritionData(dishName);
        const description = instructions[0] ? instructions[0].substring(0, 500) : '';
        
        try {
          await connection.execute(
            `INSERT INTO filipino_dishes 
             (name, category, diet_type, ingredients, calories, protein, carbs, fats, fiber) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dishName, category, 'omnivore', ingredientsStr, 
             nutrition.calories, nutrition.protein, nutrition.carbs, nutrition.fats, 2.0]
          );
          successCount++;
          console.log(`✅ ${successCount}. ${dishName} (${category})`);
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            duplicateCount++;
          } else {
            throw err;
          }
        }
      } catch (err) {
        console.error(`❌ Error processing recipe:`, err.message);
      }
    }
    
    console.log(`\n📊 Import Summary:`);
    console.log(`✅ Successfully imported: ${successCount}`);
    console.log(`⚠️  Duplicates skipped: ${duplicateCount}`);
    console.log(`⏭️  Recipes skipped (invalid): ${skippedCount}`);
    
    // Show stats
    const [stats] = await connection.execute('SELECT COUNT(*) as total, COUNT(DISTINCT category) as categories FROM filipino_dishes');
    console.log(`\n📈 Database now has ${stats[0].total} dishes in ${stats[0].categories} categories`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

// Run import
importRecipes();
