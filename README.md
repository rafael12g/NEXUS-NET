# 🌐 Nexus NET - Universal Network Architect

**Nexus NET** is a network mapping and infrastructure management tool for sysadmins, network architects, and DevOps. The interface is modern, dark, and designed to build complex topologies and control Docker from the browser.

> **Status:** This project is **in development**.

---

## ✨ Key Features

### 🐳 Docker Management
- **Docker nodes:** Add Docker containers to network diagrams (Docker icon)
- **Selective import:** Choose which containers to add from a list
- **Auto-generate diagram:** Adds all containers and creates a diagram automatically
- **Real-time status:** Color-coded status:
  - 🟢 Running
  - 🔴 Stopped/Exited
  - 🟡 Paused/Restarting
  - ⚪ Not connected
- **Direct actions:** Start/Stop/Restart via the inspector
- **Per-container monitoring:** CPU/RAM displayed on Docker nodes
- **REST API:** Docker Engine via `dockerode`

### 🗺️ Enhanced Interface (Draw.io style)
- **Minimap:** Overview of the network at bottom-right with quick navigation
- **Dynamic legend:** Collapsible panel showing all equipment types in the diagram
- **Live stats:**
  - Total nodes
  - Total connections
  - Docker containers state (Running/Stopped)
- **Improved navigation:**
  - Clear +/- zoom buttons
  - "Fit to Screen" button
  - Keyboard shortcut `F` to center the view

### 🎨 Design & UX
- **Dark mode UI:** Professional design to reduce eye strain
- **Customization:** Accent color can be changed in Settings
- **Physics engine:** Nodes auto-organize with optional freeze
- **Magnetic grid:** Auto-align equipment for clean diagrams
- **Alignment tools:** Buttons to align a selection vertically or horizontally

### 🛠️ Create & Edit
- **Full library:** Servers, Routers, Switches, Firewalls, Cloud, PCs, Printers, Docker Containers, etc.
- **Custom images:** Import your own logos or images
- **Zones & notes:** Create colored zones with **transparency (opacity)** for VLANs or rooms (DMZ, Prod, etc.)
- **Advanced cabling:**
  - RJ45 (solid)
  - Fiber (colored)
  - Wi‑Fi / Virtual (dashed)
  - Edit links *after* creation (color/width changes)

### 💾 Save & Export
- **Auto-save:** Changes are saved automatically on the server
- **JSON export:** Full project backup to transfer
- **Draw.io (XML) export:** Generates a file compatible with [diagrams.net](https://app.diagrams.net/)
- **PDF & PNG export:** High-definition report generation

---

## 🚀 Installation

### Prerequisites
- Node.js 18+
- npm
- Docker (optional, for container management)
- MySQL database

### Install
```bash
# Clone the repo
git clone https://github.com/rafael12g/NEXUS-NET.git
cd NEXUS-NET

# Install dependencies
npm install

# Configure environment (create a .env file)
# See Configuration below
```

### Configuration (.env)

Create a `.env` file at the project root with your database settings:

```env
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=nexus_net
PORT=3000
SESSION_SECRET=your_secure_secret
```

### Database

The database is initialized automatically from `schema.sql` on first start. You can also import it manually if needed.

### Run

```bash
# Start the server
npm start
```

Or on Windows, simply double‑click `start.bat`.

The server starts at `http://localhost:3000`.

### Docker Configuration (Optional)

To enable Docker management, ensure Docker Engine is accessible:

**Linux/Mac:**
- The Unix socket `/var/run/docker.sock` must be accessible
- The Node.js user must have Docker permissions

**Windows:**
- Docker Desktop must be installed and running
- The app connects automatically via the named pipe `//./pipe/docker_engine` (secure)

**Connection test:** verify Docker responds with `docker ps`.

### Docker Compose (recommended)

Use `docker-compose.yml` (DB auto‑initialized + app):
- DB exposed locally on `127.0.0.1:3306`
- CPU/RAM limits + log rotation
- env vars (DB_*, COOKIE_SECURE, TRUST_PROXY)

---

## 📖 Quick Start Guide

### 1. Add Devices
Use the left panel. Enter a **Name**, an **IP** (optional), choose a **Type**, then click the corresponding button.

### 2. Import Docker Containers
1. Click **"Selective Import"** in the Docker section
2. A window opens with the container list
3. Click a container to add it to the diagram
4. Status and stats are synced

### 3. Manage Docker Containers
1. Click a Docker node in the diagram
2. The inspector opens on the right with Docker controls
3. Use Start/Stop/Restart to control the container
4. Click "Refresh" to update status

### 4. Connect Devices (2 Methods)
* **Quick method (Lightning):** Hold `Ctrl` and click two devices to select them, then click the ⚡ button
* **Manual method:** Select source and destination from dropdowns and click `CONNECT`

### 5. Edit Properties
Click any object (Server, PC, or Cable). The **Inspector** opens on the right.
* Change IP, color, size
* Adjust opacity to create background zones
* Change cable style (solid vs dashed)

### 6. Navigate Large Diagrams
- **Minimap:** Use the bottom‑right minimap for quick navigation
- **Zoom:** Use +/- buttons (top-right) or mouse wheel
- **Fit to Screen:** Click the expand button to fit the diagram
- **Key F:** Press `F` to center the view

### 7. Manage Files
* **Drag & drop:** Drop a saved `.json` file anywhere on the page to open it
* **Draw.io:** Click the orange `Export to Draw.io` button, then open diagrams.net and choose the generated `.xml`

---

## ⌨️ Keyboard & Mouse Shortcuts

| Action | Shortcut / Gesture |
| :--- | :--- |
| **Multi‑select** | `Ctrl` + **Left Click** (or drag a selection box) |
| **Delete** | `Delete` key |
| **Close menu/inspector** | `Esc` key |
| **Center view** | `F` key |
| **Context menu** | **Right click** on a device |
| **Zoom in/out** | Mouse wheel or +/- buttons |
| **Pan** | Left click and drag on empty space |

---

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express
- **MySQL** for data persistence
- **Dockerode** for Docker integration
- **bcrypt** for password security
- **EJS** for template rendering

### Frontend
- **HTML5 / CSS3 / Vanilla JavaScript**
- **Vis-Network:** Graph rendering + physics engine
- **jsPDF:** PDF generation
- **FontAwesome 6:** Vector icons (including fa-docker)
- **Google Fonts:** Inter & JetBrains Mono

---

## 🔌 Docker API

The app exposes a REST API to interact with Docker:

```
GET  /api/docker/containers            - List all containers
GET  /api/docker/containers/:id/status  - Container status
GET  /api/docker/containers/:id/stats   - Container CPU/RAM
POST /api/docker/containers/:id/start   - Start a container
POST /api/docker/containers/:id/stop    - Stop a container
POST /api/docker/containers/:id/restart - Restart a container
GET  /api/docker/networks               - List Docker networks
```

---

## 🔧 Troubleshooting

### Docker unavailable
If you see "Docker unavailable":
1. Ensure Docker is installed and running: `docker ps`
2. On Linux/Mac, check socket permissions: `ls -l /var/run/docker.sock`
3. On Windows, make sure Docker Desktop is running
4. Restart the NEXUS-NET server after fixing the issue

### Database connection error
1. Check your `.env` settings
2. Ensure MySQL is running
3. Verify the database was created with `schema.sql`

---

## 📝 Credits & License

Made with ❤️ to simplify the life of network admins and DevOps.

**Version: 2.0.0** - Docker Integration & Enhanced UI

---

## 🗺️ Roadmap

### Version 3.0.0 (Upcoming)
- Alerts and notifications
- Kubernetes support
- Advanced themes (light/dark)
- Multi‑user collaboration mode

