/*
  Sun & Soul Style - Admin Dashboard Script
  Handles Admin panel dynamic CRUD interfaces, login, and upload operations.
*/

document.addEventListener('DOMContentLoaded', () => {
  const isLoginPage = window.location.pathname.includes('login.html');
  checkAuthAndInit(isLoginPage);
});

// Toast notification helper
function showToast(message, type = 'success') {
  const toast = document.getElementById('admin-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `admin-toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 4000);
}

// Check authentication status before rendering page contents
async function checkAuthAndInit(isLoginPage) {
  try {
    const res = await fetch('/api/auth-check');
    if (!res.ok) throw new Error("Network response error");
    const data = await res.json();
    
    if (isLoginPage) {
      if (data.authenticated) {
        window.location.href = '/admin'; // already logged in
      } else {
        initLoginForm();
      }
    } else {
      if (!data.authenticated) {
        window.location.href = '/login.html'; // redirect to login
      } else {
        initAdminDashboard();
      }
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    if (!isLoginPage) {
      window.location.href = '/login.html';
    }
  }
}

// ------------------ LOGIN FORM HANDLER ------------------

function initLoginForm() {
  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  
  // Show a warning if opened as a local file rather than via server
  if (window.location.protocol === 'file:') {
    if (errorEl) {
      errorEl.innerHTML = '<strong>Security Notice:</strong> You opened this page directly as a local file (<code>file://</code>).<br>Please start the backend server (run <code>npm start</code> in the project directory) and navigate to <a href="http://localhost:3000/admin" style="text-decoration: underline; color: inherit;">http://localhost:3000/admin</a> in your browser.';
      errorEl.style.display = 'block';
    }
  }
  
  // Toggle password visibility
  const togglePasswordBtn = document.getElementById('toggle-password');
  const passwordInput = document.getElementById('login-password');
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      togglePasswordBtn.textContent = type === 'password' ? 'Show' : 'Hide';
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.style.display = 'none';
      
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        
        const result = await res.json();
        
        if (res.ok && result.success) {
          window.location.href = '/admin';
        } else {
          if (errorEl) {
            errorEl.textContent = result.error || 'Invalid credentials';
            errorEl.style.display = 'block';
          }
        }
      } catch (err) {
        console.error("Login request failed:", err);
        if (errorEl) {
          errorEl.textContent = 'Connection error. Please try again.';
          errorEl.style.display = 'block';
        }
      }
    });
  }
}

// ------------------ ADMIN DASHBOARD CONTROLLER ------------------

let currentProjects = [];
let currentServices = [];
let currentTestimonials = [];
let currentInquiries = [];

function initAdminDashboard() {
  // 1. Setup logout button
  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login.html';
      } catch (err) {
        console.error("Logout error:", err);
      }
    });
  }

  // 1.5. Setup download database backup button
  const downloadDbBtn = document.getElementById('download-db-btn');
  if (downloadDbBtn) {
    downloadDbBtn.addEventListener('click', async () => {
      try {
        downloadDbBtn.textContent = 'Fetching database...';
        downloadDbBtn.disabled = true;
        const res = await fetch('/api/raw-db');
        if (!res.ok) throw new Error("Failed to fetch database backup");
        const data = await res.json();
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "db.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        
        downloadDbBtn.textContent = 'Downloaded!';
        setTimeout(() => {
          downloadDbBtn.textContent = 'Download Database Backup (db.json)';
          downloadDbBtn.disabled = false;
        }, 2000);
      } catch (err) {
        console.error("Failed to download database:", err);
        alert("Error downloading database backup.");
        downloadDbBtn.textContent = 'Download Database Backup (db.json)';
        downloadDbBtn.disabled = false;
      }
    });
  }

  // 2. Setup menu tabs switching
  const menuItems = document.querySelectorAll('.sidebar-menu-item');
  const panels = document.querySelectorAll('.tab-panel');
  
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = item.getAttribute('data-tab');
      
      // Update active menu link styling
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      // Toggle panel visibility
      panels.forEach(panel => {
        if (panel.id === `tab-${tabId}`) {
          panel.classList.add('active');
        } else {
          panel.classList.remove('active');
        }
      });
      
      // Load specific tab contents
      loadTabContent(tabId);
    });
  });

  // 3. Initialize file upload event listeners globally
  initGlobalUploads();

  // 4. Load initial overview page data
  loadTabContent('overview');
}

// Routes loading of data depending on selected tab ID
function loadTabContent(tabId) {
  switch(tabId) {
    case 'overview':
      loadOverviewStats();
      break;
    case 'homepage':
      loadHomepageForm();
      break;
    case 'projects':
      loadProjectsTab();
      break;
    case 'services':
      loadServicesTab();
      break;
    case 'testimonials':
      loadTestimonialsTab();
      break;
    case 'inquiries':
      loadInquiriesTab();
      break;
    case 'settings':
      initSettingsTab();
      break;
  }
}

// ------------------ TAB: OVERVIEW ------------------

async function loadOverviewStats() {
  try {
    const [projRes, servRes, msgRes] = await Promise.all([
      fetch('/api/projects'),
      fetch('/api/services'),
      fetch('/api/messages')
    ]);
    
    const projects = await projRes.json();
    const services = await servRes.json();
    const messages = await msgRes.json();
    
    const unreadMsgs = messages.filter(m => !m.read).length;
    
    document.getElementById('stat-projects-count').textContent = projects.length;
    document.getElementById('stat-services-count').textContent = services.length;
    document.getElementById('stat-inquiries-count').textContent = messages.length;
    document.getElementById('stat-unread-count').textContent = unreadMsgs;
  } catch (err) {
    console.error("Failed to load overview statistics:", err);
  }
}

// ------------------ TAB: HOME / GENERAL INFO ------------------

async function loadHomepageForm() {
  try {
    const res = await fetch('/api/site-info');
    if (!res.ok) throw new Error("Failed to load site details");
    const info = await res.json();
    
    // Fill Homepage general texts
    document.getElementById('home-brand-name').value = info.name;
    document.getElementById('home-designer-name').value = info.designerName;
    document.getElementById('home-tagline').value = info.tagline;
    document.getElementById('home-philosophy').value = info.philosophy;
    document.getElementById('home-video-url').value = info.heroVideoUrl || '';
    document.getElementById('home-fallback-img').value = info.heroFallbackImg || '';
    updatePreviewBg('home-fallback-img-preview', info.heroFallbackImg);
    
    // Fill About texts
    document.getElementById('about-bio').value = info.bio;
    document.getElementById('about-bio-photo').value = info.bioPhoto || '';
    updatePreviewBg('about-bio-photo-preview', info.bioPhoto);
    
    // Fill Contact Details
    document.getElementById('contact-email-addr').value = info.contactEmail;
    document.getElementById('contact-phone-num').value = info.contactPhone;
    document.getElementById('contact-location').value = info.studioLocation;
    document.getElementById('contact-instagram').value = info.instagram;
    document.getElementById('contact-response-note-text').value = info.responseTimeNote;
    
    // Wire up save button
    const form = document.getElementById('homepage-edit-form');
    // Remove existing listeners to avoid duplicates
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    newForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const payload = {
        name: document.getElementById('home-brand-name').value,
        designerName: document.getElementById('home-designer-name').value,
        tagline: document.getElementById('home-tagline').value,
        philosophy: document.getElementById('home-philosophy').value,
        heroVideoUrl: document.getElementById('home-video-url').value,
        heroFallbackImg: document.getElementById('home-fallback-img').value,
        bio: document.getElementById('about-bio').value,
        bioPhoto: document.getElementById('about-bio-photo').value,
        contactEmail: document.getElementById('contact-email-addr').value,
        contactPhone: document.getElementById('contact-phone-num').value,
        studioLocation: document.getElementById('contact-location').value,
        instagram: document.getElementById('contact-instagram').value,
        responseTimeNote: document.getElementById('contact-response-note-text').value,
      };
      
      try {
        const putRes = await fetch('/api/site-info', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (putRes.ok) {
          showToast("General details updated successfully!");
        } else {
          showToast("Failed to save changes.", "error");
        }
      } catch (err) {
        console.error("Save site details failed:", err);
        showToast("Unexpected error occurred while saving.", "error");
      }
    });
  } catch (err) {
    console.error("Failed to load Homepage configuration form:", err);
  }
}

// ------------------ TAB: PORTFOLIO PROJECTS ------------------

async function loadProjectsTab() {
  try {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error("Failed to load projects");
    currentProjects = await res.json();
    
    renderProjectsTable();
    
    // Set up add new project button handler
    const addBtn = document.getElementById('btn-add-project');
    addBtn.onclick = () => openProjectModal(null);
    
  } catch (err) {
    console.error("Failed to fetch projects list:", err);
  }
}

function renderProjectsTable() {
  const tbody = document.getElementById('projects-table-body');
  if (!tbody) return;
  
  if (currentProjects.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; opacity: 0.6; padding: 30px;">No projects found. Create one by clicking the button above.</td></tr>`;
    return;
  }
  
  tbody.innerHTML = currentProjects.map((p, idx) => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 15px;">
          <img src="${p.coverImage || '/assets/project-living.jpg'}" alt="${p.title}" style="border: 1px solid var(--color-gray-light);">
          <span style="font-weight: 500;">${p.title}</span>
        </div>
      </td>
      <td>${p.category}</td>
      <td>${p.style}</td>
      <td>${p.featured ? '<span style="color: var(--color-ochre); font-weight: bold;">★ Yes</span>' : 'No'}</td>
      <td>
        <div class="order-controls">
          <button class="order-btn" onclick="moveProject(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>▲</button>
          <button class="order-btn" onclick="moveProject(${idx}, 1)" ${idx === currentProjects.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
      </td>
      <td>
        <div style="display: flex; gap: 10px;">
          <button class="action-btn-small" onclick="editProject('${p.id}')">Edit</button>
          <button class="action-btn-small action-btn-danger" onclick="deleteProject('${p.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function moveProject(index, dir) {
  const targetIndex = index + dir;
  if (targetIndex < 0 || targetIndex >= currentProjects.length) return;
  
  // Swap elements in current array
  const temp = currentProjects[index];
  currentProjects[index] = currentProjects[targetIndex];
  currentProjects[targetIndex] = temp;
  
  // Re-generate order integers based on current positions
  const orders = {};
  currentProjects.forEach((proj, idx) => {
    proj.order = idx + 1;
    orders[proj.id] = idx + 1;
  });
  
  renderProjectsTable();
  
  // Send reorder command to backend
  try {
    const res = await fetch('/api/projects/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders })
    });
    
    if (res.ok) {
      showToast("Projects order saved.");
    } else {
      showToast("Failed to save projects ordering.", "error");
    }
  } catch (err) {
    console.error("Reorder projects error:", err);
  }
}

async function editProject(id) {
  const project = currentProjects.find(p => p.id === id);
  if (project) {
    openProjectModal(project);
  }
}

async function deleteProject(id) {
  if (confirm("Are you sure you want to permanently delete this project? This action cannot be undone.")) {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast("Project deleted successfully");
        loadProjectsTab();
      } else {
        showToast("Failed to delete project.", "error");
      }
    } catch (err) {
      console.error("Delete project error:", err);
    }
  }
}

// ------------------ PROJECT DIALOG MODAL ------------------

let projectMaterialsList = [];
let projectGalleryImages = [];

function openProjectModal(project = null) {
  const modal = document.getElementById('project-modal');
  const title = document.getElementById('project-modal-title');
  const form = document.getElementById('project-edit-form');
  
  modal.classList.add('active');
  
  // Clear lists
  projectMaterialsList = [];
  projectGalleryImages = [];
  
  if (project) {
    title.textContent = "Edit Project: " + project.title;
    
    // Fill standard inputs
    document.getElementById('proj-id').value = project.id;
    document.getElementById('proj-title').value = project.title;
    document.getElementById('proj-category').value = project.category;
    document.getElementById('proj-room-type').value = project.roomType || 'other';
    document.getElementById('proj-style').value = project.style;
    document.getElementById('proj-description').value = project.description;
    document.getElementById('proj-story').value = project.story;
    document.getElementById('proj-cover-img').value = project.coverImage;
    updatePreviewBg('proj-cover-img-preview', project.coverImage);
    
    document.getElementById('proj-before-img').value = project.beforeImage || '';
    updatePreviewBg('proj-before-img-preview', project.beforeImage);
    
    document.getElementById('proj-after-img').value = project.afterImage || '';
    updatePreviewBg('proj-after-img-preview', project.afterImage);
    
    document.getElementById('proj-featured').checked = project.featured === true;
    document.getElementById('proj-order').value = project.order || 0;
    
    // Palette Colors
    const palette = project.palette || [];
    document.getElementById('proj-color-1').value = palette[0] || '#FAF6F0';
    document.getElementById('proj-color-2').value = palette[1] || '#D9A05B';
    document.getElementById('proj-color-3').value = palette[2] || '#C86B55';
    document.getElementById('proj-color-4').value = palette[3] || '#5C4033';
    
    // Materials
    projectMaterialsList = [...(project.materials || [])];
    
    // Gallery
    projectGalleryImages = [...(project.gallery || [])];
  } else {
    title.textContent = "Add New Project";
    
    // Reset standard inputs
    form.reset();
    document.getElementById('proj-id').value = '';
    updatePreviewBg('proj-cover-img-preview', '');
    updatePreviewBg('proj-before-img-preview', '');
    updatePreviewBg('proj-after-img-preview', '');
    
    // Set default palette values
    document.getElementById('proj-color-1').value = '#FAF6F0';
    document.getElementById('proj-color-2').value = '#D9A05B';
    document.getElementById('proj-color-3').value = '#C86B55';
    document.getElementById('proj-color-4').value = '#5C4033';
  }
  
  // Render sub lists
  renderMaterialsChips();
  renderGalleryPreviews();
  
  // Set up add material action
  const addMatBtn = document.getElementById('btn-add-material');
  const matInput = document.getElementById('proj-new-material');
  
  addMatBtn.onclick = () => {
    const val = matInput.value.trim();
    if (val && !projectMaterialsList.includes(val)) {
      projectMaterialsList.push(val);
      matInput.value = '';
      renderMaterialsChips();
    }
  };
  
  matInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addMatBtn.click();
    }
  };
  
  // Setup project form submission handler
  form.onsubmit = async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('proj-id').value;
    const isNew = !id;
    
    const palette = [
      document.getElementById('proj-color-1').value,
      document.getElementById('proj-color-2').value,
      document.getElementById('proj-color-3').value,
      document.getElementById('proj-color-4').value
    ];
    
    const payload = {
      title: document.getElementById('proj-title').value,
      category: document.getElementById('proj-category').value,
      roomType: document.getElementById('proj-room-type').value,
      style: document.getElementById('proj-style').value,
      description: document.getElementById('proj-description').value,
      story: document.getElementById('proj-story').value,
      coverImage: document.getElementById('proj-cover-img').value,
      beforeImage: document.getElementById('proj-before-img').value,
      afterImage: document.getElementById('proj-after-img').value,
      featured: document.getElementById('proj-featured').checked,
      order: parseInt(document.getElementById('proj-order').value) || 0,
      materials: projectMaterialsList,
      palette: palette,
      gallery: projectGalleryImages
    };
    
    const url = isNew ? '/api/projects' : `/api/projects/${id}`;
    const method = isNew ? 'POST' : 'PUT';
    
    try {
      const saveRes = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (saveRes.ok) {
        showToast(isNew ? "Project created successfully!" : "Project changes saved!");
        closeProjectModal();
        loadProjectsTab();
      } else {
        const errJson = await saveRes.json();
        showToast("Error saving project: " + (errJson.error || 'Server error'), "error");
      }
    } catch (err) {
      console.error("Save project failed:", err);
      showToast("Unexpected error while saving project.", "error");
    }
  };
}

function closeProjectModal() {
  document.getElementById('project-modal').classList.remove('active');
}

function renderMaterialsChips() {
  const container = document.getElementById('proj-materials-container');
  if (!container) return;
  
  if (projectMaterialsList.length === 0) {
    container.innerHTML = `<span style="font-size: 0.85rem; opacity: 0.5; padding: 4px;">No materials added yet...</span>`;
    return;
  }
  
  container.innerHTML = projectMaterialsList.map((m, idx) => `
    <div class="tag-chip">
      <span>${m}</span>
      <span class="remove-tag" onclick="removeMaterial(${idx})">&times;</span>
    </div>
  `).join('');
}

function removeMaterial(index) {
  projectMaterialsList.splice(index, 1);
  renderMaterialsChips();
}

function renderGalleryPreviews() {
  const container = document.getElementById('proj-gallery-container');
  if (!container) return;
  
  if (projectGalleryImages.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; font-size: 0.85rem; opacity: 0.5; padding: 10px 0;">No gallery images uploaded yet.</p>`;
    return;
  }
  
  container.innerHTML = projectGalleryImages.map((imgUrl, idx) => `
    <div style="position: relative; border: 1px solid var(--color-gray-medium); aspect-ratio: 4/3; background-image: url('${imgUrl}'); background-size: cover; background-position: center;">
      <button type="button" style="position: absolute; top: 5px; right: 5px; background: rgba(42,36,33,0.8); color: #FFF; width: 22px; height: 22px; border-radius: 50%; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; justify-content: center;" onclick="removeGalleryImage(${idx})">&times;</button>
    </div>
  `).join('');
}

function removeGalleryImage(index) {
  projectGalleryImages.splice(index, 1);
  renderGalleryPreviews();
}

// ------------------ TAB: SERVICES ------------------

async function loadServicesTab() {
  try {
    const res = await fetch('/api/services');
    if (!res.ok) throw new Error("Failed to load services");
    currentServices = await res.json();
    
    renderServicesList();
    
    // Add service button
    const addBtn = document.getElementById('btn-add-service-item');
    addBtn.onclick = () => {
      currentServices.push({
        id: `service-${Date.now()}`,
        name: "New Service Package",
        price: "Starting at $0",
        description: "Specify service details...",
        deliverables: ["Sample deliverable 1"]
      });
      renderServicesList();
    };
    
    // Form submit save action
    const form = document.getElementById('services-edit-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      
      // Re-compile currentServices values from UI elements
      const serviceItemsEls = document.querySelectorAll('.service-item-edit-box');
      const compiledServices = [];
      
      serviceItemsEls.forEach((box) => {
        const id = box.getAttribute('data-id');
        const name = box.querySelector('.field-serv-name').value;
        const price = box.querySelector('.field-serv-price').value;
        const description = box.querySelector('.field-serv-desc').value;
        
        // Deliverables list
        const deliverableInputs = box.querySelectorAll('.field-serv-deliverable');
        const deliverables = [];
        deliverableInputs.forEach(input => {
          const val = input.value.trim();
          if (val) deliverables.push(val);
        });
        
        compiledServices.push({ id, name, price, description, deliverables });
      });
      
      try {
        const putRes = await fetch('/api/services', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(compiledServices)
        });
        
        if (putRes.ok) {
          showToast("Services updated successfully!");
          loadServicesTab();
        } else {
          showToast("Failed to save services details.", "error");
        }
      } catch (err) {
        console.error("Save services error:", err);
        showToast("Unexpected error while saving services.", "error");
      }
    };
    
  } catch (err) {
    console.error("Failed to load services tab data:", err);
  }
}

function renderServicesList() {
  const container = document.getElementById('services-list-container');
  if (!container) return;
  
  if (currentServices.length === 0) {
    container.innerHTML = `<p style="opacity: 0.6; text-align: center; padding: 30px 0;">No services configured. Add one below.</p>`;
    return;
  }
  
  container.innerHTML = currentServices.map((s, sIdx) => `
    <div class="dynamic-list-item service-item-edit-box" data-id="${s.id}">
      <span class="remove-item-btn" onclick="removeServiceItem(${sIdx})">Remove Package</span>
      
      <div class="form-row" style="margin-bottom: 15px;">
        <div class="form-group">
          <label>Package Name</label>
          <input type="text" class="field-serv-name" value="${s.name}" required>
        </div>
        <div class="form-group">
          <label>Pricing Note (e.g. "Starting at $5,000" or "$300 / hour")</label>
          <input type="text" class="field-serv-price" value="${s.price}" required>
        </div>
      </div>
      
      <div class="form-group" style="margin-bottom: 15px;">
        <label>Description</label>
        <textarea class="field-serv-desc" rows="2" required>${s.description}</textarea>
      </div>
      
      <div class="form-group">
        <label>Deliverables (One line per bullet)</label>
        <div class="deliverables-inputs-container" id="del-container-${s.id}">
          ${(s.deliverables || []).map((del, dIdx) => `
            <div style="display: flex; gap: 10px; margin-bottom: 8px;">
              <input type="text" class="field-serv-deliverable" value="${del}" placeholder="Enter deliverable description...">
              <button type="button" class="action-btn-small action-btn-danger" style="padding: 10px;" onclick="removeDeliverable('${s.id}', ${dIdx})">&times;</button>
            </div>
          `).join('')}
        </div>
        <button type="button" class="btn-admin-secondary" style="padding: 8px 16px; font-size: 0.75rem; margin-top: 5px;" onclick="addDeliverableInput('${s.id}')">+ Add Deliverable Bullet</button>
      </div>
    </div>
  `).join('');
}

function removeServiceItem(index) {
  currentServices.splice(index, 1);
  renderServicesList();
}

function addDeliverableInput(serviceId) {
  const service = currentServices.find(s => s.id === serviceId);
  if (service) {
    if (!service.deliverables) service.deliverables = [];
    service.deliverables.push("");
    renderServicesList();
  }
}

function removeDeliverable(serviceId, index) {
  const service = currentServices.find(s => s.id === serviceId);
  if (service && service.deliverables) {
    service.deliverables.splice(index, 1);
    renderServicesList();
  }
}

// ------------------ TAB: TESTIMONIALS ------------------

async function loadTestimonialsTab() {
  try {
    const res = await fetch('/api/testimonials');
    if (!res.ok) throw new Error("Failed to load testimonials");
    currentTestimonials = await res.json();
    
    renderTestimonialsList();
    
    // Add testimonial button
    const addBtn = document.getElementById('btn-add-testimonial');
    addBtn.onclick = () => {
      currentTestimonials.push({
        id: `test-${Date.now()}`,
        clientName: "Client Name",
        projectTitle: "Project Title",
        quote: "Write testimonial quote here..."
      });
      renderTestimonialsList();
    };
    
    // Save testimonials
    const form = document.getElementById('testimonials-edit-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      
      const testimonialBoxes = document.querySelectorAll('.testimonial-edit-box');
      const compiledTestimonials = [];
      
      testimonialBoxes.forEach(box => {
        const id = box.getAttribute('data-id');
        const clientName = box.querySelector('.field-test-client').value;
        const projectTitle = box.querySelector('.field-test-project').value;
        const quote = box.querySelector('.field-test-quote').value;
        
        compiledTestimonials.push({ id, clientName, projectTitle, quote });
      });
      
      try {
        const putRes = await fetch('/api/testimonials', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(compiledTestimonials)
        });
        
        if (putRes.ok) {
          showToast("Testimonials updated successfully!");
          loadTestimonialsTab();
        } else {
          showToast("Failed to save testimonials.", "error");
        }
      } catch (err) {
        console.error("Save testimonials error:", err);
        showToast("Unexpected error while saving testimonials.", "error");
      }
    };
    
  } catch (err) {
    console.error("Failed to load testimonials:", err);
  }
}

function renderTestimonialsList() {
  const container = document.getElementById('testimonials-list-container');
  if (!container) return;
  
  if (currentTestimonials.length === 0) {
    container.innerHTML = `<p style="opacity: 0.6; text-align: center; padding: 30px 0;">No client testimonials added yet. Add one below.</p>`;
    return;
  }
  
  container.innerHTML = currentTestimonials.map((t, idx) => `
    <div class="dynamic-list-item testimonial-edit-box" data-id="${t.id}">
      <span class="remove-item-btn" onclick="removeTestimonialItem(${idx})">Remove Testimonial</span>
      
      <div class="form-row" style="margin-bottom: 15px;">
        <div class="form-group">
          <label>Client Name(s)</label>
          <input type="text" class="field-test-client" value="${t.clientName}" required>
        </div>
        <div class="form-group">
          <label>Project Title / Room Details</label>
          <input type="text" class="field-test-project" value="${t.projectTitle}" required>
        </div>
      </div>
      
      <div class="form-group">
        <label>Client Quote</label>
        <textarea class="field-test-quote" rows="3" required>${t.quote}</textarea>
      </div>
    </div>
  `).join('');
}

function removeTestimonialItem(index) {
  currentTestimonials.splice(index, 1);
  renderTestimonialsList();
}

// ------------------ TAB: MESSAGES / INQUIRIES ------------------

async function loadInquiriesTab() {
  try {
    const res = await fetch('/api/messages');
    if (!res.ok) throw new Error("Failed to load inquiries");
    currentInquiries = await res.json();
    
    renderInquiriesTable();
  } catch (err) {
    console.error("Failed to load inquiries list:", err);
  }
}

function renderInquiriesTable() {
  const tbody = document.getElementById('inquiries-table-body');
  if (!tbody) return;
  
  if (currentInquiries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; opacity: 0.6; padding: 35px;">No contact inquiries received yet.</td></tr>`;
    return;
  }
  
  tbody.innerHTML = currentInquiries.map((m) => {
    const dateStr = new Date(m.date).toLocaleDateString(undefined, { 
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    
    return `
      <tr class="${m.read ? '' : 'msg-row-unread'}" id="inquiry-row-${m.id}">
        <td>${!m.read ? '<span class="badge-unread">New</span> ' : ''}${m.name}</td>
        <td><a href="mailto:${m.email}">${m.email}</a></td>
        <td>${m.projectType}</td>
        <td>${dateStr}</td>
        <td>
          <div style="display: flex; gap: 10px;">
            <button class="action-btn-small" onclick="viewInquiry('${m.id}')">View Details</button>
            <button class="action-btn-small action-btn-danger" onclick="deleteInquiry('${m.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function viewInquiry(id) {
  const msg = currentInquiries.find(m => m.id === id);
  if (!msg) return;
  
  // Show dialog modal
  const modal = document.getElementById('inquiry-modal');
  modal.classList.add('active');
  
  const dateStr = new Date(msg.date).toLocaleString();
  
  document.getElementById('inquiry-detail-name').textContent = msg.name;
  document.getElementById('inquiry-detail-email').textContent = msg.email;
  document.getElementById('inquiry-detail-email').href = `mailto:${msg.email}`;
  document.getElementById('inquiry-detail-type').textContent = msg.projectType;
  document.getElementById('inquiry-detail-budget').textContent = msg.budget;
  document.getElementById('inquiry-detail-date').textContent = dateStr;
  document.getElementById('inquiry-detail-msg').textContent = msg.message;
  
  // Mark as read in backend if it was unread
  if (!msg.read) {
    try {
      const res = await fetch(`/api/messages/${id}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true })
      });
      
      if (res.ok) {
        msg.read = true;
        // update list visually
        const row = document.getElementById(`inquiry-row-${id}`);
        if (row) {
          row.classList.remove('msg-row-unread');
          const badge = row.querySelector('.badge-unread');
          if (badge) badge.remove();
        }
      }
    } catch (err) {
      console.error("Mark message read failed:", err);
    }
  }
}

function closeInquiryModal() {
  document.getElementById('inquiry-modal').classList.remove('active');
}

async function deleteInquiry(id) {
  if (confirm("Are you sure you want to delete this message submission?")) {
    try {
      const res = await fetch(`/api/messages/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast("Message deleted");
        loadInquiriesTab();
      } else {
        showToast("Failed to delete message", "error");
      }
    } catch (err) {
      console.error("Delete message error:", err);
    }
  }
}

// ------------------ TAB: SETTINGS (Change Password) ------------------

function initSettingsTab() {
  const form = document.getElementById('settings-password-form');
  const msgEl = document.getElementById('settings-feedback');
  
  if (form) {
    // Rebuild form element to strip previous submit listeners
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    newForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const currentPassword = document.getElementById('set-curr-pass').value;
      const newPassword = document.getElementById('set-new-pass').value;
      const confirmPassword = document.getElementById('set-new-pass-confirm').value;
      
      if (newPassword !== confirmPassword) {
        showToast("New passwords do not match", "error");
        return;
      }
      
      try {
        const res = await fetch('/api/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword })
        });
        
        const result = await res.json();
        
        if (res.ok && result.success) {
          showToast("Password updated successfully!");
          newForm.reset();
        } else {
          showToast(result.error || "Failed to update password", "error");
        }
      } catch (err) {
        console.error("Change password error:", err);
        showToast("Unexpected error occurred while changing password.", "error");
      }
    });
  }
}

// ------------------ IMAGE UPLOADS WIDGET FLOW ------------------

function initGlobalUploads() {
  // Wire up file inputs to automatically submit to upload API
  document.body.addEventListener('change', async (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'file') {
      const fileInput = e.target;
      const files = fileInput.files;
      if (files.length === 0) return;
      
      const targetInputId = fileInput.getAttribute('data-target');
      const previewId = fileInput.getAttribute('data-preview');
      const isMulti = fileInput.hasAttribute('multiple');
      
      const formData = new FormData();
      
      if (isMulti) {
        // Upload images in sequence or loop
        showToast("Uploading gallery files...");
        for (let i = 0; i < files.length; i++) {
          const singleData = new FormData();
          singleData.append('image', files[i]);
          
          try {
            const res = await fetch('/api/upload', {
              method: 'POST',
              body: singleData
            });
            const data = await res.json();
            if (res.ok && data.success) {
              projectGalleryImages.push(data.url);
            } else {
              showToast(`Failed to upload ${files[i].name}`, "error");
            }
          } catch (err) {
            console.error("Gallery upload error:", err);
          }
        }
        renderGalleryPreviews();
        showToast("Gallery files uploaded successfully!");
        fileInput.value = ''; // reset file picker
      } else {
        // Single file upload
        formData.append('image', files[0]);
        const uploadLabel = fileInput.closest('.image-upload-wrapper')?.querySelector('.btn-upload');
        const originalText = uploadLabel ? uploadLabel.textContent : "Upload Image";
        
        if (uploadLabel) uploadLabel.textContent = "Uploading...";
        
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
          
          const data = await res.json();
          
          if (res.ok && data.success) {
            // Update the hidden target input text
            const targetInput = document.getElementById(targetInputId);
            if (targetInput) {
              targetInput.value = data.url;
              // Trigger input event to update anything listening
              targetInput.dispatchEvent(new Event('input'));
            }
            
            // Update preview background image
            updatePreviewBg(previewId, data.url);
            showToast("Image uploaded and optimized successfully!");
          } else {
            showToast(data.error || "Upload failed", "error");
          }
        } catch (err) {
          console.error("Upload error:", err);
          showToast("Connection error while uploading.", "error");
        } finally {
          if (uploadLabel) uploadLabel.textContent = originalText;
        }
      }
    }
  });
}

function updatePreviewBg(previewId, imgUrl) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  
  if (imgUrl) {
    preview.style.backgroundImage = `url('${imgUrl}')`;
    preview.innerHTML = ''; // Clear text placeholder
  } else {
    preview.style.backgroundImage = 'none';
    preview.innerHTML = 'No Image';
  }
}
