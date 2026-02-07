import { DatasetItem } from "../types";

// Distribution Logic:
// 1-5: Character Sheet (Structure) - FIXED
// 6-10: Extreme Close-up
// 11-25: Portrait
// 26-33: Medium Shot
// 34-40: Full Body
// 41-45: Cinematic/Artistic (New)
// Total: 45 Images

export const DATASET_PLAN: DatasetItem[] = [
  // --- CHARACTER SHEET (1-5) --- CRITICAL: Teaches 3D Structure & Anatomy
  // Fixed Outfit & Lighting to ensure the model focuses ONLY on geometry/features.
  { id: 1, shot: "Character Sheet: Front View", expression: "Neutral", lighting: "Studio Flat Lighting", outfit: "White tank top", description: "Passport style photo, perfectly symmetrical face, looking directly at camera, ears visible, neutral background, 50mm lens" },
  { id: 2, shot: "Character Sheet: Side Profile", expression: "Neutral", lighting: "Studio Flat Lighting", outfit: "White tank top", description: "90 degree side view of face, distinct nose shape, jawline definition, hair tucked behind ear, neutral background" },
  { id: 3, shot: "Character Sheet: Back View", expression: "Neutral", lighting: "Studio Flat Lighting", outfit: "White tank top", description: "View from behind, hair structure and length, neck and shoulder width, no face visible, neutral background" },
  { id: 4, shot: "Character Sheet: 3/4 Angle", expression: "Neutral", lighting: "Studio Flat Lighting", outfit: "White tank top", description: "45 degree angle turn, both eyes visible but one slightly further, definition of cheekbones, neutral background" },
  { id: 5, shot: "Character Sheet: High Angle", expression: "Looking up", lighting: "Studio Flat Lighting", outfit: "White tank top", description: "Camera above eye level looking down (bird's eye view face), forehead and nose bridge emphasis, cute angle, neutral background" },

  // --- EXTREME CLOSE-UP (6-10) --- Focus: Skin texture, eyes, lips
  { id: 6, shot: "Extreme Close-up", expression: "Flirty", lighting: "Candlelight", outfit: "Lace choker", description: "Soft warm glow, focus depth very shallow, blurry ears" },
  { id: 7, shot: "Extreme Close-up", expression: "Neutral", lighting: "Overcast Day", outfit: "Grey hoodie hood", description: "Flat even light, zero makeup look, every freckle visible" },
  { id: 8, shot: "Extreme Close-up", expression: "Laughing", lighting: "Camera Flash (Direct)", outfit: "Yellow summer top", description: "Harsh direct flash, shiny skin highlights, red-eye reduction style" },
  { id: 9, shot: "Extreme Close-up", expression: "Neutral", lighting: "Fluorescent Bathroom Light", outfit: "Makeup free look", description: "Greenish tint, unflattering realistic mirror selfie lighting" },
  { id: 10, shot: "Extreme Close-up", expression: "Shocked", lighting: "Streetlight (Orange)", outfit: "Emerald earrings", description: "Sodium vapor street lamp lighting, grainy night shot" },

  // --- PORTRAIT / HEADSHOT (11-25) --- Focus: Identity, hair, shoulders
  { id: 11, shot: "Portrait", expression: "Neutral", lighting: "Natural Window Light", outfit: "Beige trench coat", description: "Classic headshot, messy hair, looking out window" },
  { id: 12, shot: "Portrait", expression: "Smiling", lighting: "Outdoor Sunny", outfit: "Floral sundress", description: "Wind blowing hair across face, squinting slightly from sun" },
  { id: 13, shot: "Portrait", expression: "Confident", lighting: "Office Overhead Light", outfit: "Navy blue business suit", description: "Generic office lighting, realistic corporate snapshot" },
  { id: 14, shot: "Portrait", expression: "Neutral", lighting: "Car Headlights", outfit: "Leather biker jacket", description: "Standing on road at night, illuminated by headlights, high contrast" },
  { id: 15, shot: "Portrait", expression: "Laughing", lighting: "Cafe Window", outfit: "Chunky knit sweater", description: "Through the glass shot, reflections on window, candid moment" },
  { id: 16, shot: "Portrait", expression: "Serious", lighting: "Low Key (Dark)", outfit: "Black evening gown", description: "Underexposed, silhouette emerging from darkness, moody" },
  { id: 17, shot: "Portrait", expression: "Neutral", lighting: "Midday Sun (Harsh)", outfit: "White linen shirt", description: "Deep dark shadows under eyes and nose, high summer noon" },
  { id: 18, shot: "Portrait", expression: "Flirty", lighting: "Sunset", outfit: "Off-shoulder red top", description: "Lens flare washing out colors slightly, romantic vibes" },
  { id: 19, shot: "Portrait", expression: "Surprised", lighting: "Interior Office", outfit: "Glasses and blouse", description: "Caught off guard, slightly out of focus hand near face" },
  { id: 20, shot: "Portrait", expression: "Neutral", lighting: "Direct Flash", outfit: "Polka dot vintage dress", description: "Polaroid style, dark background, bright subject, hard shadow behind head" },
  { id: 21, shot: "Portrait", expression: "Smiling", lighting: "Party Strobe", outfit: "Party dress with sequins", description: "Motion blur background, sharp face, club atmosphere" },
  { id: 22, shot: "Portrait", expression: "Neutral", lighting: "Moonlight", outfit: "Silk pajamas", description: "Very grainy, blue tint, bedroom setting" },
  { id: 23, shot: "Portrait", expression: "Laughing", lighting: "Diffused Outdoor", outfit: "Gym tank top", description: "Post-workout, sweaty skin texture, messy hair bun" },
  { id: 24, shot: "Portrait", expression: "Angry", lighting: "Under lighting (Flashlight)", outfit: "Hooded cloak", description: "Light coming from below chin, spooky storytelling vibe" },
  { id: 25, shot: "Portrait", expression: "Neutral", lighting: "Subway Fluorescent", outfit: "Casual jacket", description: "Public transport lighting, tired eyes, realistic urban commute" },

  // --- MEDIUM SHOT (26-33) --- Focus: Upper body, hands, pose
  { id: 26, shot: "Medium Shot", expression: "Neutral", lighting: "Art Gallery Track Lights", outfit: "Minimalist black dress", description: "Spotlight on face, background dark, museum setting" },
  { id: 27, shot: "Medium Shot", expression: "Smiling", lighting: "Beach Daylight", outfit: "Bikini top and sarong", description: "Wet hair, salt on skin, bright expansive background" },
  { id: 28, shot: "Medium Shot", expression: "Confident", lighting: "City Neon", outfit: "Denim jacket over hoodie", description: "Purple and blue reflections on jacket, wet pavement" },
  { id: 29, shot: "Medium Shot", expression: "Laughing", lighting: "Kitchen Interior", outfit: "Apron over casual clothes", description: "Flour on face, messy kitchen, warm home lighting" },
  { id: 30, shot: "Medium Shot", expression: "Neutral", lighting: "Library Lamp", outfit: "Preppy cardigan", description: "Green bankers lamp light, dust motes in air" },
  { id: 31, shot: "Medium Shot", expression: "Surprised", lighting: "Car Interior", outfit: "Casual graphic tee", description: "Selfie angle from passenger seat, seatbelt visible" },
  { id: 32, shot: "Medium Shot", expression: "Serious", lighting: "Rainy Day", outfit: "Raincoat and umbrella", description: "Raindrops on lens, grey lighting, wet street" },
  { id: 33, shot: "Medium Shot", expression: "Flirty", lighting: "Bar Dim Light", outfit: "Cocktail dress", description: "Noise, blurry background people, holding a drink" },

  // --- FULL BODY (34-40) --- Focus: Posture, proportions, outfit fit
  { id: 34, shot: "Full Body", expression: "Neutral", lighting: "Gym Fluorescent", outfit: "Yoga leggings and sports bra", description: "Mirror selfie in gym, harsh overhead lights" },
  { id: 35, shot: "Full Body", expression: "Smiling", lighting: "Park Sunlight", outfit: "Bohemian maxi dress", description: "Walking away then turning back, hair in motion" },
  { id: 36, shot: "Full Body", expression: "Confident", lighting: "Paparazzi Flash", outfit: "High fashion avant-garde suit", description: "Multiple flash sources, night street, red carpet style" },
  { id: 37, shot: "Full Body", expression: "Neutral", lighting: "Urban Alleyway", outfit: "Grunge flannel and ripped jeans", description: "Trash cans in background, gritty texture, overcast" },
  { id: 38, shot: "Full Body", expression: "Laughing", lighting: "Beach Sunset", outfit: "White summer shorts outfit", description: "Running into water, motion blur on legs" },
  { id: 39, shot: "Full Body", expression: "Serious", lighting: "Elevator Light", outfit: "Pencil skirt and blazer", description: "Top down lighting, metallic reflections, security camera angle" },
  { id: 40, shot: "Full Body", expression: "Surprised", lighting: "Snowy Day", outfit: "Winter coat, scarf, boots", description: "Snow falling, overcast white light, breath visible in cold" },

  // --- CINEMATIC / ARTISTIC (41-45) --- New Additions for Variety
  { id: 41, shot: "Action Shot", expression: "Focused", lighting: "Golden Hour Backlight", outfit: "Athletic wear", description: "Jogging in a park, hair flying, motion blur background, dynamic energy" },
  { id: 42, shot: "Close-up", expression: "Peaceful", lighting: "Morning Sun Rays", outfit: "White bed sheets", description: "Lying in bed, sunlight hitting face through blinds, soft shadows, high key" },
  { id: 43, shot: "Low Angle", expression: "Dominant", lighting: "Cyberpunk Neon", outfit: "Leather trench coat", description: "Looking down at camera, rain falling, blue and pink rim lights, wet texture" },
  { id: 44, shot: "Reflection", expression: "Contemplative", lighting: "Rainy Window", outfit: "Cozy oversized knit", description: "Shot through a rainy window, face reflection visible, melancholic vibe" },
  { id: 45, shot: "Portrait", expression: "Ethereal", lighting: "Prism Refraction", outfit: "Sheer white dress", description: "Rainbow light leaks across face, dreamlike atmosphere, soft focus" }
];