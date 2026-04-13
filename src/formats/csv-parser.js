/**
 * CSV Format Parser
 * Handles structured data in CSV format
 */

/**
 * Parse CSV content
 * @param {string} content - CSV string
 * @param {Object} options - Parse options
 * @returns {Object} Parsed data with episodes
 */
export function parseCSV(content, options = {}) {
  const episodes = [];

  // Parse CSV
  const rows = parseCSVRows(content);

  if (rows.length === 0) {
    throw new Error('Empty CSV file');
  }

  // First row is headers
  const headers = rows[0];
  const dataRows = rows.slice(1);

  // Detect column mapping
  const columnMap = detectColumnMapping(headers);

  // Convert each row to episode
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowData = {};

    // Map columns to object
    for (let j = 0; j < headers.length; j++) {
      rowData[headers[j]] = row[j] || '';
    }

    // Create episode based on column mapping
    const episode = createEpisodeFromRow(rowData, columnMap, i);
    episodes.push(episode);
  }

  return {
    format: 'csv',
    episodes,
    metadata: {
      totalRows: dataRows.length,
      totalColumns: headers.length,
      headers,
      columnMap
    }
  };
}

/**
 * Parse CSV rows (simple parser, handles quoted fields)
 */
function parseCSVRows(content) {
  const rows = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.trim() === '') continue;

    // Simple CSV parsing (handles quoted fields)
    const row = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Detect column mapping from headers
 * Maps CSV columns to episode fields
 */
function detectColumnMapping(headers) {
  const map = {
    content: null,
    concept: null,
    type: null,
    importance: null,
    confidence: null,
    description: null,
    timestamp: null
  };

  // Try to detect columns by name (case-insensitive)
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase();

    if (header.includes('content') || header.includes('text') || header.includes('message')) {
      map.content = i;
    } else if (header.includes('concept') || header.includes('name') || header.includes('title')) {
      map.concept = i;
    } else if (header.includes('type') || header.includes('category')) {
      map.type = i;
    } else if (header.includes('importance') || header.includes('priority')) {
      map.importance = i;
    } else if (header.includes('confidence') || header.includes('certainty')) {
      map.confidence = i;
    } else if (header.includes('description') || header.includes('desc')) {
      map.description = i;
    } else if (header.includes('timestamp') || header.includes('date') || header.includes('time')) {
      map.timestamp = i;
    }
  }

  return map;
}

/**
 * Create episode from CSV row
 */
function createEpisodeFromRow(rowData, columnMap, index) {
  const headers = Object.keys(rowData);

  // Get content (use description or concept if content not found)
  let content = '';
  if (columnMap.content !== null) {
    content = rowData[headers[columnMap.content]];
  } else if (columnMap.description !== null) {
    content = rowData[headers[columnMap.description]];
  } else if (columnMap.concept !== null) {
    const concept = rowData[headers[columnMap.concept]];
    const type = columnMap.type !== null ? rowData[headers[columnMap.type]] : 'unknown';
    content = `Concept: ${concept}. Type: ${type}`;
  } else {
    // Fallback: combine all fields
    content = Object.entries(rowData)
      .map(([key, value]) => `${key}: ${value}`)
      .join('. ');
  }

  // Extract metadata
  const metadata = {
    type: 'structured-data',
    rowIndex: index,
    source: 'CSV'
  };

  if (columnMap.concept !== null) {
    metadata.concept = rowData[headers[columnMap.concept]];
  }

  if (columnMap.type !== null) {
    metadata.dataType = rowData[headers[columnMap.type]];
  }

  // Get importance (convert to float)
  let importance = 0.5;
  if (columnMap.importance !== null) {
    const importanceStr = rowData[headers[columnMap.importance]];
    importance = parseFloat(importanceStr) || 0.5;
  }
  metadata.importance = importance;

  // Get confidence
  let confidence = 0.7;
  if (columnMap.confidence !== null) {
    const confidenceStr = rowData[headers[columnMap.confidence]];
    confidence = parseFloat(confidenceStr) || 0.7;
  }

  // Get timestamp
  let timestamp = new Date().toISOString();
  if (columnMap.timestamp !== null) {
    const timestampStr = rowData[headers[columnMap.timestamp]];
    try {
      timestamp = new Date(timestampStr).toISOString();
    } catch {
      // Invalid date, use current
    }
  }

  return {
    content,
    role: 'system',
    timestamp,
    confidence,
    metadata
  };
}

export default parseCSV;
