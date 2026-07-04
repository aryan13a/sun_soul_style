const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn("WARNING: sharp library could not be loaded. Image optimization will be bypassed. Details:", e.message);
}
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON and URL-encoded body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom simple cookie parser middleware
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie || '';
  req.cookies = {};
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length === 2) {
      req.cookies[parts[0].trim()] = parts[1].trim();
    }
  });
  next();
});

// Simple Session Store helper functions (stateless signature-based tokens)
const getSecretKey = () => {
  try {
    return db.getData().admin.sessionSecret || 'sunsoulstyledefaultsecret';
  } catch (e) {
    return 'sunsoulstyledefaultsecret';
  }
};

function generateToken(username) {
  const payload = Buffer.from(JSON.stringify({
    username,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  })).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', getSecretKey())
    .update(payload)
    .digest('base64url');
    
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  
  const [payload, signature] = parts;
  
  const expectedSignature = crypto
    .createHmac('sha256', getSecretKey())
    .update(payload)
    .digest('base64url');
    
  if (signature !== expectedSignature) return null;
  
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp < Date.now()) return null; // expired
    return data;
  } catch (e) {
    return null;
  }
}

// Authentication check middleware (for API routes)
function requireAuth(req, res, next) {
  const token = req.cookies.admin_token;
  const session = verifyToken(token);
  if (session) {
    req.adminSession = session;
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
}

// Set up Multer with Memory Storage for Sharp optimization
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow images
    const filetypes = /jpeg|jpg|png|webp|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Error: File upload only supports images!"));
  }
});

// ------------------ API ROUTES ------------------

// 1. Authentication APIs
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const currentDb = db.getData();
  
  if (username === currentDb.admin.username && db.hashPassword(password) === currentDb.admin.passwordHash) {
    const token = generateToken(username);
    res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; Max-Age=86400`);
    return res.json({ success: true, message: 'Logged in successfully' });
  }
  
  res.status(401).json({ error: 'Invalid username or password' });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', `admin_token=; Path=/; HttpOnly; Max-Age=0`);
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth-check', (req, res) => {
  const token = req.cookies.admin_token;
  const session = verifyToken(token);
  if (session) {
    res.json({ authenticated: true });
  } else {
    res.json({ authenticated: false });
  }
});

app.post('/api/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const currentDb = db.getData();
  
  if (db.hashPassword(currentPassword) === currentDb.admin.passwordHash) {
    currentDb.admin.passwordHash = db.hashPassword(newPassword);
    db.saveData(currentDb);
    return res.json({ success: true, message: 'Password updated successfully' });
  }
  res.status(400).json({ error: 'Incorrect current password' });
});

// 2. Site Info APIs
app.get('/api/site-info', (req, res) => {
  const data = db.getData();
  res.json(data.siteInfo);
});

app.put('/api/site-info', requireAuth, (req, res) => {
  const data = db.getData();
  data.siteInfo = { ...data.siteInfo, ...req.body };
  db.saveData(data);
  res.json({ success: true, data: data.siteInfo });
});

// 3. Projects APIs
app.get('/api/projects', (req, res) => {
  const data = db.getData();
  // Sort projects by order
  const sortedProjects = [...data.projects].sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json(sortedProjects);
});

app.get('/api/projects/:id', (req, res) => {
  const data = db.getData();
  const project = data.projects.find(p => p.id === req.params.id);
  if (project) {
    res.json(project);
  } else {
    res.status(404).json({ error: 'Project not found' });
  }
});

app.post('/api/projects', requireAuth, (req, res) => {
  const data = db.getData();
  const newProject = {
    id: `project-${Date.now()}`,
    title: req.body.title || 'Untitled Project',
    category: req.body.category || 'Interior Design',
    roomType: req.body.roomType || 'other',
    style: req.body.style || 'Modern',
    coverImage: req.body.coverImage || '',
    description: req.body.description || '',
    story: req.body.story || '',
    materials: Array.isArray(req.body.materials) ? req.body.materials : [],
    palette: Array.isArray(req.body.palette) ? req.body.palette : [],
    beforeImage: req.body.beforeImage || '',
    afterImage: req.body.afterImage || '',
    gallery: Array.isArray(req.body.gallery) ? req.body.gallery : [],
    featured: req.body.featured === true || req.body.featured === 'true',
    order: parseInt(req.body.order) || (data.projects.length + 1)
  };
  
  data.projects.push(newProject);
  db.saveData(data);
  res.status(201).json({ success: true, project: newProject });
});

app.put('/api/projects/:id', requireAuth, (req, res) => {
  const data = db.getData();
  const index = data.projects.findIndex(p => p.id === req.params.id);
  
  if (index !== -1) {
    data.projects[index] = {
      ...data.projects[index],
      ...req.body,
      id: req.params.id, // Preserve ID
      featured: req.body.featured === true || req.body.featured === 'true',
      order: parseInt(req.body.order) || data.projects[index].order || 0
    };
    db.saveData(data);
    res.json({ success: true, project: data.projects[index] });
  } else {
    res.status(404).json({ error: 'Project not found' });
  }
});

app.delete('/api/projects/:id', requireAuth, (req, res) => {
  const data = db.getData();
  const filtered = data.projects.filter(p => p.id !== req.params.id);
  if (filtered.length !== data.projects.length) {
    data.projects = filtered;
    db.saveData(data);
    res.json({ success: true, message: 'Project deleted' });
  } else {
    res.status(404).json({ error: 'Project not found' });
  }
});

// Reorder projects API
app.post('/api/projects/reorder', requireAuth, (req, res) => {
  const { orders } = req.body; // Expecting { "project-id-1": 1, "project-id-2": 2 }
  if (!orders) return res.status(400).json({ error: 'Orders data required' });
  
  const data = db.getData();
  data.projects.forEach(project => {
    if (orders[project.id] !== undefined) {
      project.order = parseInt(orders[project.id]);
    }
  });
  
  db.saveData(data);
  res.json({ success: true, message: 'Projects reordered successfully' });
});

// 4. Services APIs
app.get('/api/services', (req, res) => {
  const data = db.getData();
  res.json(data.services);
});

app.put('/api/services', requireAuth, (req, res) => {
  // Save entire services array
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Expected services array' });
  const data = db.getData();
  data.services = req.body;
  db.saveData(data);
  res.json({ success: true, services: data.services });
});

// 5. Testimonials APIs
app.get('/api/testimonials', (req, res) => {
  const data = db.getData();
  res.json(data.testimonials);
});

app.put('/api/testimonials', requireAuth, (req, res) => {
  // Save entire testimonials array
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Expected testimonials array' });
  const data = db.getData();
  data.testimonials = req.body;
  db.saveData(data);
  res.json({ success: true, testimonials: data.testimonials });
});

// 6. Contact Messages APIs
app.post('/api/contact', (req, res) => {
  const { name, email, projectType, budget, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  
  const data = db.getData();
  const newMessage = {
    id: `msg-${Date.now()}`,
    name,
    email,
    projectType: projectType || 'General Inquiry',
    budget: budget || 'Not Specified',
    message,
    date: new Date().toISOString(),
    read: false
  };
  
  data.messages.push(newMessage);
  db.saveData(data);
  res.json({ success: true, message: 'Message sent successfully.' });
});

app.get('/api/messages', requireAuth, (req, res) => {
  const data = db.getData();
  // Return newest first
  const sortedMessages = [...data.messages].sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(sortedMessages);
});

app.put('/api/messages/:id/read', requireAuth, (req, res) => {
  const data = db.getData();
  const msg = data.messages.find(m => m.id === req.params.id);
  if (msg) {
    msg.read = req.body.read === true;
    db.saveData(data);
    res.json({ success: true, message: msg });
  } else {
    res.status(404).json({ error: 'Message not found' });
  }
});

app.delete('/api/messages/:id', requireAuth, (req, res) => {
  const data = db.getData();
  const filtered = data.messages.filter(m => m.id !== req.params.id);
  if (filtered.length !== data.messages.length) {
    data.messages = filtered;
    db.saveData(data);
    res.json({ success: true, message: 'Message deleted' });
  } else {
    res.status(404).json({ error: 'Message not found' });
  }
});

// 7. Image Upload and Auto-Optimization API
app.post('/api/upload', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded.' });
  }
  
  try {
    const filename = `img-${Date.now()}.webp`;
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const outputPath = path.join(uploadsDir, filename);
    
    if (sharp) {
      // Auto-optimize: resize to max 1600px width/height and compress to webp
      await sharp(req.file.buffer)
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true // don't upscale small images
        })
        .webp({ quality: 80 })
        .toFile(outputPath);
        
      res.json({
        success: true,
        url: `/uploads/${filename}`,
        originalName: req.file.originalname
      });
    } else {
      // Fallback: save original file without optimization
      const originalExt = path.extname(req.file.originalname) || '.jpg';
      const fallbackFilename = `img-${Date.now()}${originalExt}`;
      const fallbackPath = path.join(uploadsDir, fallbackFilename);
      fs.writeFileSync(fallbackPath, req.file.buffer);
      
      res.json({
        success: true,
        url: `/uploads/${fallbackFilename}`,
        originalName: req.file.originalname
      });
    }
  } catch (err) {
    console.error("Image optimization failed:", err);
    res.status(500).json({ error: 'Image processing failed.' });
  }
});

// Helper: Generate a secure random crypto token
function cryptoToken() {
  return crypto.randomBytes(24).toString('hex');
}

// ------------------ PAGE SERVING ------------------

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Specific fallback redirect for /admin (serves admin.html)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Fallback route: serve index.html for unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Sun Soul Style website is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
