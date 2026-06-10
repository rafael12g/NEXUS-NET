'use strict';

/* ============================================================================
 * Nexus NET — Éditeur de plan réseau
 * Tout le code est externe (compatible CSP strict). Les actions de l'interface
 * passent par des attributs data-action gérés par délégation d'événements.
 * ========================================================================== */

(function () {
    // --- Contexte injecté par le serveur ------------------------------------
    const PLAN_ID = document.body.dataset.planId;
    const CSRF_TOKEN = document.body.dataset.csrf;

    // --- Configuration --------------------------------------------------------
    const ICONS = {
        server:   { code: '\uf233', fa: 'fa-solid fa-server' },
        router:   { code: '\uf0ec', fa: 'fa-solid fa-network-wired' },
        switch:   { code: '\uf2db', fa: 'fa-solid fa-microchip' },
        firewall: { code: '\uf132', fa: 'fa-solid fa-shield-halved' },
        cloud:    { code: '\uf0c2', fa: 'fa-solid fa-cloud' },
        db:       { code: '\uf1c0', fa: 'fa-solid fa-database' },
        pc:       { code: '\uf108', fa: 'fa-solid fa-desktop' },
        printer:  { code: '\uf02f', fa: 'fa-solid fa-print' },
        wifi:     { code: '\uf1eb', fa: 'fa-solid fa-wifi' },
        note:     { code: '\uf249', fa: 'fa-solid fa-sticky-note' },
        docker:   { code: '\uf395', fa: 'fa-brands fa-docker' }
    };

    const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#38bdf8', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#ffffff', '#94a3b8', '#475569', '#0f172a'];
    const DOCKER_BLUE = '#2496ED';

    // --- État ------------------------------------------------------------------
    const nodes = new vis.DataSet([]);
    const edges = new vis.DataSet([]);
    let network = null;
    let selectedNodeId = null;
    let selectedEdgeId = null;
    let magnetMode = false;
    let linkMode = false;

    const $ = (id) => document.getElementById(id);

    // --- Utilitaires --------------------------------------------------------------
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    function getStatusColor(state) {
        const s = String(state || '').toLowerCase();
        if (s === 'running') return '#4ade80';
        if (s === 'paused' || s === 'restarting') return '#fbbf24';
        if (s === 'stopped' || s === 'exited') return '#f87171';
        return '#94a3b8';
    }

    function formatDockerLabel(data) {
        const name = escapeHtml(data.name || 'Container');
        const fallbackState = data.dockerId ? 'unknown' : 'non lié';
        const state = escapeHtml(data.dockerState || fallbackState);
        const ip = data.ip ? `\n${escapeHtml(data.ip)}` : '';

        let statsLine = '';
        if (data.dockerStats && Number.isFinite(data.dockerStats.cpuPercent) && Number.isFinite(data.dockerStats.memPercent)) {
            statsLine = `\nCPU ${Math.round(data.dockerStats.cpuPercent)}% • RAM ${Math.round(data.dockerStats.memPercent)}%`;
        }
        return `\n<b>${name}</b>${ip}\n${state}${statsLine}`;
    }

    function showToast(message) {
        const t = $('toast');
        t.textContent = message;
        t.style.opacity = 1;
        t.style.bottom = '40px';
        setTimeout(() => { t.style.opacity = 0; t.style.bottom = '30px'; }, 2000);
    }

    function downloadFile(content, name, type) {
        const blob = new Blob([content], { type });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    async function apiFetch(url, options = {}) {
        const opts = { ...options, headers: { ...(options.headers || {}) } };
        if (opts.method && opts.method !== 'GET') {
            opts.headers['x-csrf-token'] = CSRF_TOKEN;
        }
        const res = await fetch(url, opts);
        return res.json();
    }

    // --- Sauvegarde -----------------------------------------------------------------
    let saving = false;
    async function savePlan(notify) {
        if (saving) return;
        saving = true;
        try {
            const result = await apiFetch(`/api/plans/${PLAN_ID}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: { nodes: nodes.get(), edges: edges.get() } })
            });
            if (result.success) {
                if (notify) showToast('Sauvegardé sur le serveur');
            } else {
                showToast('Erreur de sauvegarde : ' + (result.error || 'inconnue'));
            }
        } catch {
            showToast('Erreur réseau');
        } finally {
            saving = false;
        }
    }

    // --- Palettes de couleurs ----------------------------------------------------------
    function buildPalette(containerId, hiddenInputId, onPick) {
        const palette = $(containerId);
        const input = $(hiddenInputId);
        if (!palette) return;
        palette.innerHTML = '';
        COLORS.forEach((c) => {
            const div = document.createElement('div');
            div.style.cssText = `width:20px; height:20px; background:${c}; border-radius:3px; cursor:pointer; border:1px solid #334155;`;
            if (input && input.value === c) div.style.borderColor = '#fff';
            div.addEventListener('click', () => {
                if (input) input.value = c;
                Array.from(palette.children).forEach((ch) => { ch.style.borderColor = '#334155'; });
                div.style.borderColor = '#fff';
                if (onPick) onPick(c);
            });
            palette.appendChild(div);
        });
    }

    // --- Nœuds & arêtes -------------------------------------------------------------------
    function addNode(type) {
        const labelInput = $('nodeLabel').value;
        const label = labelInput || (type === 'note' ? 'Note' : type.charAt(0).toUpperCase() + type.slice(1));
        const ip = $('nodeIP').value;
        const color = type === 'docker' ? DOCKER_BLUE : $('nodeColor').value;

        const node = {
            id: Date.now(),
            label: `\n<b>${escapeHtml(label)}</b>` + (ip ? `\n${escapeHtml(ip)}` : ''),
            _data: { name: label, ip, type, color, size: 45, opacity: 100 }
        };

        if (type === 'note') {
            node.shape = 'box';
            node.color = { background: color, border: color };
            node.font = { color: '#000', size: 16, strokeWidth: 0, multi: false };
            node.label = label;
        } else {
            const def = ICONS[type] || ICONS.server;
            const fontFace = type === 'docker' ? "'Font Awesome 6 Brands'" : "'Font Awesome 6 Free'";
            node.icon = { code: def.code, color, face: fontFace };
            node._data.fa = def.fa;
        }

        nodes.add(node);
        updateSelects();
        savePlan(false);
        $('nodeLabel').value = '';
        $('nodeIP').value = '';
    }

    function addCustomImageNode(imgBase64) {
        const label = $('nodeLabel').value || 'Image';
        nodes.add({
            id: Date.now(),
            label: `<b>${escapeHtml(label)}</b>`,
            shape: 'image',
            image: imgBase64,
            size: 50,
            _data: { name: label, ip: '', type: 'custom', color: '#ffffff', size: 50, opacity: 100, isCustom: true, img: imgBase64 }
        });
        updateSelects();
        savePlan(false);
        $('nodeLabel').value = '';
    }

    function connectSelectedNodes() {
        const selection = network.getSelectedNodes();
        if (selection.length !== 2) return alert('Sélectionnez 2 nœuds (Ctrl+Clic).');
        edges.add({ from: selection[0], to: selection[1] });
        savePlan(false);
        showToast('Lien créé');
    }

    function addEdge() {
        const f = $('fromNode').value;
        const t = $('toNode').value;
        if (f && t && f !== t) {
            edges.add({ from: f, to: t });
            savePlan(false);
        }
    }

    function deleteSelected() {
        if (selectedNodeId) { nodes.remove(selectedNodeId); updateSelects(); }
        if (selectedEdgeId) edges.remove(selectedEdgeId);
        closeInspector();
        savePlan(false);
    }

    function updateSelects() {
        const s1 = $('fromNode');
        const s2 = $('toNode');
        s1.innerHTML = '<option value="">De…</option>';
        s2.innerHTML = '<option value="">Vers…</option>';
        nodes.get().forEach((n) => {
            const name = n._data ? n._data.name : n.label;
            [s1, s2].forEach((sel) => {
                const op = document.createElement('option');
                op.value = n.id;
                op.textContent = name;
                sel.appendChild(op);
            });
        });
    }

    // --- Inspecteur --------------------------------------------------------------------------
    function openNodeInspector(id) {
        selectedNodeId = id;
        selectedEdgeId = null;
        const node = nodes.get(id);
        const d = node._data || {};

        $('inspector').style.display = 'block';
        $('insp-content-node').style.display = 'block';
        $('insp-content-edge').style.display = 'none';

        $('edit-name').value = d.name || '';
        $('edit-ip').value = d.ip || '';
        $('edit-color').value = d.color || '#ffffff';

        buildPalette('editColorPalette', 'edit-color', () => updateNode());

        const op = d.opacity !== undefined ? d.opacity : 100;
        $('edit-opacity').value = op;
        $('opacity-val').textContent = op + '%';

        let s = node.size || (node.icon ? node.icon.size : 45);
        if (node.font && node.shape === 'box') s = node.font.size;
        $('edit-size').value = Math.round(s || 45);

        const dockerControls = $('docker-controls');
        if (d.type === 'docker') {
            dockerControls.style.display = 'block';
            if (d.dockerId) refreshDockerStatus();
            else $('docker-status-text').textContent = 'Container non lié';
        } else {
            dockerControls.style.display = 'none';
        }
    }

    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function updateNode() {
        if (!selectedNodeId) return;
        const name = $('edit-name').value;
        const ip = $('edit-ip').value;
        const color = $('edit-color').value;
        const size = parseInt($('edit-size').value, 10) || 45;
        const opacity = parseInt($('edit-opacity').value, 10);
        $('opacity-val').textContent = opacity + '%';

        const node = nodes.get(selectedNodeId);
        if (!node) return;
        const d = node._data || {};
        const updateObj = { id: selectedNodeId, _data: { ...d, name, ip, color, size, opacity } };
        const alpha = opacity / 100;

        if (node.shape === 'box') {
            updateObj.label = name;
            updateObj.color = { background: hexToRgba(color, alpha), border: color };
            updateObj.font = { ...node.font, size };
        } else {
            updateObj.label = d.type === 'docker'
                ? formatDockerLabel({ ...d, name, ip })
                : `\n<b>${escapeHtml(name)}</b>` + (ip ? `\n${escapeHtml(ip)}` : '');
            if (node.shape === 'image') updateObj.size = size;
            else updateObj.icon = { ...node.icon, color: hexToRgba(color, alpha), size };
        }
        nodes.update(updateObj);
        savePlanDebounced();
    }

    function openEdgeInspector(id) {
        selectedEdgeId = id;
        selectedNodeId = null;
        const edge = edges.get(id);
        $('inspector').style.display = 'block';
        $('insp-content-node').style.display = 'none';
        $('insp-content-edge').style.display = 'block';
        $('edit-edge-color').value = edge.color ? (edge.color.color || edge.color) : '#64748b';
        $('edit-edge-width').value = edge.width || 2;
        $('edit-edge-type').value = edge.dashes ? 'dashed' : 'solid';
    }

    function updateEdge() {
        if (!selectedEdgeId) return;
        const c = $('edit-edge-color').value;
        const w = parseInt($('edit-edge-width').value, 10);
        const t = $('edit-edge-type').value;
        edges.update({ id: selectedEdgeId, color: { color: c, highlight: c }, width: w, dashes: t === 'dashed' });
        savePlanDebounced();
    }

    function closeInspector() {
        $('inspector').style.display = 'none';
        selectedNodeId = null;
        selectedEdgeId = null;
        if (network) network.unselectAll();
    }

    // Débounce pour éviter de spammer le serveur pendant la frappe
    let saveTimer = null;
    function savePlanDebounced() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => savePlan(false), 800);
    }

    // --- Modes & alignement ---------------------------------------------------------------------
    function toggleMagnet() {
        magnetMode = !magnetMode;
        $('btnMagnet').classList.toggle('active', magnetMode);
    }

    function toggleLinkMode() {
        linkMode = !linkMode;
        const container = $('network-container');
        $('btnLinkMode').classList.toggle('active', linkMode);
        if (linkMode) {
            container.style.cursor = 'crosshair';
            network.addEdgeMode();
        } else {
            container.style.cursor = 'default';
            network.disableEditMode();
        }
    }

    function toggleGrid() {
        $('network-container').classList.toggle('grid-bg');
        network.redraw();
    }

    function snapToGrid(nodeIds) {
        const gridSize = 40;
        const positions = network.getPositions(nodeIds);
        nodes.update(nodeIds.map((id) => ({
            id,
            x: Math.round(positions[id].x / gridSize) * gridSize,
            y: Math.round(positions[id].y / gridSize) * gridSize
        })));
    }

    function alignNodes(direction) {
        const selected = network.getSelectedNodes();
        if (selected.length < 2) return alert('Sélectionnez au moins 2 nœuds.');
        const positions = network.getPositions(selected);

        if (direction === 'UD') {
            const avgX = selected.reduce((sum, id) => sum + positions[id].x, 0) / selected.length;
            nodes.update(selected.map((id) => ({ id, x: avgX })));
        } else {
            const avgY = selected.reduce((sum, id) => sum + positions[id].y, 0) / selected.length;
            nodes.update(selected.map((id) => ({ id, y: avgY })));
        }
        savePlan(false);
    }

    function searchNetwork() {
        const term = $('searchNode').value.toLowerCase();
        if (term.length < 2) return;
        const found = nodes.get().find((n) =>
            (n._data && n._data.name && n._data.name.toLowerCase().includes(term)) ||
            (n.label && String(n.label).toLowerCase().includes(term))
        );
        if (found) {
            network.selectNodes([found.id]);
            network.focus(found.id, { scale: 1.5, animation: true });
            openNodeInspector(found.id);
        }
    }

    // --- Exports ---------------------------------------------------------------------------------
    function exportJSON() {
        downloadFile(JSON.stringify({ nodes: nodes.get(), edges: edges.get() }, null, 2), 'nexus.json', 'application/json');
    }

    function exportPDF() {
        network.fit({ animation: false });
        setTimeout(() => {
            const cvs = document.querySelector('#network-container canvas');
            const pdf = new window.jspdf.jsPDF('l', 'mm', 'a4');
            pdf.addImage(cvs.toDataURL('image/jpeg', 1.0), 'JPEG', 10, 10, 280, 150);
            pdf.save('schema.pdf');
        }, 500);
    }

    function escapeXml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }

    function exportDrawIO() {
        try {
            const allNodes = nodes.get();
            const allEdges = edges.get();
            const positions = network.getPositions(allNodes.map((n) => n.id));

            let xml = '<?xml version="1.0" encoding="UTF-8"?>';
            xml += '<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">';
            xml += '<root><mxCell id="0"/><mxCell id="1" parent="0"/>';

            allNodes.forEach((n) => {
                const pos = positions[n.id];
                const d = n._data || {};
                const color = n.color ? (n.color.background || n.color) : (d.color || '#ffffff');
                const label = escapeXml(d.name || '');
                const size = d.size || 45;

                let style;
                if (n.shape === 'image' && d.img) {
                    style = `shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;image=${d.img};`;
                } else if (n.shape === 'box') {
                    style = `shape=rectangle;whiteSpace=wrap;html=1;fillColor=${color};strokeColor=${(n.color && n.color.border) || color};opacity=${d.opacity || 100};`;
                } else {
                    style = `rounded=1;whiteSpace=wrap;html=1;fillColor=${color};strokeColor=none;fontColor=#ffffff;`;
                }

                xml += `<mxCell id="${n.id}" value="${label}" style="${escapeXml(style)}" vertex="1" parent="1">`;
                xml += `<mxGeometry x="${pos.x}" y="${pos.y}" width="${size}" height="${size}" as="geometry"/></mxCell>`;
            });

            allEdges.forEach((e) => {
                const color = e.color ? (e.color.color || e.color) : '#000000';
                let style = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=${color};strokeWidth=${e.width || 2};`;
                if (e.dashes) style += 'dashed=1;';
                xml += `<mxCell id="edge_${e.id}" edge="1" parent="1" source="${e.from}" target="${e.to}" style="${escapeXml(style)}">`;
                xml += '<mxGeometry relative="1" as="geometry"/></mxCell>';
            });

            xml += '</root></mxGraphModel>';
            downloadFile(xml, 'nexus_export.xml', 'application/xml');
        } catch (err) {
            console.error('Export error', err);
            alert("Erreur lors de l'export Draw.io");
        }
    }

    function loadFile(file) {
        if (!file) return;
        const r = new FileReader();
        r.onload = (e) => {
            try {
                const d = JSON.parse(e.target.result);
                if (!Array.isArray(d.nodes) || !Array.isArray(d.edges)) throw new Error('format');
                nodes.clear();
                edges.clear();
                nodes.add(d.nodes);
                edges.add(d.edges);
                updateSelects();
                showToast('Fichier chargé');
                savePlan(false);
            } catch {
                alert('Fichier JSON invalide');
            }
        };
        r.readAsText(file);
    }

    // --- Docker -----------------------------------------------------------------------------------
    async function generateDockerSchema() {
        if (!confirm('Cela va ajouter tous vos containers et les relier au nœud hôte. Continuer ?')) return;
        try {
            const result = await apiFetch('/api/docker/containers');
            if (!result.success) return showToast(result.error || 'Docker non disponible');

            const containers = result.containers;
            if (containers.length === 0) return showToast('Aucun container trouvé');

            const radius = 200 + containers.length * 20;
            const hostId = Date.now();

            nodes.add({
                id: hostId,
                label: '\n<b>Docker Host</b>',
                icon: { code: ICONS.server.code, color: '#ffffff', face: "'Font Awesome 6 Free'" },
                x: 0, y: 0,
                _data: { name: 'Docker Host', type: 'server', color: '#ffffff', size: 45, opacity: 100 }
            });

            const newNodes = containers.map((c, index) => {
                const angle = (index / containers.length) * 2 * Math.PI;
                const color = getStatusColor(c.state);
                const nodeId = hostId + index + 1;

                edges.add({ from: hostId, to: nodeId, color: { color: '#64748b' }, width: 1, dashes: true });

                return {
                    id: nodeId,
                    label: formatDockerLabel({ name: c.name, dockerState: c.state, ip: '' }),
                    x: radius * Math.cos(angle),
                    y: radius * Math.sin(angle),
                    icon: { code: ICONS.docker.code, color, face: "'Font Awesome 6 Brands'" },
                    _data: { name: c.name, ip: '', type: 'docker', color, size: 45, opacity: 100, dockerId: c.id, dockerState: c.state }
                };
            });

            nodes.add(newNodes);
            updateSelects();
            savePlan(false);
            network.fit({ animation: true });
            showToast(`${containers.length} containers générés`);
        } catch (err) {
            console.error(err);
            showToast('Erreur lors de la génération');
        }
    }

    async function importFromDocker() {
        try {
            const result = await apiFetch('/api/docker/containers');
            if (!result.success) return showToast(result.error || 'Docker non disponible');

            const containers = result.containers;
            if (containers.length === 0) return showToast('Aucun container trouvé');

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';

            const content = document.createElement('div');
            content.className = 'modal-content';

            const title = document.createElement('h2');
            title.style.cssText = 'margin-top:0; color:var(--text-primary);';
            title.textContent = 'Importer des containers Docker';
            content.appendChild(title);

            const list = document.createElement('div');
            list.style.cssText = 'display:flex; flex-direction:column; gap:10px;';

            containers.forEach((c) => {
                const statusColor = getStatusColor(c.state);
                const item = document.createElement('div');
                item.style.cssText = `padding:12px; background:rgba(0,0,0,0.3); border-radius:6px; border-left:3px solid ${statusColor}; cursor:pointer;`;

                const nameDiv = document.createElement('div');
                nameDiv.style.cssText = 'font-weight:600; color:var(--text-primary);';
                nameDiv.textContent = c.name;

                const infoDiv = document.createElement('div');
                infoDiv.style.cssText = 'font-size:11px; color:var(--text-secondary);';
                infoDiv.textContent = `Image : ${c.image} | État : ${c.state}`;

                item.append(nameDiv, infoDiv);
                item.addEventListener('click', () => {
                    addDockerContainer(c.id, c.name, c.state);
                    modal.remove();
                });
                list.appendChild(item);
            });
            content.appendChild(list);

            const closeBtn = document.createElement('button');
            closeBtn.className = 'btn-ghost';
            closeBtn.style.cssText = 'margin-top:20px; width:100%;';
            closeBtn.textContent = 'Fermer';
            closeBtn.addEventListener('click', () => modal.remove());
            content.appendChild(closeBtn);

            modal.appendChild(content);
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
            document.body.appendChild(modal);
        } catch (err) {
            console.error(err);
            showToast("Erreur lors de l'import Docker");
        }
    }

    function addDockerContainer(dockerId, containerName, state) {
        const color = getStatusColor(state);
        nodes.add({
            id: Date.now(),
            label: formatDockerLabel({ name: containerName, dockerState: state, ip: '' }),
            icon: { code: ICONS.docker.code, color, face: "'Font Awesome 6 Brands'" },
            _data: { name: containerName, ip: '', type: 'docker', color, size: 45, opacity: 100, dockerId, dockerState: state }
        });
        updateSelects();
        savePlan(false);
        showToast(`Container ${containerName} ajouté`);
    }

    function updateDockerStatusUI(state, text) {
        const colors = { running: '#4ade80', stopped: '#f87171', paused: '#fbbf24', restarting: '#fbbf24', disconnected: '#94a3b8' };
        $('docker-status-indicator').style.background = colors[state] || '#94a3b8';
        $('docker-status-text').textContent = text;
    }

    async function refreshDockerStatus() {
        if (!selectedNodeId) return;
        const node = nodes.get(selectedNodeId);
        const d = (node && node._data) || {};
        if (!d.dockerId) return showToast('Container non lié');

        try {
            const result = await apiFetch(`/api/docker/containers/${d.dockerId}/status`);
            if (!result.success) return updateDockerStatusUI('disconnected', 'Non trouvé');

            const status = result.status;
            let state, text;
            if (status.running) { state = 'running'; text = 'Running'; }
            else if (status.paused) { state = 'paused'; text = 'Paused'; }
            else if (status.restarting) { state = 'restarting'; text = 'Restarting'; }
            else { state = 'stopped'; text = 'Stopped'; }

            updateDockerStatusUI(state, text);

            const newColor = getStatusColor(text);
            nodes.update({
                id: selectedNodeId,
                _data: { ...d, dockerState: text, color: newColor },
                icon: { ...node.icon, color: newColor },
                label: formatDockerLabel({ ...d, dockerState: text })
            });
        } catch (err) {
            console.error(err);
            updateDockerStatusUI('disconnected', 'Erreur');
        }
    }

    async function dockerAction(action) {
        if (!selectedNodeId) return;
        const node = nodes.get(selectedNodeId);
        const d = (node && node._data) || {};
        if (!d.dockerId) return showToast('Container non lié');

        try {
            const result = await apiFetch(`/api/docker/containers/${d.dockerId}/${action}`, { method: 'POST' });
            if (result.success) {
                showToast(result.message);
                setTimeout(refreshDockerStatus, 500);
            } else {
                showToast('Erreur : ' + result.error);
            }
        } catch (err) {
            console.error(err);
            showToast('Erreur de connexion');
        }
    }

    async function refreshDockerStatsForNode(nodeId) {
        const node = nodes.get(nodeId);
        if (!node || !node._data || node._data.type !== 'docker' || !node._data.dockerId) return;

        try {
            const result = await apiFetch(`/api/docker/containers/${node._data.dockerId}/stats`);
            if (!result.success) return;
            const d = node._data;
            nodes.update({
                id: nodeId,
                _data: { ...d, dockerStats: result.stats || {} },
                label: formatDockerLabel({ ...d, dockerStats: result.stats || {} })
            });
        } catch (err) {
            console.error('Docker stats error', err);
        }
    }

    function refreshDockerStatsAll() {
        nodes.get().forEach((n) => {
            if (n._data && n._data.type === 'docker' && n._data.dockerId) {
                refreshDockerStatsForNode(n.id);
            }
        });
    }

    // --- Statistiques, légende, minimap ----------------------------------------------------------
    function updateStatistics() {
        $('stat-nodes').textContent = nodes.length;
        $('stat-edges').textContent = edges.length;

        let running = 0, stopped = 0;
        nodes.get().forEach((n) => {
            if (n._data && n._data.type === 'docker') {
                if (String(n._data.dockerState || '').toLowerCase().includes('running')) running++;
                else stopped++;
            }
        });
        $('stat-docker-running').textContent = running;
        $('stat-docker-stopped').textContent = stopped;
    }

    const LEGEND_STYLES = {
        docker:   { icon: 'fab fa-docker', color: '#0ea5e9' },
        server:   { icon: 'fas fa-server', color: '#ffffff' },
        switch:   { icon: 'fas fa-microchip', color: '#a8a29e' },
        router:   { icon: 'fas fa-network-wired', color: '#f59e0b' },
        firewall: { icon: 'fas fa-shield-halved', color: '#ef4444' },
        cloud:    { icon: 'fas fa-cloud', color: '#94a3b8' },
        db:       { icon: 'fas fa-database', color: '#c084fc' },
        pc:       { icon: 'fas fa-desktop', color: '#38bdf8' },
        printer:  { icon: 'fas fa-print', color: '#94a3b8' },
        wifi:     { icon: 'fas fa-wifi', color: '#4ade80' },
        note:     { icon: 'fas fa-sticky-note', color: '#fbbf24' },
        custom:   { icon: 'fas fa-image', color: '#94a3b8' }
    };

    function updateLegend() {
        const legend = $('legend-content');
        if (!legend) return;
        legend.innerHTML = '';

        const types = new Set();
        nodes.get().forEach((n) => { if (n._data && n._data.type) types.add(n._data.type); });

        if (types.size === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'font-size:10px; color:var(--text-secondary); text-align:center;';
            empty.textContent = 'Aucun élément';
            legend.appendChild(empty);
            return;
        }

        types.forEach((type) => {
            const style = LEGEND_STYLES[type] || { icon: 'fas fa-circle', color: '#38bdf8' };
            const item = document.createElement('div');
            item.className = 'legend-item';

            const icon = document.createElement('i');
            icon.className = style.icon;
            icon.style.cssText = `color:${style.color}; width:20px; text-align:center;`;

            const span = document.createElement('span');
            span.textContent = type.charAt(0).toUpperCase() + type.slice(1);

            item.append(icon, span);
            legend.appendChild(item);
        });
    }

    function updateMinimap() {
        const canvas = $('minimap-canvas');
        if (!canvas || !network) return;

        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const positions = network.getPositions();
        const nodeIds = Object.keys(positions);
        if (nodeIds.length === 0) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        nodeIds.forEach((id) => {
            const pos = positions[id];
            minX = Math.min(minX, pos.x); maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y); maxY = Math.max(maxY, pos.y);
        });

        const width = maxX - minX || 100;
        const height = maxY - minY || 100;
        const scale = Math.min((rect.width - 20) / width, (rect.height - 20) / height);

        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        edges.get().forEach((edge) => {
            const f = positions[edge.from];
            const t = positions[edge.to];
            if (f && t) {
                ctx.beginPath();
                ctx.moveTo((f.x - minX) * scale + 10, (f.y - minY) * scale + 10);
                ctx.lineTo((t.x - minX) * scale + 10, (t.y - minY) * scale + 10);
                ctx.stroke();
            }
        });

        ctx.fillStyle = '#38bdf8';
        nodeIds.forEach((id) => {
            const pos = positions[id];
            ctx.beginPath();
            ctx.arc((pos.x - minX) * scale + 10, (pos.y - minY) * scale + 10, 3, 0, 2 * Math.PI);
            ctx.fill();
        });

        const viewport = network.getViewPosition();
        const viewScale = network.getScale();
        const containerRect = $('network-container').getBoundingClientRect();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            (viewport.x - minX) * scale + 10,
            (viewport.y - minY) * scale + 10,
            (containerRect.width / viewScale) * scale,
            (containerRect.height / viewScale) * scale
        );
    }

    // --- Règles -------------------------------------------------------------------------------------
    function drawRulers(scale, translation) {
        const topCanvas = $('ruler-top');
        const leftCanvas = $('ruler-left');
        const container = $('network-container');
        if (!topCanvas || !leftCanvas) return;

        if (topCanvas.width !== container.offsetWidth) topCanvas.width = container.offsetWidth;
        if (topCanvas.height !== 20) topCanvas.height = 20;
        if (leftCanvas.width !== 20) leftCanvas.width = 20;
        if (leftCanvas.height !== container.offsetHeight) leftCanvas.height = container.offsetHeight;

        const ctxT = topCanvas.getContext('2d');
        const ctxL = leftCanvas.getContext('2d');
        ctxT.clearRect(0, 0, topCanvas.width, topCanvas.height);
        ctxL.clearRect(0, 0, leftCanvas.width, leftCanvas.height);
        ctxT.fillStyle = '#94a3b8'; ctxL.fillStyle = '#94a3b8';
        ctxT.font = '10px Inter'; ctxL.font = '10px Inter';

        let step = 100;
        if (scale > 2) step = 20;
        else if (scale > 0.8) step = 50;
        else if (scale <= 0.4) step = 200;

        const firstX = Math.floor((-translation.x / scale) / step) * step;
        const firstY = Math.floor((-translation.y / scale) / step) * step;

        for (let x = firstX; ; x += step) {
            const screenX = x * scale + translation.x;
            if (screenX > topCanvas.width) break;
            if (screenX < 20) continue;
            ctxT.beginPath();
            ctxT.moveTo(screenX, 15);
            ctxT.lineTo(screenX, 20);
            ctxT.strokeStyle = '#64748b';
            ctxT.stroke();
            ctxT.fillText(x, screenX + 2, 12);
        }

        for (let y = firstY; ; y += step) {
            const screenY = y * scale + translation.y;
            if (screenY > leftCanvas.height) break;
            if (screenY < 20) continue;
            ctxL.beginPath();
            ctxL.moveTo(15, screenY);
            ctxL.lineTo(20, screenY);
            ctxL.strokeStyle = '#64748b';
            ctxL.stroke();
            ctxL.save();
            ctxL.translate(12, screenY + 2);
            ctxL.rotate(-Math.PI / 2);
            ctxL.fillText(y, 0, 0);
            ctxL.restore();
        }

        ctxT.fillStyle = '#1e293b'; ctxT.fillRect(0, 0, 20, 20);
        ctxL.fillStyle = '#1e293b'; ctxL.fillRect(0, 0, 20, 20);
    }

    // --- Interaction personnalisée (sélection, pan, redimensionnement) -----------------------------
    function setupInteraction(container) {
        const selectionBox = $('selectionBox');
        let isSelecting = false;
        let isPanning = false;
        let isResizing = false;
        let resizeNodeId = null;
        let resizeHandle = null;
        let resizeStartSize = 0;
        let resizeStartPos = { x: 0, y: 0 };
        let startPos = { x: 0, y: 0 };
        let lastPos = { x: 0, y: 0 };

        function getNodeHandles(nodeId) {
            const bb = network.getBoundingBox(nodeId);
            const p = 5;
            return {
                tl: { x: bb.left - p, y: bb.top - p },
                tr: { x: bb.right + p, y: bb.top - p },
                bl: { x: bb.left - p, y: bb.bottom + p },
                br: { x: bb.right + p, y: bb.bottom + p }
            };
        }

        container.addEventListener('mousedown', (e) => {
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // 1. Poignées de redimensionnement
            try {
                for (const id of network.getSelectedNodes()) {
                    const handles = getNodeHandles(id);
                    for (const h in handles) {
                        const domPos = network.canvasToDOM(handles[h]);
                        const dist = Math.hypot(mouseX - domPos.x, mouseY - domPos.y);
                        if (dist < 20) {
                            isResizing = true;
                            resizeNodeId = id;
                            resizeHandle = h;
                            const node = nodes.get(id);
                            let currentSize = 45;
                            if (node.shape === 'box' && node.font && node.font.size) currentSize = node.font.size;
                            else if (node.shape === 'image' && node.size) currentSize = node.size;
                            else if (node.icon && node.icon.size) currentSize = node.icon.size;
                            else if (node.size) currentSize = node.size;
                            resizeStartSize = currentSize;
                            resizeStartPos = { x: e.clientX, y: e.clientY };
                            e.stopPropagation();
                            e.preventDefault();
                            return;
                        }
                    }
                }
            } catch { /* ignore */ }

            // 2. Clic sur nœud/arête ou mode liaison → laisser vis-network gérer
            const pointer = { x: mouseX, y: mouseY };
            if (network.getNodeAt(pointer) !== undefined || network.getEdgeAt(pointer) !== undefined || linkMode) return;

            // 3. Boîte de sélection (clic gauche) ou pan (clic droit)
            if (e.button === 0) {
                isSelecting = true;
                startPos = { x: mouseX, y: mouseY };
                selectionBox.style.left = startPos.x + 'px';
                selectionBox.style.top = startPos.y + 'px';
                selectionBox.style.width = '0px';
                selectionBox.style.height = '0px';
                selectionBox.style.display = 'block';
                e.stopPropagation();
                e.preventDefault();
            } else if (e.button === 2) {
                isPanning = true;
                lastPos = { x: e.clientX, y: e.clientY };
                container.style.cursor = 'grabbing';
                e.stopPropagation();
                e.preventDefault();
            }
        }, true);

        window.addEventListener('mousemove', (e) => {
            if (isResizing) {
                const dx = e.clientX - resizeStartPos.x;
                const dy = e.clientY - resizeStartPos.y;
                let delta = 0;
                if (resizeHandle === 'br') delta = (dx + dy) / 2;
                else if (resizeHandle === 'tl') delta = -(dx + dy) / 2;
                else if (resizeHandle === 'tr') delta = (dx - dy) / 2;
                else if (resizeHandle === 'bl') delta = (-dx + dy) / 2;

                let newSize = Math.min(300, Math.max(10, resizeStartSize + delta * 0.5));
                const node = nodes.get(resizeNodeId);
                if (!node) return;

                const d = node._data || {};
                const updateObj = { id: resizeNodeId, _data: { ...d, size: newSize } };
                if (node.shape === 'box') updateObj.font = { ...(node.font || {}), size: newSize };
                else if (node.shape === 'image') updateObj.size = newSize;
                else updateObj.icon = { ...(node.icon || {}), size: newSize };
                nodes.update(updateObj);

                if (selectedNodeId === resizeNodeId) $('edit-size').value = Math.round(newSize);
                e.preventDefault();
            } else if (isSelecting) {
                const rect = container.getBoundingClientRect();
                const currentX = e.clientX - rect.left;
                const currentY = e.clientY - rect.top;
                selectionBox.style.left = Math.min(startPos.x, currentX) + 'px';
                selectionBox.style.top = Math.min(startPos.y, currentY) + 'px';
                selectionBox.style.width = Math.abs(currentX - startPos.x) + 'px';
                selectionBox.style.height = Math.abs(currentY - startPos.y) + 'px';
            } else if (isPanning) {
                const dx = e.clientX - lastPos.x;
                const dy = e.clientY - lastPos.y;
                lastPos = { x: e.clientX, y: e.clientY };
                const t = network.body.view.translation;
                network.body.view.translation = { x: t.x + dx, y: t.y + dy };
                network.redraw();
            } else {
                // Curseur au survol des poignées
                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                let overHandle = false;
                try {
                    for (const id of network.getSelectedNodes()) {
                        const handles = getNodeHandles(id);
                        for (const h in handles) {
                            const domPos = network.canvasToDOM(handles[h]);
                            if (Math.hypot(mouseX - domPos.x, mouseY - domPos.y) < 20) {
                                overHandle = true;
                                container.style.cursor = (h === 'tl' || h === 'br') ? 'nwse-resize' : 'nesw-resize';
                                break;
                            }
                        }
                        if (overHandle) break;
                    }
                } catch { /* ignore */ }
                if (!overHandle && !linkMode && !isPanning) container.style.cursor = 'default';
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (isResizing) {
                isResizing = false;
                savePlan(false);
            } else if (isSelecting) {
                isSelecting = false;
                const rect = selectionBox.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                selectionBox.style.display = 'none';

                const selectRect = {
                    left: rect.left - containerRect.left,
                    top: rect.top - containerRect.top,
                    right: rect.right - containerRect.left,
                    bottom: rect.bottom - containerRect.top
                };

                const selectedIds = [];
                nodes.get().forEach((n) => {
                    const pos = network.getPositions([n.id])[n.id];
                    if (!pos) return;
                    const domPos = network.canvasToDOM(pos);
                    if (domPos.x >= selectRect.left && domPos.x <= selectRect.right &&
                        domPos.y >= selectRect.top && domPos.y <= selectRect.bottom) {
                        selectedIds.push(n.id);
                    }
                });

                if (e.ctrlKey) {
                    const current = network.getSelectedNodes();
                    network.selectNodes([...new Set([...current, ...selectedIds])]);
                } else {
                    network.selectNodes(selectedIds);
                }
            } else if (isPanning) {
                isPanning = false;
                container.style.cursor = 'default';
            }
        });

        container.addEventListener('contextmenu', (e) => e.preventDefault());

        return { getNodeHandles };
    }

    // --- Initialisation -------------------------------------------------------------------------------
    function init() {
        buildPalette('colorPalette', 'nodeColor');
        // Couleur par défaut : bleu ciel
        const palette = $('colorPalette');
        if (palette.children[6]) palette.children[6].click();

        // Chargement des données du plan
        try {
            const rawEl = $('plan-data-json');
            if (rawEl && rawEl.textContent.trim() !== 'null') {
                let parsed = JSON.parse(rawEl.textContent);
                if (typeof parsed === 'string') parsed = JSON.parse(parsed);
                if (parsed && parsed.nodes) nodes.add(parsed.nodes);
                if (parsed && parsed.edges) edges.add(parsed.edges);
                updateSelects();
            }
        } catch (e) {
            console.error('Erreur de chargement du plan', e);
        }

        const container = $('network-container');
        const options = {
            nodes: {
                shape: 'icon',
                icon: { face: "'Font Awesome 6 Free'", weight: '900', size: 45, color: '#fff' },
                font: { face: 'Inter', color: '#fff', size: 14, strokeWidth: 4, strokeColor: '#0f172a', multi: 'html', vadjust: 4 },
                shadow: { enabled: true, color: 'rgba(0,0,0,0.5)' }
            },
            edges: {
                width: 2,
                color: { color: '#64748b', highlight: '#38bdf8' },
                smooth: { type: 'continuous', roundness: 0.2 }
            },
            physics: { enabled: false },
            interaction: { hover: true, multiselect: true, navigationButtons: false, dragView: false },
            manipulation: {
                enabled: true,
                initiallyActive: false,
                addNode: false,
                addEdge(data, callback) {
                    if (data.from !== data.to) {
                        callback(data);
                        savePlan(false);
                    } else {
                        callback(null);
                    }
                    if (linkMode) setTimeout(() => network.addEdgeMode(), 50);
                },
                editEdge: false,
                deleteNode: false,
                deleteEdge: false,
                controlNodeStyle: {
                    shape: 'dot', size: 6,
                    color: { background: '#38bdf8', border: '#0f172a' },
                    borderWidth: 2
                }
            }
        };

        network = new vis.Network(container, { nodes, edges }, options);
        const { getNodeHandles } = setupInteraction(container);

        // Limites de zoom
        network.on('zoom', (params) => {
            if (params.scale < 0.2) network.moveTo({ scale: 0.2, animation: false });
            if (params.scale > 4.0) network.moveTo({ scale: 4.0, animation: false });
            updateMinimap();
        });

        network.on('afterDrawing', (ctx) => {
            const scale = network.getScale();
            const translation = network.body.view.translation;

            if (container.classList.contains('grid-bg')) {
                if (scale < 0.2) {
                    container.style.backgroundImage = 'none';
                } else {
                    container.style.backgroundImage = '';
                    const gridSize = 40 * scale;
                    container.style.backgroundSize = `${gridSize}px ${gridSize}px`;
                    container.style.backgroundPosition = `${translation.x}px ${translation.y}px`;
                }
            } else {
                container.style.backgroundImage = '';
                container.style.backgroundSize = '';
                container.style.backgroundPosition = '';
            }

            drawRulers(scale, translation);

            // Poignées de sélection
            const selected = network.getSelectedNodes();
            selected.forEach((id) => {
                const bb = network.getBoundingBox(id);
                const p = 5;
                ctx.beginPath();
                ctx.lineWidth = 1;
                ctx.strokeStyle = '#38bdf8';
                ctx.setLineDash([5, 5]);
                ctx.rect(bb.left - p, bb.top - p, (bb.right - bb.left) + 2 * p, (bb.bottom - bb.top) + 2 * p);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = '#38bdf8';
                const handles = getNodeHandles(id);
                for (const h in handles) {
                    ctx.beginPath();
                    ctx.arc(handles[h].x, handles[h].y, 4, 0, 2 * Math.PI);
                    ctx.fill();
                }
            });
        });

        network.on('click', (params) => {
            if (params.nodes.length > 0) openNodeInspector(params.nodes[0]);
            else if (params.edges.length > 0) openEdgeInspector(params.edges[0]);
            else closeInspector();
        });

        network.on('dragEnd', (params) => {
            if (magnetMode && params.nodes.length > 0) snapToGrid(params.nodes);
            savePlan(false);
            updateMinimap();
        });
        network.on('dragStart', updateMinimap);

        nodes.on('*', () => { updateStatistics(); updateLegend(); updateMinimap(); });
        edges.on('*', () => { updateStatistics(); updateMinimap(); });

        // Sauvegarde automatique toutes les 30 s
        setInterval(() => savePlan(false), 30000);
        // Stats Docker toutes les 4 s
        setInterval(refreshDockerStatsAll, 4000);

        // Import d'image personnalisée
        $('customImg').addEventListener('change', (e) => {
            const f = e.target.files[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = (ev) => addCustomImageNode(ev.target.result);
            r.readAsDataURL(f);
            e.target.value = '';
        });

        // Chargement de fichier JSON
        $('fileLoader').addEventListener('change', (e) => {
            loadFile(e.target.files[0]);
            e.target.value = '';
        });

        // Glisser-déposer
        const dz = $('dropZone');
        document.body.addEventListener('dragover', (e) => { e.preventDefault(); dz.style.display = 'flex'; });
        dz.addEventListener('dragleave', (e) => { e.preventDefault(); dz.style.display = 'none'; });
        dz.addEventListener('drop', (e) => {
            e.preventDefault();
            dz.style.display = 'none';
            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith('.json')) loadFile(file);
        });

        // Recherche
        $('searchNode').addEventListener('input', searchNetwork);

        // Champs de l'inspecteur
        ['edit-name', 'edit-ip', 'edit-opacity', 'edit-size'].forEach((id) => {
            $(id).addEventListener('input', updateNode);
        });
        $('edit-edge-color').addEventListener('input', updateEdge);
        $('edit-edge-width').addEventListener('input', updateEdge);
        $('edit-edge-type').addEventListener('change', updateEdge);

        // Raccourcis clavier
        document.addEventListener('keydown', (e) => {
            const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
            if (e.key === 'Delete' && !typing) deleteSelected();
            if ((e.key === 'f' || e.key === 'F') && !typing) {
                network.fit();
                e.preventDefault();
            }
            if (e.key === 'Escape') closeInspector();
        });

        // Délégation des actions data-action
        const actions = {
            'fit': () => network.fit(),
            'zoom-in': () => network.moveTo({ scale: network.getScale() * 1.2 }),
            'zoom-out': () => network.moveTo({ scale: network.getScale() * 0.8 }),
            'toggle-grid': toggleGrid,
            'toggle-link': toggleLinkMode,
            'toggle-magnet': toggleMagnet,
            'align-v': () => alignNodes('UD'),
            'align-h': () => alignNodes('LR'),
            'add-node': (btn) => addNode(btn.dataset.type),
            'pick-image': () => $('customImg').click(),
            'docker-import': importFromDocker,
            'docker-generate': generateDockerSchema,
            'docker-start': () => dockerAction('start'),
            'docker-stop': () => dockerAction('stop'),
            'docker-restart': () => dockerAction('restart'),
            'docker-refresh': refreshDockerStatus,
            'connect-selected': connectSelectedNodes,
            'add-edge': addEdge,
            'save': () => savePlan(true),
            'open': () => $('fileLoader').click(),
            'export-drawio': exportDrawIO,
            'export-json': exportJSON,
            'export-pdf': exportPDF,
            'delete-selected': deleteSelected,
            'close-inspector': closeInspector
        };

        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const fn = actions[btn.dataset.action];
            if (fn) fn(btn);
        });

        // Premier rendu
        updateStatistics();
        updateLegend();
        setTimeout(updateMinimap, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
