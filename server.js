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

if (process.env.VERCEL && !process.env.RESEND_API_KEY) {
  console.warn("WARNING: RESEND_API_KEY environment variable is missing in Vercel environment! Admin password reset emails will NOT work, and links will only log to stdout (inaccessible to users).");
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware: Ensure database is initialized from Vercel Blob before serving any requests
app.use(async (req, res, next) => {
  try {
    await db.waitForInit();
  } catch (err) {
    console.error("Database initialization check failed:", err);
  }
  next();
});

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
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  try {
    return db.getData().admin.sessionSecret || 'sunsoulstyledefaultsecret';
  } catch (e) {
    return 'sunsoulstyledefaultsecret';
  }
};

function generateToken(username, remember = false) {
  // 30 days if remember is checked, otherwise 2 hours
  const duration = remember ? 30 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({
    username,
    exp: Date.now() + duration
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

// Disable caching for all API routes
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// 1. Authentication APIs
app.post('/api/login', (req, res) => {
  const { username, password, remember } = req.body;
  const currentDb = db.getData();
  
  if (username === currentDb.admin.username && db.hashPassword(password) === currentDb.admin.passwordHash) {
    const token = generateToken(username, remember);
    if (remember) {
      // 30 days persistent cookie
      res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax`);
    } else {
      // Session cookie (deleted on browser close)
      res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax`);
    }
    return res.json({ success: true, message: 'Logged in successfully' });
  }
  
  res.status(401).json({ error: 'Invalid username or password' });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', `admin_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);
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

// GET raw database backup (authenticated only)
app.get('/api/raw-db', requireAuth, (req, res) => {
  const data = db.getData();
  const safeData = { ...data };
  delete safeData.admin;
  res.json(safeData);
});

app.post('/api/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const currentDb = db.getData();
  
  if (db.hashPassword(currentPassword) === currentDb.admin.passwordHash) {
    currentDb.admin.passwordHash = db.hashPassword(newPassword);
    try {
      await db.saveData(currentDb);
      return res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
      console.error("Failed to change password:", err);
      return res.status(500).json({ error: 'Failed to persist database changes.' });
    }
  }
  res.status(400).json({ error: 'Incorrect current password' });
});

// Forgot Password Request Flow
app.post('/api/forgot-password', async (req, res) => {
  const { username } = req.body;
  const currentDb = db.getData();
  
  // Verify that the requested user is the admin
  if (!username || username !== currentDb.admin.username) {
    // For security reasons, don't explicitly say the username is invalid
    return res.json({ success: true, message: 'If the username is correct, a password reset link has been sent.' });
  }
  
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 60 * 60 * 1000; // 1 hour expiry
    
    currentDb.admin.resetToken = token;
    currentDb.admin.resetTokenExpiry = expiry;
    await db.saveData(currentDb);
    
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const host = req.get('host');
    const resetLink = `${protocol}://${host}/reset-password.html?token=${token}`;
    
    const contactEmail = currentDb.siteInfo.contactEmail || 'hello@sunsoulstyle.com';
    
    if (process.env.RESEND_API_KEY) {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      await resend.emails.send({
        from: 'Sun Soul Style CMS <onboarding@resend.dev>',
        to: contactEmail,
        subject: 'Sun Soul Style - Admin Password Reset Request',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #EBE6DF; background: #FFFDFB;">
            <h2 style="font-family: serif; font-style: italic; color: #2A2421; font-weight: 300;">Password Reset Request</h2>
            <p style="color: #2A2421; font-size: 1rem; line-height: 1.6;">You requested a password reset for the Sun Soul Style Admin CMS.</p>
            <p style="color: #2A2421; font-size: 1rem; line-height: 1.6;">Click the link below to set a new password (valid for 1 hour):</p>
            <div style="margin: 30px 0;">
              <a href="${resetLink}" target="_blank" style="background-color: #5C4033; color: #FFFDFB; padding: 14px 24px; text-decoration: none; font-size: 0.85rem; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500; display: inline-block;">Reset Password</a>
            </div>
            <p style="color: #2A2421; font-size: 0.9rem; opacity: 0.8; word-break: break-all;">Or copy and paste this URL into your browser: <br><a href="${resetLink}" style="color: #C86B55;">${resetLink}</a></p>
            <hr style="border: none; border-top: 1px solid #EBE6DF; margin: 30px 0;">
            <p style="font-size: 0.8rem; opacity: 0.6; color: #2A2421;">If you did not request this, you can ignore this email. Your password remains unchanged.</p>
          </div>
        `
      });
      console.log(`Password reset email successfully sent to ${contactEmail}`);
    } else {
      if (process.env.VERCEL) {
        console.error("CRITICAL WARNING: RESEND_API_KEY environment variable is missing in Vercel environment! Forgot password emails will NOT be sent. The reset link is only output to the logs.");
      }
      console.warn("WARNING: RESEND_API_KEY environment variable is not set! Reset link printed to console instead:");
      console.warn(`👉 PASSWORD RESET LINK: ${resetLink}`);
    }
    
    res.json({ success: true, message: 'If the username is correct, a password reset link has been sent.' });
  } catch (err) {
    console.error("Forgot password request failed:", err);
    res.status(500).json({ error: 'Failed to send password reset request. Please check server logs.' });
  }
});

// Validate Token & Reset Password Endpoint
app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }
  
  const currentDb = db.getData();
  
  if (
    currentDb.admin.resetToken &&
    currentDb.admin.resetToken === token &&
    currentDb.admin.resetTokenExpiry &&
    currentDb.admin.resetTokenExpiry > Date.now()
  ) {
    // Hash and update the password
    currentDb.admin.passwordHash = db.hashPassword(newPassword);
    // Invalidate the reset token immediately
    currentDb.admin.resetToken = null;
    currentDb.admin.resetTokenExpiry = null;
    
    try {
      await db.saveData(currentDb);
      return res.json({ success: true, message: 'Password has been reset successfully. Please log in with your new password.' });
    } catch (err) {
      console.error("Failed to reset password:", err);
      return res.status(500).json({ error: 'Failed to persist database changes.' });
    }
  }
  
  res.status(400).json({ error: 'Invalid or expired password reset token.' });
});

// 2. Site Info APIs
app.get('/api/site-info', (req, res) => {
  const data = db.getData();
  res.json(data.siteInfo);
});

app.put('/api/site-info', requireAuth, async (req, res) => {
  const data = db.getData();
  data.siteInfo = { ...data.siteInfo, ...req.body };
  try {
    await db.saveData(data);
    res.json({ success: true, data: data.siteInfo });
  } catch (err) {
    console.error("Failed to save site info:", err);
    res.status(500).json({ error: 'Failed to persist database changes.' });
  }
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

app.post('/api/projects', requireAuth, async (req, res) => {
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
  try {
    await db.saveData(data);
    res.status(201).json({ success: true, project: newProject });
  } catch (err) {
    console.error("Failed to save project:", err);
    res.status(500).json({ error: 'Failed to persist database changes.' });
  }
});

app.put('/api/projects/:id', requireAuth, async (req, res) => {
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
    try {
      await db.saveData(data);
      res.json({ success: true, project: data.projects[index] });
    } catch (err) {
      console.error("Failed to update project:", err);
      res.status(500).json({ error: 'Failed to persist database changes.' });
    }
  } else {
    res.status(404).json({ error: 'Project not found' });
  }
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  const data = db.getData();
  const filtered = data.projects.filter(p => p.id !== req.params.id);
  if (filtered.length !== data.projects.length) {
    data.projects = filtered;
    try {
      await db.saveData(data);
      res.json({ success: true, message: 'Project deleted' });
    } catch (err) {
      console.error("Failed to delete project:", err);
      res.status(500).json({ error: 'Failed to persist database changes.' });
    }
  } else {
    res.status(404).json({ error: 'Project not found' });
  }
});

// Reorder projects API
app.post('/api/projects/reorder', requireAuth, async (req, res) => {
  const { orders } = req.body; // Expecting { "project-id-1": 1, "project-id-2": 2 }
  if (!orders) return res.status(400).json({ error: 'Orders data required' });
  
  const data = db.getData();
  data.projects.forEach(project => {
    if (orders[project.id] !== undefined) {
      project.order = parseInt(orders[project.id]);
    }
  });
  
  try {
    await db.saveData(data);
    res.json({ success: true, message: 'Projects reordered successfully' });
  } catch (err) {
    console.error("Failed to reorder projects:", err);
    res.status(500).json({ error: 'Failed to persist database changes.' });
  }
});

// 4. Services APIs
app.get('/api/services', (req, res) => {
  const data = db.getData();
  res.json(data.services);
});

app.put('/api/services', requireAuth, async (req, res) => {
  // Save entire services array
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Expected services array' });
  const data = db.getData();
  data.services = req.body;
  try {
    await db.saveData(data);
    res.json({ success: true, services: data.services });
  } catch (err) {
    console.error("Failed to update services:", err);
    res.status(500).json({ error: 'Failed to persist database changes.' });
  }
});

// 5. Testimonials APIs
app.get('/api/testimonials', (req, res) => {
  const data = db.getData();
  res.json(data.testimonials);
});

app.put('/api/testimonials', requireAuth, async (req, res) => {
  // Save entire testimonials array
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Expected testimonials array' });
  const data = db.getData();
  data.testimonials = req.body;
  try {
    await db.saveData(data);
    res.json({ success: true, testimonials: data.testimonials });
  } catch (err) {
    console.error("Failed to update testimonials:", err);
    res.status(500).json({ error: 'Failed to persist database changes.' });
  }
});

// 6. Contact Messages APIs
app.post('/api/contact', async (req, res) => {
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
  try {
    await db.saveData(data);
    res.json({ success: true, message: 'Message sent successfully.' });
  } catch (err) {
    console.error("Failed to save contact message:", err);
    res.status(500).json({ error: 'Failed to persist database changes.' });
  }
});

app.get('/api/messages', requireAuth, (req, res) => {
  const data = db.getData();
  // Return newest first
  const sortedMessages = [...data.messages].sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(sortedMessages);
});

app.put('/api/messages/:id/read', requireAuth, async (req, res) => {
  const data = db.getData();
  const msg = data.messages.find(m => m.id === req.params.id);
  if (msg) {
    msg.read = req.body.read === true;
    try {
      await db.saveData(data);
      res.json({ success: true, message: msg });
    } catch (err) {
      console.error("Failed to update message read status:", err);
      res.status(500).json({ error: 'Failed to persist database changes.' });
    }
  } else {
    res.status(404).json({ error: 'Message not found' });
  }
});

app.delete('/api/messages/:id', requireAuth, async (req, res) => {
  const data = db.getData();
  const filtered = data.messages.filter(m => m.id !== req.params.id);
  if (filtered.length !== data.messages.length) {
    data.messages = filtered;
    try {
      await db.saveData(data);
      res.json({ success: true, message: 'Message deleted' });
    } catch (err) {
      console.error("Failed to delete message:", err);
      res.status(500).json({ error: 'Failed to persist database changes.' });
    }
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
    
    // Check if running on Vercel
    if (process.env.VERCEL) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.error("CRITICAL ERROR: BLOB_READ_WRITE_TOKEN is missing in Vercel environment! Cannot upload image to Vercel Blob.");
        return res.status(500).json({ error: 'Blob storage write token is missing.' });
      }
      
      const { put } = require('@vercel/blob');
      let uploadBuffer = req.file.buffer;
      let finalFilename = filename;
      
      if (sharp) {
        try {
          // Auto-optimize: resize to max 1600px width/height and compress to webp
          uploadBuffer = await sharp(req.file.buffer)
            .resize({
              width: 1600,
              height: 1600,
              fit: 'inside',
              withoutEnlargement: true
            })
            .webp({ quality: 80 })
            .toBuffer();
        } catch (sharpError) {
          console.warn("Sharp optimization failed, falling back to original upload:", sharpError.message);
          const originalExt = path.extname(req.file.originalname) || '.jpg';
          finalFilename = `img-${Date.now()}${originalExt}`;
        }
      } else {
        const originalExt = path.extname(req.file.originalname) || '.jpg';
        finalFilename = `img-${Date.now()}${originalExt}`;
      }
      
      // Upload directly to Vercel Blob storage
      const blob = await put(`uploads/${finalFilename}`, uploadBuffer, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN
      });
      
      return res.json({
        success: true,
        url: blob.url,
        originalName: req.file.originalname
      });
    } else {
      // Local development (!process.env.VERCEL)
      const uploadsDir = path.join(__dirname, 'public', 'uploads');
      
      // Ensure uploads directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const outputPath = path.join(uploadsDir, filename);
      
      if (sharp) {
        try {
          // Auto-optimize: resize to max 1600px width/height and compress to webp
          await sharp(req.file.buffer)
            .resize({
              width: 1600,
              height: 1600,
              fit: 'inside',
              withoutEnlargement: true
            })
            .webp({ quality: 80 })
            .toFile(outputPath);
            
          return res.json({
            success: true,
            url: `/uploads/${filename}`,
            originalName: req.file.originalname
          });
        } catch (sharpError) {
          console.warn("Sharp optimization failed, falling back to original save:", sharpError.message);
        }
      }
      
      // Fallback: save original file without optimization
      const originalExt = path.extname(req.file.originalname) || '.jpg';
      const fallbackFilename = `img-${Date.now()}${originalExt}`;
      const fallbackPath = path.join(uploadsDir, fallbackFilename);
      fs.writeFileSync(fallbackPath, req.file.buffer);
      
      return res.json({
        success: true,
        url: `/uploads/${fallbackFilename}`,
        originalName: req.file.originalname
      });
    }
  } catch (err) {
    console.error("Image upload failed completely:", err);
    res.status(500).json({ error: 'Image upload failed.' });
  }
});



// Express Error Handler for Multer and other errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// ------------------ PAGE SERVING ------------------

// ------------------ SEO: DYNAMIC SITEMAP ------------------

app.get('/sitemap.xml', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const data = db.getData();
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'weekly' },
    { url: '/projects.html', priority: '0.9', changefreq: 'weekly' },
    { url: '/services.html', priority: '0.7', changefreq: 'monthly' },
    { url: '/about.html', priority: '0.7', changefreq: 'monthly' },
    { url: '/contact.html', priority: '0.6', changefreq: 'monthly' },
  ];

  const projectUrls = (data.projects || []).map(p => ({
    url: `/project-detail.html?id=${p.id}`,
    priority: '0.8',
    changefreq: 'monthly',
  }));

  const entries = [...staticPages, ...projectUrls].map(({ url, priority, changefreq }) => `
  <url>
    <loc>${baseUrl}${url}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}
</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

// ------------------ SEO: SERVER-RENDERED META FOR CASE STUDY PAGES ------------------
app.get('/project-detail.html', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'project-detail.html');
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const id = req.query.id;
  const data = db.getData();
  const project = id ? data.projects.find(p => p.id === id) : null;

  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) {
      return res.status(500).send('Unable to load page.');
    }

    const title = project ? `${project.title} | Sun Soul Style` : 'Project Case Study | Sun Soul Style';
    const description = project
      ? (project.description || '').slice(0, 160) || `${project.title} - a ${project.category} interior design case study by Sun Soul Style.`
      : 'Explore the details of our interior design project. View before & after comparisons, materials palette, and the visual design story.';
    const image = project && project.coverImage
      ? (project.coverImage.startsWith('http') ? project.coverImage : `${baseUrl}${project.coverImage}`)
      : `${baseUrl}/assets/hero-interior.jpg`;
    const canonical = `${baseUrl}/project-detail.html${id ? `?id=${id}` : ''}`;

    const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const injected = [
      '  <title>' + escapeHtml(title) + '</title>',
      '  <meta name="description" content="' + escapeHtml(description) + '">',
      '  <link rel="canonical" href="' + canonical + '">',
      '  <meta property="og:type" content="article">',
      '  <meta property="og:title" content="' + escapeHtml(title) + '">',
      '  <meta property="og:description" content="' + escapeHtml(description) + '">',
      '  <meta property="og:image" content="' + escapeHtml(image) + '">',
      '  <meta property="og:url" content="' + canonical + '">',
      '  <meta property="og:site_name" content="Sun Soul Style">',
      '  <meta name="twitter:card" content="summary_large_image">',
      '  <meta name="twitter:title" content="' + escapeHtml(title) + '">',
      '  <meta name="twitter:description" content="' + escapeHtml(description) + '">',
      '  <meta name="twitter:image" content="' + escapeHtml(image) + '">',
    ].join('\n');

    const updatedHtml = html
      .replace(/<title>.*?<\/title>/i, '')
      .replace(/<meta name="description"[^>]*>/i, '')
      .replace('</head>', injected + '\n</head>');

    res.send(updatedHtml);
  });
});

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
