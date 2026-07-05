/* 
  Sun & Soul Style - Main Frontend Script
  Handles general UX (custom cursor, scroll animations, mobile menu) and dynamic page loading.
*/

document.addEventListener('DOMContentLoaded', () => {
  initCommonUX();
  dispatchPageRouter();
});

// ------------------ COMMON UX & ANIMATIONS ------------------

function initCommonUX() {
  // 1. Header scroll effect
  const header = document.querySelector('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // 2. Mobile menu toggle
  const menuToggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      // Hamburger animation
      const spans = menuToggle.querySelectorAll('span');
      spans[0].style.transform = navLinks.classList.contains('open') ? 'rotate(45deg) translate(5px, 5px)' : 'none';
      spans[1].style.opacity = navLinks.classList.contains('open') ? '0' : '1';
      spans[2].style.transform = navLinks.classList.contains('open') ? 'rotate(-45deg) translate(6px, -6px)' : 'none';
    });
  }

  // 3. Custom Cursor
  const cursor = document.querySelector('.custom-cursor');
  const follower = document.querySelector('.custom-cursor-follower');
  if (cursor && follower) {
    let mouseX = 0, mouseY = 0;
    let followerX = 0, followerY = 0;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursor.style.left = mouseX + 'px';
      cursor.style.top = mouseY + 'px';
    });

    // Smooth follower movement
    function animateFollower() {
      const ease = 0.15;
      followerX += (mouseX - followerX) * ease;
      followerY += (mouseY - followerY) * ease;
      follower.style.left = followerX + 'px';
      follower.style.top = followerY + 'px';
      requestAnimationFrame(animateFollower);
    }
    animateFollower();

    // Hover states for links and buttons
    const hoverElements = document.querySelectorAll('a, button, .filter-btn, .testimonial-control-btn, .comparison-handle');
    hoverElements.forEach(el => {
      el.addEventListener('mouseenter', () => document.body.classList.add('hover-active'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('hover-active'));
    });
  }

  // 4. Scroll Reveal Animations (Intersection Observer)
  const revealElements = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          observer.unobserve(entry.target); // Reveal once
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px' // Trigger slightly before element enters viewport
    });

    revealElements.forEach(el => observer.observe(el));
  } else {
    // Fallback: active all
    revealElements.forEach(el => el.classList.add('active'));
  }

  // 5. Global Site Info Injector (Injects name, logo and footer details)
  fetchSiteInfo();

  // 6. Inject WhatsApp Floating Button
  injectWhatsAppFloatingButton();
}

async function fetchSiteInfo() {
  try {
    const res = await fetch('/api/site-info');
    if (!res.ok) throw new Error("Failed to load site info");
    const info = await res.json();
    
    // Set site titles and names dynamically
    document.querySelectorAll('.js-brand-name').forEach(el => el.textContent = info.name);
    document.querySelectorAll('.js-designer-name').forEach(el => el.textContent = info.designerName);
    document.querySelectorAll('.js-tagline').forEach(el => el.textContent = info.tagline);
    document.querySelectorAll('.js-bio-email').forEach(el => {
      el.textContent = info.contactEmail;
      el.href = `mailto:${info.contactEmail}`;
    });
    document.querySelectorAll('.js-bio-phone').forEach(el => {
      el.textContent = info.contactPhone;
      el.href = `tel:${info.contactPhone.replace(/[^+\d]/g, '')}`;
    });
    document.querySelectorAll('.js-studio-location').forEach(el => el.textContent = info.studioLocation);
    document.querySelectorAll('.js-instagram-handle').forEach(el => {
      el.textContent = info.instagram;
      el.href = `https://instagram.com/${info.instagram.replace('@', '')}`;
    });
    
    // Set dynamic document title if we're on a page with placeholder
    const pageTitle = document.querySelector('title');
    if (pageTitle && pageTitle.textContent.includes('Designer Portfolio')) {
      pageTitle.textContent = `${info.name} | ${info.designerName} - Interior Design`;
    }
  } catch (err) {
    console.error("Error setting common site metadata:", err);
  }
}

function injectWhatsAppFloatingButton() {
  if (document.querySelector('.whatsapp-float')) return; // Avoid duplicate injection
  
  const waBtn = document.createElement('a');
  waBtn.href = "https://wa.me/917073319692?text=Hi%20Sun%20Soul%20Style,%20I'd%20like%20to%20inquire%20about%20your%20interior%20design%20services.";
  waBtn.target = "_blank";
  waBtn.rel = "noopener";
  waBtn.className = "whatsapp-float";
  waBtn.setAttribute('aria-label', 'Chat on WhatsApp');
  waBtn.innerHTML = `
    <svg class="whatsapp-icon-svg" viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.965C16.528 2.016 14.07 1 11.996 1c-5.44 0-9.866 4.372-9.87 9.802 0 1.714.47 3.387 1.357 4.847L2.462 21.03l5.59-1.464l-.405-.412zm11.393-4.524c-.3-.15-1.777-.878-2.052-.978-.275-.1-.475-.15-.675.15-.2.3-.775.978-.95 1.178-.175.2-.35.225-.65.075-1.025-.513-1.74-.897-2.422-2.063-.18-.3-.18-.546-.03-.696.136-.136.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52l-.575-.01c-.2 0-.525.075-.8 1.05-.275.975-.825 2.425-.825 2.5 0 .075.075.375.3.6 1.838 1.838 3.514 2.188 4.414 2.45.625.18.9.2.1.2.6.2.775-.375.95-.575s.35-.45.45-.675c.1-.225.05-.425-.025-.575z"/>
    </svg>
  `;
  document.body.appendChild(waBtn);
  
  // Register custom cursor hover event
  waBtn.addEventListener('mouseenter', () => document.body.classList.add('hover-active'));
  waBtn.addEventListener('mouseleave', () => document.body.classList.remove('hover-active'));
}

// ------------------ PAGE ROUTER DISPATCH ------------------

function dispatchPageRouter() {
  const body = document.body;
  if (body.classList.contains('page-home')) {
    loadHomePage();
  } else if (body.classList.contains('page-projects')) {
    loadProjectsPage();
  } else if (body.classList.contains('page-project-detail')) {
    loadProjectDetailPage();
  } else if (body.classList.contains('page-about')) {
    loadAboutPage();
  } else if (body.classList.contains('page-services')) {
    loadServicesPage();
  } else if (body.classList.contains('page-contact')) {
    loadContactPage();
  }
}

// ------------------ PAGE: HOMEPAGE ------------------

async function loadHomePage() {
  try {
    // 1. Fetch and apply Hero details
    const siteRes = await fetch('/api/site-info');
    if (siteRes.ok) {
      const info = await siteRes.json();
      
      // Update Philosophy Section
      const philText = document.getElementById('philosophy-text');
      if (philText) philText.textContent = info.philosophy;
      
      // Hero image or video setup
      const heroMedia = document.getElementById('hero-media-container');
      if (heroMedia) {
        if (info.heroVideoUrl) {
          heroMedia.innerHTML = `
            <video autoplay muted loop playsinline poster="${info.heroFallbackImg || '/assets/hero-interior.jpg'}">
              <source src="${info.heroVideoUrl}" type="video/mp4">
            </video>`;
        } else {
          heroMedia.innerHTML = `<img src="${info.heroFallbackImg || '/assets/hero-interior.jpg'}" alt="Luxury Interior Home">`;
        }
      }
    }

    // 2. Fetch and render Featured Projects
    const projRes = await fetch('/api/projects');
    if (projRes.ok) {
      const projects = await projRes.json();
      const featured = projects.filter(p => p.featured).slice(0, 4); // limit to 4 featured
      const grid = document.getElementById('featured-projects-grid');
      
      if (grid && featured.length > 0) {
        grid.innerHTML = featured.map((p, idx) => `
          <a href="/project-detail.html?id=${p.id}" class="project-card reveal reveal-delay-${(idx % 2) + 1}">
            <div class="project-image-wrapper">
              <img src="${p.coverImage || '/assets/project-living.jpg'}" alt="${p.title}" loading="lazy">
              <div class="project-card-overlay">
                <span style="color: var(--color-warm-white); letter-spacing: 0.15em; font-size: 0.8rem; text-transform: uppercase;">View Project</span>
              </div>
            </div>
            <div class="project-card-info">
              <div>
                <h3 class="project-card-title">${p.title}</h3>
                <span class="project-card-category">${p.category}</span>
              </div>
              <div class="project-card-arrow">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 11L11 1M11 1H1M11 1V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
          </a>
        `).join('');
        
        // Re-observe dynamic cards
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('active');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.1 });
        grid.querySelectorAll('.reveal').forEach(el => observer.observe(el));
        
        // Register cursor events for new elements
        const cursor = document.querySelector('.custom-cursor');
        if (cursor) {
          grid.querySelectorAll('a').forEach(el => {
            el.addEventListener('mouseenter', () => document.body.classList.add('hover-active'));
            el.addEventListener('mouseleave', () => document.body.classList.remove('hover-active'));
          });
        }
      }
    }

    // 3. Fetch and render Testimonials Slider
    const testRes = await fetch('/api/testimonials');
    if (testRes.ok) {
      const testimonials = await testRes.json();
      initTestimonialSlider(testimonials);
    }
  } catch (err) {
    console.error("Error loading home page details:", err);
  }
}

function initTestimonialSlider(testimonials) {
  const container = document.getElementById('testimonials-slider-container');
  if (!container || testimonials.length === 0) return;
  
  container.innerHTML = testimonials.map((t, idx) => `
    <div class="testimonial-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
      <blockquote class="testimonial-quote">“${t.quote}”</blockquote>
      <div class="testimonial-client">${t.clientName}</div>
      <div class="testimonial-project">${t.projectTitle}</div>
    </div>
  `).join('');
  
  let currentIndex = 0;
  const slides = container.querySelectorAll('.testimonial-slide');
  
  const prevBtn = document.getElementById('test-prev');
  const nextBtn = document.getElementById('test-next');
  
  function showSlide(index) {
    slides[currentIndex].classList.remove('active');
    currentIndex = (index + slides.length) % slides.length;
    slides[currentIndex].classList.add('active');
  }
  
  if (prevBtn) prevBtn.addEventListener('click', () => showSlide(currentIndex - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => showSlide(currentIndex + 1));
  
  // Auto slide every 8s
  setInterval(() => {
    showSlide(currentIndex + 1);
  }, 8000);
}

// ------------------ PAGE: PORTFOLIO ------------------

async function loadProjectsPage() {
  try {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error("Failed to load projects");
    const projects = await res.json();
    
    const grid = document.getElementById('portfolio-grid');
    const filterContainer = document.getElementById('portfolio-filters');
    
    if (!grid) return;
    
    // Extract unique categories for filter bar
    const categories = ['all', ...new Set(projects.map(p => p.category))];
    
    if (filterContainer && categories.length > 1) {
      filterContainer.innerHTML = categories.map(cat => `
        <button class="filter-btn ${cat === 'all' ? 'active' : ''}" data-filter="${cat.toLowerCase().replace(/\s+/g, '-')}">
          ${cat}
        </button>
      `).join('');
      
      // Register custom cursor hover events for new buttons
      const cursor = document.querySelector('.custom-cursor');
      if (cursor) {
        filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
          btn.addEventListener('mouseenter', () => document.body.classList.add('hover-active'));
          btn.addEventListener('mouseleave', () => document.body.classList.remove('hover-active'));
        });
      }
    }
    
    function renderGrid(filter = 'all') {
      const filtered = filter === 'all' 
        ? projects 
        : projects.filter(p => p.category.toLowerCase().replace(/\s+/g, '-') === filter);
        
      if (filtered.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; font-family: var(--font-serif); font-size: 1.5rem; padding: 40px 0; opacity: 0.6;">No projects found in this category.</p>`;
        return;
      }
      
      grid.innerHTML = filtered.map((p, idx) => `
        <a href="/project-detail.html?id=${p.id}" class="project-card reveal active" data-category="${p.category.toLowerCase().replace(/\s+/g, '-')}">
          <div class="project-image-wrapper">
            <img src="${p.coverImage || '/assets/project-living.jpg'}" alt="${p.title}" loading="lazy">
            <div class="project-card-overlay">
              <span style="color: var(--color-warm-white); letter-spacing: 0.15em; font-size: 0.8rem; text-transform: uppercase;">View Case Study</span>
            </div>
          </div>
          <div class="project-card-info">
            <div>
              <h3 class="project-card-title">${p.title}</h3>
              <span class="project-card-category">${p.category}</span>
            </div>
            <div class="project-card-arrow">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 11L11 1M11 1H1M11 1V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        </a>
      `).join('');
      
      // Hook up hover cursor active states
      const cursor = document.querySelector('.custom-cursor');
      if (cursor) {
        grid.querySelectorAll('a').forEach(el => {
          el.addEventListener('mouseenter', () => document.body.classList.add('hover-active'));
          el.addEventListener('mouseleave', () => document.body.classList.remove('hover-active'));
        });
      }
    }
    
    // Initial render
    renderGrid('all');
    
    // Filter click handlers
    if (filterContainer) {
      filterContainer.addEventListener('click', (e) => {
        if (!e.target.classList.contains('filter-btn')) return;
        
        filterContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        
        const filterVal = e.target.getAttribute('data-filter');
        renderGrid(filterVal);
      });
    }
    
  } catch (err) {
    console.error("Error loading portfolio projects:", err);
  }
}

// ------------------ PAGE: CASE STUDY DETAILS ------------------

async function loadProjectDetailPage() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (!id) {
      window.location.href = '/projects.html';
      return;
    }
    
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) {
      console.error("Project not found");
      window.location.href = '/projects.html';
      return;
    }
    const project = await res.json();
    
    // Populate Page Elements
    document.getElementById('project-title').textContent = project.title;
    document.getElementById('project-category').textContent = project.category;
    document.getElementById('project-desc').textContent = project.description;
    document.getElementById('project-story').textContent = project.story;
    
    // Background and hero images
    const heroImg = document.getElementById('project-hero-img');
    if (heroImg) heroImg.src = project.coverImage || '/assets/project-living.jpg';
    
    // Materials List
    const materialsList = document.getElementById('project-materials');
    if (materialsList && project.materials && project.materials.length > 0) {
      materialsList.innerHTML = project.materials.map(m => `<li>${m}</li>`).join('');
    } else if (materialsList) {
      materialsList.closest('.spec-group').style.display = 'none';
    }
    
    // Color Palette
    const paletteContainer = document.getElementById('project-palette');
    if (paletteContainer && project.palette && project.palette.length > 0) {
      paletteContainer.innerHTML = project.palette.map(color => `
        <div class="palette-circle" style="background-color: ${color};" title="${color}"></div>
      `).join('');
    } else if (paletteContainer) {
      paletteContainer.closest('.spec-group').style.display = 'none';
    }
    
    // Before / After Slider
    const beforeAfterSection = document.getElementById('before-after-section');
    const beforeImg = document.getElementById('before-img');
    const afterImg = document.getElementById('after-img');
    
    if (project.beforeImage && project.afterImage) {
      beforeImg.src = project.beforeImage;
      afterImg.src = project.afterImage;
      initBeforeAfterSlider();
    } else if (beforeAfterSection) {
      beforeAfterSection.style.display = 'none'; // hide comparison if no before image
    }
    
    // Gallery Grid
    const galleryGrid = document.getElementById('gallery-grid');
    if (galleryGrid && project.gallery && project.gallery.length > 0) {
      galleryGrid.innerHTML = project.gallery.map(imgUrl => `
        <div class="gallery-item reveal">
          <img src="${imgUrl}" alt="${project.title} detailed shot" loading="lazy">
        </div>
      `).join('');
      
      // Observe new gallery items for scroll reveal
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      galleryGrid.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }
    
  } catch (err) {
    console.error("Error loading project details page:", err);
  }
}

function initBeforeAfterSlider() {
  const container = document.querySelector('.comparison-container');
  const before = document.querySelector('.comparison-before');
  const handle = document.querySelector('.comparison-handle');
  if (!container || !before || !handle) return;
  
  let active = false;
  
  function sliderMove(x) {
    const rect = container.getBoundingClientRect();
    let position = ((x - rect.left) / rect.width) * 100;
    
    if (position < 0) position = 0;
    if (position > 100) position = 100;
    
    before.style.width = position + '%';
    handle.style.left = position + '%';
  }
  
  // Mouse events
  container.addEventListener('mousedown', (e) => {
    active = true;
    sliderMove(e.clientX);
  });
  
  window.addEventListener('mouseup', () => {
    active = false;
  });
  
  window.addEventListener('mousemove', (e) => {
    if (!active) return;
    sliderMove(e.clientX);
  });
  
  // Touch events for mobile
  container.addEventListener('touchstart', (e) => {
    active = true;
    sliderMove(e.touches[0].clientX);
  });
  
  window.addEventListener('touchend', () => {
    active = false;
  });
  
  window.addEventListener('touchmove', (e) => {
    if (!active) return;
    sliderMove(e.touches[0].clientX);
  });
}

// ------------------ PAGE: ABOUT ------------------

async function loadAboutPage() {
  try {
    const res = await fetch('/api/site-info');
    if (!res.ok) throw new Error("Failed to load bio data");
    const info = await res.json();
    
    const bioTextEl = document.getElementById('about-bio-text');
    const bioPhotoEl = document.getElementById('about-bio-photo');
    
    if (bioTextEl) {
      // Split bio into paragraphs
      bioTextEl.innerHTML = info.bio.split('\n\n').map(para => `<p>${para}</p>`).join('<br>');
    }
    if (bioPhotoEl) {
      bioPhotoEl.src = info.bioPhoto || '/assets/about_designer.jpg';
      bioPhotoEl.alt = info.designerName;
    }
  } catch (err) {
    console.error("Error setting about page details:", err);
  }
}

// ------------------ PAGE: SERVICES ------------------

async function loadServicesPage() {
  try {
    const res = await fetch('/api/services');
    if (!res.ok) throw new Error("Failed to load services");
    const services = await res.json();
    
    const grid = document.getElementById('services-grid');
    if (grid && services.length > 0) {
      grid.innerHTML = services.map((s, idx) => `
        <div class="service-card reveal reveal-delay-${(idx % 3) + 1}">
          <div class="service-header">
            <h3 class="service-name">${s.name}</h3>
            <div class="service-price">${s.price}</div>
          </div>
          <div style="flex-grow: 1;">
            <p class="service-desc">${s.description}</p>
            <ul class="service-deliverables">
              ${s.deliverables.map(del => `<li>${del}</li>`).join('')}
            </ul>
          </div>
          <a href="/contact.html?type=${encodeURIComponent(s.name)}" class="btn-underline" style="margin-top: 40px; align-self: flex-start;">Inquire Now</a>
        </div>
      `).join('');
      
      // Observe reveal
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      grid.querySelectorAll('.reveal').forEach(el => observer.observe(el));
      
      // Hook up hover cursor active states
      const cursor = document.querySelector('.custom-cursor');
      if (cursor) {
        grid.querySelectorAll('a').forEach(el => {
          el.addEventListener('mouseenter', () => document.body.classList.add('hover-active'));
          el.addEventListener('mouseleave', () => document.body.classList.remove('hover-active'));
        });
      }
    }
  } catch (err) {
    console.error("Error setting services page details:", err);
  }
}

// ------------------ PAGE: CONTACT ------------------

async function loadContactPage() {
  try {
    const res = await fetch('/api/site-info');
    if (res.ok) {
      const info = await res.json();
      const responseNoteEl = document.getElementById('contact-response-note');
      if (responseNoteEl) responseNoteEl.textContent = info.responseTimeNote;
    }
    
    // Set project type drop-down if specified in query param (e.g. from service click)
    const urlParams = new URLSearchParams(window.location.search);
    const serviceType = urlParams.get('type');
    const dropdown = document.getElementById('contact-project-type');
    
    if (dropdown && serviceType) {
      // Find matching option
      for (let option of dropdown.options) {
        if (option.text.toLowerCase().includes(serviceType.toLowerCase()) || serviceType.toLowerCase().includes(option.value.toLowerCase())) {
          dropdown.value = option.value;
          break;
        }
      }
    }
    
    // Contact Form Submission logic
    const form = document.getElementById('contact-form');
    const statusEl = document.getElementById('form-status');
    
    if (form && statusEl) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        statusEl.className = 'form-status';
        statusEl.textContent = 'Sending inquiry...';
        
        const formData = {
          name: document.getElementById('contact-name').value,
          email: document.getElementById('contact-email').value,
          projectType: document.getElementById('contact-project-type').value,
          budget: document.getElementById('contact-budget').value,
          message: document.getElementById('contact-message').value
        };
        
        try {
          const postRes = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });
          
          const result = await postRes.json();
          
          if (postRes.ok) {
            statusEl.classList.add('success');
            statusEl.textContent = 'Thank you. Your inquiry has been sent successfully. We will reach out soon.';
            form.reset();
          } else {
            statusEl.classList.add('error');
            statusEl.textContent = result.error || 'Failed to submit form. Please check details and try again.';
          }
        } catch (err) {
          console.error("Form submission error:", err);
          statusEl.classList.add('error');
          statusEl.textContent = 'An unexpected error occurred. Please try again later.';
        }
      });
    }
  } catch (err) {
    console.error("Error setting contact page details:", err);
  }
}
