# Sun Soul Style — Premium Interior Designer Portfolio Website

An elegant, editorial-style portfolio website built for a boutique interior design studio. Designed with soft neutral tones, raw wood details, and natural light to convey calm luxury and tactile refinement.

Features a lightweight, self-contained Express + JSON database CMS backend with a password-protected administrative panel allowing the designer to easily manage all site content with zero coding or redevelopment.

## Key Features

- **Homepage**: Full-bleed hero image/video, signature serif philosophy quote, featured projects grid with visual hover cards, curated Instagram strip, testimonials carousel, and newsletter call-to-action.
- **Dynamic Portfolio Grid**: Interactive filters (all, full-home, kitchen, bedroom, dining-room) and slide-up transition entries.
- **Bespoke Case Studies**: Case-study template displaying concept narratives, material lists, customized color palettes, double-column masonry galleries, and an interactive **Before & After comparison slider**.
- **Services**: Service offering columns detailing inclusions and rates.
- **Contact Inquiry**: Responsive booking form with project type and budget dropdown selectors.
- **Administrative CMS (/admin)**: Password-protected, custom administrative dashboard matching the studio brand aesthetics. Includes:
  - **Overview**: Active listing stats.
  - **Home & Bio Settings**: Update header taglines, video links, bios, social handles, and response notes.
  - **Portfolio Projects**: Create, edit, delete, and **reorder** (up/down sorting) projects, customize color palettes, material tags, cover photos, before/after compare images, and multiple gallery uploads.
  - **Design Packages**: Edit packages, description details, and add/remove deliverable bullet lists.
  - **Client Notes**: Manage testimonials, quotes, and client names.
  - **Inquiries Inbox**: Read, delete, and manage unread bookings.
  - **Auto-Optimization**: Images uploaded via CMS are resized, converted to `WebP` and compressed in real-time by the backend using `Sharp`.

---

## Tech Stack

- **Frontend**: Semantic HTML5, Vanilla JavaScript, and Custom CSS3 (flexible variables, smooth transitions, custom cursors, scroll reveals).
- **Backend**: Node.js & Express (API controllers, session cookies, cookie-parser).
- **Database**: Atomic transactional JSON file-store (`db.json` / `db.js`) for zero-configuration, zero-maintenance portability.
- **Upload pipeline**: Multer (memory buffer storage) + Sharp (real-time WebP optimization and scaling).

---

## Getting Started

### Prerequisites
- Node.js (v16.0 or higher)

### Setup & Run
1. Navigate into the project folder:
   ```cmd
   cd "C:\Users\Lenovo\OneDrive\Desktop\sun_soul_style"
   ```
2. Install dependencies (Express, Multer, Sharp):
   ```cmd
   npm install
   ```
3. Launch the server:
   ```cmd
   npm start
   ```
4. Open your web browser and navigate to:
   - **Main Website**: [http://localhost:3000](http://localhost:3000)
   - **Admin Control Panel**: [http://localhost:3000/admin](http://localhost:3000/admin)

### Admin Credentials
- **Username**: `admin`
- **Password**: `admin123`
- *Note: You can update the password in the Dashboard Security tab inside the admin panel.*

---

## Project Structure

- `server.js`: API routes, upload controllers, static servers.
- `db.js`: Database atomic writes and seeding engine.
- `db.json`: JSON database storage holding all active website text, list data, and submissions.
- `public/`:
  - `index.html`: Homepage structure.
  - `projects.html`: Portfolio grid listing.
  - `project-detail.html`: Case study page template.
  - `about.html`: Biography page.
  - `services.html`: Packages page.
  - `contact.html`: Inquiries form.
  - `login.html`: Admin login card.
  - `admin.html`: Administrative dashboard workspace.
  - `css/`: Theme files (`style.css`, `admin.css`).
  - `js/`: Script files (`main.js`, `admin.js`).
  - `assets/`: SVGs and seed images (covers, gallery, designer portrait, logo).
  - `uploads/`: optimized client uploads.
