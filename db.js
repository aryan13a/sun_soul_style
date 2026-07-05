const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const BUNDLE_DB_PATH = path.join(__dirname, 'db.json');
const DB_PATH = process.env.VERCEL
  ? path.join('/tmp', 'db.json')
  : BUNDLE_DB_PATH;

if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("CRITICAL ERROR: BLOB_READ_WRITE_TOKEN environment variable is missing in Vercel environment! Database persistence is DISABLED. Edits will stay in ephemeral /tmp/db.json and reset on cold start.");
}

// Default initial database state
const DEFAULT_DB = {
  admin: {
    // Default password is 'admin123', hashed with sha256
    passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', // sha256 of 'admin123'
    username: 'admin',
    sessionSecret: 'sunsoulstyle_secret_session_key_2026'
  },
  siteInfo: {
    name: "Sun Soul Style",
    designerName: "Keshavi Gupta",
    tagline: "Warm, elevated spaces shaped by natural light and organic textures.",
    philosophy: "We believe a home should feel like an extension of the soul. Our design language merges tactile simplicity with confident refinement — balancing cream boucle textures, raw walnut wood, and warm Mediterranean tones.",
    heroVideoUrl: "/assets/hero-video.mp4", // Optional looping video, will use hero image if empty
    heroVideoUrlPortrait: "", // Optional looping video for mobile, will fall back to heroVideoUrl if empty
    heroFallbackImg: "/assets/hero-interior.jpg",
    bio: "Inspired by Mediterranean architecture, natural textiles, and the quiet luxury of clean lines, Keshavi Gupta creates spaces that feel both elevated and deeply lived-in. Based in Jaipur, Rajasthan, her boutique studio specializes in high-end residential interiors that honor natural light, organic materials, and hand-crafted details.",
    bioPhoto: "/assets/kp.png",
    contactEmail: "hello@sunsoulstyle.com",
    contactPhone: "+91 70733 19692",
    studioLocation: "Jaipur, Rajasthan",
    instagram: "@sun_soul_style",
    responseTimeNote: "We typically respond to new inquiries within 2-3 business days. We look forward to shaping your space."
  },
  projects: [
    {
      id: "project-1",
      title: "The Ojai Hacienda",
      category: "Full Home",
      roomType: "full-home",
      style: "Mediterranean",
      coverImage: "/assets/project-living.jpg",
      description: "A warm, light-filled sanctuary emphasizing organic shapes, custom walnut joinery, and soft plaster walls.",
      story: "Nestled in the foothills of Ojai, this 1970s Spanish-style home was reimagined as a peaceful, tactile retreat. We stripped back years of dark paint to expose raw wood ceilings, applied hand-textured limestone plaster to the walls, and integrated custom walnut cabinetry. By enlarging the windows and adding skylights, we flooded the interior with Ojai's legendary golden hour light.",
      materials: ["Raw walnut", "Cream Boucle", "Limestone plaster", "Terracotta tiles", "Hand-thrown ceramics"],
      palette: ["#FAF6F0", "#D9A05B", "#C86B55", "#5C4033"],
      beforeImage: "/assets/project-before-living.jpg",
      afterImage: "/assets/project-living.jpg",
      gallery: [
        "/assets/project-living.jpg",
        "/assets/project-kitchen.jpg",
        "/assets/project-bedroom.jpg",
        "/assets/project-dining.jpg"
      ],
      featured: true,
      order: 1
    },
    {
      id: "project-2",
      title: "The Walnut Kitchen",
      category: "Kitchen",
      roomType: "kitchen",
      style: "Minimalist",
      coverImage: "/assets/project-kitchen.jpg",
      description: "An elegant culinary workspace designed with solid walnut cabinets, honed marble, and minimalist details.",
      story: "For this kitchen, we focused on the beauty of grain continuity and minimal hardware. The solid walnut cabinetry is offset by thick slabs of Arabescato marble. Integrated appliances and custom pull-outs keep the lines clean, while a centered skylight keeps the workspace bright throughout the day.",
      materials: ["Solid Walnut", "Honed Arabescato Marble", "Brushed Brass", "Plaster Hood"],
      palette: ["#FFFDFB", "#2A2421", "#5C4033", "#D9A05B"],
      beforeImage: "",
      afterImage: "/assets/project-kitchen.jpg",
      gallery: [
        "/assets/project-kitchen.jpg",
        "/assets/project-dining.jpg"
      ],
      featured: true,
      order: 2
    },
    {
      id: "project-3",
      title: "Terracotta Bedroom Sanctuary",
      category: "Bedroom",
      roomType: "bedroom",
      style: "Rustic Modern",
      coverImage: "/assets/project-bedroom.jpg",
      description: "A cozy, grounding bedroom utilizing earthy terracotta accent colors, raw linen, and rattan textures.",
      story: "Designed as an intimate escape, this master bedroom pairs custom linen drapery with plaster walls tinted a very soft sand. Terracotta accents in the bedding and hand-made ceramics ground the space, while a vintage rattan armchair and a rustic wood stool add rich texture and warmth.",
      materials: ["Raw Linen", "Rattan", "Earthy Plaster", "Ebonized Oak"],
      palette: ["#FAF6F0", "#C86B55", "#8E7259", "#2A2421"],
      beforeImage: "",
      afterImage: "/assets/project-bedroom.jpg",
      gallery: [
        "/assets/project-bedroom.jpg",
        "/assets/project-living.jpg"
      ],
      featured: true,
      order: 3
    },
    {
      id: "project-4",
      title: "The Organic Dining Room",
      category: "Dining Room",
      roomType: "dining-room",
      style: "Coastal Modern",
      coverImage: "/assets/project-dining.jpg",
      description: "A bright, airy dining space centered around an organic curved oak table and natural woven lighting.",
      story: "Our goal was to create a space that inspires long, slow meals. We custom-designed the organic curved dining table in local oak, pairing it with linen-upholstered chairs. A large woven rattan pendant casts a soft, textured glow, while tall French doors open to an olive tree courtyard, blending the outdoors with the inside.",
      materials: ["Local Oak", "Woven Rattan", "Belgian Linen", "Travertine Stone"],
      palette: ["#FFFDFB", "#8E7259", "#D9A05B", "#FAF6F0"],
      beforeImage: "",
      afterImage: "/assets/project-dining.jpg",
      gallery: [
        "/assets/project-dining.jpg",
        "/assets/project-kitchen.jpg"
      ],
      featured: false,
      order: 4
    }
  ],
  services: [
    {
      id: "service-1",
      name: "Full-Service Interior Design",
      price: "Starting at ₹5,00,000",
      description: "From initial concept planning to construction documents and final styling, we handle every detail of your renovation or new build.",
      deliverables: [
        "Space planning and furniture layouts",
        "Material, fixture, and finishes selection",
        "3D photo-realistic renderings",
        "Procurement, logistics, and installation"
      ]
    },
    {
      id: "service-2",
      name: "E-Design & Space Curation",
      price: "Flat Fee ₹1,50,000 / room",
      description: "A flexible, virtual design service providing you with a custom blueprint to execute at your own pace.",
      deliverables: [
        "Digital concept board and color palette",
        "To-scale room layout plan",
        "Curated shopping list with direct purchase links",
        "Step-by-step setup and styling guide"
      ]
    },
    {
      id: "service-3",
      name: "Design Consultation",
      price: "₹25,000 / hour",
      description: "A focused, one-on-one session to solve specific design challenges, select paint colors, or refine layouts.",
      deliverables: [
        "Up to 2 hours in-person or virtual consultation",
        "Color palette and general styling advice",
        "Follow-up recap with resource notes"
      ]
    }
  ],
  testimonials: [
    {
      id: "test-1",
      clientName: "Sarah & Marcus K.",
      projectTitle: "The Ojai Hacienda",
      quote: "Working with Keshavi was an absolute dream. She understood our vision before we even knew how to articulate it. Every single room feels incredibly warm, tactile, and peaceful."
    },
    {
      id: "test-2",
      clientName: "Claire L.",
      projectTitle: "The Walnut Kitchen",
      quote: "The attention to detail in our kitchen is unbelievable. Keshavi managed to make a highly functional space feel like an artistic masterpiece. We spend all our time here now."
    }
  ],
  messages: []
};

// Helper: Fetch JSON from URL using native https module
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Background sync function to write to Vercel Blob
async function syncToVercelBlob(data) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const { put } = require('@vercel/blob');
    await put('db.json', JSON.stringify(data, null, 2), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    console.log("Database successfully synced to Vercel Blob.");
  } catch (e) {
    console.error("Failed to sync database to Vercel Blob in background:", e);
  }
}

// Initialize database from Vercel Blob (if running on Vercel) or fallback locally
let isInitialized = false;
let initPromise = null;

async function initDb() {
  // If not on Vercel, initialize local db.json normally
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    if (!fs.existsSync(DB_PATH)) {
      let initialData = DEFAULT_DB;
      if (fs.existsSync(BUNDLE_DB_PATH)) {
        try {
          initialData = JSON.parse(fs.readFileSync(BUNDLE_DB_PATH, 'utf-8'));
        } catch (e) {
          initialData = DEFAULT_DB;
        }
      }
      fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
    }
    isInitialized = true;
    return;
  }

  // If on Vercel, pull latest db.json from Vercel Blob first
  try {
    console.log("Initializing database from Vercel Blob...");
    const { list } = require('@vercel/blob');
    const listResult = await list({ token: process.env.BLOB_READ_WRITE_TOKEN });
    const dbBlob = listResult.blobs.find(b => b.pathname === 'db.json');
    
    let initialData = DEFAULT_DB;
    if (dbBlob) {
      console.log("Found database blob at URL:", dbBlob.url);
      initialData = await fetchJson(dbBlob.url);
    } else {
      console.log("No database blob found in store. Initializing with bundle content.");
      if (fs.existsSync(BUNDLE_DB_PATH)) {
        try {
          initialData = JSON.parse(fs.readFileSync(BUNDLE_DB_PATH, 'utf-8'));
        } catch (e) {
          initialData = DEFAULT_DB;
        }
      }
      // Write to Vercel Blob immediately so it exists next time
      await syncToVercelBlob(initialData);
    }
    
    // Ensure the local /tmp folder exists
    const tmpDir = path.dirname(DB_PATH);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
    console.log("Database initialized successfully in /tmp/db.json");
  } catch (err) {
    console.error("Vercel Blob initialization failed, using default db.json:", err);
    // Fallback: write defaults to /tmp/db.json so server can still function
    try {
      const tmpDir = path.dirname(DB_PATH);
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
    } catch (fsErr) {
      console.error("Failed to write fallback database locally:", fsErr);
    }
  }
  isInitialized = true;
}

initPromise = initDb();

function waitForInit() {
  return initPromise;
}

function getData() {
  try {
    const content = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error("Error reading database, resetting to default...", err);
    saveData(DEFAULT_DB);
    return DEFAULT_DB;
  }
}

function saveData(data) {
  const tempPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, DB_PATH);

  // Trigger background sync to Vercel Blob in production
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    syncToVercelBlob(data);
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = {
  getData,
  saveData,
  hashPassword,
  waitForInit
};
