import fs from 'fs';
import path from 'path';
import { pool } from '../config/db.config';

type ParsedMealRow = {
  category: 'breakfast' | 'lunch' | 'dinner';
  name: string;
  ingredients: string[];
  instructionsRaw: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  fiber: number | null;
};

function parseNumber(input: string | undefined): number | null {
  const v = String(input ?? '').trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeCategory(input: string): ParsedMealRow['category'] | null {
  const v = String(input || '').trim().toLowerCase();
  if (v === 'breakfast') return 'breakfast';
  if (v === 'lunch') return 'lunch';
  if (v === 'dinner') return 'dinner';
  return null;
}

function splitIngredients(input: string): string[] {
  const raw = String(input || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // De-dupe, preserve order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function ensureCommonBasics(ingredients: string[], instructions: string): string[] {
  const set = new Set(ingredients.map((i) => i.toLowerCase()));
  const lower = instructions.toLowerCase();

  const maybeAdd = (value: string, keys?: string[]) => {
    const k = value.toLowerCase();
    if (set.has(k)) return;
    if (keys && keys.some((x) => set.has(x.toLowerCase()))) return;
    ingredients.push(value);
    set.add(k);
  };

  if (/\bfry\b|\bpan-fry\b|\bdeep-fry\b|\bstir-fry\b/.test(lower)) {
    if (!set.has('oil') && !set.has('cooking oil') && !set.has('vegetable oil')) {
      maybeAdd('Cooking oil', ['oil', 'cooking oil', 'vegetable oil']);
    }
  }

  if (/(season|salt)/.test(lower) && !set.has('salt')) {
    maybeAdd('Salt');
  }

  if (/(pepper)/.test(lower) && !set.has('pepper') && !set.has('black pepper')) {
    maybeAdd('Black pepper', ['pepper', 'black pepper']);
  }

  return ingredients;
}

function titleCase(str: string): string {
  const s = String(str || '').trim();
  if (!s) return s;
  // Keep existing casing for words with hyphens/parentheses; just lightly normalize spaces.
  return s.replace(/\s+/g, ' ');
}

function expandInstructions(raw: string, ingredients: string[]): string {
  const text = String(raw || '').trim();
  if (!text) {
    return [
      '1. Prepare and measure all ingredients.',
      '2. Cook using your preferred Filipino method for this dish.',
      '3. Season to taste.',
      '4. Serve hot and enjoy.',
    ].join('\n');
  }

  const lower = text.toLowerCase();
  const steps: string[] = [];

  // A gentle first step that makes short instructions feel more complete.
  const hasAromatics = ingredients.some((i) => /garlic|onion|ginger/.test(i.toLowerCase()));
  steps.push(
    `Prepare ingredients (wash/chop as needed${hasAromatics ? ', mince aromatics' : ''}).`
  );

  // Split the raw instruction into clauses.
  const clauses = text
    .split(/[.;]+|\s*,\s*/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const normalizeClause = (clause: string): string => {
    let c = clause;
    // Expand a few common shorthand phrases.
    c = c.replace(/pan-?fry/gi, 'pan-fry');
    c = c.replace(/saute/gi, 'sauté');
    c = c.replace(/stir-?fry/gi, 'stir-fry');

    const lc = c.toLowerCase();

    if (lc.startsWith('marinate')) {
      return `${c}. If time allows, marinate longer (30 minutes to overnight) for better flavor.`;
    }
    if (lc.startsWith('boil')) {
      return `${c}, keeping a gentle boil to avoid breaking ingredients.`;
    }
    if (lc.startsWith('simmer')) {
      return `${c} until the meat/vegetables are tender and flavors develop.`;
    }
    if (lc.startsWith('sauté') || lc.startsWith('saute')) {
      return `${c} over medium heat until fragrant.`;
    }
    if (lc.includes('grill')) {
      return `${c}, basting occasionally for color and moisture.`;
    }
    if (lc.includes('steam')) {
      return `${c} until set and cooked through.`;
    }
    if (lc.includes('bake')) {
      return `${c} until cooked through and lightly browned.`;
    }
    if (lc.includes('fry')) {
      return `${c} until golden and fully cooked.`;
    }

    return c;
  };

  for (const clause of clauses) {
    if (steps.length >= 6) break;
    steps.push(normalizeClause(clause));
  }

  // Close with serving suggestion.
  if (!/serve/.test(lower)) {
    steps.push('Serve warm; pair with rice or your preferred side.');
  }

  // Format into numbered list.
  return steps
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n');
}

function parseMealsFile(filePath: string): ParsedMealRow[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);

  const out: ParsedMealRow[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^Meal Type\b/i.test(trimmed)) continue; // header

    const parts = line.split('\t');
    if (parts.length < 6) continue;

    const category = normalizeCategory(parts[0]);
    const name = titleCase(parts[1] || '');
    const ingredientsRaw = parts[2] || '';
    const instructionsRaw = parts[3] || '';

    if (!category || !name) continue;

    const calories = parseNumber(parts[4]);
    const protein = parseNumber(parts[5]);
    const carbs = parseNumber(parts[6]);
    const fats = parseNumber(parts[7]);
    const fiber = parseNumber(parts[8]);

    let ingredients = splitIngredients(ingredientsRaw);
    ingredients = ensureCommonBasics(ingredients, instructionsRaw);

    out.push({
      category,
      name,
      ingredients,
      instructionsRaw,
      calories,
      protein,
      carbs,
      fats,
      fiber,
    });
  }

  return out;
}

async function isPostgres(): Promise<boolean> {
  try {
    const [rows] = await pool.query<any>('SELECT version() as version');
    const v = rows?.[0]?.version ? String(rows[0].version) : '';
    return v.toLowerCase().includes('postgres');
  } catch {
    return false;
  }
}

async function getFilipinoDishesColumns(schema: string): Promise<Set<string>> {
  const [rows] = await pool.query<any>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = ? AND table_name = ?`,
    [schema, 'filipino_dishes']
  );

  const set = new Set<string>();
  (rows || []).forEach((r: any) => set.add(String(r.column_name || '').toLowerCase()));
  return set;
}

async function ensureColumnsIfMissing(isPg: boolean, schema: string, cols: Set<string>): Promise<Set<string>> {
  if (!isPg) return cols;

  // Ensure ON CONFLICT (name) is valid by having a unique constraint/index on name.
  // This is safe to run even if it already exists.
  try {
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_filipino_dishes_name ON ${schema}.filipino_dishes(name)`
    );
  } catch {
    // ignore (may fail if permissions are restricted)
  }

  const maybeAddColumn = async (column: string, sqlType: string) => {
    if (cols.has(column.toLowerCase())) return;
    await pool.query(`ALTER TABLE ${schema}.filipino_dishes ADD COLUMN IF NOT EXISTS ${column} ${sqlType}`);
    cols.add(column.toLowerCase());
  };

  // Store richer cooking steps.
  await maybeAddColumn('recipe', 'TEXT');
  // Fiber is used by some existing fixtures; keep it if missing.
  await maybeAddColumn('fiber', 'DECIMAL(10,2)');

  return cols;
}

async function upsertMeals(meals: ParsedMealRow[]) {
  const schema = (process.env.DB_SCHEMA || '').trim() || 'public';
  const pg = await isPostgres();

  let cols = await getFilipinoDishesColumns(schema);
  cols = await ensureColumnsIfMissing(pg, schema, cols);

  const has = (...names: string[]) => names.some((n) => cols.has(n.toLowerCase()));

  const nameCol = 'name';
  const categoryCol = has('category') ? 'category' : null;
  const ingredientsCol = has('ingredients') ? 'ingredients' : null;
  const recipeCol = has('recipe') ? 'recipe' : (has('instructions') ? 'instructions' : null);

  const caloriesCols = ['calories', 'cal'].filter((c) => has(c));
  const proteinCols = ['protein', 'pro'].filter((c) => has(c));
  const carbsCols = ['carbs', 'carb'].filter((c) => has(c));
  const fatsCols = ['fats', 'fat'].filter((c) => has(c));
  const fiberCols = ['fiber'].filter((c) => has(c));

  if (!cols.has(nameCol)) {
    throw new Error('filipino_dishes.name column is missing; cannot import.');
  }

  const insertCols: string[] = [nameCol];
  if (categoryCol) insertCols.push(categoryCol);
  for (const c of caloriesCols) insertCols.push(c);
  for (const c of proteinCols) insertCols.push(c);
  for (const c of carbsCols) insertCols.push(c);
  for (const c of fatsCols) insertCols.push(c);
  for (const c of fiberCols) insertCols.push(c);
  if (ingredientsCol) insertCols.push(ingredientsCol);
  if (recipeCol) insertCols.push(recipeCol);

  const setCols = insertCols.filter((c) => c !== nameCol);

  let imported = 0;
  let failed = 0;

  for (const meal of meals) {
    try {
      const recipe = expandInstructions(meal.instructionsRaw, meal.ingredients);

      const values: any[] = [meal.name];
      if (categoryCol) values.push(meal.category);

      const pushNumberOrNull = (n: number | null) => values.push(n === null ? null : n);

      for (const _ of caloriesCols) pushNumberOrNull(meal.calories);
      for (const _ of proteinCols) pushNumberOrNull(meal.protein);
      for (const _ of carbsCols) pushNumberOrNull(meal.carbs);
      for (const _ of fatsCols) pushNumberOrNull(meal.fats);
      for (const _ of fiberCols) pushNumberOrNull(meal.fiber);

      if (ingredientsCol) values.push(JSON.stringify(meal.ingredients));
      if (recipeCol) values.push(recipe);

      const placeholders = insertCols.map(() => '?').join(', ');

      if (pg) {
        const setClause = setCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ');
        await pool.query(
          `INSERT INTO ${schema}.filipino_dishes (${insertCols.join(', ')})
           VALUES (${placeholders})
           ON CONFLICT (name) DO UPDATE SET ${setClause}`,
          values
        );
      } else {
        // Best-effort MySQL compatibility (unlikely in Supabase).
        const setClause = setCols.map((c) => `${c} = VALUES(${c})`).join(', ');
        await pool.query(
          `INSERT INTO ${schema}.filipino_dishes (${insertCols.join(', ')})
           VALUES (${placeholders})
           ON DUPLICATE KEY UPDATE ${setClause}`,
          values
        );
      }

      imported++;
    } catch (err: any) {
      failed++;
      // Keep going; print minimal context.
      console.error(`❌ Failed: ${meal.name} (${meal.category}) - ${String(err?.message || err)}`);
    }
  }

  console.log('\n✨ Import complete');
  console.log(`✅ Upserted: ${imported}`);
  console.log(`❌ Failed: ${failed}`);

  const [stats] = await pool.query<any>('SELECT COUNT(*)::int as total FROM filipino_dishes');
  const total = stats?.[0]?.total;
  console.log(`📈 Total dishes now: ${total ?? '(unknown)'}`);
}

async function main() {
  const argPath = process.argv[2];
  const defaultPath = path.resolve(__dirname, '..', '..', '..', '60newMeals_20Breakfast_20luchn_20dinner.md');
  const filePath = argPath ? path.resolve(process.cwd(), argPath) : defaultPath;

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Meals file not found: ${filePath}`);
    console.error('   Pass a path, e.g. `node dist/scripts/importNewMeals.js 60newMeals_20Breakfast_20luchn_20dinner.md`');
    process.exit(1);
  }

  const meals = parseMealsFile(filePath);
  if (meals.length === 0) {
    console.error('❌ No meals parsed from file (check delimiter tabs and header).');
    process.exit(1);
  }

  console.log(`📦 Parsed ${meals.length} meals from: ${filePath}`);
  await upsertMeals(meals);

  // Close DB pool.
  await pool.end();
}

main().catch(async (err) => {
  console.error('❌ Import failed:', String(err?.message || err));
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
