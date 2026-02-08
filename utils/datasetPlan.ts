
import { DatasetItem } from "../types";

export const GLOBAL_NEGATIVE_PROMPT = "same pose, repetitive angle, stiff posture, mugshot, passport photo, looking at camera (unless specified), deformed hands, plastic skin, 3d render, cartoon, anime, illustration, bad anatomy, blur, low quality, grayscale, monochrome (unless specified), text, watermark";

// Distribution Logic:
// 1-3: Structural Anchors (White Tank / Studio) - Essential for basic face ID.
// 4-45: REAL LIFE LIFESTYLE (No Fantasy, No Neon). 
// 46-50: TECHNICAL EDGE CASES (Extreme angles, Macro, Blur) - To force model flexibility.

export const DATASET_PLAN: DatasetItem[] = [
  // --- ANCHOR STRUCTURE (1-3) - CLINICAL GROUND TRUTH --- 
  { 
    id: 1, 
    shot: "Technical Front View (Mugshot)", 
    expression: "Zero Emotion", 
    lighting: "Clinical Studio Lighting", 
    outfit: "White tank top", 
    description: "Technical Front View (Mugshot), Clinical studio lighting, zero emotion, perfect symmetry, 85mm lens, ears visible, high frequency skin texture." 
  },
  { 
    id: 2, 
    shot: "Medical Side Profile (90° Left)", 
    expression: "Neutral", 
    lighting: "Flat Studio Lighting", 
    outfit: "White tank top", 
    description: "Medical Side Profile (90° Left), Dermatology reference, strict 90-degree profile, white background, focus on nose bridge and jawline silhouette." 
  },
  { 
    id: 3, 
    shot: "Anatomical Back View", 
    expression: "Neutral", 
    lighting: "Flat Studio Lighting", 
    outfit: "White tank top", 
    description: "Anatomical Back View, Posture analysis, neutral stance, showing shoulders and hair volume, no face visible." 
  },

  // --- LIFESTYLE & REALISM (4-45) --- 
  { id: 4, shot: "Coffee Shop Candid", expression: "Thoughtful", lighting: "Window Side Light", outfit: "Beige cashmere turtle neck sweater", description: "Sitting at a wooden table, steam rising from coffee, blurred background, f/1.8 aperture bokeh" },
  { id: 5, shot: "Street Crossing", expression: "Confident", lighting: "Overcast City Day", outfit: "Black leather biker jacket and white tee", description: "Walking across street, wind blowing hair, urban city background, depth of field" },
  { id: 6, shot: "Golden Hour Selfie", expression: "Soft Smile", lighting: "Direct Sunset Glow", outfit: "White linen summer dress", description: "Hand holding camera angle, sun flare hitting lens, warm orange tones, park background" },
  { id: 7, shot: "Supermarket Aisle", expression: "Neutral", lighting: "Fluorescent Shop Light", outfit: "Grey oversized hoodie", description: "Holding a product, shelves in background, realistic everyday shopping vibe" },
  { id: 8, shot: "Office Desk", expression: "Focused", lighting: "Cool Office Daylight", outfit: "Light blue button-up shirt", description: "Working at laptop, modern glass office background, clean aesthetic" },
  { id: 9, shot: "Car Passenger", expression: "Relaxed", lighting: "Afternoon Sun (Hard Shadows)", outfit: "Black sunglasses (on head) and tank top", description: "Seatbelt visible, window reflection, road trip vibe, realistic skin texture" },
  { id: 10, shot: "Night Out Dining", expression: "Happy", lighting: "Warm Candlelight", outfit: "Black silk slip dress", description: "Restaurant setting, wine glass on table, bokeh background lights (warm tones)" },
  { id: 11, shot: "Morning Routine", expression: "Sleepy", lighting: "Soft Morning Haze", outfit: "White cotton bathrobe", description: "Holding toothbrush, bathroom mirror reflection, no makeup look, very natural" },
  { id: 12, shot: "Library Studying", expression: "Serious", lighting: "Quiet Library Lamp", outfit: "Chunky knit brown cardigan", description: "Surrounded by books, reading glasses in hand, dust motes in light, dark academia" },
  { id: 13, shot: "Gym Workout", expression: "Tired/Sweaty", lighting: "Harsh Gym Downlight", outfit: "Black sports bra and leggings", description: "Sitting on bench, sweat on skin, gym equipment background, realistic fitness" },
  { id: 14, shot: "Rainy Taxi Window", expression: "Melancholic", lighting: "Streetlight through Rain", outfit: "Yellow raincoat", description: "Leaning head on window, raindrops on glass, city lights blurring outside (amber tones)" },
  { id: 15, shot: "Park Picnic", expression: "Laughing", lighting: "Dappled Sunlight (Tree Shade)", outfit: "Gingham checkered sundress", description: "Lying on grass, shadows of leaves on face, bright and airy" },
  { id: 16, shot: "Subway Commute", expression: "Bored", lighting: "Subway Tube Light", outfit: "Denim jacket and headphones", description: "Holding pole, crowded train background, realistic urban commute" },
  { id: 17, shot: "Beach Sunset", expression: "Peaceful", lighting: "Soft Pink Twilight", outfit: "Oversized white shirt (beach coverup)", description: "Walking on sand, ocean in background, wind in hair, salt texture" },
  { id: 18, shot: "Winter Walk", expression: "Cold", lighting: "Grey Overcast Snow", outfit: "Thick wool scarf and puffer jacket", description: "Snow falling, red nose from cold, breath visible, snowy street" },
  { id: 19, shot: "Kitchen Cooking", expression: "Focused", lighting: "Kitchen Under-cabinet Light", outfit: "Casual t-shirt and apron", description: "Choping vegetables, messy kitchen counter, homey vibe" },
  { id: 20, shot: "Hotel Lobby", expression: "Elegant", lighting: "Warm Chandelier", outfit: "Navy blue blazer", description: "Sitting in armchair, waiting, upscale interior background" },
  { id: 21, shot: "Rooftop Terrace", expression: "Free", lighting: "Golden Hour Backlight", outfit: "Sleeveless silk top", description: "City skyline behind, hair glowing from sun behind, drink in hand" },
  { id: 22, shot: "Elevator Selfie", expression: "Cool", lighting: "Metallic Overhead Light", outfit: "All black outfit", description: "Mirror selfie in elevator, metallic reflections, daily life update" },
  { id: 23, shot: "Art Museum", expression: "Curious", lighting: "Spotlight on Art", outfit: "Minimalist grey coat", description: "Looking at a painting, clean white walls, gallery atmosphere" },
  { id: 24, shot: "Hiking Summit", expression: "Accomplished", lighting: "Bright Mountain Sun", outfit: "Windbreaker and backpack", description: "Blue sky background, wind blown hair, nature landscape" },
  { id: 25, shot: "Bedroom Reading", expression: "Relaxed", lighting: "Bedside Lamp", outfit: "Silk pajamas", description: "Lying in bed, reading a book, warm cozy atmosphere, night time" },
  { id: 26, shot: "Grocery Flowers", expression: "Happy", lighting: "Natural Outdoor Shade", outfit: "Floral blouse", description: "Holding a bouquet of flowers, flower market background, colorful" },
  { id: 27, shot: "Laptop Cafe Work", expression: "Stressed", lighting: "Laptop Screen Glow", outfit: "Casual hoodie", description: "Late evening in cafe, face illuminated by screen, realistic work mode" },
  { id: 28, shot: "Stairs Photoshoot", expression: "Posey", lighting: "Natural Skylight", outfit: "Streetwear style (Cargo pants)", description: "Sitting on concrete stairs, urban minimalist background" },
  { id: 29, shot: "Convenience Store", expression: "Hungry", lighting: "Bright LED Store Light", outfit: "Casual track jacket", description: "Looking at snacks, rows of colorful products, late night snack run" },
  { id: 30, shot: "Garden Watering", expression: "Content", lighting: "Morning Sun", outfit: "Overalls and straw hat", description: "Watering plants, greenery, wet leaves, authentic hobby" },
  { id: 31, shot: "Car Driver", expression: "Singing", lighting: "Daylight through Windshield", outfit: "Sunglasses and tank top", description: "Hands on steering wheel, singing along, road visible through glass" },
  { id: 32, shot: "Formal Event", expression: "Charming", lighting: "Flash Photography", outfit: "Red evening gown", description: "Red carpet style but realistic, holding clutch, high contrast flash" },
  { id: 33, shot: "Dog Walking", expression: "Playful", lighting: "Afternoon Sun", outfit: "Leggings and sweatshirt", description: "Leash in hand (dog out of frame or blurred), park path" },
  { id: 34, shot: "Airport Departure", expression: "Tired but Excited", lighting: "Large Window Daylight", outfit: "Comfortable travel sweats", description: "Sitting at gate, suitcase visible, airplanes outside window" },
  { id: 35, shot: "Balcony Coffee", expression: "Peaceful", lighting: "Sunrise", outfit: "Silk robe", description: "Leaning on railing, city waking up in background, soft light" },
  { id: 36, shot: "Vintage Record Store", expression: "Cool", lighting: "Dim Interior", outfit: "Vintage leather jacket", description: "Browsing vinyl records, posters on wall, retro vibe" },
  { id: 37, shot: "Poolside Lounge", expression: "Relaxing", lighting: "Bright Harsh Sun", outfit: "Swimsuit and sarong", description: "Lying on lounge chair, sunglasses, blue water background" },
  { id: 38, shot: "Night Street Food", expression: "Happy", lighting: "Street Stall Bulbs", outfit: "Casual denim shirt", description: "Eating street food, blurry night city background, candid" },
  { id: 39, shot: "Makeup Vanity", expression: "Focused", lighting: "Ring Light", outfit: "White towel on head", description: "Applying lipstick, mirror reflection, makeup products visible" },
  { id: 40, shot: "Rainy Bus Stop", expression: "Waiting", lighting: "Grey Gloomy Light", outfit: "Trench coat and umbrella", description: "Standing under shelter, wet street, moody atmosphere" },
  { id: 41, shot: "Sunday Brunch", expression: "Social", lighting: "Outdoor Patio Light", outfit: "Smart casual blazer", description: "Mimosa in hand, sunny patio background, laughter" },
  { id: 42, shot: "Laundry Mat", expression: "Waiting", lighting: "Fluorescent Strip Light", outfit: "College sweatshirt", description: "Sitting on washing machine, rows of machines, retro laundromat vibe" },
  { id: 43, shot: "Tennis Court Break", expression: "Sweaty", lighting: "High Noon Sun", outfit: "White tennis skirt", description: "Drinking water, red face from heat, green court background" },
  { id: 44, shot: "Boat Ride", expression: "Windy", lighting: "Open Water Sun", outfit: "Nautical stripes shirt", description: "Wind messing up hair, blue water background, holiday vibe" },
  { id: 45, shot: "Classic Portrait", expression: "Intense", lighting: "Rembrandt Studio Light", outfit: "Black turtleneck", description: "Simple textured background, high detail skin texture, serious art portrait" },

  // --- TECHNICAL EDGE CASES (46-50) - TO PUSH THE SCORE TO 9.5/10 ---
  { 
    id: 46, 
    shot: "Extreme Macro Close-Up", 
    expression: "Neutral", 
    lighting: "Soft Ring Light", 
    outfit: "None (Focus on Eye)", 
    description: "Extreme close-up on one eye and nose bridge, distinct iris texture, skin pores visible, eyelashes in sharp focus, 100mm macro lens." 
  },
  { 
    id: 47, 
    shot: "High Angle (CCTV/Drone)", 
    expression: "Looking Up", 
    lighting: "Industrial Overhead", 
    outfit: "Winter Coat", 
    description: "Security camera view from ceiling corner, looking down at subject walking, foreshortening perspective." 
  },
  { 
    id: 48, 
    shot: "Low Angle (Worm's Eye)", 
    expression: "Dominant", 
    lighting: "Backlit Sun", 
    outfit: "Power Suit", 
    description: "Camera on the ground looking up, subject towering over camera, blue sky background." 
  },
  { 
    id: 49, 
    shot: "Motion Blur Action", 
    expression: "Urgent", 
    lighting: "City Night Streaks", 
    outfit: "Running gear", 
    description: "Subject running/walking fast, background streaked with motion blur, dynamic energy." 
  },
  { 
    id: 50, 
    shot: "Silhouette / Backlit", 
    expression: "Unknown", 
    lighting: "Bright White Studio Background", 
    outfit: "Tight fitting bodysuit", 
    description: "Subject in shadow, focus on body outline and posture, complete silhouette against bright light." 
  }
];
