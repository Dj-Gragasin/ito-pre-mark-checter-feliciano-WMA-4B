import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, initializeDatabase } from './config/db.config';
import axios from 'axios';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import rateLimit from 'express-rate-limit';
// Avoid startup crash if OPENAI_API_KEY missing
let openai: OpenAI | undefined;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log('✅ OpenAI initialized');
} else {
  openai = undefined;
  console.log('⚠️ OPENAI_API_KEY not present — OpenAI features disabled');
}
import nodemailer, { Transporter } from 'nodemailer';
import crypto from 'crypto';

const app = express();

// ============================================
// SECURITY: Validate JWT_SECRET at startup
// ============================================
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('\n❌ ========================================');
  console.error('❌ FATAL: JWT_SECRET CONFIGURATION ERROR');
  console.error('❌ ========================================');
  console.error('❌ JWT_SECRET must be:');
  console.error('❌   1. Set in .env file');
  console.error('❌   2. At least 32 characters long');
  console.error('❌ ');
  console.error('❌ Generate a secure secret:');
  console.error('❌   openssl rand -base64 32');
  console.error('❌ ========================================\n');
  process.exit(1);
}

// Track OpenAI availability globally
let openaiAvailable = true;

// ============================================
// RATE LIMITING: Protect against brute force
// ============================================
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts. Please try again later.',
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 registration attempts per hour
  message: 'Too many registration attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // General API limit: 30 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
});

// Dev CORS: allow all in development for quick debugging
app.use(cors({ origin: true, credentials: true }));
app.options('*', cors({ origin: true, credentials: true }));

app.use(express.json());

// Apply general rate limiting to all requests
app.use(generalLimiter);

// Debug: log incoming requests and origin so we can diagnose CORS issues
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// CORS: allow all in development; set safe origin + support preflight
if (process.env.NODE_ENV === 'development') {
  app.use(cors({ origin: true, credentials: true }));
  // Ensure pre-flight passes
  app.options('*', cors({ origin: true, credentials: true }));
} else {
  const allowedOrigins = (process.env.FRONTEND_URL?.split(',') || ['http://localhost:8100']).map((s) => s.trim().replace(/\/$/, ''));
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = (req.headers.origin as string | undefined) || undefined;
    const originNormalized = origin ? origin.replace(/\/$/, '') : origin;
    const allowedExplicit = originNormalized && allowedOrigins.includes(originNormalized);
    const allowedLocal = originNormalized && (originNormalized.includes('localhost') || originNormalized.includes('127.0.0.1') || originNormalized.includes('ngrok.io'));
    if (!origin || allowedExplicit || allowedLocal) {
      const allowOrigin = origin || (allowedOrigins.length > 0 ? allowedOrigins[0] : '*');
      res.header('Access-Control-Allow-Origin', allowOrigin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      console.log(`CORS allowed origin: ${origin}`);
      next();
    } else {
      console.warn(`CORS denied origin: ${origin}`);
      res.status(403).json({ success: false, message: 'CORS origin denied', origin });
    }
  });
}

// PayPal API configuration
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox'; // 'sandbox' or 'live'
const PAYPAL_API_URL = PAYPAL_MODE === 'live' 
  ? 'https://api.paypal.com/v2'
  : 'https://api.sandbox.paypal.com/v2';

// use env-driven model name so it's easy to switch
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// Trusted Filipino meals (USDA/DOST-PH)
const trustedFilipinoMeals = [
  "Chicken Adobo", "Pork Adobo", "Beef Tapa", "Bangus Sinigang", "Tinolang Manok", "Laing",
  "Pinakbet", "Sinigang na Baboy", "Tortang Talong", "Ginisang Monggo", "Paksiw na Isda",
  "Pancit Bihon", "Arroz Caldo", "Kare-Kare", "Paksiw na Lechon", "Ensaladang Talong",
  "Inihaw na Liempo", "Lumpiang Sariwa", "Paksiw na Bangus", "Ginataang Gulay", "La Paz Batchoy",
  "Dinuguan", "Menudo", "Bicol Express", "Pochero", "Bulalo", "Pancit Canton", "Tapsilog",
  "Tocilog", "Longsilog", "Daing na Bangus", "Tinapang Bangus", "Chicken Inasal", "Paksiw na Pata",
  "Paksiw na Tilapia", "Ginisang Ampalaya", "Ginisang Sitaw at Kalabasa", "Ginisang Pechay",
  "Ginisang Repolyo", "Ginisang Sayote", "Ginisang Upo", "Ginisang Patola", "Ginisang Togue",
  "Ginisang Okra", "Ginisang Malunggay", "Ginisang Kangkong", "Ginisang Alugbati", "Ginisang Bataw",
  "Ginisang Sigarilyas", "Pancit Palabok", "Pancit Malabon", "Pancit Habhab", "Pancit Molo",
  "Sinigang na Hipon", "Sinigang na Isda", "Sinigang na Baka", "Pritong Tilapia", "Pritong Bangus",
  "Tinolang Tahong", "Tinolang Isda", "Tinolang Baboy", "Tinolang Hipon", "Tinolang Gulay",
  "Pinapaitan", "Papaitan", "Igado", "Bagnet", "Dinakdakan", "Kilawin", "Paksiw na Pata",
  "Paksiw na Lechon", "Paksiw na Tilapia", "Paksiw na Bangus", "Paksiw na Galunggong",
  "Paksiw na Dilis", "Paksiw na Tulingan", "Paksiw na Pusit", "Paksiw na Baboy", "Paksiw na Manok",
  "Paksiw na Baka", "Paksiw na Hipon", "Paksiw na Gulay", "Paksiw na Labanos", "Paksiw na Ampalaya",
  "Paksiw na Talong", "Paksiw na Okra", "Paksiw na Sitaw", "Paksiw na Kalabasa", "Paksiw na Upo",
  "Paksiw na Patola", "Paksiw na Bataw", "Paksiw na Sigarilyas"
];

// Extended trustedFilipinoMealsDetailed with more meals and macros
const trustedFilipinoMealsDetailed = [
  { name: "Chicken Adobo", ingredients: ["chicken thighs","soy sauce","vinegar","garlic","bay leaves","black pepper","oil","water"], calories: 480, protein: 36, carbs: 50, fats: 14, fiber: 2, recipe: "1. Heat oil in a pan and sauté garlic until fragrant\n2. Add chicken pieces and brown on all sides\n3. Pour in soy sauce and vinegar, add bay leaves\n4. Simmer covered for 30 minutes until chicken is tender\n5. Season with pepper and serve hot with rice" },
  { name: "Pork Adobo", ingredients: ["pork belly","soy sauce","vinegar","garlic cloves","bay leaves","black pepper","cooking oil","water"], calories: 520, protein: 32, carbs: 52, fats: 22, fiber: 2, recipe: "1. Cut pork belly into bite-sized pieces\n2. Heat oil and sauté minced garlic until fragrant\n3. Brown pork pieces on all sides for 5 minutes\n4. Add soy sauce, vinegar, and bay leaves\n5. Simmer for 40 minutes until pork is tender and sauce reduces" },
  { name: "Tapsilog", ingredients: ["beef tapa","garlic","rice","egg","butter","salt","pepper"], calories: 520, protein: 36, carbs: 48, fats: 16, fiber: 2, recipe: "1. Fry garlic rice: heat butter and sauté minced garlic, add cooked rice\n2. Cook beef tapa on a hot pan until crispy and caramelized\n3. Fry an egg sunny-side up in butter\n4. Plate the garlic rice, tapa, and fried egg together\n5. Season with salt and pepper to taste" },
  { name: "Bangus Sinigang", ingredients: ["milkfish","tamarind paste","radish","spinach","string beans","ginger","garlic","onion","salt","pepper"], calories: 410, protein: 32, carbs: 46, fats: 10, fiber: 3, recipe: "1. Boil water with tamarind paste and ginger slices for 5 minutes\n2. Add radish and onion, simmer for 5 minutes\n3. Add milkfish and string beans, simmer for 8 minutes\n4. Add spinach and cook until wilted (2 minutes)\n5. Season with salt and pepper, serve hot" },
  { name: "Tinolang Manok", ingredients: ["chicken","ginger","malunggay leaves","papaya","garlic","onion","fish sauce","broth","oil"], calories: 390, protein: 34, carbs: 44, fats: 8, fiber: 3, recipe: "1. Heat oil and sauté ginger, garlic, and onion\n2. Add chicken and cook until no longer pink\n3. Pour in broth and simmer for 15 minutes\n4. Add papaya cubes and simmer for 5 minutes\n5. Add malunggay leaves, fish sauce, and cook for 2 minutes" },
  { name: "Laing", ingredients: ["taro leaves","coconut milk","garlic","onion","ginger","chili","shrimp paste","salt"], calories: 350, protein: 12, carbs: 38, fats: 16, fiber: 5, recipe: "1. Blanch taro leaves in boiling salted water for 5 minutes, drain well\n2. Sauté garlic, onion, and ginger in oil\n3. Add shrimp paste and cook for 1 minute\n4. Add taro leaves and coconut milk, simmer for 10 minutes\n5. Add chili and salt to taste, cook for 2 more minutes" },
  { name: "Pinakbet", ingredients: ["eggplant","ampalaya","string beans","okra","squash","shrimp paste","garlic","onion","tomato","anchovy"], calories: 300, protein: 12, carbs: 30, fats: 10, fiber: 6, recipe: "1. Heat oil and sauté garlic, onion, and shrimp paste\n2. Add ampalaya and cook for 2 minutes\n3. Add squash and tomato, simmer for 5 minutes\n4. Add eggplant, string beans, and okra\n5. Simmer until vegetables are tender (8 minutes), season to taste" },
  { name: "Pancit Bihon", ingredients: ["bihon noodles","chicken","carrots","cabbage","garlic","onion","soy sauce","cooking oil","broth"], calories: 420, protein: 18, carbs: 62, fats: 8, fiber: 4, recipe: "1. Soak bihon noodles in hot water for 5 minutes, drain\n2. Heat oil and sauté garlic and onion\n3. Add chicken and cook until done\n4. Add broth, carrots, and cabbage\n5. Add noodles and soy sauce, toss well and cook until noodles absorb liquid" },
  { name: "Arroz Caldo", ingredients: ["rice","chicken","ginger","egg","garlic","onion","turmeric","broth","fish sauce","oil"], calories: 390, protein: 20, carbs: 54, fats: 8, fiber: 2, recipe: "1. Heat oil and sauté garlic, onion, and ginger\n2. Add chicken and cook until done, shred finely\n3. Return chicken to pot, add rice and broth\n4. Add turmeric and fish sauce, simmer until rice is tender\n5. Beat egg and drizzle into the pot while stirring gently" },
  { name: "Kare-Kare", ingredients: ["oxtail","peanut butter","vegetables","garlic","onion","vinegar","salt","pepper","oil","annatto"], calories: 540, protein: 28, carbs: 52, fats: 22, fiber: 5, recipe: "1. Boil oxtail in water with salt and pepper until tender\n2. In a separate pot, sauté garlic, onion, and annatto in oil\n3. Add peanut butter and reserved broth to make sauce\n4. Add vegetables (eggplant, squash, long beans, bok choy)\n5. Simmer until vegetables are cooked, add vinegar to taste" },
  { name: "Lumpiang Sariwa", ingredients: ["spring roll wrapper","vegetables","peanut sauce","garlic","shrimp","pork","egg","vinegar"], calories: 260, protein: 8, carbs: 38, fats: 8, fiber: 4, recipe: "1. Blanch vegetables (cabbage, carrots, green beans) until crisp-tender\n2. Cook pork and shrimp, chop finely\n3. Mix cooked vegetables with pork and shrimp\n4. Place filling on spring roll wrapper, roll tightly and seal\n5. Serve with peanut sauce (peanut butter + vinegar + garlic)" },
  { name: "Daing na Bangus", ingredients: ["milkfish","vinegar","garlic","salt","pepper","bay leaves","cooking oil"], calories: 410, protein: 32, carbs: 44, fats: 10, fiber: 2, recipe: "1. Mix vinegar, salt, pepper, bay leaves, and garlic in a bowl\n2. Place milkfish in a glass dish and pour vinegar mixture over it\n3. Refrigerate for at least 2 hours (preferably overnight)\n4. Heat oil in a pan and fry the marinated milkfish until golden\n5. Serve with the remaining marinade as sauce" },
  { name: "Chicken Inasal", ingredients: ["chicken leg","annatto oil","vinegar","garlic","ginger","brown sugar","salt","pepper"], calories: 420, protein: 34, carbs: 44, fats: 10, fiber: 2, recipe: "1. Mix annatto oil, vinegar, garlic, ginger, brown sugar, salt, and pepper\n2. Marinate chicken legs in this mixture for 1 hour\n3. Grill chicken over charcoal or pan-fry on medium heat\n4. Baste with marinade while grilling until cooked through\n5. Serve with sliced calamansi or lime" },
  { name: "Ginisang Monggo", ingredients: ["mung beans","garlic","pork bits","spinach","onion","ginger","tomato","oil","salt"], calories: 340, protein: 18, carbs: 44, fats: 8, fiber: 6, recipe: "1. Boil mung beans until soft, drain\n2. Heat oil and sauté garlic, onion, and ginger\n3. Add pork bits and cook until done\n4. Add cooked mung beans and simmer for 5 minutes\n5. Add spinach and tomato, cook until spinach wilts, season with salt" },
  { name: "La Paz Batchoy", ingredients: ["egg noodles","pork","chicken liver","egg","garlic","onion","carrots","broth","lard"], calories: 480, protein: 22, carbs: 60, fats: 14, fiber: 2, recipe: "1. Cook egg noodles and set aside\n2. Heat lard and sauté garlic, onion, and carrots\n3. Add pork and chicken liver, simmer until cooked\n4. Pour in broth and bring to a boil\n5. Place noodles in bowl, pour broth and toppings, top with raw egg" },
  { name: "Bicol Express", ingredients: ["pork","coconut milk","long chili","shrimp paste","garlic","onion","salt","oil"], calories: 520, protein: 24, carbs: 52, fats: 22, fiber: 3, recipe: "1. Heat oil and sauté garlic and onion\n2. Add shrimp paste and cook for 1 minute\n3. Add pork cubes and brown on all sides\n4. Pour in coconut milk and add long chili\n5. Simmer for 20 minutes until pork is tender, season with salt" },
  { name: "Paksiw na Bangus", ingredients: ["milkfish","vinegar","eggplant","salt","garlic","ginger","bay leaves","oil"], calories: 380, protein: 28, carbs: 40, fats: 10, fiber: 4, recipe: "1. Layer eggplant slices in a pan with milkfish on top\n2. Mix vinegar, salt, garlic, ginger, and bay leaves, pour over fish\n3. Add oil and bring to a simmer\n4. Cover and cook for 10 minutes until fish is cooked\n5. Serve in a shallow dish with the broth" },
  { name: "Bulalo", ingredients: ["beef shank","corn","radish","spinach","cabbage","garlic","onion","fish sauce","broth"], calories: 520, protein: 32, carbs: 50, fats: 18, fiber: 3, recipe: "1. Boil beef shank with garlic and onion for 45 minutes until tender\n2. Add radish cubes and simmer for 10 minutes\n3. Add corn and cabbage, simmer for 5 minutes\n4. Add spinach and fish sauce\n5. Cook until spinach wilts (2 minutes), season and serve hot" },
  { name: "Tinolang Isda", ingredients: ["fish","ginger","papaya","malunggay leaves","garlic","onion","fish sauce","broth","oil"], calories: 350, protein: 28, carbs: 38, fats: 8, fiber: 3, recipe: "1. Heat oil and sauté ginger, garlic, and onion\n2. Add fish and cook briefly on both sides\n3. Pour in broth and add papaya cubes\n4. Simmer for 8 minutes until papaya is tender\n5. Add malunggay leaves and fish sauce, cook for 2 minutes" },
  { name: "Pochero", ingredients: ["pork","plantains","chickpeas","carrots","potatoes","cabbage","garlic","onion","broth"], calories: 500, protein: 28, carbs: 54, fats: 16, fiber: 5, recipe: "1. Boil pork with garlic and onion until partially cooked\n2. Add potatoes, carrots, and plantains\n3. Simmer for 10 minutes\n4. Add cabbage and chickpeas\n5. Continue cooking until all vegetables are tender (10 minutes)" },
];

// Filipino Snacks List - SPECIFICALLY for snack1 and snack2
const filipinoSnacks = [
  { name: "Banana Cue", ingredients: ["saba banana","brown sugar","cooking oil","salt"], calories: 180, protein: 1, carbs: 35, fats: 5, fiber: 2, recipe: "1. Peel saba bananas and cut in half lengthwise\n2. Heat oil in a pan to medium heat\n3. Add brown sugar and stir until melted\n4. Coat each banana half in the caramelized sugar\n5. Serve hot on a stick with pinch of salt" },
  { name: "Camote Cue", ingredients: ["sweet potato","brown sugar","cooking oil","salt"], calories: 160, protein: 1, carbs: 32, fats: 4, fiber: 3, recipe: "1. Peel and cut sweet potato into thick lengthwise pieces\n2. Heat oil in a pan over medium heat\n3. Melt brown sugar in the oil until bubbly\n4. Dip each sweet potato piece in the caramelized sugar\n5. Skewer and serve immediately while warm" },
  { name: "Fishball", ingredients: ["fish meat","cornstarch","salt","pepper","garlic","vinegar"], calories: 120, protein: 10, carbs: 12, fats: 3, fiber: 0, recipe: "1. Grind fish meat finely with salt, pepper, and minced garlic\n2. Mix in cornstarch to bind the mixture\n3. Shape into small balls (about 1 inch diameter)\n4. Boil in water until balls float and rise to top\n5. Serve with vinegar-garlic dipping sauce" },
  { name: "Siomai", ingredients: ["pork","shrimp","wonton wrapper","soy sauce","ginger","garlic"], calories: 140, protein: 8, carbs: 14, fats: 5, fiber: 0, recipe: "1. Mince pork and shrimp together finely\n2. Mix with grated ginger, minced garlic, and soy sauce\n3. Place 1 teaspoon filling on wonton wrapper\n4. Gather corners at top and seal\n5. Steam for 10-12 minutes until wrapper is translucent" },
  { name: "Lumpia Shanghai", ingredients: ["pork","cabbage","carrots","spring roll wrapper","garlic","onion","soy sauce"], calories: 150, protein: 7, carbs: 16, fats: 6, fiber: 1, recipe: "1. Sauté garlic and onion, add minced pork and cook until done\n2. Add shredded cabbage and carrots, cook until soft\n3. Season with soy sauce and cool mixture\n4. Fill each spring roll wrapper with 2 tablespoons filling\n5. Roll tightly and deep fry until golden brown" },
  { name: "Turon", ingredients: ["banana","brown sugar","spring roll wrapper","cooking oil","cinnamon"], calories: 170, protein: 1, carbs: 32, fats: 5, fiber: 2, recipe: "1. Slice saba banana lengthwise into strips\n2. Place banana slice and brown sugar on spring roll wrapper\n3. Sprinkle cinnamon and roll tightly, sealing edges with water\n4. Deep fry in oil until wrapper is golden and crispy\n5. Drain on paper towel and serve hot" },
  { name: "Halo-Halo", ingredients: ["ice","evaporated milk","mango","jackfruit","palm seeds","red beans","vanilla ice cream"], calories: 220, protein: 3, carbs: 45, fats: 4, fiber: 3, recipe: "1. Layer shaved ice in a tall glass\n2. Add cooked red beans and palm seeds\n3. Top with diced mango and jackfruit\n4. Pour evaporated milk over the mixture\n5. Top with a scoop of vanilla ice cream and serve immediately" },
  { name: "Bibingka", ingredients: ["rice flour","coconut","brown sugar","egg","baking powder","salt","butter"], calories: 240, protein: 4, carbs: 38, fats: 8, fiber: 1, recipe: "1. Mix rice flour, brown sugar, baking powder, and salt\n2. Beat egg and combine with coconut milk and flour mixture\n3. Pour into buttered banana leaves on hot skillet\n4. Cook on medium heat with charcoal on top for 8-10 minutes\n5. Cool slightly, serve with grated coconut" },
  { name: "Puto", ingredients: ["rice flour","sugar","baking powder","salt","egg","milk","banana leaves"], calories: 180, protein: 3, carbs: 36, fats: 2, fiber: 1, recipe: "1. Mix rice flour, sugar, baking powder, and salt together\n2. Beat egg and combine with milk, then mix with dry ingredients\n3. Fill small molds or cups lined with banana leaves\n4. Steam in a steamer basket for 8-10 minutes\n5. Cool and remove from molds to serve" },
  { name: "Balut", ingredients: ["duck egg","salt","vinegar","ginger"], calories: 190, protein: 14, carbs: 1, fats: 14, fiber: 0, recipe: "1. Boil duck eggs in salted water for 15-20 minutes\n2. Gently crack open the shell at the wider end\n3. Sip the broth from inside the egg\n4. Eat the cooked embryo and yolk inside\n5. Serve with salt, vinegar, and ginger sauce for dipping" },
  { name: "Kwek-Kwek", ingredients: ["quail eggs","flour","turmeric","salt","baking powder","oil"], calories: 130, protein: 7, carbs: 12, fats: 5, fiber: 0, recipe: "1. Hard boil quail eggs and peel carefully\n2. Make batter: mix flour, turmeric, salt, baking powder with water\n3. Heat oil for deep frying\n4. Coat each quail egg in batter and deep fry until golden\n5. Serve with sweet and spicy vinegar sauce" },
  { name: "Tokneneng", ingredients: ["quail eggs","flour","turmeric","sweet chili sauce","oil","vinegar"], calories: 150, protein: 8, carbs: 14, fats: 6, fiber: 0, recipe: "1. Hard boil quail eggs and peel completely\n2. Prepare turmeric batter (flour, turmeric, salt, water)\n3. Skewer 3-4 quail eggs on a stick\n4. Dip in batter and deep fry until golden\n5. Coat with sweet chili sauce and serve with vinegar" },
  { name: "Empanada", ingredients: ["flour","butter","meat","potatoes","garlic","onion","egg"], calories: 240, protein: 8, carbs: 28, fats: 10, fiber: 2, recipe: "1. Cook minced meat with garlic, onion, and diced potatoes\n2. Season with salt and pepper, cool the filling\n3. Make dough: flour, butter, salt, and water kneaded together\n4. Roll dough thin, cut circles, fill, and fold\n5. Deep fry until golden brown on both sides" },
  { name: "Puto Bumbong", ingredients: ["rice flour","coconut milk","brown sugar","salt","banana leaves"], calories: 210, protein: 2, carbs: 40, fats: 5, fiber: 2, recipe: "1. Mix rice flour, brown sugar, salt, and coconut milk\n2. Pour into bamboo tubes (bumbong) lined with banana leaves\n3. Steam in boiling water for 15 minutes\n4. Push puto out of tube onto banana leaf\n5. Serve hot topped with grated coconut and brown sugar" },
  { name: "Tinutuan", ingredients: ["rice","chicken","ginger","egg","garlic","onion","fish sauce"], calories: 200, protein: 8, carbs: 28, fats: 4, fiber: 1, recipe: "1. Cook shredded chicken with garlic and onion\n2. Add broth and bring to boil, then add rice\n3. Add ginger slices and simmer until rice is very soft\n4. Stir in fish sauce and pour into bowl\n5. Top with fried egg and crispy garlic bits" },
  { name: "Lumpiang Togue", ingredients: ["bean sprouts","pork","spring roll wrapper","garlic","onion","soy sauce"], calories: 140, protein: 7, carbs: 16, fats: 4, fiber: 2, recipe: "1. Sauté garlic and onion, add minced pork and cook until done\n2. Add bean sprouts and soy sauce, cook for 2 minutes\n3. Let filling cool slightly\n4. Roll in spring roll wrapper tightly\n5. Deep fry until golden brown and crispy" },
  { name: "Okoy", ingredients: ["shrimp","potato","flour","egg","onion","oil","vinegar"], calories: 180, protein: 8, carbs: 20, fats: 7, fiber: 2, recipe: "1. Shred potato and squeeze out excess moisture\n2. Mix with chopped shrimp, onion, flour, and beaten egg\n3. Season with salt and pepper\n4. Drop spoonfuls into hot oil for deep frying\n5. Fry until golden on both sides, serve with vinegar sauce" },
  { name: "Cassava Cake", ingredients: ["cassava","coconut milk","sugar","egg","butter","salt"], calories: 250, protein: 2, carbs: 42, fats: 8, fiber: 2, recipe: "1. Grate fresh cassava finely\n2. Mix cassava with coconut milk, sugar, egg, butter, and salt\n3. Pour into greased baking pan\n4. Bake at 350°F for 35-40 minutes until golden\n5. Cool before cutting into squares" },
  { name: "Ube Cake", ingredients: ["ube","flour","sugar","egg","butter","baking powder","milk"], calories: 260, protein: 4, carbs: 44, fats: 8, fiber: 1, recipe: "1. Steam and mash ube yam until smooth\n2. Cream together butter and sugar\n3. Add egg, ube puree, and flour alternately with milk\n4. Add baking powder and mix until smooth\n5. Bake in greased pan at 350°F for 30-35 minutes" },
  { name: "Choco Pie", ingredients: ["graham crackers","chocolate","condensed milk","butter","salt"], calories: 210, protein: 2, carbs: 32, fats: 9, fiber: 1, recipe: "1. Crush graham crackers into fine crumbs\n2. Melt butter and mix with crushed graham and salt\n3. Press into pie crust and refrigerate\n4. Melt chocolate with condensed milk for filling\n5. Pour into crust and refrigerate until set" },
  { name: "Dilis (Dried Anchovies)", ingredients: ["anchovies","salt"], calories: 120, protein: 20, carbs: 0, fats: 4, fiber: 0, recipe: "1. Clean fresh anchovies under running water\n2. Remove heads and gut if desired (optional)\n3. Layer on trays with sea salt between layers\n4. Dry under sun for 3-5 days until completely dried\n5. Store in airtight container for long-term use" },
  { name: "Bagnet Bits", ingredients: ["pork belly","salt","garlic"], calories: 280, protein: 16, carbs: 0, fats: 23, fiber: 0, recipe: "1. Cut pork belly into small cubes about 1 inch\n2. Boil in water with salt and garlic for 10 minutes\n3. Drain well and dry completely\n4. Deep fry in oil over low heat until golden and crispy\n5. Drain on paper towel, serve as a crispy pork cracklings" },
  { name: "Peanut Brittle", ingredients: ["peanuts","brown sugar","corn syrup","butter","salt"], calories: 220, protein: 8, carbs: 28, fats: 10, fiber: 2, recipe: "1. Heat brown sugar, corn syrup, and butter to 300°F\n2. Add roasted peanuts and stir to coat\n3. Quickly pour onto buttered baking sheet\n4. Cool completely then break into pieces\n5. Store in airtight container" },
  { name: "Sweet Corn Ice Cream", ingredients: ["corn","milk","sugar","cream","vanilla"], calories: 180, protein: 4, carbs: 26, fats: 7, fiber: 1, recipe: "1. Blend cooked corn with milk until smooth\n2. Strain through fine mesh to get corn milk\n3. Heat corn milk with sugar until dissolved\n4. Cool completely, add cream and vanilla extract\n5. Churn in ice cream maker according to instructions" },
  { name: "Egg Pie", ingredients: ["egg yolks","pie crust","sugar","condensed milk","evaporated milk"], calories: 240, protein: 6, carbs: 32, fats: 10, fiber: 1, recipe: "1. Beat egg yolks with sugar until pale\n2. Mix in condensed milk and evaporated milk\n3. Pour into unbaked pie crust\n4. Bake at 375°F for 30-35 minutes until set\n5. Cool before slicing and serving" },
  { name: "Fried Spring Roll", ingredients: ["cabbage","carrots","pork","spring roll wrapper","garlic","soy sauce"], calories: 160, protein: 6, carbs: 18, fats: 7, fiber: 2, recipe: "1. Sauté garlic, add minced pork and cook until done\n2. Add shredded cabbage and carrots, season with soy sauce\n3. Cook until vegetables soften, then cool\n4. Wrap in spring roll wrapper, seal edges with water\n5. Deep fry until golden brown and crispy" },
  { name: "Garlic Bread Stick", ingredients: ["bread","garlic","butter","parmesan cheese","salt"], calories: 180, protein: 4, carbs: 24, fats: 8, fiber: 1, recipe: "1. Slice bread into sticks about 1 inch wide\n2. Mix softened butter with minced garlic, salt, and parmesan\n3. Brush garlic butter generously on bread sticks\n4. Arrange on baking sheet and bake at 375°F for 10-12 minutes\n5. Serve hot with additional parmesan cheese" },
];


// ===== AUTHENTICATION MIDDLEWARE =====
interface AuthRequest extends Request {
  user?: any;
}

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('🔐 Auth Header:', authHeader);
  console.log('🎫 Token:', token ? 'Present' : 'Missing');

  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({ 
      success: false,
      message: 'Access token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    console.log('✅ Token verified, user ID:', decoded.id);
    req.user = decoded;
    next();
  } catch (err: any) {
    console.log('❌ Token verification failed:', getErrorMessage(err)); // changed
    return res.status(403).json({ 
      success: false,
      message: 'Invalid or expired token' 
    });
  }
};

// ===== HELPER FUNCTIONS =====

// Add rice/carb sides to lunch and dinner meals
function addRiceSidesToMeals(weekPlan: any[]) {
  const riceSideDishes = [
    { name: 'Sinangag na Kanin (Garlic Fried Rice)', calories: 180, carbs: 35, protein: 4, fats: 2 },
    { name: 'Plain Steamed Rice', calories: 130, carbs: 28, protein: 2.7, fats: 0.3 },
    { name: 'Fried Rice', calories: 160, carbs: 30, protein: 3, fats: 3 }
  ];
  
  return weekPlan.map((day: any) => {
    const updatedMeals = { ...day.meals };
    
    // Add rice to lunch if not already included
    if (updatedMeals.lunch && !String(updatedMeals.lunch.name || '').toLowerCase().includes('rice')) {
      const randomRice = riceSideDishes[Math.floor(Math.random() * riceSideDishes.length)];
      updatedMeals.lunch = {
        ...updatedMeals.lunch,
        name: `${updatedMeals.lunch.name} with ${randomRice.name}`,
        calories: (updatedMeals.lunch.calories || 0) + randomRice.calories,
        carbs: (updatedMeals.lunch.carbs || 0) + randomRice.carbs,
        protein: (updatedMeals.lunch.protein || 0) + randomRice.protein,
        fats: (updatedMeals.lunch.fats || 0) + randomRice.fats,
        ingredients: Array.isArray(updatedMeals.lunch.ingredients) 
          ? [...updatedMeals.lunch.ingredients, 'Garlic Fried Rice or Steamed Rice'] 
          : ['Garlic Fried Rice or Steamed Rice']
      };
    }
    
    // Add rice to dinner if not already included
    if (updatedMeals.dinner && !String(updatedMeals.dinner.name || '').toLowerCase().includes('rice')) {
      const randomRice = riceSideDishes[Math.floor(Math.random() * riceSideDishes.length)];
      updatedMeals.dinner = {
        ...updatedMeals.dinner,
        name: `${updatedMeals.dinner.name} with ${randomRice.name}`,
        calories: (updatedMeals.dinner.calories || 0) + randomRice.calories,
        carbs: (updatedMeals.dinner.carbs || 0) + randomRice.carbs,
        protein: (updatedMeals.dinner.protein || 0) + randomRice.protein,
        fats: (updatedMeals.dinner.fats || 0) + randomRice.fats,
        ingredients: Array.isArray(updatedMeals.dinner.ingredients)
          ? [...updatedMeals.dinner.ingredients, 'Garlic Fried Rice or Steamed Rice']
          : ['Garlic Fried Rice or Steamed Rice']
      };
    }
    
    // Recalculate totals
    const totals = sumMacros(Object.values(updatedMeals));
    return {
      ...day,
      meals: updatedMeals,
      totalCalories: totals.calories,
      totalProtein: totals.protein,
      totalCarbs: totals.carbs,
      totalFats: totals.fats
    };
  });
}

async function enhanceAIWeekPlanWithDetails(parsedWeekPlan: any[], dishes: any[]) {
  if (!Array.isArray(parsedWeekPlan)) return [];

  return parsedWeekPlan.map((dayObj: any) => {
    const mealsInput = dayObj.meals || {};
    const enrichedMeals: Record<string, any> = {};

    for (const [mealType, mealValue] of Object.entries(mealsInput)) {
      let mealName = "";
      if (typeof mealValue === "string") {
        mealName = mealValue;
      } else if (mealValue && typeof mealValue === "object") {
        mealName = (mealValue as any).name || "";
      }

      const dish = dishes.find((d: any) => String(d.name || "").toLowerCase() === String(mealName || "").toLowerCase());
      if (dish) {
        let ingredients: string[] = [];
        try {
          if (typeof dish.ingredients === "string") {
            ingredients = JSON.parse(String(dish.ingredients));
            if (!Array.isArray(ingredients)) ingredients = [String(dish.ingredients)];
          } else if (Array.isArray(dish.ingredients)) {
            ingredients = dish.ingredients;
          } else {
            ingredients = [];
          }
        } catch (e: any) {
          ingredients = String(dish.ingredients || "").split(",").map((s: string) => s.trim()).filter(Boolean);
        }

        enrichedMeals[mealType] = {
          name: dish.name,
          ingredients,
          portionSize: dish.portion_size || "1 serving",
          calories: Number(dish.calories ?? dish.cal ?? 0),
          protein: Number(dish.protein ?? dish.pro ?? 0),
          carbs: Number(dish.carbs ?? dish.carb ?? 0),
          fats: Number(dish.fats ?? dish.fat ?? 0),
          fiber: Number(dish.fiber ?? 0),
          recipe: dish.recipe || (mealValue && (mealValue as any).recipe) || ""
        };
      } else {
        if (typeof mealValue === "object" && mealValue !== null) {
          enrichedMeals[mealType] = createMealObject(mealValue);
        } else {
          enrichedMeals[mealType] = createMealObject({ name: mealName || "Unnamed Meal" });
        }
      }
    }

    const totals = sumMacros(Object.values(enrichedMeals));
    return {
      day: dayObj.day || dayObj.dayName || "",
      meals: enrichedMeals,
      totalCalories: totals.calories,
      totalProtein: totals.protein,
      totalCarbs: totals.carbs,
      totalFats: totals.fats,
    };
  });
}

function createMealObject(meal: any) {
  return {
    name: meal.name || "Unnamed Meal",
    ingredients: meal.ingredients || [],
    portionSize: meal.portionSize || "1 serving",
    calories: Number(meal.calories ?? meal.cal ?? 0),
    protein: Number(meal.protein ?? meal.pro ?? 0),
    carbs: Number(meal.carbs ?? meal.carb ?? 0),
    fats: Number(meal.fats ?? meal.fat ?? 0),
    fiber: Number(meal.fiber ?? 0),
    recipe: meal.recipe || "1. Prepare all ingredients\n2. Cook according to traditional Filipino method\n3. Season to taste\n4. Serve hot",
  };
}

function generateShoppingList(weekPlan: any[]) {
  const ingredientCounts: Record<string, number> = {};

  if (!Array.isArray(weekPlan)) return [];

  weekPlan.forEach((day: any) => {
    Object.values(day.meals).forEach((meal: any) => {
      if (meal && Array.isArray(meal.ingredients)) {
        meal.ingredients.forEach((ing: string) => {
          const normalized = ing.trim().toLowerCase();
          ingredientCounts[normalized] = (ingredientCounts[normalized] || 0) + 1;
        });
      }
    });
  });

  const shoppingList = Object.entries(ingredientCounts).map(([ingredient, count]) => ({
    ingredient,
    estimate: `${count} portion(s)`,
  }));

  shoppingList.sort((a: any, b: any) => (b.estimate.length - a.estimate.length));
  return shoppingList;
}

function getMealPrepTips(weekPlan: any[]) {
  const tips: string[] = [
    "Batch-cook rice (3-4 servings) and freeze in portion containers.",
    "Roast or grill proteins on one day to use across multiple meals.",
    "Chop vegetables and store them in airtight containers for quick cooking.",
    "Prepare sauces and dressings in a jar to add flavor quickly.",
    "Portion meals in reusable containers labeled by day to speed up reheating and reduce waste."
  ];

  const stewDays = (weekPlan || []).filter((d: any) =>
    Object.values(d.meals).some((m: any) => m.name && /sinigang|tinola|bulalo|pochero/i.test(m.name))
  );
  if (stewDays.length >= 2) {
    tips.push("Make a big batch of broths (sinigang/tinola/bulalo) and freeze in portions for quick lunches/dinners.");
  }

  const friedCount = (weekPlan || []).reduce((acc: number, day: any) => {
    const dayFried = Object.values(day.meals).filter((m: any) => m.name && /fried|crispy|prito|daing|tapa|longganisa|spamsilog/i.test(m.name)).length;
    return acc + dayFried;
  }, 0);
  if (friedCount >= 4) {
    tips.push("For fried items, consider pan-searing instead of deep frying to reduce oil use and cleanup time.");
  }

  return tips;
}

function getNutritionTips(goal: string) {
  const normalizedGoal = (goal || "").toLowerCase();
  switch (normalizedGoal) {
    case "muscle gain":
    case "gain":
      return [
        "Increase protein intake at every meal (aim for 20–40g per meal).",
        "Include a mix of fast-digesting carbs and protein post-workout (e.g., rice + chicken).",
        "Use healthy fats (avocado, coconut, nuts) to increase calorie density."
      ];
    case "weight loss":
    case "loss":
      return [
        "Focus on lean proteins and vegetables to increase satiety.",
        "Reduce portion sizes of calorie-dense foods and favor low-calorie volume foods (leafy greens, broth-based soups).",
        "Avoid sugary beverages and reduce fried foods; use steamed or grilled methods."
      ];
    default:
      return [
        "Balance protein, carbs, and fats throughout the day.",
        "Aim for whole foods and fiber-rich vegetables to maintain steady energy.",
        "Drink plenty of water and keep sodium moderate to reduce water retention."
      ];
  }
}

function shuffleArray<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sumMacros(meals: any[]) {
  const totals = { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 };
  meals.forEach((m: any) => {
    totals.calories += Number(m.calories || m.cal || 0);
    totals.protein += Number(m.protein || m.pro || 0);
    totals.carbs += Number(m.carbs || m.carb || 0);
    totals.fats += Number(m.fats || m.fat || 0);
    totals.fiber += Number(m.fiber || 0);
  });
  return totals;
}

function pickUniqueMeals(source: any[], used: Set<string>, count: number) {
  let pool = source.filter(m => !used.has(m.name));
  if (pool.length < count) {
    used.clear();
    pool = [...source];
  }
  const shuffled = shuffleArray(pool);
  const picked = shuffled.slice(0, Math.min(count, shuffled.length));
  picked.forEach(m => used.add(m.name));
  return picked;
}

function generateWeekPlan(aiDay: any | null, targets: any, goal: string) {
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const used = new Set<string>();
  const usedSnacks = new Set<string>();
  const weekPlan: any[] = [];

  if (aiDay && aiDay.meals) {
    Object.values(aiDay.meals).forEach((m: any) => {
      if (m && m.name) used.add(m.name);
    });
  }

  for (const day of DAYS) {
    if (aiDay && aiDay.day === day) {
      const normalizedMeals: any = {};
      Object.entries(aiDay.meals || {}).forEach(([k,v]: any) => {
        normalizedMeals[k] = createMealObject(v);
        if (normalizedMeals[k].name) used.add(normalizedMeals[k].name);
      });
      const totals = sumMacros(Object.values(normalizedMeals));
      weekPlan.push({
        day,
        meals: normalizedMeals,
        totalCalories: totals.calories,
        totalProtein: totals.protein,
        totalCarbs: totals.carbs,
        totalFats: totals.fats
      });
      continue;
    }

    // Pick 3 main meals (breakfast, lunch, dinner) from meals list
    const picks = pickUniqueMeals(trustedFilipinoMealsDetailed, used, 3);

    while (picks.length < 3) {
      const fallback = trustedFilipinoMealsDetailed[Math.floor(Math.random() * trustedFilipinoMealsDetailed.length)];
      if (!picks.find(p => p.name === fallback.name)) picks.push(fallback);
    }

    // Pick 2 snacks from SNACKS list only
    const snack1 = pickUniqueMeals(filipinoSnacks, usedSnacks, 1)[0];
    const snack2 = pickUniqueMeals(filipinoSnacks, usedSnacks, 1)[0];

    const mealsObj: any = {
      breakfast: createMealObject(picks[0]),
      lunch: createMealObject(picks[1]),
      dinner: createMealObject(picks[2]),
      snack1: createMealObject(snack1),
      snack2: createMealObject(snack2),
    };

    const totals = sumMacros(Object.values(mealsObj));
    weekPlan.push({
      day,
      meals: mealsObj,
      totalCalories: totals.calories,
      totalProtein: totals.protein,
      totalCarbs: totals.carbs,
      totalFats: totals.fats
    });
  }

  return weekPlan;
}

// Safe OpenAI wrapper with timeout
async function safeOpenAICompletionsCreate(params: any, timeoutMs = 12000): Promise<any> {
  if (!openai) {
    throw new Error('OpenAI not configured');
  }
  try {
    const promise = openai.chat.completions.create(params);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI timeout')), timeoutMs));
    const completion = await Promise.race([promise, timeout]);
    openaiAvailable = true;
    return completion;
  } catch (err: any) {
    const errMsg = getErrorMessage(err); // changed
    const status = (err?.status || err?.response?.status || err?.code) as any;
    const isAuthErr = status === 401 || /Incorrect API key/i.test(errMsg) || /invalid api key/i.test(errMsg); // changed to use errMsg
    if (isAuthErr) {
      openaiAvailable = false;
      console.warn('OpenAI unauthorized: check OPENAI_API_KEY (rotate key).');
      const e = new Error('OPENAI_UNAUTHORIZED');
      (e as any).status = 401;
      throw e;
    }
    throw err;
  }
}

// Utility: ensure a user preference row exists; return its id or null
async function ensureUserPreferenceExists(userId: number): Promise<number | null> {
  try {
    const [rows] = await pool.query<any[]>('SELECT id FROM user_meal_preferences WHERE user_id = ?', [userId]);
    if (Array.isArray(rows) && rows.length > 0) {
      return Number(rows[0].id);
    }

    const [insertResult] = await pool.query<any>(
      `INSERT INTO user_meal_preferences (user_id, preferences, created_at)
       VALUES (?, ?, NOW())`,
      [ userId, JSON.stringify({}) ]
    );

    return Number(insertResult.insertId || null);
  } catch (err: any) {
    // Use the helper to extract message safely
    console.warn('Failed to ensure preference exists:', getErrorMessage(err));
    return null;
  }
}

// Add helper to safely extract message from unknown errors
function getErrorMessage(err: unknown): string {
  if (!err) return String(err);
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  try {
    if (typeof err === 'object' && err !== null && 'message' in err) {
      return String((err as any).message || JSON.stringify(err));
    }
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// Add this helper below getErrorMessage() and above route handlers
function isoDateString(input?: Date | string | null): string {
  if (!input) return new Date().toISOString().split('T')[0];
  const d = input instanceof Date ? input : new Date(String(input));
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  return d.toISOString().split('T')[0];
}

// ============================================
// INPUT VALIDATION HELPERS
// ============================================

// Generate recipe instructions using OpenAI
async function generateRecipeInstructions(mealName: string, ingredients: string[]): Promise<string> {
  if (!openai || !openaiAvailable) {
    // Return basic instructions if OpenAI not available
    return `1. Prepare all ingredients\n2. Cook according to traditional Filipino method\n3. Season to taste\n4. Serve hot`;
  }
  
  try {
    const ingredientsList = ingredients.join(", ");
    const completion = await safeOpenAICompletionsCreate({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a Filipino cuisine expert. Provide concise, numbered cooking instructions (3-5 steps max) for traditional Filipino dishes. Keep each step brief and practical."
        },
        {
          role: "user",
          content: `Generate simple cooking instructions for "${mealName}" using these ingredients: ${ingredientsList}. Return only the numbered steps, no extra text.`
        }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    const recipeText = (completion?.choices?.[0]?.message?.content || "").trim();
    return recipeText || `1. Prepare all ingredients\n2. Cook according to traditional Filipino method\n3. Season to taste\n4. Serve hot`;
  } catch (err: any) {
    console.warn('Recipe generation failed:', getErrorMessage(err));
    return `1. Prepare all ingredients\n2. Cook according to traditional Filipino method\n3. Season to taste\n4. Serve hot`;
  }
}

// Enrich week plan meals with recipes
async function enrichWeekPlanWithRecipes(weekPlan: any[]): Promise<any[]> {
  if (!Array.isArray(weekPlan)) return weekPlan;
  
  return Promise.all(weekPlan.map(async (day) => {
    if (!day.meals || typeof day.meals !== 'object') return day;
    
    const enrichedMeals: Record<string, any> = {};
    for (const [mealType, meal] of Object.entries(day.meals)) {
      if (!meal || typeof meal !== 'object') {
        enrichedMeals[mealType] = meal;
        continue;
      }
      
      const mealObj = meal as any;
      // Only generate recipe if it's empty and we have ingredients
      if ((!mealObj.recipe || mealObj.recipe.trim() === '') && mealObj.ingredients && Array.isArray(mealObj.ingredients) && mealObj.ingredients.length > 0) {
        const recipe = await generateRecipeInstructions(mealObj.name || "Meal", mealObj.ingredients);
        enrichedMeals[mealType] = { ...mealObj, recipe };
      } else {
        enrichedMeals[mealType] = mealObj;
      }
    }
    
    return { ...day, meals: enrichedMeals };
  }));
}

// ===== BASIC ROUTES =====
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      port: process.env.DB_PORT || '3308'
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: 'Database connection failed'
    });
  }
});

app.get('/api/system/status', async (req: Request, res: Response) => {
  try {
    let dbOk = false;
    try {
      await pool.query('SELECT 1');
      dbOk = true;
    } catch (e) {
      dbOk = false;
    }

    const openaiOk = !!process.env.OPENAI_API_KEY && typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.trim().length > 0;

    let paypalOk = false;
    try {
      await axios.post(
        `${PAYPAL_API_URL}/oauth2/token`,
        'grant_type=client_credentials',
        {
          timeout: 1500,
          auth: {
            username: PAYPAL_CLIENT_ID,
            password: PAYPAL_CLIENT_SECRET
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      paypalOk = true;
    } catch (e) {
      paypalOk = false;
    }

    return res.json({
      ok: true,
      dbConnected: dbOk,
      openai: openaiOk,
      paypal: paypalOk,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: getErrorMessage(err) }); // changed
  }
});

// ===== AUTHENTICATION ROUTES =====
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    if (typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    console.log('\n🔐 Login attempt received');

    const [users] = await pool.query<any[]>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (!Array.isArray(users) || users.length === 0) {
      console.log('❌ User not found');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];
    console.log('✅ User found');

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      console.log('❌ Invalid password');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    console.log('✅ Login successful\n');
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('❌ Login error:', getErrorMessage(error)); // changed
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    const [users] = await pool.query<any[]>(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(currentPassword, user.password);

    if (!validPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/register', registerLimiter, async (req: Request, res: Response) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      gender,
      dateOfBirth,
      membershipType,
      membershipPrice,
      emergencyContact,
      address,
      joinDate,
    } = req.body;

    console.log('\n➕ New member registration started');

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !phone) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }
    
    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message || 'Password does not meet requirements'
      });
    }
    
    // Validate phone format
    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }
    
    // Sanitize string inputs
    const sanitizedFirstName = sanitizeInput(firstName);
    const sanitizedLastName = sanitizeInput(lastName);
    if (!sanitizedFirstName || !sanitizedLastName) {
      return res.status(400).json({
        success: false,
        message: 'First and last names are required'
      });
    }

    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if ((existingUsers as any[]).length > 0) {
      console.log('❌ Registration failed: email already in use');
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 12);

    const subscriptionStart = new Date();
    const subscriptionEnd = new Date();
    
    switch (membershipType || 'monthly') {
      case 'monthly':
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
        break;
      case 'quarterly':
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 3);
        break;
      case 'annual':
        subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
        break;
    }

    console.log('💾 Inserting member into database...');
    
    const [result] = await pool.query(
      `INSERT INTO users (
        first_name, last_name, email, password, phone, 
        gender, date_of_birth, role, status,
        membership_type, membership_price, join_date,
        subscription_start, subscription_end,
        payment_status, emergency_contact, address,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'member', 'active', ?, ?, ?, ?, ?, 'pending', ?, ?, NOW())`,
      [
        firstName,
        lastName,
        email,
        hashedPassword,
        phone,
        gender || 'male',
        dateOfBirth || null,
        membershipType || 'monthly',
        membershipPrice || 1500,
        isoDateString(req.body?.joinDate || joinDate), // safe access — prefer req.body.joinDate if present
        isoDateString(subscriptionStart), // was subscriptionStart.toISOString().split('T')[0]
        isoDateString(subscriptionEnd), // was subscriptionEnd.toISOString().split('T')[0]
        emergencyContact || null,
        address || null,
      ]
    );

    const userId = (result as any).insertId;

    console.log(`✅ Member registered successfully with ID: ${userId}\n`);

    res.status(201).json({
      success: true,
      message: 'Member registered successfully',
      userId,
    });
  } catch (error: any) {
    console.error('❌ Registration error:', getErrorMessage(error)); // changed
    res.status(500).json({ 
      success: false, 
      message: getErrorMessage(error) || 'Registration failed' 
    });
  }
});

// ===== MEMBER MANAGEMENT ROUTES =====
app.get('/api/members', async (req, res) => {
  try {
    console.log('📋 Fetching all members with payment info...');
    
    const [members] = await pool.query<any[]>(
      `SELECT 
        u.id, 
        u.email, 
        u.first_name as firstName, 
        u.last_name as lastName,
        u.phone,
        u.gender,
        u.date_of_birth as dateOfBirth,
        u.membership_type as membershipType,
        u.membership_price as membershipPrice,
        u.join_date as joinDate,
        u.status,
        u.payment_status as paymentStatus,
        u.subscription_start as subscriptionStart,
        u.subscription_end as subscriptionEnd,
        u.emergency_contact as emergencyContact,
        u.address,
        COUNT(p.id) as totalPayments
      FROM users u
      LEFT JOIN payments p ON u.id = p.user_id
      WHERE u.role = "member"
      GROUP BY u.id`
    );

    console.log(`✅ Found ${members.length} members`);
    
    const transformedMembers = members.map((member: any) => ({
      id: member.id,
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      email: member.email,
      phone: member.phone || '',
      gender: member.gender || 'male',
      dateOfBirth: member.dateOfBirth ? new Date(member.dateOfBirth).toISOString().split('T')[0] : '',
      membershipType: member.membershipType || 'monthly',
      membershipPrice: parseFloat(member.membershipPrice) || 1500,
      joinDate: member.joinDate ? new Date(member.joinDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      status: member.status || 'active',
      paymentStatus: member.paymentStatus || 'pending',
      subscriptionStart: member.subscriptionStart ? new Date(member.subscriptionStart).toISOString().split('T')[0] : null,
      subscriptionEnd: member.subscriptionEnd ? new Date(member.subscriptionEnd).toISOString().split('T')[0] : null,
      emergencyContact: member.emergencyContact || '',
      address: member.address || '',
      totalPayments: member.totalPayments || 0,
    }));

    res.json(transformedMembers);
  } catch (error: any) {
    console.error('❌ Error fetching members:', getErrorMessage(error)); // changed
    res.status(500).json({ message: 'Server error', error: getErrorMessage(error) });
  }
});

app.post('/api/members', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      password, 
      phone, 
      gender, 
      dateOfBirth, 
      membershipType, 
      membershipPrice,
      joinDate,
      status,
      emergencyContact,
      address,
      
    } = req.body;

    console.log('\n➕ Admin adding new member');

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const [existing] = await pool.query<any[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      console.log('❌ Email already exists in system');
      return res.status(400).json({ message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const subscriptionStart = new Date();
    const subscriptionEnd = new Date();
    
    switch(membershipType) {
      case 'monthly':
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
        break;
      case 'quarterly':
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 3);
        break;
      case 'annual':
        subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
        break;
    }
    
    const [result] = await pool.query(
      `INSERT INTO users (
        first_name, last_name, email, password, phone, 
        gender, date_of_birth, role, status,
        membership_type, membership_price, join_date,
        subscription_start, subscription_end,
        payment_status, emergency_contact, address,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'member', ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW())`,
      [
        firstName,
        lastName,
        email,
        hashedPassword,
        phone,
        gender || 'male',
        dateOfBirth || null,
        status || 'active',
        membershipType || 'monthly',
        membershipPrice || 1500,
        joinDate || isoDateString(new Date()), // in the insert values: use isoDateString for joinDate default
        isoDateString(subscriptionStart), // was subscriptionStart.toISOString().split('T')[0]
        isoDateString(subscriptionEnd),   // was subscriptionEnd.toISOString().split('T')[0]
        emergencyContact || null,
        address || null
      ]
    );

    const insertId = (result as any).insertId;

    console.log(`✅ Member added with ID: ${insertId}\n`);

    res.status(201).json({ 
      success: true,
      message: 'Member added successfully',
      id: insertId
    });
  } catch (error: any) {
    console.error('❌ Error adding member:', getErrorMessage(error)); // changed
    res.status(500).json({ success: false, message: 'Server error', error: getErrorMessage(error) });
  }
});

app.put('/api/members/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const memberId = req.params.id;
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      gender,
      dateOfBirth,
      membershipType,
      membershipPrice,
      status,
      emergencyContact,
      address,
      joinDate,
    } = req.body;

    console.log(`📝 Updating member ID: ${memberId}`);

    let updateFields = [];
    let updateValues = [];

    if (firstName) {
      updateFields.push('first_name = ?');
      updateValues.push(firstName);
    }
    if (lastName) {
      updateFields.push('last_name = ?');
      updateValues.push(lastName);
    }
    if (email) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      updateFields.push('password = ?');
      updateValues.push(hashedPassword);
    }
    if (phone) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (gender) {
      updateFields.push('gender = ?');
      updateValues.push(gender);
    }
    if (dateOfBirth) {
      updateFields.push('date_of_birth = ?');
      updateValues.push(dateOfBirth);
    }
    if (membershipType) {
      updateFields.push('membership_type = ?');
      updateValues.push(membershipType);
    }
    if (membershipPrice) {
      updateFields.push('membership_price = ?');
      updateValues.push(membershipPrice);
    }
    if (status) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (emergencyContact !== undefined) {
      updateFields.push('emergency_contact = ?');
      updateValues.push(emergencyContact);
    }
    if (address !== undefined) {
      updateFields.push('address = ?');
      updateValues.push(address);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updateValues.push(memberId);

    await pool.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    console.log('✅ Member updated successfully');

    res.json({ 
      success: true,
      message: 'Member updated successfully' 
    });
  } catch (error: any) {
    console.error('❌ Error updating member:', getErrorMessage(error)); // changed
    res.status(500).json({ success: false, message: 'Server error', error: getErrorMessage(error) });
  }
});

app.delete('/api/members/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`\n🗑️ Deleting member ID: ${id}`);

    const [result] = await pool.query(
      'DELETE FROM users WHERE id = ? AND role = "member"',
      [id]
    );

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ message: 'Member not found' });
    }

    console.log(`✅ Member deleted successfully\n`);
    res.json({ message: 'Member deleted successfully' });
  } catch (error: any) {
    console.error('❌ Error deleting member:', getErrorMessage(error)); // changed
    res.status(500).json({ message: 'Server error', error: getErrorMessage(error) });
  }
});

// ===== PAYMENT ROUTES =====
app.get('/api/member/subscription', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const [member] = await pool.query<any[]>(
      `SELECT 
        id, email, first_name as firstName, last_name as lastName,
        membership_type as membershipType, membership_price as membershipPrice,
        subscription_start as subscriptionStart, subscription_end as subscriptionEnd,
        payment_status as paymentStatus, status
      FROM users WHERE id = ? AND role = 'member'`,
      [userId]
    );

    if (member.length === 0) {
      return res.status(404).json({ message: 'Member not found' });
    }

    res.json(member[0]);
  } catch (error: any) {
    console.error('❌ Error fetching subscription:', getErrorMessage(error)); // changed
    res.status(500).json({ message: 'Server error', error: getErrorMessage(error) });
  }
});

app.post('/api/member/payment/gcash', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId: bodyUserId, membershipType, amount, paymentMethod } = req.body;
    // Use userId from token if not provided in body (for renewal cases)
    const userId = bodyUserId || req.user?.id;

    console.log('\n💳 Processing GCash AUTO-APPROVAL payment:', { userId, membershipType, amount, paymentMethod, fromToken: !bodyUserId });

    if (!userId || !membershipType || !amount) {
      console.log('❌ Missing required fields:', { userId: !!userId, membershipType: !!membershipType, amount: !!amount });
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: userId=' + (userId ? 'OK' : 'MISSING') + ', membershipType=' + (membershipType ? 'OK' : 'MISSING') + ', amount=' + (amount ? 'OK' : 'MISSING')
      });
    }

    const transactionId = `GCASH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const subscriptionStart = new Date();
    const subscriptionEnd = new Date();
    
    switch (membershipType) {
      case 'monthly':
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
        break;
      case 'quarterly':
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 3);
        break;
      case 'annual':
        subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
        break;
    }

    const paymentStatus = 'paid';
    console.log(`📝 GCash payment → Status: ${paymentStatus} (AUTO-APPROVED)`);

    const [result] = await pool.query(
      `INSERT INTO payments (
        user_id, amount, payment_date, payment_method,
        membership_type, payment_status, transaction_id,
        subscription_start, subscription_end
      ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?)`,
      [
        userId, 
        amount, 
        paymentMethod || 'gcash', 
        membershipType, 
        paymentStatus, 
        transactionId,
        isoDateString(subscriptionStart), // was subscriptionStart.toISOString().split('T')[0]
        isoDateString(subscriptionEnd),   // was subscriptionEnd.toISOString().split('T')[0]
      ]
    );

    await pool.query(
      `UPDATE users 
       SET status = 'active',
           payment_status = 'paid',
           subscription_start = ?,
           subscription_end = ?,
           membership_type = ?,
           membership_price = ?
       WHERE id = ?`,
      [
        isoDateString(subscriptionStart), // was subscriptionStart.toISOString().split('T')[0]
        isoDateString(subscriptionEnd),   // was subscriptionEnd.toISOString().split('T')[0]
        membershipType,
        amount,
        userId
      ]
    );

    console.log('✅ GCash payment approved instantly!');

    res.status(201).json({
      success: true,
      message: '✅ Payment successful! Your subscription is now active.',
      paymentId: (result as any).insertId,
      transactionId,
      paymentStatus: 'paid',
      subscription: {
        start: subscriptionStart.toISOString().split('T')[0],
        end: subscriptionEnd.toISOString().split('T')[0],
        type: membershipType,
        amount: amount
      }
    });

  } catch (error: any) {
    console.error('❌ GCash payment error:', getErrorMessage(error)); // changed
    res.status(500).json({ success: false, message: getErrorMessage(error) || 'Payment processing failed' });
  }
});

app.post('/api/admin/payments/record-cash', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, membershipType, amount, paymentMethod, notes } = req.body;

    if (!userId || !amount || !membershipType) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields' 
      });
    }

    const transactionId = `CASH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const subscriptionStart = new Date();
    const subscriptionEnd = new Date();
    
    switch (membershipType) {
      case 'monthly':
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
        break;
      case 'quarterly':
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 3);
        break;
      case 'annual':
        subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
        break;
    }

    const paymentStatus = 'paid';

    const [result] = await pool.query(
      `INSERT INTO payments (
        user_id, amount, payment_date, payment_method,
        membership_type, payment_status, transaction_id,
        subscription_start, subscription_end, notes
      ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, 
        amount, 
        paymentMethod || 'cash', 
        membershipType, 
        paymentStatus, 
        transactionId,
        isoDateString(subscriptionStart),
        isoDateString(subscriptionEnd),
        notes || ''
      ]
    );

    await pool.query(
      `UPDATE users 
       SET status = 'active',
           payment_status = 'paid',
           subscription_start = ?,
           subscription_end = ?,
           membership_type = ?,
           membership_price = ?
       WHERE id = ?`,
      [
        isoDateString(subscriptionStart),
        isoDateString(subscriptionEnd),
        membershipType,
        amount,
        userId
      ]
    );

    res.status(201).json({
      success: true,
      message: '✅ Payment recorded! Member subscription is now active.',
      paymentId: (result as any).insertId,
      transactionId,
      paymentStatus: 'paid',
      subscription: {
        start: subscriptionStart.toISOString().split('T')[0],
        end: subscriptionEnd.toISOString().split('T')[0],
        type: membershipType,
        amount: amount
      }
    });

  } catch (error: any) {
    console.error('❌ Cash payment recording error:', getErrorMessage(error));
    res.status(500).json({ success: false, message: getErrorMessage(error) || 'Failed to record payment' });
  }
});

// GET ALL PAYMENTS FOR ADMIN DASHBOARD (ADMIN)
app.get('/api/admin/payments/all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const [payments] = await pool.query<any[]>(`
      SELECT 
        p.id,
        p.user_id,
        p.amount,
        p.payment_method,
        p.membership_type,
        COALESCE(p.payment_status, 'paid') as payment_status,
        p.payment_date,
        p.transaction_id,
        p.subscription_start,
        p.subscription_end,
        p.notes,
        u.first_name as firstName,
        u.last_name as lastName,
        u.email
      FROM payments p
      INNER JOIN users u ON p.user_id = u.id
      ORDER BY p.payment_date DESC
    `);

    res.json(payments);
  } catch (error: any) {
    console.error('❌ Get all payments error:', getErrorMessage(error));
    res.status(500).json({ success: false, message: 'Failed to get payments', error: getErrorMessage(error) });
  }
});

// ADMIN PAYMENT SUMMARY ROUTE
app.get('/api/admin/payments/summary', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Total revenue (sum of all paid payments)
    const [revenueRows] = await pool.query<any[]>(`
      SELECT SUM(amount) as totalRevenue
      FROM payments
      WHERE payment_status = 'paid'
    `);

    // Count of pending payments
    const [pendingRows] = await pool.query<any[]>(`
      SELECT COUNT(*) as pendingPayments
      FROM payments
      WHERE payment_status = 'pending'
    `);

    // Count of paid payments
    const [paidRows] = await pool.query<any[]>(`
      SELECT COUNT(*) as paidPayments
      FROM payments
      WHERE payment_status = 'paid'
    `);

    res.json({
      success: true,
      totalRevenue: Number(revenueRows[0]?.totalRevenue) || 0,
      pendingPayments: Number(pendingRows[0]?.pendingPayments) || 0,
      paidPayments: Number(paidRows[0]?.paidPayments) || 0,
    });
  } catch (err: any) {
    console.error('❌ Payment summary error:', err);
    res.status(500).json({ success: false, message: 'Failed to get payment summary' });
  }
});

// ===== MEAL PLANNER ROUTES =====
// GENERATE MEAL PLAN (AI-POWERED)
app.post('/api/meal-planner/generate', authenticateToken, async (req: AuthRequest, res: Response) => {
  console.log('🔄 /api/meal-planner/generate hit');

  try {
    const userId = req.user!.id;
    const { lifestyle, mealType, goal, diet, dietaryRestrictions, targets, planName } = req.body;

    if (!dbConnected) {
      console.warn('Database not connected: returning local fallback week plan');
      const weekPlan = generateWeekPlan(null, targets, goal);
      return res.status(503).json({
        success: false,
        message: 'Database not connected — returning fallback plan',
        mealPlan: {
          weekPlan,
          shoppingList: generateShoppingList(weekPlan),
          mealPrepTips: getMealPrepTips(weekPlan),
          nutritionTips: getNutritionTips(goal)
        },
        saved: false
      });
    }

    const [dbDishes] = await pool.query<any[]>('SELECT * FROM filipino_dishes ORDER BY name ASC');

    const dishesForPrompt = dbDishes.map(d => ({
      name: d.name,
      category: d.category,
      calories: Number(d.calories ?? d.cal ?? 0),
      protein: Number(d.protein ?? d.pro ?? 0),
      carbs: Number(d.carbs ?? d.carb ?? 0),
      fats: Number(d.fats ?? d.fat ?? 0),
      ingredients: typeof d.ingredients === 'string' ? d.ingredients : (d.ingredients || [])
    }));
    const dishesJson = JSON.stringify(dishesForPrompt);

    // Build diet constraint text with explicit filtering rules
    let dietConstraint = '';
    let dietRules = '';
    
    if (diet && diet !== '') {
      dietConstraint = `\n- Diet Type: ${diet}`;
      
      // Add explicit filtering rules based on diet type
      switch(diet.toLowerCase()) {
        case 'vegan':
          dietRules = '\n- STRICTLY VEGAN: Exclude ALL meat, poultry, seafood, eggs, dairy, and animal products. Only plant-based dishes.';
          break;
        case 'vegetarian':
          dietRules = '\n- VEGETARIAN: Exclude meat, poultry, and seafood. Eggs and dairy are allowed.';
          break;
        case 'low carb':
          dietRules = '\n- LOW CARB: Prioritize dishes with low carbohydrate content. Minimize rice and starchy foods.';
          break;
        case 'low fat':
          dietRules = '\n- LOW FAT: Prioritize lean proteins and minimize oil/fat in dishes.';
          break;
        case 'keto':
          dietRules = '\n- KETO: Very low carbs (under 20g per meal), high fat and protein. Exclude rice, bread, sugary items.';
          break;
        case 'paleo':
          dietRules = '\n- PALEO: Exclude grains, legumes, and dairy. Focus on meat, seafood, vegetables, and fruits.';
          break;
        case 'low sodium':
          dietRules = '\n- LOW SODIUM: Minimize salt and salty condiments. Focus on fresh, unsalted preparations.';
          break;
        case 'high protein':
          dietRules = '\n- HIGH PROTEIN: Prioritize high-protein dishes with lean meats, seafood, and legumes.';
          break;
      }
    }

    const prompt = `
You are a professional Filipino nutritionist and meal planner. The user preferences:
- Lifestyle: ${lifestyle}
- Type: ${mealType}
- Goal: ${goal}${dietConstraint}
- Restrictions: ${dietaryRestrictions}
- Targets: ${targets?.calories ?? 2000} kcal, ${targets?.protein ?? 150}g protein, ${targets?.carbs ?? 250}g carbs, ${targets?.fats ?? 70}g fats

Only use meals from the provided DB list (JSON) below:
${dishesJson}

Rules:
- Only use dishes that appear in the list (no new dishes).${dietRules}
- IMPORTANT: For lunch and dinner, include a rice/carb side dish (like "Sinangag na Kanin" or "Fried Rice") to make it a complete Filipino meal.
- Randomize meals across days and avoid repeating the same meal on consecutive days.
- Return exactly JSON with "weekPlan": an array of 7 objects with structure:
  { "day":"Monday", "meals": { "breakfast": "Tapsilog"|{name:..., calories:..., ingredients:[]...}, "lunch": {name: "main dish with rice side"}, ... }, "totalCalories": number, "totalProtein": number, "totalCarbs": number, "totalFats": number }
`;

    let weekPlan: any[] = [];
    let preferenceId: number | null = null;

    // Try to get user's preference id early
    try {
      const [prefRows] = await pool.query<any[]>('SELECT id FROM user_meal_preferences WHERE user_id = ?', [userId]);
      if (Array.isArray(prefRows) && prefRows.length > 0) {
        preferenceId = Number(prefRows[0].id);
      } else {
        preferenceId = await ensureUserPreferenceExists(userId);
        console.log('Created preference row for user:', userId, 'preferenceId:', preferenceId);
      }
    } catch (err: any) {
      // replaced unsafe access with helper
      console.warn('Could not fetch or create preference id for user:', getErrorMessage(err));
      preferenceId = null;
    }

    // If OpenAI key exists, try AI generation; else fallback immediately
    if (process.env.OPENAI_API_KEY && openaiAvailable) {
      try {
        const completion: any = await safeOpenAICompletionsCreate({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: 'You are a nutritionist and only use the provided list.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 4000
        }, 12000);

        const aiResponse = String((completion?.choices?.[0]?.message?.content) ?? '');
        let parsed: any = null;
        try {
          parsed = JSON.parse(aiResponse || '');
        } catch (parseErr: any) {
          console.warn('AI returned non-JSON or parse failed', getErrorMessage(parseErr)); // changed
        }

        if (parsed && Array.isArray(parsed.weekPlan) && parsed.weekPlan.length === 7) {
          weekPlan = await enhanceAIWeekPlanWithDetails(parsed.weekPlan, dbDishes);
          weekPlan = addRiceSidesToMeals(weekPlan); // Add rice sides to complete Filipino meals
        } else {
          const aiDay = parsed && parsed.weekPlan && parsed.weekPlan[0] ? parsed.weekPlan[0] : null;
          weekPlan = generateWeekPlan(aiDay, targets, goal);
          weekPlan = addRiceSidesToMeals(weekPlan); // Add rice sides to complete Filipino meals
        }
      } catch (aiErr: any) {
        console.warn('OpenAI generation failed — falling back to deterministic plan', getErrorMessage(aiErr)); // changed
        weekPlan = generateWeekPlan(null, targets, goal);
        weekPlan = addRiceSidesToMeals(weekPlan); // Add rice sides to complete Filipino meals
      }
    } else {
      weekPlan = generateWeekPlan(null, targets, goal);
      weekPlan = addRiceSidesToMeals(weekPlan); // Add rice sides to complete Filipino meals
    }

    // Build today's shopping list
    let todayShoppingList: any[] = [];
    try {
      const todayName = new Date().toLocaleString('en-US', { weekday: 'long' });
      const todayPlan = weekPlan.find((d: any) => d.day === todayName) || weekPlan[0];
      todayShoppingList = todayPlan ? generateShoppingList([todayPlan]) : [];
    } catch (err: any) {
      console.warn('Failed to compute today shopping list:', getErrorMessage(err)); // changed
    }

    // Enrich week plan with recipes (AWAIT this to ensure recipes are included in response)
    try {
      console.log('🔄 Generating recipes for meal plan...');
      weekPlan = await enrichWeekPlanWithRecipes(weekPlan);
      console.log('✅ Recipe generation completed');
    } catch (err: any) {
      console.warn('⚠️ Recipe enrichment failed, continuing without recipes:', getErrorMessage(err));
    }

    // Save meal plan safely
    try {
      const safePlanName = planName || "Untitled Plan";

      // ensure we only include generated_at if the column exists
      const hasGeneratedAt = await dbColumnExists('meal_plans', 'generated_at');

      const insertCols = preferenceId === null
        ? (hasGeneratedAt ? 'user_id, plan_name, plan_data, generated_at' : 'user_id, plan_name, plan_data')
        : (hasGeneratedAt ? 'user_id, preference_id, plan_name, plan_data, generated_at' : 'user_id, preference_id, plan_name, plan_data');
  
      const insertValsBase = preferenceId === null
        ? [userId, safePlanName, JSON.stringify({ weekPlan })]
        : [userId, preferenceId, safePlanName, JSON.stringify({ weekPlan })];
  
      const insertVals = hasGeneratedAt ? [...insertValsBase, new Date()] : insertValsBase;

      const qMarks = insertVals.map(() => '?').join(', ');
      await pool.query(`INSERT INTO meal_plans (${insertCols}) VALUES (${qMarks})`, insertVals);
      console.log('Meal plan persisted successfully; preferenceId used:', preferenceId);
    } catch (err: any) {
      console.warn('Failed to persist generated meal plan, continuing without persistence:', getErrorMessage(err)); // changed
    }

    // Respond with meal plan
    res.json({
      success: true,
      mealPlan: {
        weekPlan,
        shoppingList: generateShoppingList(weekPlan),
        todayShoppingList,
        mealPrepTips: getMealPrepTips(weekPlan),
        nutritionTips: getNutritionTips(goal),
      },
      saved: !!preferenceId
    });
  } catch (err: any) {
    const errMsg = getErrorMessage(err); // changed
    console.error('Meal plan generation error:', errMsg);
    res.status(500).json({ success: false, message: 'Failed to generate meal plan', error: errMsg });
  }
});

app.post(['/api/meal-planner/regenerate', '/meal-planner/regenerate'], authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Accept flexible input shapes:
    const { dayIndex, day, mealType, mealKey, mealTypeKey, mealPlan, planId, excludeMealNames = [], currentMeal, dietaryRestrictions, targets, goal, lifestyle } = req.body || {};

    // Determine category for dish selection
    const category = mealTypeKey || mealType || mealKey || null;
    const isSnack = category === 'snack1' || category === 'snack2' || category === 'snacks';

    // Get dishes by category if category provided else fetch all
    let dishes: any[] = [];
    
    // Use snacks list if this is a snack regeneration
    if (isSnack) {
      dishes = filipinoSnacks;
    } else if (category) {
      const [rows] = await pool.query<any[]>('SELECT * FROM filipino_dishes WHERE category = ?', [category]);
      dishes = rows || [];
    }
    
    if (!Array.isArray(dishes) || dishes.length === 0) {
      if (isSnack) {
        dishes = filipinoSnacks;
      } else {
        const [rows] = await pool.query<any[]>('SELECT * FROM filipino_dishes ORDER BY name');
        dishes = rows || [];
      }
    }

    // Normalize excluded names (lowercase)
    const excludeArr = (Array.isArray(excludeMealNames) ? excludeMealNames : (excludeMealNames ? [excludeMealNames] : []))
      .concat(currentMeal && typeof currentMeal === 'string' ? [currentMeal] : (currentMeal && currentMeal.name ? [currentMeal.name] : []))
      .map((n: any) => String(n || '').toLowerCase().trim())
      .filter(Boolean);

    // Fallback sample if no DB dishes
    if (!Array.isArray(dishes) || dishes.length === 0) {
      const fallbackDish = isSnack 
        ? filipinoSnacks[Math.floor(Math.random() * filipinoSnacks.length)]
        : trustedFilipinoMealsDetailed[Math.floor(Math.random() * trustedFilipinoMealsDetailed.length)];
      const mealObj = createMealObject(fallbackDish);
      const recipe = await generateRecipeInstructions(mealObj.name, mealObj.ingredients);
      return res.json({ success: true, newMeal: { ...mealObj, recipe }, source: 'fallback' });
    }

    // Helper: pick random excluding excludeArr
    function pickRandomExcluding(list: any[], exclude: string[]) {
      const pool = list.filter(d => !exclude.includes(String(d.name || '').toLowerCase().trim()));
      if (pool.length === 0) {
        // if nothing left, pick random and label alt
        const r = list[Math.floor(Math.random() * list.length)];
        return { ...r, name: `${r.name} (Alt)` };
      }
      return pool[Math.floor(Math.random() * pool.length)];
    }

    // Build prompt for AI if needed
    const dishListJson = JSON.stringify(dishes.map(d => ({ name: d.name, calories: d.calories, protein: d.protein, carbs: d.carbs, fats: d.fats })));
    const excludeText = excludeArr.length > 0 ? `\nDo NOT return these dish names: ${excludeArr.join(', ')}` : '';
    const prompt = `
You are a Filipino nutritionist. Choose a single ${isSnack ? 'snack' : String(category || mealType || 'meal')} best suited for the user from the list below.
User targets: ${targets?.calories ?? 2000} kcal, ${targets?.protein ?? 150}g protein, ${targets?.carbs ?? 250}g carbs, ${targets?.fats ?? 70}g fats.
Dietary restrictions: ${dietaryRestrictions || 'none'}.
${excludeText}
List: ${dishListJson}
Return JSON: { "newMeal": { "name":"...", "ingredients":[...], "calories":..., "protein":..., "carbs":..., "fats":..., "recipe":"..." } }
`;

    // Try OpenAI for regeneration
    if (process.env.OPENAI_API_KEY && openaiAvailable) {
      try {
        const completion: any = await safeOpenAICompletionsCreate({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: 'You are a Filipino nutritionist. Use only provided list.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 700
        }, 8000);

        const aiResponse = String((completion?.choices?.[0]?.message?.content) ?? '{}');
        let parsed: any = null;
        try { parsed = JSON.parse(aiResponse); } catch { parsed = null; }

        if (parsed && parsed.newMeal && parsed.newMeal.name) {
          const nameLower = String(parsed.newMeal.name).toLowerCase().trim();
          // If AI returns excluded name, fallback
          if (excludeArr.includes(nameLower)) {
            const picked = pickRandomExcluding(dishes, excludeArr);
            const mealObj = createMealObject(picked);
            const recipe = await generateRecipeInstructions(mealObj.name, mealObj.ingredients);
            return res.json({ success: true, newMeal: { ...mealObj, recipe }, source: 'fallback-excluded' });
          }
          // If DB contains this dish, use DB result for accurate macros
          const found = dishes.find(d => String(d.name || '').toLowerCase().trim() === nameLower);
          if (found) {
            const mealObj = createMealObject(found);
            const recipe = await generateRecipeInstructions(mealObj.name, mealObj.ingredients);
            return res.json({ success: true, newMeal: { ...mealObj, recipe }, source: 'ai' });
          }
          const mealObj = createMealObject(parsed.newMeal);
          const recipe = await generateRecipeInstructions(mealObj.name, mealObj.ingredients);
          return res.json({ success: true, newMeal: { ...mealObj, recipe }, source: 'ai' });
        }
      } catch (err: any) {
        console.warn('AI regeneration failed, falling back to random pick:', getErrorMessage(err));
      }
    }

    // fallback deterministic pick that avoids excluded names
    const picked = pickRandomExcluding(dishes, excludeArr);
    const mealObj = createMealObject(picked);
    const recipe = await generateRecipeInstructions(mealObj.name, mealObj.ingredients);
    return res.json({ success: true, newMeal: { ...mealObj, recipe }, source: 'fallback' });

  } catch (err: any) {
    console.error('Regenerate (alias) error:', getErrorMessage(err));
    return res.status(500).json({ success: false, message: 'Regenerate failed', error: getErrorMessage(err) });
  }
});

// helper to check if a column exists in a table (returns boolean)
async function dbColumnExists(table: string, column: string): Promise<boolean> {
  try {
    const dbName = process.env.DB_NAME || 'activecore';
    const [rows] = await pool.query<any[]>(
      `SELECT COUNT(*) as cnt 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [dbName, table, column]
    );
    return !!(rows && rows[0] && Number(rows[0].cnt) > 0);
  } catch (err: any) {
    console.warn('dbColumnExists error:', getErrorMessage(err));
    return false;
  }
}

// ===== MEAL-PLANNER: Save (create/update) - tolerant to generated_at/updated_at schema =====
app.post('/api/meal-planner/save', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { planId, planName, mealPlan } = req.body;

    if (!mealPlan || !Array.isArray(mealPlan)) {
      return res.status(400).json({ success: false, message: 'Invalid mealPlan payload' });
    }

    // ensure preference exists if needed (unchanged)
    let preferenceId: number | null = null;
    try {
      const [prefRows] = await pool.query<any[]>('SELECT id FROM user_meal_preferences WHERE user_id = ?', [userId]);
      if (Array.isArray(prefRows) && prefRows.length > 0) {
        preferenceId = Number(prefRows[0].id);
      } else {
        preferenceId = await ensureUserPreferenceExists(userId);
      }
    } catch (err: any) {
      preferenceId = null;
    }

    // Update (if planId provided) - use schema-aware column usage
    if (planId) {
      const hasUpdatedAt = await dbColumnExists('meal_plans', 'updated_at');
      try {
        if (hasUpdatedAt) {
          await pool.query('UPDATE meal_plans SET plan_name = ?, plan_data = ?, updated_at = NOW() WHERE id = ?', [
            planName || null, JSON.stringify({ weekPlan: mealPlan }), planId
          ]);
        } else {
          await pool.query('UPDATE meal_plans SET plan_name = ?, plan_data = ? WHERE id = ?', [
            planName || null, JSON.stringify({ weekPlan: mealPlan }), planId
          ]);
        }

        return res.json({ success: true, message: 'Meal plan updated', planId });
      } catch (updateErr: any) {
        console.warn('Update meal plan failed:', getErrorMessage(updateErr));
        return res.status(500).json({ success: false, message: 'Failed to update meal plan', error: getErrorMessage(updateErr) });
      }
    }

    // Insert new plan - handle generated_at if present
    try {
      const hasGeneratedAt = await dbColumnExists('meal_plans', 'generated_at');

      const insertCols = preferenceId === null
        ? (hasGeneratedAt ? 'user_id, plan_name, plan_data, generated_at' : 'user_id, plan_name, plan_data')
        : (hasGeneratedAt ? 'user_id, preference_id, plan_name, plan_data, generated_at' : 'user_id, preference_id, plan_name, plan_data');

      const insertValsBase = preferenceId === null
        ? [userId, planName || null, JSON.stringify({ weekPlan: mealPlan })]
        : [userId, preferenceId, planName || null, JSON.stringify({ weekPlan: mealPlan })];

      const insertVals = hasGeneratedAt ? [...insertValsBase, new Date()] : insertValsBase;

      const qMarks = insertVals.map(() => '?').join(', ');
      const [result] = await pool.query<any>(`INSERT INTO meal_plans (${insertCols}) VALUES (${qMarks})`, insertVals);
      const newId = (result as any)?.insertId || null;
      return res.status(201).json({ success: true, message: 'Meal plan saved', planId: newId });
    } catch (insertErr: any) {
      console.error('Insert meal plan failed:', getErrorMessage(insertErr));
      return res.status(500).json({ success: false, message: 'Failed to save meal plan', error: getErrorMessage(insertErr) });
    }
  } catch (err: any) {
    console.error('Save meal plan error:', getErrorMessage(err));
    return res.status(500).json({ success: false, message: 'Failed to save meal plan', error: getErrorMessage(err) });
  }
});

// ===== MEAL-PLANNER: List plans - schema-safe columns only =====
app.get('/api/meal-planner/plans', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const hasUpdatedAt = await dbColumnExists('meal_plans', 'updated_at');
    const hasGeneratedAt = await dbColumnExists('meal_plans', 'generated_at');

    const cols = ['id', 'plan_name', 'plan_data'];
    if (hasGeneratedAt) cols.push('generated_at');
    if (hasUpdatedAt) cols.push('updated_at');

    const orderBy = hasGeneratedAt ? 'generated_at' : 'id';
    const [rows] = await pool.query<any[]>(`SELECT ${cols.join(', ')} FROM meal_plans WHERE user_id = ? ORDER BY ${orderBy} DESC`, [userId]);

    const plans = rows.map((r: any) => ({
      id: Number(r.id),
      planName: r.plan_name ?? null,
      plan_data: typeof r.plan_data === 'string' ? (() => { try { return JSON.parse(r.plan_data); } catch { return r.plan_data; } })() : r.plan_data ?? null,
      generatedAt: r.generated_at ?? null,
      updatedAt: r.updated_at ?? r.generated_at ?? null
    }));

    res.json({ success: true, plans });
  } catch (err: any) {
    console.error('List meal plans endpoint error:', getErrorMessage(err));
    res.status(500).json({ success: false, message: 'Failed to list meal plans', error: getErrorMessage(err) });
  }
});

// ===== MEAL-PLANNER: Load plan by id - schema-safe =====
app.get('/api/meal-planner/plans/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const planId = Number(req.params.id);

    const hasUpdatedAt = await dbColumnExists('meal_plans', 'updated_at');
    const hasGeneratedAt = await dbColumnExists('meal_plans', 'generated_at');

    const cols = ['id', 'user_id', 'plan_name', 'plan_data'];
    if (hasGeneratedAt) cols.push('generated_at');
    if (hasUpdatedAt) cols.push('updated_at');

    const [rows] = await pool.query<any[]>(`SELECT ${cols.join(', ')} FROM meal_plans WHERE id = ?`, [planId]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const plan = rows[0];
    if (Number(plan.user_id) !== userId && (req.user?.role ?? '') !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: not the owner' });
    }

    let parsed = null;
    if (typeof plan.plan_data === 'string') {
      try { parsed = JSON.parse(plan.plan_data); } catch { parsed = plan.plan_data; }
    } else {
      parsed = plan.plan_data;
    }

    res.json({
      success: true,
      plan: {
        id: plan.id,
        name: plan.plan_name,
        generatedAt: plan.generated_at ?? null,
        updatedAt: plan.updated_at ?? plan.generated_at ?? null,
        data: parsed,
      },
    });
  } catch (err: any) {
    console.error('Load meal plan error:', getErrorMessage(err));
    res.status(500).json({ success: false, message: 'Failed to load meal plan', error: getErrorMessage(err) });
  }
});

// ===== MEAL-PLANNER: Delete plan (owner or admin) - minimal columns, no updated_at =====
app.delete('/api/meal-planner/plans/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const planId = Number(req.params.id);

    // verify existence & owner (select minimal columns)
    const [rows] = await pool.query<any>('SELECT id, user_id FROM meal_plans WHERE id = ?', [planId]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    const ownerId = Number(rows[0].user_id);
    const isOwner = ownerId === userId;
    const isAdmin = (req.user?.role || '') === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden: not the owner' });
    }

    await pool.query('DELETE FROM meal_plans WHERE id = ?', [planId]);
    console.log(`🗑️ User ${userId} deleted meal plan ${planId}`);
    return res.json({ success: true, message: 'Plan deleted' });
  } catch (err: any) {
    console.error('Delete meal plan error:', getErrorMessage(err));
    return res.status(500).json({ success: false, message: 'Failed to delete meal plan', error: getErrorMessage(err) });
  }
});

// QR Attendance Check-in Route
app.post('/api/attendance/checkin', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { qrToken, location } = req.body;

    // Validate QR token
    if (!qrToken || !qrToken.includes("ACTIVECORE_GYM")) {
      return res.status(400).json({ success: false, message: "Invalid QR code." });
    }

    // Prevent duplicate check-in for today
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const [existing] = await pool.query<any[]>(
     
      `SELECT id FROM attendance WHERE user_id = ? AND DATE(check_in_time) = ?`,
      [userId, todayStr]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "Already checked in today." });
    }

    // Insert attendance record
    await pool.query(
      `INSERT INTO attendance (user_id, check_in_time, location, status) VALUES (?, NOW(), ?, 'present')`,
      [userId, location || 'Main Gym']
    );

    res.json({
      success: true,
      message: "Check-in successful."
    });
  } catch (err: any) {
    console.error('❌ Attendance check-in error:', err);
    res.status(500).json({ success: false, message: "Failed to record attendance." });
  }
});

// Member Attendance History Route
app.get('/api/attendance/history', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const [rows] = await pool.query<any[]>(
      `SELECT id, check_in_time, location, status FROM attendance WHERE user_id = ? ORDER BY check_in_time DESC`,
      [userId]
    );

    // Format for frontend
    const attendance = rows.map(r => {
      // Ensure check_in_time is a string in ISO format
      let checkInTimeStr: string;
      if (typeof r.check_in_time === 'string') {
        checkInTimeStr = r.check_in_time;
      } else if (r.check_in_time instanceof Date) {
        checkInTimeStr = r.check_in_time.toISOString();
      } else {
        checkInTimeStr = String(r.check_in_time);
      }
      return {
        id: r.id,
        checkInTime: checkInTimeStr,
        location: r.location,
        status: r.status,
        date: checkInTimeStr.split('T')[0],
        time: new Date(checkInTimeStr).toLocaleTimeString(),
      };
    });

    // Calculate stats
    let currentStreak = 0;
    let prevDate = null;
    for (const record of attendance) {
      const date = record.checkInTime.split('T')[0];
      if (!prevDate) {
        prevDate = date;
        currentStreak = 1;
      } else {
        const prev = new Date(prevDate);
        const curr = new Date(date);
        prev.setDate(prev.getDate() - 1);
        if (curr.toISOString().split('T')[0] === prev.toISOString().split('T')[0]) {
          currentStreak++;
          prevDate = date;
        } else {
          break;
        }
      }
    }

    res.json({
      success: true,
      attendance,
      stats: {
        totalAttendance: attendance.length,
        currentStreak
      }
    });
  } catch (err: any) {
    console.error('❌ Attendance history error:', err);
    res.status(500).json({ success: false, message: "Failed to fetch attendance history." });
  }
});

// Admin: Who is present today
app.get('/api/admin/attendance/today', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await pool.query<any[]>(
      `SELECT a.id, a.user_id, a.check_in_time, a.location, u.first_name, u.last_name, u.email
       FROM attendance a
       INNER JOIN users u ON a.user_id = u.id
       WHERE DATE(a.check_in_time) = ?
       ORDER BY a.check_in_time DESC`,
      [today]
    );
    res.json({ success: true, present: rows });
  } catch (err: any) {
    console.error('❌ Admin today attendance error:', err);
    res.status(500).json({ success: false, message: "Failed to fetch today's attendance." });
  }
});

app.get('/api/admin/attendance', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const date = req.query.date as string || new Date().toISOString().split('T')[0];
    const [rows] = await pool.query<any[]>(
      `SELECT a.id, a.user_id, a.check_in_time, a.location, u.first_name, u.last_name, u.email
       FROM attendance a
       INNER JOIN users u ON a.user_id = u.id
       WHERE DATE(a.check_in_time) = ?
       ORDER BY a.check_in_time DESC`,
      [date]
    );
    // Format for frontend
    const attendance = rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      fullName: `${r.first_name} ${r.last_name}`,
      email: r.email,
      checkInTime: r.check_in_time,
      date: new Date(r.check_in_time).toLocaleDateString(),
      time: new Date(r.check_in_time).toLocaleTimeString(),
      location: r.location,
      status: "present"
    }));
    res.json({ success: true, attendance });
  } catch (err: any) {
    console.error('❌ Admin attendance error:', err);
    res.status(500).json({ success: false, message: "Failed to fetch attendance." });
  }
});

// --- Rewards: Available ---
app.get('/api/rewards/available', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    // Example rewards (customize as needed)
    const rewards = [
      { id: 1, title: "Bronze Streak", description: "Attend 3 days", requiredAttendance: 3, points: 10, category: "streak", icon: "🥉" },
      { id: 2, title: "Silver Streak", description: "Attend 7 days", requiredAttendance: 7, points: 25, category: "streak", icon: "🥈" },
      { id: 3, title: "Gold Streak", description: "Attend 14 days", requiredAttendance: 14, points: 50, category: "streak", icon: "🥇" },
      { id: 4, title: "Attendance Pro", description: "Attend 30 days", requiredAttendance: 30, points: 100, category: "streak", icon: "🏆" },
    ];

    // Fetch claimed rewards
    const [claimedRows] = await pool.query<any[]>(
      `SELECT reward_id, claimed_at FROM rewards_claimed WHERE user_id = ?`,
      [userId]
    );
    const claimedMap = new Map<number, string>();
    claimedRows.forEach(r => claimedMap.set(r.reward_id, r.claimed_at));

    // Fetch attendance count
    const [attendanceRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as total FROM attendance WHERE user_id = ?`,
      [userId]
    );
    const totalAttendance = attendanceRows[0]?.total || 0;

    // Mark rewards as claimed/unlocked
    const rewardsWithStatus = rewards.map(r => ({
      ...r,
      claimed: claimedMap.has(r.id),
      claimedAt: claimedMap.get(r.id) || null,
      unlocked: totalAttendance >= r.requiredAttendance
    }));

    res.json({ success: true, rewards: rewardsWithStatus });
  } catch (err: any) {
    console.error('❌ Rewards available error:', err);
    res.status(500).json({ success: false, message: "Failed to fetch rewards." });
  }
});

// --- Rewards: Claim ---
app.post('/api/rewards/claim', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { rewardId } = req.body;
    if (!rewardId) return res.status(400).json({ success: false, message: "Missing rewardId" });

    // Example rewards (should match above)
    const rewards = [
      { id: 1, requiredAttendance: 3 },
      { id: 2, requiredAttendance: 7 },
      { id: 3, requiredAttendance: 14 },
      { id: 4, requiredAttendance: 30 },
    ];
    const reward = rewards.find(r => r.id === rewardId);
    if (!reward) return res.status(404).json({ success: false, message: "Reward not found" });

    // Check attendance
    const [attendanceRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as total FROM attendance WHERE user_id = ?`,
      [userId]
    );
    const totalAttendance = attendanceRows[0]?.total || 0;
    if (totalAttendance < reward.requiredAttendance) {
      return res.status(400).json({ success: false, message: "Not enough attendance to claim this reward." });
    }

    // Check if already claimed
    const [claimedRows] = await pool.query<any[]>(
      `SELECT id FROM rewards_claimed WHERE user_id = ? AND reward_id = ?`,
      [userId, rewardId]
    );
    if (claimedRows.length > 0) {
      return res.status(400).json({ success: false, message: "Reward already claimed." });
    }

    // Insert claim
    await pool.query(
      `INSERT INTO rewards_claimed (user_id, reward_id, claimed_at) VALUES (?, ?, NOW())`,
      [userId, rewardId]
    );

    res.json({ success: true, message: "Reward claimed!" });
  } catch (err: any) {
    console.error('❌ Claim reward error:', err);
    res.status(500).json({ success: false, message: "Failed to claim reward." });
  }
});

// User Profile Route (for QR Attendance)
app.get('/api/user/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const [users] = await pool.query<any[]>(
      'SELECT id, email, first_name, last_name, role FROM users WHERE id = ?',
      [userId]
    );
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = users[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });
  } catch (err: any) {
    console.error('❌ User profile error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch user profile.' });
  }
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Express error:', getErrorMessage(err));
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err: any) => {
  console.error('UNCAUGHT EXCEPTION:', getErrorMessage(err), err);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('UNHANDLED REJECTION:', getErrorMessage(reason), reason);
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3002;

let dbConnected = false;

console.log(`\n🔰 Activecore Backend starting (NODE_ENV=${process.env.NODE_ENV})`);
console.log('🔍 Env vars sample:', {
  DB_HOST: process.env.DB_HOST || 'not set',
  DB_PORT: process.env.DB_PORT || 'not set',
  DB_NAME: process.env.DB_NAME || 'not set',
  API_PORT: process.env.PORT || 3002,
  FRONTEND_URL: process.env.FRONTEND_URL || 'not set',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'not set',
});

app.get('/api/ping', (req: Request, res: Response) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

async function startServer() {
  console.log('\n🚀 Starting server...');
  try {
    try {
      dbConnected = await initializeDatabase();
      console.log('✅ Database init finished. Connected:', !!dbConnected);
    } catch (dbErr: any) {
      dbConnected = false;
      console.error('❌ Database initialization failed:', getErrorMessage(dbErr)); // changed
      console.warn('⚠️ Server will continue listening — DB queries will fallback where implemented.');
    }

    const portNum = Number(process.env.PORT || PORT || 3002);
    app.listen(portNum, () => {
      console.log('=========================================');
      console.log(`🌐 Server running on port ${portNum}`);
      console.log(`🌐 API URL: http://localhost:${portNum}`);
      console.log('=========================================');
    }).on('error', (err: any) => {
      console.error('❌ App listen error:', getErrorMessage(err));
      process.exit(1);
    });
  } catch (err: any) {
    console.error('Fatal server start error:', getErrorMessage(err));
    process.exit(1);
  }
}

app.get('/', (req: Request, res: Response) => {
  res.send('Activecore Backend: running');
});

startServer();

// QR Token Generation for Attendance (Admin)
app.post('/api/admin/qr-token/generate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // You can make this more secure by encoding gym, date, and expiry
    const { expiresInHours = 24 } = req.body;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);
    // Example token: ACTIVECORE_GYM_YYYYMMDDHHMMSS_random
    const token = `ACTIVECORE_GYM_${now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    res.json({
      success: true,
      token,
      expiresAt: expiresAt.toISOString()
    });
  } catch (err: any) {
    console.error('❌ QR token generation error:', err);
    res.status(500).json({ success: false, message: "Failed to generate QR token." });
  }
});

// Ensure this runs after pool and env are ready
(async function ensureNotificationTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT NOW(),
        INDEX (user_id),
        INDEX (type)
      )
    `);
    console.log('✅ notification_logs table ready');
  } catch (err) {
    console.error('Failed to create notification_logs table', err);
  }
})();

// Setup email transporter
const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const fromEmail = process.env.FROM_EMAIL || smtpUser;

// typed transporter so it isn't implicitly `any`
let transporter: Transporter | undefined;
let smtpReady = false;

if (smtpHost && smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  transporter
    .verify()
    .then(() => {
      smtpReady = true;
      console.log('✅ SMTP ready');
    })
    .catch((err: any) => {
      smtpReady = false;
      console.warn('SMTP verify failed', err);
    });
} else {
  console.warn(
    '⚠️ SMTP config missing. Reminder emails will not be sent. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env'
  );
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!transporter) {
    console.warn('No transporter configured; skipping sendEmail to', to);
    return false;
  }
  try {
    const info = await transporter.sendMail({
      from: fromEmail,
      to,
      subject,
      html,
    });
    console.log(`✉️ Sent email to ${to}: ${info.messageId}`);
    return true;
  } catch (err: any) {
    console.error(`Failed to send email to ${to}:`, err.message || err);
    return false;
  }
}

/**
 * Validates password strength
 * Requirements: 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
 */
function validatePassword(password: string): { isValid: boolean; message?: string } {
  if (!password || password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }
  if (!/[!@#$%^&*]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character (!@#$%^&*)' };
  }
  return { isValid: true };
}

/**
 * Sanitizes string input to prevent injection attacks
 */
function sanitizeInput(input: any): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>\"']/g, '') // Remove HTML/script tags
    .trim()
    .substring(0, 255); // Max 255 chars
}

/**
 * Validates phone number (basic format)
 */
function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\d\s\-\+\(\)]{7,}$/;
  return phoneRegex.test(String(phone).replace(/\s/g, ''));
}

function isValidEmail(email?: string) {
  if (!email || typeof email !== 'string') return false;
  // simple regex — avoids outbound errors caused by malformed addresses
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function notifyInactiveMembers(thresholdDays = 3) {
  try {
    if (!transporter || !smtpReady) {
      console.warn('SMTP not configured or not ready — skipping notifyInactiveMembers');
      return { success: false, message: 'SMTP not configured or credentials invalid' };
    }

    // Select members who haven't checked in within thresholdDays
    const [rows] = await pool.query<any[]>(
      `
      SELECT u.id, u.email, u.first_name, u.last_name, MAX(a.check_in_time) AS lastCheckIn
      FROM users u
      LEFT JOIN attendance a ON a.user_id = u.id
      WHERE u.role = 'member' AND u.status = 'active'
      GROUP BY u.id
      HAVING (lastCheckIn IS NULL OR DATE(lastCheckIn) <= DATE_SUB(CURDATE(), INTERVAL ? DAY))
      `,
      [thresholdDays]
    );

    if (!rows || rows.length === 0) {
      console.log(`No inactive members found for thresholdDays=${thresholdDays}`);
      return { success: true, notified: 0 };
    }

    console.log(`Found ${rows.length} inactive members; processing email reminders...`);
    let notifiedCount = 0;

    for (const u of rows) {
      if (!u.email || !isValidEmail(u.email)) {
        console.warn('Skipping invalid or missing email for user', u.id, u.email);
        continue;
      }

      // Avoid resending within last thresholdDays
      const [alreadySent] = await pool.query<any[]>(
        `SELECT id FROM notification_logs WHERE user_id = ? AND type = 'absent_reminder' AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT 1`,
        [u.id, thresholdDays]
      );

      if (alreadySent.length > 0) {
        console.log(`Already notified user ${u.id} in last ${thresholdDays} days — skip`);
        continue;
      }

      const lastCheckInText = u.lastCheckIn ? `Your last visit was on ${new Date(u.lastCheckIn).toLocaleDateString()}.` : `We haven't seen you yet — start your journey with us!`;

      const subject = `We've missed you at ActiveCore — come back!`;
      const html = `
        <p>Hi ${u.first_name || 'Member'},</p>
        <p>${lastCheckInText}</p>
        <p>We noticed you haven't visited the gym in a while. Your fitness matters — we'd love to see you back! Here are a few ways to make it easier:</p>
        <ul>
          <li>Book a quick orientation with our trainer</li>
          <li>Try a refreshed workout plan</li>
          <li>Bring a friend and get motivated together</li>
        </ul>
        <p>If there's anything we can help with, just reply to this email.</p>
        <p>— ActiveCore</p>
      `;

      const sent = await sendEmail(u.email, subject, html);
      if (sent) {
        await pool.query(`INSERT INTO notification_logs (user_id, type, created_at) VALUES (?, 'absent_reminder', NOW())`, [u.id]);
        notifiedCount++;
      } else {
        console.warn('Failed to send reminder to', u.email);
      }
    }

    console.log(`Done: ${notifiedCount} reminder(s) sent`);
    return { success: true, notified: notifiedCount };
  } catch (err: any) {
    console.error('notifyInactiveMembers error', err);
    return { success: false, error: err.message || err };
  }
}

// Admin endpoint: trigger notifications manually
app.post('/api/admin/attendance/notify-inactive', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { thresholdDays = 3 } = req.body;
    const result = await notifyInactiveMembers(Number(thresholdDays));
    res.json(result);
  } catch (err: any) {
    console.error('❌ notify-inactive endpoint error:', err);
    res.status(500).json({ success: false, message: 'Failed to notify inactive members' });
  }
});

// Schedule daily run (once every 24h) at server start if desired
const NOTIFY_THRESHOLD_DAYS = Number(process.env.INACTIVE_NOTIFY_DAYS) || 3;
const DAILY_MS = 24 * 60 * 60 * 1000;
// Run once at startup
setTimeout(() => {
  notifyInactiveMembers(NOTIFY_THRESHOLD_DAYS).catch(err => console.error('Scheduled notify failed', err));
}, 5 * 1000); // small delay on start
// Run every 24 hours
setInterval(() => {
  notifyInactiveMembers(NOTIFY_THRESHOLD_DAYS).catch(err => console.error('Scheduled notify failed', err));
}, DAILY_MS);

// Admin endpoint: test sending email
app.post('/api/admin/attendance/test-email', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ success: false, message: 'Missing "to" address in body' });
    }
    const subject = 'ActiveCore test email';
    const html = `<p>This is a test message from <strong>ActiveCore</strong>. If you received this, SMTP settings are valid.</p>`;
    const sent = await sendEmail(to, subject, html);
    if (!sent) {
      return res.status(500).json({ success: false, message: 'Failed to send test email. Check SMTP settings and logs.' });
    }
    res.json({ success: true, message: `Test email sent to ${to}` });
  } catch (err: any) {
    console.error('❌ Test email endpoint error:', getErrorMessage(err));
    res.status(500).json({ success: false, message: 'Failed to send test email.' });
  }
});

// PayPal Test Endpoint
app.post('/api/test/paypal', async (req: Request, res: Response) => {
  try {
    const tokenUrl = `${PAYPAL_API_URL}/oauth2/token`;
    console.log('\n🧪 PAYPAL TEST ENDPOINT');
    console.log('📍 Token URL:', tokenUrl);
    console.log('💼 Client ID:', PAYPAL_CLIENT_ID?.substring(0, 15) + '...');
    console.log('🔑 Secret (first 10 chars):', PAYPAL_CLIENT_SECRET?.substring(0, 10) + '...');
    console.log('📋 Mode:', PAYPAL_MODE);
    
    const axiosConfig = {
      auth: {
        username: PAYPAL_CLIENT_ID,
        password: PAYPAL_CLIENT_SECRET
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 5000
    };
    
    console.log('🔄 Sending request to PayPal...\n');
    const response = await axios.post(tokenUrl, 'grant_type=client_credentials', axiosConfig);
    
    console.log('✅ SUCCESS! Got token');
    res.json({
      success: true,
      message: 'PayPal connection works!',
      tokenUrl,
      mode: PAYPAL_MODE,
      clientIdPrefix: PAYPAL_CLIENT_ID?.substring(0, 15) + '...'
    });
  } catch (error: any) {
    console.error('❌ TEST FAILED');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status,
      hint: 'Check that your PayPal credentials are correct'
    });
  }
});

// App configuration
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Helper function to get PayPal access token
async function getPayPalAccessToken(): Promise<string> {
  try {
    const tokenUrl = `${PAYPAL_API_URL}/oauth2/token`;
    console.log('\n🔗 PayPal Token Request:');
    console.log('   URL:', tokenUrl);
    console.log('   Client ID:', PAYPAL_CLIENT_ID?.substring(0, 15) + '...');
    console.log('   Mode:', PAYPAL_MODE);
    
    // Use Base64 encoding for auth header instead of axios auth
    const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    const response = await axios.post(
      tokenUrl,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );
    
    const tokenData = response.data as any;
    console.log('✅ Token obtained successfully\n');
    return tokenData.access_token;
  } catch (error: any) {
    console.error('\n❌ PayPal Token Error:');
    console.error('   Status:', error.response?.status);
    console.error('   Error Code:', error.response?.data?.error);
    console.error('   Error Description:', error.response?.data?.error_description);
    console.error('   Full Response:', error.response?.data);
    console.error('   Message:', error.message);
    throw new Error('PayPal authentication failed: ' + (error.response?.data?.error_description || error.message));
  }
}

// Create a PayPal order and return redirect URL
app.post('/api/payments/paypal/create-order', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amount, plan } = req.body;

    if (!amount || !plan) {
      return res.status(400).json({ success: false, message: 'Missing amount or plan' });
    }

    const accessToken = await getPayPalAccessToken();

    const planDescription = plan === 'monthly' ? 'Monthly Membership' : 
                           plan === 'quarterly' ? 'Quarterly Membership' :
                           'Annual Membership';

    const payload = {
      intent: 'CAPTURE',
      payer: {
        email_address: `user_${userId}@activecore.test`
      },
      purchase_units: [{
        amount: {
          currency_code: 'PHP',
          value: String(amount)
        },
        description: planDescription,
        custom_id: `${userId}|${plan}` // Store userId and plan in custom_id
      }],
      application_context: {
        brand_name: 'ActiveCore Fitness',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        return_url: `${APP_URL}/member/payment/success`,
        cancel_url: `${APP_URL}/member/payment/cancel`
      }
    };

    const response = await axios.post(`${PAYPAL_API_URL}/checkout/orders`, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const responseData = response.data as any;
    const orderId = responseData.id;
    const approvalLink = responseData.links?.find((link: any) => link.rel === 'approve')?.href;

    if (!orderId || !approvalLink) {
      return res.status(500).json({ success: false, message: 'Failed to create PayPal order' });
    }

    // Insert payment record (pending)
    await pool.query(
      `INSERT INTO payments (user_id, amount, payment_method, membership_type, payment_status, transaction_id, created_at)
         VALUES (?, ?, 'paypal', ?, 'pending', ?, NOW())`,
      [userId, Number(amount), plan, orderId]
    );

    console.log(`💳 PayPal order created for user ${userId}: ${orderId}`);
    res.json({ success: true, approvalLink, orderId });
  } catch (err: any) {
    console.error('❌ create-order error - Full details:');
    console.error('  Status:', err.response?.status);
    console.error('  Data:', JSON.stringify(err.response?.data, null, 2));
    console.error('  Message:', err.message);
    
    const errorMsg = err.response?.data?.error_description || err.response?.data?.message || err.message || 'Failed to create PayPal order';
    res.status(500).json({ success: false, message: errorMsg, error: err.response?.data });
  }
});

// Capture PayPal order and update subscription
app.post('/api/payments/paypal/capture-order', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Missing orderId' });
    }

    const accessToken = await getPayPalAccessToken();

    // Capture the payment
    const captureResponse = await axios.post(
      `${PAYPAL_API_URL}/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const captureData = captureResponse.data as any;
    const paymentStatus = captureData.status;
    const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const customId = captureData.purchase_units?.[0]?.custom_id;
    const [paymentUserId, plan] = customId?.split('|') || [null, null];

    if (paymentStatus !== 'COMPLETED') {
      return res.json({ success: false, status: paymentStatus, message: 'Payment not completed' });
    }

    // Update payment record
    await pool.query(
      `UPDATE payments SET payment_status = ?, payment_date = NOW() WHERE transaction_id = ? AND user_id = ?`,
      ['completed', orderId, userId]
    );

    // Calculate subscription dates
    let months = 1;
    if (plan === 'annual') months = 12;
    else if (plan === 'quarterly') months = 3;

    const subscriptionStart = new Date();
    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + months);

    // Get payment amount
    const [paymentRows] = await pool.query<any[]>(
      `SELECT amount FROM payments WHERE transaction_id = ? AND user_id = ? LIMIT 1`,
      [orderId, userId]
    );

    const paymentAmount = paymentRows?.[0]?.amount || 0;

    // Update user subscription
    await pool.query(
      `UPDATE users 
       SET status = 'active',
           payment_status = 'paid',
           subscription_start = ?,
           subscription_end = ?,
           membership_type = ?,
           membership_price = ?,
           next_payment = ?
       WHERE id = ?`,
      [
        isoDateString(subscriptionStart),
        isoDateString(subscriptionEnd),
        plan,
        paymentAmount,
        isoDateString(subscriptionEnd),
        userId
      ]
    );

    // Record payment history
    await pool.query(
      `INSERT INTO payments_history (user_id, payment_id, amount, payment_method, status, created_at)
         VALUES (?, ?, ?, 'paypal', 'completed', NOW())`,
      [userId, orderId, paymentAmount]
    );

    console.log(`✅ Payment for user ${userId} captured and completed (orderId=${orderId}), subscription updated to ${plan}`);

    res.json({
      success: true,
      status: 'completed',
      subscription: {
        start: subscriptionStart.toISOString().split('T')[0],
        end: subscriptionEnd.toISOString().split('T')[0],
        type: plan
      }
    });
  } catch (err: any) {
    console.error('❌ capture-order error:', err.response?.data || err.message || err);
    
    // If it's a 404, order may not exist
    if (err.response?.status === 404) {
      return res.status(400).json({ success: false, message: 'PayPal order not found' });
    }

    res.status(500).json({ success: false, message: 'Failed to capture PayPal payment' });
  }
});

