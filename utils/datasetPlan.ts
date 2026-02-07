import { DatasetItem } from "../types";

// Distribution Logic:
// 10x Extreme Close-up | 15x Portrait | 8x Medium Shot | 7x Full Body
// 15x Neutral | 8x Smiling | 5x Laughing | 4x Serious | 4x Surprised | 4x Flirty

export const DATASET_PLAN: DatasetItem[] = [
  // --- EXTREME CLOSE-UP (10) --- Focus: Skin texture, eyes, lips
  { id: 1, shot: "Extreme Close-up", expression: "Neutral", lighting: "Hard Side Lighting", outfit: "White crewneck t-shirt", description: "Macro shot of eyes and nose bridge, detailed skin texture" },
  { id: 2, shot: "Extreme Close-up", expression: "Neutral", lighting: "Soft Studio Lighting", outfit: "Black turtleneck", description: "Focus on lips and chin, soft shadows" },
  { id: 3, shot: "Extreme Close-up", expression: "Serious", lighting: "Rembrandt Lighting", outfit: "Red silk scarf", description: "Intense gaze into camera, high contrast" },
  { id: 4, shot: "Extreme Close-up", expression: "Smiling", lighting: "Golden Hour", outfit: "Denim collar", description: "Sunlight hitting the face, catching details in iris" },
  { id: 5, shot: "Extreme Close-up", expression: "Surprised", lighting: "Neon Blue/Pink", outfit: "Silver necklace", description: "Cyberpunk aesthetic, reflection in eyes" },
  { id: 6, shot: "Extreme Close-up", expression: "Flirty", lighting: "Candlelight", outfit: "Lace choker", description: "Looking up through lashes, warm glow" },
  { id: 7, shot: "Extreme Close-up", expression: "Neutral", lighting: "Overcast Day", outfit: "Grey hoodie hood", description: "Diffused soft light, very flat and detailed" },
  { id: 8, shot: "Extreme Close-up", expression: "Laughing", lighting: "Bright High Key", outfit: "Yellow summer top", description: "Joyful expression, crinkles around eyes" },
  { id: 9, shot: "Extreme Close-up", expression: "Neutral", lighting: "Ring Light", outfit: "Makeup free look", description: "Perfectly even lighting, cosmetic beauty shot" },
  { id: 10, shot: "Extreme Close-up", expression: "Shocked", lighting: "Dramatic Spotlight", outfit: "Emerald earrings", description: "Mouth slightly open, stark background" },

  // --- PORTRAIT / HEADSHOT (15) --- Focus: Identity, hair, shoulders
  { id: 11, shot: "Portrait", expression: "Neutral", lighting: "Natural Window Light", outfit: "Beige trench coat", description: "Classic headshot, soft window light from left" },
  { id: 12, shot: "Portrait", expression: "Smiling", lighting: "Outdoor Sunny", outfit: "Floral sundress", description: "Cheerful park setting, bokeh background" },
  { id: 13, shot: "Portrait", expression: "Confident", lighting: "Studio Grey Backdrop", outfit: "Navy blue business suit", description: "Professional corporate headshot" },
  { id: 14, shot: "Portrait", expression: "Neutral", lighting: "Cinematic Teal/Orange", outfit: "Leather biker jacket", description: "Movie scene aesthetic, urban night" },
  { id: 15, shot: "Portrait", expression: "Laughing", lighting: "Warm Cafe Light", outfit: "Chunky knit sweater", description: "Candid moment in a coffee shop" },
  { id: 16, shot: "Portrait", expression: "Serious", lighting: "Low Key (Dark)", outfit: "Black evening gown", description: "Mysterious, face emerging from shadow" },
  { id: 17, shot: "Portrait", expression: "Neutral", lighting: "Midday Sun (Harsh)", outfit: "White linen shirt", description: "Sharp shadows, summer vibes" },
  { id: 18, shot: "Portrait", expression: "Flirty", lighting: "Sunset", outfit: "Off-shoulder red top", description: "Backlit by setting sun, hair glowing" },
  { id: 19, shot: "Portrait", expression: "Surprised", lighting: "Interior Office", outfit: "Glasses and blouse", description: "Reaction shot, looking at something off camera" },
  { id: 20, shot: "Portrait", expression: "Neutral", lighting: "Softbox", outfit: "Polka dot vintage dress", description: "Fashion catalog style, clean background" },
  { id: 21, shot: "Portrait", expression: "Smiling", lighting: "Flash Photography", outfit: "Party dress with sequins", description: "Red carpet style, direct flash" },
  { id: 22, shot: "Portrait", expression: "Neutral", lighting: "Moonlight (Blue)", outfit: "Silk pajamas", description: "Night time, cool tones" },
  { id: 23, shot: "Portrait", expression: "Laughing", lighting: "Diffused Outdoor", outfit: "Gym tank top", description: "Post-workout glow, natural vibes" },
  { id: 24, shot: "Portrait", expression: "Angry", lighting: "Under lighting (Spooky)", outfit: "Hooded cloak", description: "Dramatic and moody, shadows going up" },
  { id: 25, shot: "Portrait", expression: "Neutral", lighting: "Rim Light only", outfit: "Silhouette profile", description: "Outline of face defined by back light" },

  // --- MEDIUM SHOT (8) --- Focus: Upper body, hands, pose
  { id: 26, shot: "Medium Shot", expression: "Neutral", lighting: "Art Gallery Track Lights", outfit: "Minimalist black dress", description: "Standing with arms crossed" },
  { id: 27, shot: "Medium Shot", expression: "Smiling", lighting: "Beach Daylight", outfit: "Bikini top and sarong", description: "Relaxed vacation vibe, holding a hat" },
  { id: 28, shot: "Medium Shot", expression: "Confident", lighting: "City Street Lights", outfit: "Denim jacket over hoodie", description: "Urban streetwear style, hands in pockets" },
  { id: 29, shot: "Medium Shot", expression: "Laughing", lighting: "Kitchen Interior", outfit: "Apron over casual clothes", description: "Cooking context, candid motion" },
  { id: 30, shot: "Medium Shot", expression: "Neutral", lighting: "Library Lamp", outfit: "Preppy cardigan", description: "Holding a book, studious atmosphere" },
  { id: 31, shot: "Medium Shot", expression: "Surprised", lighting: "Car Interior", outfit: "Casual graphic tee", description: "Sitting in driver seat, daylight through window" },
  { id: 32, shot: "Medium Shot", expression: "Serious", lighting: "Rainy Day (Blue)", outfit: "Raincoat and umbrella", description: "Melancholic mood, water droplets" },
  { id: 33, shot: "Medium Shot", expression: "Flirty", lighting: "Bar Neon Signs", outfit: "Cocktail dress", description: "Holding a drink, leaning on counter" },

  // --- FULL BODY (7) --- Focus: Posture, proportions, outfit fit
  { id: 34, shot: "Full Body", expression: "Neutral", lighting: "Studio White Cycle", outfit: "Yoga leggings and sports bra", description: "Fitness pose, showing physique" },
  { id: 35, shot: "Full Body", expression: "Smiling", lighting: "Park Sunlight", outfit: "Bohemian maxi dress", description: "Walking towards camera, dress flowing" },
  { id: 36, shot: "Full Body", expression: "Confident", lighting: "Red Carpet", outfit: "High fashion avant-garde suit", description: "Power pose, wide angle" },
  { id: 37, shot: "Full Body", expression: "Neutral", lighting: "Urban Alleyway", outfit: "Grunge flannel and ripped jeans", description: "Leaning against a brick wall" },
  { id: 38, shot: "Full Body", expression: "Laughing", lighting: "Beach Sunset", outfit: "White summer shorts outfit", description: "Running on sand, dynamic motion" },
  { id: 39, shot: "Full Body", expression: "Serious", lighting: "Corporate Lobby", outfit: "Pencil skirt and blazer", description: "Walking with briefcase, professional" },
  { id: 40, shot: "Full Body", expression: "Surprised", lighting: "Snowy Day", outfit: "Winter coat, scarf, boots", description: "Standing in snow, catching snowflakes" }
];