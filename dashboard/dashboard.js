/**
 * NMS Dashboard v0.5.2
 * Neurobiological Memory System - Knowledge Graph Visualization
 */

// ========================================
// STATE
// ========================================
let graph = null;
let config = null;
let stats = null;
let simulation = null;
let svg = null;
let currentTheme = 'dark';
let currentFilter = 'all';
let selectedNode = null;

// ========================================
// INITIALIZATION
// ========================================
async function init() {
  console.log('🚀 Initializing NMS Dashboard v0.5.2...');

  // Load theme from localStorage
  loadTheme();

  // Load data
  await Promise.all([
    loadGraph(),
    loadConfig(),
    loadStats()
  ]);

  // Setup UI components
  setupThemeToggle();
  setupSearch();
  setupFilters();
  setupTimeline();
  setupImport();
  setupModal();
  setupHnswToggle();
  setupGangliaModal();
  setupGangliaEditModal();

  // Render visualizations
  renderGraph();
  renderTopConcepts();
  renderHealthDashboard();
  updateStatistics();
  loadGangliaList();

  console.log('✅ Dashboard initialized');
}

// ========================================
// DATA LOADING
// ========================================
async function loadGraph() {
  try {
    const response = await fetch('/api/graph');
    graph = await response.json();
    console.log(`📊 Loaded graph: ${Object.keys(graph.nodes).length} nodes, ${Object.keys(graph.edges).length} edges`);

    // Update header stats
    document.getElementById('header-nodes').textContent = Object.keys(graph.nodes).length;
    document.getElementById('header-edges').textContent = Object.keys(graph.edges).length;
  } catch (error) {
    console.error('Error loading graph:', error);
    showNotification('Failed to load graph', 'error');
  }
}

async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    config = await response.json();
    console.log(`⚙️ Config loaded: mode=${config.mode}, HNSW=${config.hnswEnabled}`);
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    stats = await response.json();
    console.log(`📊 Stats loaded:`, stats);
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// ========================================
// THEME MANAGEMENT
// ========================================
function loadTheme() {
  const savedTheme = localStorage.getItem('nms-theme') || 'dark';
  currentTheme = savedTheme;
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  const html = document.documentElement;
  const moonIcon = document.getElementById('moonIcon');
  const sunIcon = document.getElementById('sunIcon');

  if (theme === 'dark') {
    html.classList.remove('light');
    moonIcon.classList.remove('hidden');
    sunIcon.classList.add('hidden');
  } else {
    html.classList.add('light');
    moonIcon.classList.add('hidden');
    sunIcon.classList.remove('hidden');
  }

  console.log(`✅ Theme switched to: ${theme}`);
}

function setupThemeToggle() {
  const toggleBtn = document.getElementById('themeToggle');

  toggleBtn.addEventListener('click', () => {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    currentTheme = newTheme;
    applyTheme(newTheme);
    localStorage.setItem('nms-theme', newTheme);
  });
}

// ========================================
// GRAPH VISUALIZATION (D3.js)
// ========================================
function renderGraph() {
  if (!graph) return;

  const container = document.getElementById('graph-container');
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Clear previous
  d3.select('#graph-container svg').remove();

  // Create SVG
  svg = d3.select('#graph-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  // Zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });

  svg.call(zoom);

  // Group for graph elements
  const g = svg.append('g');

  // Prepare data
  const nodes = Object.entries(graph.nodes).map(([id, node]) => ({
    id,
    ...node,
    x: width / 2 + (Math.random() - 0.5) * 200,
    y: height / 2 + (Math.random() - 0.5) * 200
  }));

  // Filter orphaned links
  const nodeIds = new Set(nodes.map(n => n.id));
  const allLinks = Object.entries(graph.edges).map(([id, edge]) => ({
    id,
    source: edge.source,
    target: edge.target,
    ...edge
  }));

  const links = allLinks.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

  if (allLinks.length - links.length > 0) {
    console.warn(`⚠️ Filtered ${allLinks.length - links.length} orphaned links`);
  }

  // Force simulation with performance optimizations
  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(100))
    .force('charge', d3.forceManyBody()
      .strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(30))
    .alphaDecay(0.05) // Faster stabilization
    .velocityDecay(0.4); // More friction

  // Draw links
  const link = g.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('class', 'link')
    .attr('stroke-width', d => Math.sqrt(d.weight * 3) || 1);

  // Draw nodes
  const node = g.append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('class', 'node')
    .attr('r', d => {
      const connections = links.filter(l =>
        l.source.id === d.id || l.target.id === d.id
      ).length;
      return Math.max(8, Math.min(20, 8 + connections * 2));
    })
    .attr('fill', d => {
      const weight = d.weight || 0.5;
      return d3.interpolateBlues(weight);
    })
    .attr('stroke', '#30363d')
    .attr('stroke-width', 2)
    .call(drag(simulation))
    .on('mouseover', (event, d) => handleNodeHover(event, d, node, link))
    .on('mouseout', (event, d) => handleNodeOut(event, d, node, link))
    .on('click', (event, d) => handleNodeClick(event, d));

  // Labels (hidden by default, shown on hover)
  const label = g.append('g')
    .selectAll('text')
    .data(nodes)
    .join('text')
    .attr('class', 'node-label')
    .text(d => {
      const name = d.name || d.id;
      return name.length > 20 ? name.substring(0, 20) + '...' : name;
    })
    .attr('opacity', 0);

  // Update positions on tick (throttled for performance)
  let tickCount = 0;
  simulation.on('tick', () => {
    tickCount++;

    // Update every 2nd tick for better performance
    if (tickCount % 2 === 0) {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      label
        .attr('x', d => d.x)
        .attr('y', d => d.y - 15);
    }
  });

  // Stop simulation after stabilization to save resources
  simulation.on('end', () => {
    console.log('✅ Simulation stabilized');
  });

  // Store for later use
  window.graphElements = { nodes: node, links: link, labels: label, simulation };

  // Setup controls
  document.getElementById('resetZoom').addEventListener('click', () => {
    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
  });

  document.getElementById('refreshGraph').addEventListener('click', async () => {
    await loadGraph();
    renderGraph();
    renderTopConcepts();
    updateStatistics();
  });

  console.log('✅ Graph rendered');
}

// Drag behavior
function drag(simulation) {
  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }

  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}

// Node interaction handlers
function handleNodeHover(event, d, nodes, links) {
  d3.select(event.target).classed('highlighted', true);

  window.graphElements.labels
    .filter(label => label.id === d.id)
    .attr('opacity', 1);

  window.graphElements.links
    .classed('highlighted', l =>
      l.source.id === d.id || l.target.id === d.id
    );
}

function handleNodeOut(event, d, nodes, links) {
  d3.select(event.target).classed('highlighted', false);

  window.graphElements.labels
    .filter(label => label.id === d.id)
    .attr('opacity', 0);

  window.graphElements.links.classed('highlighted', false);
}

function handleNodeClick(event, d) {
  selectedNode = d;
  showNodeDetails(d);
}

// ========================================
// TOP CONCEPTS
// ========================================
function renderTopConcepts() {
  if (!graph) return;

  const container = document.getElementById('topConcepts');
  const nodes = Object.entries(graph.nodes)
    .map(([id, node]) => ({ id, ...node }))
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))
    .slice(0, 15);

  if (nodes.length === 0) {
    container.innerHTML = '<div class="text-sm text-dark-muted text-center py-4">No concepts yet</div>';
    return;
  }

  container.innerHTML = nodes.map((node, index) => `
    <div class="flex items-center justify-between p-2 rounded-lg hover:bg-dark-bg cursor-pointer transition-colors group" data-node-id="${node.id}">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <span class="text-xs text-dark-muted w-5">${index + 1}</span>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">${node.name || node.id}</div>
          <div class="text-xs text-dark-muted">${node.type || 'concept'}</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="text-xs text-dark-muted">${(node.weight || 0).toFixed(2)}</div>
        <button class="opacity-0 group-hover:opacity-100 transition-opacity text-dark-muted hover:text-dark-accent" onclick="focusNode('${node.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  // Add click handlers
  container.querySelectorAll('[data-node-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        const nodeId = el.dataset.nodeId;
        const node = graph.nodes[nodeId];
        if (node) {
          showNodeDetails({ id: nodeId, ...node });
        }
      }
    });
  });
}

// Focus node in graph
window.focusNode = function(nodeId) {
  // TODO: Implement zoom to node
  console.log('Focus node:', nodeId);
};

// ========================================
// HEALTH DASHBOARD
// ========================================
async function renderHealthDashboard() {
  try {
    const response = await fetch('/api/health');
    const health = await response.json();

    // Update health score
    const score = health.healthScore || 0;
    document.getElementById('healthScore').textContent = `${score}%`;
    document.getElementById('healthBar').style.width = `${score}%`;

    // Change color based on score
    const healthBar = document.getElementById('healthBar');
    if (score >= 80) {
      healthBar.className = 'bg-green-500 h-2 rounded-full transition-all duration-500';
    } else if (score >= 60) {
      healthBar.className = 'bg-yellow-500 h-2 rounded-full transition-all duration-500';
    } else {
      healthBar.className = 'bg-red-500 h-2 rounded-full transition-all duration-500';
    }

    // Update issues
    const issuesContainer = document.getElementById('healthIssues');
    const totalIssues = (health.issues?.lowConfidence || 0) +
                       (health.issues?.flagged || 0) +
                       (health.issues?.orphanedLinks || 0);

    const goodNodes = health.totalNodes - totalIssues;

    issuesContainer.innerHTML = `
      <div class="space-y-2 text-xs">
        <div class="flex justify-between">
          <span class="text-dark-muted">✅ Healthy nodes</span>
          <span class="font-semibold">${goodNodes}</span>
        </div>
        ${health.issues?.lowConfidence > 0 ? `
          <div class="flex justify-between">
            <span class="text-yellow-500">⚠️ Low confidence</span>
            <span class="font-semibold">${health.issues.lowConfidence}</span>
          </div>
        ` : ''}
        ${health.issues?.flagged > 0 ? `
          <div class="flex justify-between">
            <span class="text-yellow-500">🚩 Flagged</span>
            <span class="font-semibold">${health.issues.flagged}</span>
          </div>
        ` : ''}
        ${health.issues?.orphanedLinks > 0 ? `
          <div class="flex justify-between">
            <span class="text-red-500">🔗 Orphaned links</span>
            <span class="font-semibold">${health.issues.orphanedLinks}</span>
          </div>
        ` : ''}
        ${totalIssues === 0 ? `
          <div class="text-center text-dark-muted py-2">
            🎉 All systems healthy!
          </div>
        ` : ''}
      </div>
    `;

    console.log('✅ Health dashboard updated');

    // Update search mode
    await updateSearchMode();
  } catch (error) {
    console.error('Health dashboard error:', error);
  }

  // Health check button
  const runHealthBtn = document.getElementById('runHealthCheck');
  runHealthBtn.onclick = async () => {
    runHealthBtn.disabled = true;
    runHealthBtn.textContent = 'Checking...';

    try {
      // Run all health checks
      const [quality, contradictions, orphaned] = await Promise.all([
        fetch('/api/health/check-quality', { method: 'POST' }).then(r => r.json()),
        fetch('/api/health/check-contradictions', { method: 'POST' }).then(r => r.json()),
        fetch('/api/health/check-orphaned', { method: 'POST' }).then(r => r.json())
      ]);

      console.log('Health check results:', { quality, contradictions, orphaned });

      // Show results
      showHealthCheckResults({ quality, contradictions, orphaned });

      // Refresh health dashboard
      await renderHealthDashboard();

    } catch (error) {
      console.error('Health check error:', error);
      showNotification('Health check failed', 'error');
    } finally {
      runHealthBtn.disabled = false;
      runHealthBtn.textContent = 'Run Health Check';
    }
  };
}

function showHealthCheckResults(results) {
  const { quality, contradictions, orphaned } = results;

  const totalIssues = (quality.lowConfidenceNodes || 0) +
                     (contradictions.contradictions || 0) +
                     (orphaned.orphanedLinks || 0);

  const message = `
Health Check Complete:
• Low Confidence Nodes: ${quality.lowConfidenceNodes || 0}
• Contradictions: ${contradictions.contradictions || 0}
• Orphaned Links: ${orphaned.orphanedLinks || 0}

Total Issues: ${totalIssues}
  `.trim();

  alert(message);

  // If there are orphaned links, ask to fix
  if (orphaned.orphanedLinks > 0) {
    if (confirm(`Found ${orphaned.orphanedLinks} orphaned links. Fix them now?`)) {
      fixOrphanedLinks();
    }
  }
}

async function fixOrphanedLinks() {
  try {
    const response = await fetch('/api/health/fix-orphaned', { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      showNotification('Fixing orphaned links...', 'info');

      // Refresh after 3 seconds
      setTimeout(async () => {
        await loadGraph();
        renderGraph();
        renderHealthDashboard();
        showNotification('Orphaned links fixed!', 'success');
      }, 3000);
    }
  } catch (error) {
    console.error('Fix orphaned error:', error);
    showNotification('Failed to fix orphaned links', 'error');
  }
}

// ========================================
// STATISTICS
// ========================================
async function updateStatistics() {
  if (!stats) {
    await loadStats();
  }

  if (!stats) return;

  // Hippocampus (short-term)
  const hippocampusEvents = stats.hippocampus?.totalEvents || 0;
  document.getElementById('stat-hippocampus').textContent = hippocampusEvents;

  // Neocortex (long-term)
  const neocortexNodes = stats.nodes || 0;
  document.getElementById('stat-neocortex').textContent = neocortexNodes;

  // Graph density
  const density = parseFloat(stats.avgDegree) || 0;
  document.getElementById('stat-density').textContent = density.toFixed(2);

  // HNSW status
  const hnswEl = document.getElementById('stat-hnsw');
  if (stats.hnswEnabled) {
    hnswEl.textContent = 'Enabled';
    hnswEl.classList.add('text-green-500');
    hnswEl.classList.remove('text-dark-muted');
  } else {
    hnswEl.textContent = 'Linear';
    hnswEl.classList.add('text-dark-muted');
    hnswEl.classList.remove('text-green-500');
  }

  // Calculate memory utilization
  const maxNodes = 1000; // Target capacity
  const utilization = (neocortexNodes / maxNodes * 100).toFixed(1);

  // Update utilization if element exists
  const utilizationEl = document.getElementById('stat-utilization');
  if (utilizationEl) {
    utilizationEl.textContent = `${utilization}%`;
  }

  // Update progress bar
  const neocortexBar = document.getElementById('stat-neocortex-bar');
  if (neocortexBar) {
    neocortexBar.style.width = `${Math.min(100, utilization)}%`;

    // Change color based on utilization
    if (utilization >= 90) {
      neocortexBar.className = 'bg-red-500 h-2 rounded-full transition-all duration-500';
    } else if (utilization >= 70) {
      neocortexBar.className = 'bg-yellow-500 h-2 rounded-full transition-all duration-500';
    } else {
      neocortexBar.className = 'bg-blue-500 h-2 rounded-full transition-all duration-500';
    }
  }

  console.log('✅ Statistics updated:', {
    hippocampus: hippocampusEvents,
    neocortex: neocortexNodes,
    density: density.toFixed(2),
    hnsw: stats.hnswEnabled,
    utilization: utilization + '%'
  });
}

// ========================================
// SEARCH & FILTERS
// ========================================
function setupSearch() {
  const searchInput = document.getElementById('headerSearch');
  const searchBtn = document.getElementById('headerSearchBtn');

  const performSearch = async () => {
    const query = searchInput.value.trim();
    if (!query) return;

    console.log('🔍 Searching for:', query);

    // Always use local graph search for reliability
    if (!graph || !graph.nodes) {
      console.error('Graph not loaded');
      displaySearchResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const results = Object.entries(graph.nodes)
      .map(([id, node]) => {
        const name = (node.name || id).toLowerCase();
        const type = (node.type || '').toLowerCase();
        const canonicalForm = (node.canonicalForm || '').toLowerCase();

        // Calculate relevance score
        let score = 0;
        if (name === lowerQuery) score = 1.0;
        else if (name.startsWith(lowerQuery)) score = 0.8;
        else if (name.includes(lowerQuery)) score = 0.6;
        else if (type.includes(lowerQuery)) score = 0.4;
        else if (canonicalForm.includes(lowerQuery)) score = 0.3;
        else if (id.toLowerCase().includes(lowerQuery)) score = 0.2;

        return {
          id,
          name: node.name || id,
          type: node.type || 'concept',
          weight: node.weight || 0,
          confidence: node.confidence || 0,
          score
        };
      })
      .filter(result => result.score > 0)
      .sort((a, b) => {
        // Sort by score first, then by weight
        if (b.score !== a.score) return b.score - a.score;
        return (b.weight || 0) - (a.weight || 0);
      })
      .slice(0, 10);

    console.log('📊 Local search found:', results.length, 'results');
    console.log('Results:', results);

    displaySearchResults(results);
  };

  searchBtn.addEventListener('click', performSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });
}

function setupFilters() {
  const toggleBtn = document.getElementById('toggleFilters');
  const content = document.getElementById('filtersContent');
  const chevron = document.getElementById('filtersChevron');

  toggleBtn.addEventListener('click', () => {
    content.classList.toggle('hidden');
    chevron.classList.toggle('rotate-180');
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active', 'border-dark-accent'));
      btn.classList.add('active', 'border-dark-accent');
      currentFilter = btn.textContent.toLowerCase().trim();
      // TODO: Apply filter
    });
  });

  // Top Concepts toggle
  const toggleTopBtn = document.getElementById('toggleTopConcepts');
  const topContent = document.getElementById('topConceptsContent');
  const topChevron = document.getElementById('topConceptsChevron');

  if (toggleTopBtn) {
    toggleTopBtn.addEventListener('click', () => {
      topContent.classList.toggle('hidden');
      topChevron.classList.toggle('rotate-180');
    });
  }
}

function setupTimeline() {
  const toggleBtn = document.getElementById('toggleTimeline');
  const content = document.getElementById('timelineContent');
  const chevron = document.getElementById('timelineChevron');

  toggleBtn.addEventListener('click', () => {
    content.classList.toggle('hidden');
    chevron.classList.toggle('rotate-180');
  });

  // Fetch and display import history
  loadImportTimeline();
}

async function loadImportTimeline() {
  try {
    const response = await fetch('/api/import/history');
    const data = await response.json();

    if (!data.success || !data.history || data.history.length === 0) {
      document.getElementById('timelineList').innerHTML = '';
      document.getElementById('timelineEmpty').classList.remove('hidden');
      return;
    }

    document.getElementById('timelineEmpty').classList.add('hidden');

    // Sort by timestamp (newest first)
    const sorted = data.history.sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    displayTimeline(sorted);
  } catch (error) {
    console.error('Error loading import timeline:', error);
  }
}

function displayTimeline(history) {
  const container = document.getElementById('timelineList');

  container.innerHTML = history.map(item => {
    const date = new Date(item.timestamp);
    const timeAgo = getTimeAgo(date);
    const formatIcon = getFormatIcon(item.format);
    const statusIcon = item.success ? '✅' : '❌';
    const fileName = item.filePath ? item.filePath.split(/[/\\]/).pop() : 'Unknown';

    return `
      <div class="p-3 bg-dark-bg border border-dark-border rounded-lg hover:border-dark-accent transition-colors">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span>${formatIcon}</span>
              <span class="text-xs font-medium truncate">${fileName}</span>
              <span class="text-xs">${statusIcon}</span>
            </div>
            <div class="flex items-center gap-3 text-xs text-dark-muted">
              <span>📊 ${item.episodeCount || 0} episodes</span>
              <span>⚡ ${item.duration || 'N/A'}</span>
              <span>💾 ${formatFileSize(item.fileSize || 0)}</span>
            </div>
          </div>
          <div class="text-xs text-dark-muted whitespace-nowrap">
            ${timeAgo}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function getFormatIcon(format) {
  const icons = {
    'json': '📋',
    'text': '📄',
    'csv': '📊',
    'code': '💻',
    'md': '📝',
    'markdown': '📝'
  };
  return icons[format] || '📁';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString();
}

function displaySearchResults(results) {
  const container = document.getElementById('searchResults');

  if (!results || results.length === 0) {
    container.innerHTML = '<div class="text-sm text-dark-muted text-center py-4">No results found</div>';
    return;
  }

  console.log('📊 Displaying', results.length, 'results:', results);

  container.innerHTML = results.map((result) => {
    const nodeId = result.id;
    const name = result.name || nodeId;
    const type = result.type || 'concept';
    const weight = result.weight !== undefined ? result.weight : 0;
    const score = result.score !== undefined ? result.score : 0;

    return `
      <div class="p-3 bg-dark-panel rounded-lg border border-dark-border hover:border-dark-accent cursor-pointer transition-colors group" data-node-id="${nodeId}">
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">${name}</div>
            <div class="text-xs text-dark-muted mt-0.5">${type}</div>
          </div>
          <div class="text-right">
            <div class="text-xs font-semibold text-dark-accent">${(score * 100).toFixed(0)}%</div>
            <div class="text-xs text-dark-muted">w: ${weight.toFixed(2)}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers to results
  container.querySelectorAll('[data-node-id]').forEach(el => {
    el.addEventListener('click', () => {
      const nodeId = el.dataset.nodeId;
      const node = graph.nodes[nodeId];
      if (node) {
        showNodeDetails({ id: nodeId, ...node });
      }
    });
  });

  // Show filters section if hidden
  document.getElementById('filtersContent').classList.remove('hidden');
  document.getElementById('filtersChevron').classList.add('rotate-180');
}

// ========================================
// IMPORT
// ========================================
let selectedFiles = [];

function setupImport() {
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');
  const fileList = document.getElementById('fileList');
  const importBtn = document.getElementById('importBtn');
  const statusEl = document.getElementById('importStatus');
  const progressContainer = document.getElementById('importProgress');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const progressPercent = document.getElementById('progressPercent');

  // File selection via input
  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    addFiles(files);
  });

  // Drag & Drop handlers
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-dark-accent', 'bg-dark-bg');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-dark-accent', 'bg-dark-bg');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-dark-accent', 'bg-dark-bg');

    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  });

  // Import button
  importBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
      showNotification('No files selected', 'warning');
      return;
    }

    importBtn.disabled = true;
    progressContainer.classList.remove('hidden');
    statusEl.textContent = '';

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const progress = ((i / selectedFiles.length) * 100).toFixed(0);

      progressText.textContent = `Importing ${file.name}... (${i + 1}/${selectedFiles.length})`;
      progressPercent.textContent = `${progress}%`;
      progressBar.style.width = `${progress}%`;

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/import/file', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          console.error(`Failed to import ${file.name}:`, result.error);
        }
      } catch (error) {
        failCount++;
        console.error('Import error:', error);
      }
    }

    // Complete
    progressBar.style.width = '100%';
    progressPercent.textContent = '100%';
    progressText.textContent = 'Import complete!';

    setTimeout(() => {
      progressContainer.classList.add('hidden');
      progressBar.style.width = '0%';
    }, 2000);

    statusEl.textContent = `✅ Imported ${successCount} file(s)${failCount > 0 ? `, ${failCount} failed` : ''}`;

    importBtn.disabled = false;
    selectedFiles = [];
    fileInput.value = '';
    fileList.innerHTML = '';

    // Refresh data
    await loadGraph();
    renderGraph();
    renderTopConcepts();
    updateStatistics();
    loadImportTimeline();
  });
}

function addFiles(newFiles) {
  const validExtensions = ['.json', '.txt', '.md', '.markdown', '.csv', '.js', '.mjs', '.ts', '.py', '.java', '.cpp', '.c', '.go', '.rs'];

  for (const file of newFiles) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!validExtensions.includes(ext)) {
      showNotification(`Unsupported file type: ${file.name}`, 'warning');
      continue;
    }

    // Check if file already added
    if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
      continue;
    }

    selectedFiles.push(file);
  }

  displayFileList();
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  displayFileList();
}

function displayFileList() {
  const container = document.getElementById('fileList');

  if (selectedFiles.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = selectedFiles.map((file, index) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const formatIcon = getFormatIcon(ext.slice(1));
    const sizeWarning = file.size > 5 * 1024 * 1024; // > 5MB

    return `
      <div class="p-2 bg-dark-bg border border-dark-border rounded-lg flex items-center justify-between gap-2 group hover:border-dark-accent transition-colors">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <span class="text-sm">${formatIcon}</span>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-medium truncate">${file.name}</div>
            <div class="text-xs text-dark-muted">
              ${formatFileSize(file.size)}${sizeWarning ? ' <span class="text-yellow-500">⚠️ Large file</span>' : ''}
            </div>
          </div>
        </div>
        <button onclick="removeFile(${index})" class="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/20 rounded" title="Remove file">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-400">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  }).join('');
}

// ========================================
// NODE DETAILS MODAL
// ========================================
function setupModal() {
  const modal = document.getElementById('nodeModal');
  const closeBtn = document.getElementById('closeModal');

  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;

      // Update tab styles
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('border-dark-accent', 'text-dark-accent');
        b.classList.add('border-transparent', 'text-dark-muted');
      });
      btn.classList.remove('border-transparent', 'text-dark-muted');
      btn.classList.add('border-dark-accent', 'text-dark-accent');

      // Show tab content
      showModalTab(tab);
    });
  });

  // Forget button
  const forgetBtn = document.getElementById('forgetBtn');
  forgetBtn.addEventListener('click', async () => {
    if (!selectedNode) return;

    const nodeName = selectedNode.name || selectedNode.id;
    const confirmed = confirm(
      `Are you sure you want to forget "${nodeName}"?\n\n` +
      `This will permanently delete the node and all its connections.\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      forgetBtn.disabled = true;
      forgetBtn.textContent = 'Forgetting...';

      const response = await fetch(`/api/nodes/${selectedNode.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        showNotification(
          `✅ Forgot "${nodeName}" and ${result.deletedEdges} connection(s)`,
          'success'
        );

        // Close modal
        modal.classList.add('hidden');

        // Refresh data
        await loadGraph();
        renderGraph();
        renderTopConcepts();
        updateStatistics();
      } else {
        throw new Error(result.error || 'Failed to forget node');
      }
    } catch (error) {
      console.error('Forget error:', error);
      showNotification(`❌ Failed to forget: ${error.message}`, 'error');
    } finally {
      forgetBtn.disabled = false;
      forgetBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        Forget
      `;
    }
  });
}

function showNodeDetails(node) {
  const modal = document.getElementById('nodeModal');
  const title = document.getElementById('modalTitle');

  title.textContent = node.name || node.id;
  modal.classList.remove('hidden');

  // Show overview tab by default
  showModalTab('overview', node);
}

function showModalTab(tab, node = selectedNode) {
  if (!node) return;

  const body = document.getElementById('modalBody');

  switch (tab) {
    case 'overview':
      // Calculate age
      const createdDate = new Date(node.created);
      const now = new Date();
      const ageMs = now - createdDate;
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      const ageHours = Math.floor((ageMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      // Get connections count
      const connectionsCount = Object.values(graph.edges || {})
        .filter(edge => edge.source === node.id || edge.target === node.id).length;

      body.innerHTML = `
        <div class="space-y-6">
          <!-- Main Stats Grid -->
          <div class="grid grid-cols-3 gap-4">
            <div class="bg-dark-bg rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-dark-accent">${(node.weight || 0).toFixed(3)}</div>
              <div class="text-xs text-dark-muted mt-1">Weight (Importance)</div>
            </div>
            <div class="bg-dark-bg rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-green-500">${(node.confidence || 0).toFixed(2)}</div>
              <div class="text-xs text-dark-muted mt-1">Confidence</div>
            </div>
            <div class="bg-dark-bg rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-blue-500">${node.activations || 0}</div>
              <div class="text-xs text-dark-muted mt-1">Activations</div>
            </div>
          </div>

          <!-- Details -->
          <div class="space-y-3">
            <div>
              <div class="text-xs text-dark-muted mb-1">Type</div>
              <div class="inline-block px-2 py-1 bg-dark-bg rounded text-sm">${node.type || 'N/A'}</div>
            </div>

            <div>
              <div class="text-xs text-dark-muted mb-1">Canonical Form</div>
              <div class="text-sm font-mono">${node.canonicalForm || node.id}</div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="text-xs text-dark-muted mb-1">Created</div>
                <div class="text-sm">${createdDate.toLocaleDateString()}</div>
                <div class="text-xs text-dark-muted">${ageDays}d ${ageHours}h ago</div>
              </div>
              <div>
                <div class="text-xs text-dark-muted mb-1">Last Activation</div>
                <div class="text-sm">${new Date(node.lastActivation).toLocaleDateString()}</div>
                <div class="text-xs text-dark-muted">${new Date(node.lastActivation).toLocaleTimeString()}</div>
              </div>
            </div>

            <div>
              <div class="text-xs text-dark-muted mb-1">Connections</div>
              <div class="text-sm">${connectionsCount} linked concept${connectionsCount !== 1 ? 's' : ''}</div>
            </div>

            <div>
              <div class="text-xs text-dark-muted mb-1">Source Episodes</div>
              <div class="text-sm">${(node.sources || []).length} episode${(node.sources || []).length !== 1 ? 's' : ''}</div>
            </div>

            ${node.flags && node.flags.length > 0 ? `
              <div>
                <div class="text-xs text-dark-muted mb-1">Flags</div>
                <div class="flex flex-wrap gap-1">
                  ${node.flags.map(flag => `
                    <span class="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 rounded text-xs">${flag}</span>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
      break;

    case 'sources':
      const sources = node.sources || [];

      body.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="text-sm text-dark-muted">${sources.length} source episode${sources.length !== 1 ? 's' : ''}</div>
            ${sources.length > 0 ? `
              <button onclick="exportSources('${node.id}')" class="px-3 py-1 text-xs bg-dark-bg hover:bg-dark-border border border-dark-border rounded transition-colors">
                Export List
              </button>
            ` : ''}
          </div>

          ${sources.length === 0 ? `
            <div class="text-center py-8 text-dark-muted">
              <div class="text-3xl mb-2">📭</div>
              <div class="text-sm">No source episodes</div>
            </div>
          ` : `
            <div class="space-y-2 max-h-96 overflow-y-auto">
              ${sources.slice(0, 50).map((episodeId, index) => `
                <div class="p-3 bg-dark-bg rounded-lg hover:bg-dark-border transition-colors">
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      <div class="text-xs text-dark-muted mb-1">#${index + 1}</div>
                      <div class="text-xs font-mono truncate">${episodeId}</div>
                    </div>
                    <button onclick="viewEpisode('${episodeId}')" class="text-xs text-dark-accent hover:underline whitespace-nowrap">
                      View
                    </button>
                  </div>
                </div>
              `).join('')}
              ${sources.length > 50 ? `
                <div class="text-xs text-dark-muted text-center py-2">
                  ... and ${sources.length - 50} more episodes
                </div>
              ` : ''}
            </div>
          `}
        </div>
      `;
      break;

    case 'connections':
      const connections = Object.entries(graph.edges || {})
        .filter(([id, edge]) => edge.source === node.id || edge.target === node.id)
        .map(([id, edge]) => edge);

      // Group by type
      const grouped = {};
      connections.forEach(edge => {
        const type = edge.type || 'unknown';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(edge);
      });

      body.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="text-sm text-dark-muted">${connections.length} connection${connections.length !== 1 ? 's' : ''}</div>
            <div class="text-xs text-dark-muted">${Object.keys(grouped).length} relationship type${Object.keys(grouped).length !== 1 ? 's' : ''}</div>
          </div>

          ${connections.length === 0 ? `
            <div class="text-center py-8 text-dark-muted">
              <div class="text-3xl mb-2">🔗</div>
              <div class="text-sm">No connections yet</div>
            </div>
          ` : `
            <div class="space-y-4 max-h-96 overflow-y-auto">
              ${Object.entries(grouped).map(([type, edges]) => `
                <div>
                  <div class="text-xs font-semibold text-dark-muted mb-2 uppercase">${type} (${edges.length})</div>
                  <div class="space-y-2">
                    ${edges.map(edge => {
                      const isSource = edge.source === node.id;
                      const otherId = isSource ? edge.target : edge.source;
                      const otherNode = graph.nodes[otherId];
                      const weightPercent = Math.round((edge.weight || 0) * 100);

                      return `
                        <div class="p-3 bg-dark-bg rounded-lg hover:bg-dark-border transition-colors cursor-pointer" onclick="showNodeDetails({id: '${otherId}', ...graph.nodes['${otherId}']})">
                          <div class="flex items-center justify-between gap-3">
                            <div class="flex items-center gap-3 flex-1 min-w-0">
                              <div class="text-lg">${isSource ? '→' : '←'}</div>
                              <div class="flex-1 min-w-0">
                                <div class="text-sm font-medium truncate">${otherNode?.name || otherId}</div>
                                <div class="text-xs text-dark-muted">${otherNode?.type || 'concept'}</div>
                              </div>
                            </div>
                            <div class="text-right">
                              <div class="text-xs text-dark-muted">Weight</div>
                              <div class="text-sm font-semibold">${weightPercent}%</div>
                            </div>
                          </div>
                          <div class="mt-2">
                            <div class="w-full bg-dark-border rounded-full h-1">
                              <div class="bg-dark-accent rounded-full h-1 transition-all" style="width: ${weightPercent}%"></div>
                            </div>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
      break;
  }
}

// Helper functions for modal actions
window.exportSources = function(nodeId) {
  const node = graph.nodes[nodeId];
  if (!node || !node.sources) return;

  const text = node.sources.join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nodeId}-sources.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

window.viewEpisode = function(episodeId) {
  console.log('View episode:', episodeId);
  showNotification('Episode viewer not yet implemented', 'info');
};

// ========================================
// UTILITIES
// ========================================
function showNotification(message, type = 'info') {
  // TODO: Implement toast notifications
  console.log(`[${type.toUpperCase()}] ${message}`);
}

// ========================================
// HNSW TOGGLE
// ========================================
let currentSearchMode = 'linear';

async function updateSearchMode() {
  try {
    const response = await fetch('/api/search/mode');
    const data = await response.json();

    currentSearchMode = data.mode;
    const modeText = currentSearchMode === 'hnsw' ? 'HNSW' : 'Linear';
    const modeColor = currentSearchMode === 'hnsw' ? 'text-green-400' : 'text-blue-400';

    document.getElementById('searchMode').textContent = modeText;
    document.getElementById('searchMode').className = `font-semibold ${modeColor}`;

    const toggleBtn = document.getElementById('toggleSearchMode');
    const newMode = currentSearchMode === 'hnsw' ? 'Linear' : 'HNSW';
    toggleBtn.textContent = `Switch to ${newMode}`;

  } catch (error) {
    console.error('Failed to get search mode:', error);
    document.getElementById('searchMode').textContent = 'Unknown';
  }
}

function setupHnswToggle() {
  const toggleBtn = document.getElementById('toggleSearchMode');
  const modal = document.getElementById('hnswModal');
  const closeBtn = document.getElementById('closeHnswModal');
  const cancelBtn = document.getElementById('cancelHnsw');
  const confirmBtn = document.getElementById('confirmHnsw');

  // Open modal
  toggleBtn.addEventListener('click', () => {
    showHnswModal();
  });

  // Close modal
  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  cancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  // Confirm toggle
  confirmBtn.addEventListener('click', async () => {
    await toggleSearchMode();
    modal.classList.add('hidden');
  });

  // Close on backdrop
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });
}

async function showHnswModal() {
  const modal = document.getElementById('hnswModal');
  const title = document.getElementById('hnswModalTitle');
  const body = document.getElementById('hnswModalBody');

  const targetMode = currentSearchMode === 'hnsw' ? 'linear' : 'hnsw';

  try {
    // Get graph stats for estimation
    const statsResponse = await fetch('/api/stats');
    const stats = await statsResponse.json();
    const nodeCount = stats.nodes || 0;

    // Calculate estimates
    const estimatedTime = Math.ceil(nodeCount / 30); // ~30 nodes per second
    const estimatedTokens = Math.ceil(nodeCount * 2); // ~2 tokens per node

    if (targetMode === 'hnsw') {
      title.textContent = '⚡ Switch to HNSW Search?';
      body.innerHTML = `
        <div class="space-y-3">
          <div class="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div class="font-semibold text-green-400 mb-1">✅ Benefits</div>
            <ul class="text-xs space-y-1 text-dark-muted">
              <li>• 100-1000x faster search</li>
              <li>• Better for large graphs (>1000 nodes)</li>
              <li>• Scales to millions of nodes</li>
            </ul>
          </div>

          <div class="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div class="font-semibold text-yellow-400 mb-1">⚠️ Trade-offs</div>
            <ul class="text-xs space-y-1 text-dark-muted">
              <li>• ~5% accuracy loss (approximate search)</li>
              <li>• Index build time: ~${estimatedTime} seconds</li>
              <li>• Token cost: ~${estimatedTokens} tokens</li>
              <li>• +20% memory for index</li>
            </ul>
          </div>

          <div class="p-3 bg-dark-bg border border-dark-border rounded-lg">
            <div class="font-semibold text-dark-text mb-2">📊 Current Graph</div>
            <div class="text-xs space-y-1 text-dark-muted">
              <div class="flex justify-between">
                <span>Nodes:</span>
                <span class="font-semibold text-dark-text">${nodeCount}</span>
              </div>
              <div class="flex justify-between">
                <span>Estimated time:</span>
                <span class="font-semibold text-dark-text">~${estimatedTime}s</span>
              </div>
              <div class="flex justify-between">
                <span>Estimated cost:</span>
                <span class="font-semibold text-dark-text">~${estimatedTokens} tokens</span>
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      title.textContent = '🔄 Switch to Linear Search?';
      body.innerHTML = `
        <div class="space-y-3">
          <div class="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div class="font-semibold text-green-400 mb-1">✅ Benefits</div>
            <ul class="text-xs space-y-1 text-dark-muted">
              <li>• 100% accuracy (exact search)</li>
              <li>• No index maintenance</li>
              <li>• Lower memory usage</li>
            </ul>
          </div>

          <div class="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div class="font-semibold text-yellow-400 mb-1">⚠️ Trade-offs</div>
            <ul class="text-xs space-y-1 text-dark-muted">
              <li>• Slower for large graphs</li>
              <li>• Not recommended for >1000 nodes</li>
            </ul>
          </div>

          <div class="p-3 bg-dark-bg border border-dark-border rounded-lg">
            <div class="font-semibold text-dark-text mb-2">📊 Current Graph</div>
            <div class="text-xs space-y-1 text-dark-muted">
              <div class="flex justify-between">
                <span>Nodes:</span>
                <span class="font-semibold text-dark-text">${nodeCount}</span>
              </div>
              <div class="flex justify-between">
                <span>Impact:</span>
                <span class="font-semibold text-dark-text">${nodeCount > 1000 ? '⚠️ Slow' : 'Minimal'}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    modal.classList.remove('hidden');
  } catch (error) {
    console.error('Failed to show modal:', error);
  }
}

async function toggleSearchMode() {
  const confirmBtn = document.getElementById('confirmHnsw');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Switching...';

  try {
    const response = await fetch('/api/search/toggle', {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      showNotification(`✅ Switched to ${result.mode.toUpperCase()} mode`, 'success');
      await updateSearchMode();
    } else {
      throw new Error(result.error || 'Failed to toggle mode');
    }
  } catch (error) {
    console.error('Toggle error:', error);
    showNotification(`❌ Failed: ${error.message}`, 'error');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Proceed';
  }
}

// ========================================
// GANGLIA MANAGEMENT
// ========================================

let gangliaQuestions = [];
let gangliaAnswers = {};
let gangliaTags = {}; // Store tags for subtopics and relations (create)
let editGangliaTags = {}; // Store tags for editing
let currentEditingGanglia = null;

async function loadGangliaList() {
  try {
    const response = await fetch('/api/ganglia');
    const data = await response.json();

    if (!data.success) throw new Error(data.error);

    const container = document.getElementById('gangliaList');
    const ganglia = data.ganglia || [];

    if (ganglia.length === 0) {
      container.innerHTML = '<div class="text-xs text-dark-muted text-center py-4">No ganglia yet. Create one to get started.</div>';
      return;
    }

    container.innerHTML = ganglia.map(g => `
      <div class="p-3 bg-dark-bg border border-dark-border rounded-lg hover:border-dark-accent transition-colors cursor-pointer ganglia-item" data-id="${g.id}">
        <div class="flex items-start justify-between mb-1">
          <div class="font-medium text-sm">${g.name}</div>
          <div class="text-xs text-dark-muted">${g.type}</div>
        </div>
        <div class="flex items-center gap-3 text-xs text-dark-muted">
          <span>Weight: ${g.weight.toFixed(1)}</span>
          <span>•</span>
          <span>${g.connections} connections</span>
        </div>
      </div>
    `).join('');

    // Add click handlers
    document.querySelectorAll('.ganglia-item').forEach(item => {
      item.addEventListener('click', () => {
        showGangliaDetails(item.dataset.id);
      });
    });

  } catch (error) {
    console.error('Load ganglia error:', error);
    document.getElementById('gangliaList').innerHTML = '<div class="text-xs text-red-400 text-center py-4">Failed to load</div>';
  }
}

async function showGangliaDetails(gangliaId) {
  try {
    const response = await fetch(`/api/ganglia/${gangliaId}`);
    const data = await response.json();

    if (!data.success) throw new Error(data.error);

    currentEditingGanglia = data.ganglia;
    openEditModal(data.ganglia);

  } catch (error) {
    console.error('Show ganglia error:', error);
    showNotification(`Failed to load details: ${error.message}`, 'error');
  }
}

function openEditModal(ganglia) {
  const modal = document.getElementById('gangliaEditModal');

  // Fill form
  document.getElementById('editGangliaName').value = ganglia.name;
  document.getElementById('editGangliaType').value = ganglia.type;
  document.getElementById('editGangliaDescription').value = ganglia.metadata.description || '';
  document.getElementById('editGangliaWeight').value = ganglia.weight;
  document.getElementById('editWeightValue').textContent = ganglia.weight.toFixed(1);
  document.getElementById('editGangliaContext').value = ganglia.metadata.context || '';

  // Set expertise radio
  const expertise = ganglia.metadata.expertise_level || 'beginner';
  document.querySelector(`input[name="editExpertise"][value="${expertise}"]`).checked = true;

  // Set horizon radio
  const horizon = ganglia.metadata.horizon || 'long-term';
  document.querySelector(`input[name="editHorizon"][value="${horizon}"]`).checked = true;

  // Load tags
  editGangliaTags.subtopics = ganglia.metadata.subtopics || [];
  editGangliaTags.relations = ganglia.metadata.related_projects || [];
  renderEditTags('subtopics');
  renderEditTags('relations');

  // Show connection info
  document.getElementById('editConnectionsInfo').textContent =
    `${ganglia.edges.length} connections will be preserved`;

  // Open modal
  modal.classList.remove('hidden');
}

window.addEditTag = function(type) {
  const input = document.getElementById(`editTagInput-${type}`);
  const value = input.value.trim();

  if (!value) return;

  if (!editGangliaTags[type]) editGangliaTags[type] = [];

  if (editGangliaTags[type].includes(value)) {
    input.style.borderColor = '#ef4444';
    setTimeout(() => input.style.borderColor = '', 1000);
    return;
  }

  editGangliaTags[type].push(value);
  input.value = '';
  renderEditTags(type);
};

window.removeEditTag = function(type, value) {
  if (!editGangliaTags[type]) return;
  editGangliaTags[type] = editGangliaTags[type].filter(t => t !== value);
  renderEditTags(type);
};

function renderEditTags(type) {
  const container = document.getElementById(`edit-tags-${type}`);
  if (!container) return;

  const tags = editGangliaTags[type] || [];

  if (tags.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = tags.map(tag => `
    <span class="tag">
      ${tag}
      <button class="tag-remove" onclick="removeEditTag('${type}', '${tag.replace(/'/g, "\\'")}')">×</button>
    </span>
  `).join('');
}

async function saveGangliaEdits() {
  if (!currentEditingGanglia) return;

  const description = document.getElementById('editGangliaDescription').value.trim();
  const weight = parseFloat(document.getElementById('editGangliaWeight').value);
  const context = document.getElementById('editGangliaContext').value.trim();
  const expertise = document.querySelector('input[name="editExpertise"]:checked').value;
  const horizon = document.querySelector('input[name="editHorizon"]:checked').value;

  const subtopics = (editGangliaTags.subtopics || []).join(', ');
  const relations = (editGangliaTags.relations || []).join(', ');

  const saveBtn = document.getElementById('saveEditGanglia');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const response = await fetch(`/api/ganglia/${currentEditingGanglia.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        weight,
        enrichmentAnswers: {
          context,
          expertise,
          subtopics,
          relations,
          horizon
        }
      })
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.error);

    showNotification(`✅ Ganglia updated: ${data.ganglia.name}`, 'success');
    document.getElementById('gangliaEditModal').classList.add('hidden');
    await loadGangliaList();

  } catch (error) {
    console.error('Save ganglia error:', error);
    document.getElementById('editGangliaError').textContent = `Failed: ${error.message}`;
    document.getElementById('editGangliaError').classList.remove('hidden');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';
  }
}

function setupGangliaEditModal() {
  const modal = document.getElementById('gangliaEditModal');
  const closeBtn = document.getElementById('closeGangliaEditModal');
  const cancelBtn = document.getElementById('cancelEditGanglia');
  const saveBtn = document.getElementById('saveEditGanglia');

  // Weight slider
  const weightSlider = document.getElementById('editGangliaWeight');
  const weightValue = document.getElementById('editWeightValue');
  weightSlider.addEventListener('input', (e) => {
    weightValue.textContent = parseFloat(e.target.value).toFixed(1);
  });

  // Enter key for tag inputs
  ['subtopics', 'relations'].forEach(type => {
    const input = document.getElementById(`editTagInput-${type}`);
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addEditTag(type);
        }
      });
    }
  });

  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
  saveBtn.addEventListener('click', saveGangliaEdits);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
}

function setupGangliaModal() {
  const modal = document.getElementById('gangliaModal');
  const createBtn = document.getElementById('createGangliaBtn');
  const closeBtn = document.getElementById('closeGangliaModal');
  const cancelBtn = document.getElementById('cancelGanglia');
  const backBtn = document.getElementById('gangliaBack');
  const nextBtn = document.getElementById('gangliaNext');
  const confirmBtn = document.getElementById('confirmGanglia');

  const step1 = document.getElementById('gangliaStep1');
  const step2 = document.getElementById('gangliaStep2');
  const loading = document.getElementById('gangliaLoading');
  const errorDiv = document.getElementById('gangliaError');

  // Open modal
  createBtn.addEventListener('click', () => {
    resetGangliaModal();
    modal.classList.remove('hidden');
  });

  // Close modal
  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));

  // Next button (Step 1 → Step 2)
  nextBtn.addEventListener('click', async () => {
    const name = document.getElementById('gangliaName').value.trim();
    const type = document.getElementById('gangliaType').value;
    const description = document.getElementById('gangliaDescription').value.trim();

    if (!name) {
      errorDiv.textContent = 'Name is required';
      errorDiv.classList.remove('hidden');
      return;
    }

    errorDiv.classList.add('hidden');

    // Generate questions
    step1.classList.add('hidden');
    loading.classList.remove('hidden');

    try {
      const response = await fetch('/api/ganglia/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      gangliaQuestions = data.questions;
      renderQuestions();

      loading.classList.add('hidden');
      step2.classList.remove('hidden');
      nextBtn.classList.add('hidden');
      backBtn.classList.remove('hidden');
      confirmBtn.classList.remove('hidden');

    } catch (error) {
      console.error('Generate questions error:', error);
      loading.classList.add('hidden');
      step1.classList.remove('hidden');
      errorDiv.textContent = `Failed: ${error.message}`;
      errorDiv.classList.remove('hidden');
    }
  });

  // Back button (Step 2 → Step 1)
  backBtn.addEventListener('click', () => {
    step2.classList.add('hidden');
    step1.classList.remove('hidden');
    nextBtn.classList.remove('hidden');
    backBtn.classList.add('hidden');
    confirmBtn.classList.add('hidden');
  });

  // Confirm button (Create ganglia)
  confirmBtn.addEventListener('click', async () => {
    const name = document.getElementById('gangliaName').value.trim();
    const type = document.getElementById('gangliaType').value;
    const description = document.getElementById('gangliaDescription').value.trim();

    // Collect answers
    gangliaAnswers = {};
    gangliaQuestions.forEach((q, i) => {
      if (q.type === 'subtopics' || q.type === 'relations') {
        // Get tags
        const tags = gangliaTags[q.type] || [];
        gangliaAnswers[q.type] = tags.join(', ');
      } else {
        // Get text input
        const input = document.getElementById(`gangliaQ${i}`);
        if (input) {
          gangliaAnswers[q.type] = input.value.trim();
        }
      }
    });

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Creating...';

    try {
      const response = await fetch('/api/ganglia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, description, answers: gangliaAnswers })
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      showNotification(`✅ Ganglia created: ${data.ganglia.name}`, 'success');
      modal.classList.add('hidden');
      await loadGangliaList();
      await loadGraph(); // Refresh graph

    } catch (error) {
      console.error('Create ganglia error:', error);
      errorDiv.textContent = `Failed: ${error.message}`;
      errorDiv.classList.remove('hidden');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Create';
    }
  });

  // Close on backdrop
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
}

function renderQuestions() {
  const container = document.getElementById('gangliaQuestions');

  container.innerHTML = gangliaQuestions.map((q, i) => {
    const isTagInput = q.type === 'subtopics' || q.type === 'relations';

    if (isTagInput) {
      gangliaTags[q.type] = gangliaTags[q.type] || [];

      return `
        <div>
          <label class="block text-sm font-medium mb-2">${q.q}</label>
          <div class="tag-container">
            <div id="tags-${q.type}" class="tags-list"></div>
            <div class="tag-input-row">
              <input
                id="tagInput-${q.type}"
                type="text"
                class="tag-input"
                placeholder="Type and press Enter or click Add..."
                data-type="${q.type}"
              >
              <button class="tag-btn" data-type="${q.type}" onclick="addGangliaTag('${q.type}')">+ Add</button>
            </div>
          </div>
        </div>
      `;
    } else {
      return `
        <div>
          <label class="block text-sm font-medium mb-2">${q.q}</label>
          <input id="gangliaQ${i}" type="text" class="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:border-dark-accent">
        </div>
      `;
    }
  }).join('');

  // Add Enter key handler for tag inputs
  setTimeout(() => {
    document.querySelectorAll('.tag-input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addGangliaTag(e.target.dataset.type);
        }
      });
    });
  }, 0);
}

window.addGangliaTag = function(type) {
  const input = document.getElementById(`tagInput-${type}`);
  const value = input.value.trim();

  if (!value) return;

  // Initialize array if needed
  if (!gangliaTags[type]) gangliaTags[type] = [];

  // Check for duplicates
  if (gangliaTags[type].includes(value)) {
    input.style.borderColor = '#ef4444';
    setTimeout(() => input.style.borderColor = '', 1000);
    return;
  }

  // Add tag
  gangliaTags[type].push(value);
  input.value = '';
  renderGangliaTags(type);
}

window.removeGangliaTag = function(type, value) {
  if (!gangliaTags[type]) return;
  gangliaTags[type] = gangliaTags[type].filter(t => t !== value);
  renderGangliaTags(type);
}

function renderGangliaTags(type) {
  const container = document.getElementById(`tags-${type}`);
  if (!container) return;

  const tags = gangliaTags[type] || [];

  if (tags.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = tags.map(tag => `
    <span class="tag">
      ${tag}
      <button class="tag-remove" onclick="removeGangliaTag('${type}', '${tag}')" title="Remove">×</button>
    </span>
  `).join('');
}

function resetGangliaModal() {
  document.getElementById('gangliaName').value = '';
  document.getElementById('gangliaType').value = 'concept';
  document.getElementById('gangliaDescription').value = '';
  document.getElementById('gangliaStep1').classList.remove('hidden');
  document.getElementById('gangliaStep2').classList.add('hidden');
  document.getElementById('gangliaLoading').classList.add('hidden');
  document.getElementById('gangliaError').classList.add('hidden');
  document.getElementById('gangliaNext').classList.remove('hidden');
  document.getElementById('gangliaBack').classList.add('hidden');
  document.getElementById('confirmGanglia').classList.add('hidden');
  gangliaQuestions = [];
  gangliaAnswers = {};
  gangliaTags = {};
}

// ========================================
// INIT ON LOAD
// ========================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
