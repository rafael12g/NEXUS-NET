# 🌐 Nexus NET - IN DEV

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

### Install
>**Check the wiki for more info**.
```bash
# Clone the repo
git clone https://github.com/rafael12g/NEXUS-NET.git
cd NEXUS-NET

# Install dependencies
npm install

# Configure environment (create a .env file)
# See Configuration below
```

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

## 🗺️ Roadmap

### Version 3.0.0 (Upcoming)
- Alerts and notifications
- Kubernetes support
- Advanced themes (light/dark)
- Multi‑user collaboration mode

---

## 📝 Credits & License

Made with ❤️ to simplify the life of network admins and DevOps.
