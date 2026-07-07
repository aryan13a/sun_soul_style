const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware: Ensure database is initialized
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

// ------------------ API ROUTES ------------------

// Disable caching for all API routes
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// 1. Site Info API
app.get('/api/site-info', (req, res) => {
  const data = db.getData();
  res.json(data.siteInfo);
});

// 2. Projects APIs
app.get('/api/projects', (req, res) => {
  const data = db.getData();
  // Sort projects by order
  const sortedProjects = [...(data.projects || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json(sortedProjects);
});

app.get('/api/projects/:id', (req, res) => {
  const data = db.getData();
  const project = (data.projects || []).find(p => p.id === req.params.id);
  if (project) {
    res.json(project);
  } else {
    res.status(404).json({ error: 'Project not found' });
  }
});

// 3. Services API
app.get('/api/services', (req, res) => {
  const data = db.getData();
  res.json(data.services);
});

// 4. Testimonials API
app.get('/api/testimonials', (req, res) => {
  const data = db.getData();
  res.json(data.testimonials);
});

// ------------------ PAGE SERVING & SEO ------------------

// Dynamic sitemap
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

// Server-rendered meta for case study pages
app.get('/project-detail.html', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'project-detail.html');
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const id = req.query.id;
  const data = db.getData();
  const project = id ? (data.projects || []).find(p => p.id === id) : null;

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
