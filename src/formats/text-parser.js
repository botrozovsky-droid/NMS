/**
 * Text Format Parser
 * Handles TXT, MD files - documentation, notes, articles
 */

import path from 'path';

/**
 * Parse text content
 * @param {string} content - Text content
 * @param {string} filePath - File path (for metadata)
 * @param {Object} options - Parse options
 * @returns {Object} Parsed data with episodes
 */
export function parseText(content, filePath, options = {}) {
  const ext = path.extname(filePath).toLowerCase();

  // Detect if markdown
  const isMarkdown = ['.md', '.markdown'].includes(ext);

  if (isMarkdown) {
    return parseMarkdown(content, filePath, options);
  } else {
    return parsePlainText(content, filePath, options);
  }
}

/**
 * Parse Markdown file
 * Split by headers and create episodes for each section
 */
function parseMarkdown(content, filePath, options) {
  const episodes = [];
  const fileName = path.basename(filePath, path.extname(filePath));

  // Split by headers (# or ##)
  const sections = splitMarkdownSections(content);

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    // Skip very short sections
    if (section.content.trim().length < 20) continue;

    episodes.push({
      content: section.content.trim(),
      role: 'system',
      timestamp: new Date().toISOString(),
      metadata: {
        type: 'documentation',
        section: section.title || `Section ${i + 1}`,
        level: section.level,
        fileName,
        filePath,
        format: 'markdown',
        hasCodeBlocks: section.hasCode,
        wordCount: section.content.split(/\s+/).length
      }
    });
  }

  return {
    format: 'markdown',
    episodes,
    metadata: {
      fileName,
      filePath,
      totalSections: sections.length,
      totalEpisodes: episodes.length
    }
  };
}

/**
 * Split markdown into sections by headers
 */
function splitMarkdownSections(content) {
  const sections = [];
  const lines = content.split('\n');

  let currentSection = {
    title: null,
    level: 0,
    content: '',
    hasCode: false
  };

  for (const line of lines) {
    // Check if line is a header
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headerMatch) {
      // Save previous section if it has content
      if (currentSection.content.trim()) {
        sections.push({ ...currentSection });
      }

      // Start new section
      currentSection = {
        title: headerMatch[2].trim(),
        level: headerMatch[1].length,
        content: line + '\n',
        hasCode: false
      };
    } else {
      // Add line to current section
      currentSection.content += line + '\n';

      // Check for code blocks
      if (line.includes('```')) {
        currentSection.hasCode = true;
      }
    }
  }

  // Add last section
  if (currentSection.content.trim()) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Parse plain text file
 * Split into paragraphs or chunks
 */
function parsePlainText(content, filePath, options) {
  const episodes = [];
  const fileName = path.basename(filePath, path.extname(filePath));

  // Chunking strategy
  const chunkSize = options.chunkSize || 1000; // characters
  const overlap = options.overlap || 100; // character overlap

  const chunks = chunkText(content, chunkSize, overlap);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    episodes.push({
      content: chunk.trim(),
      role: 'system',
      timestamp: new Date().toISOString(),
      metadata: {
        type: 'document',
        chunkIndex: i,
        totalChunks: chunks.length,
        fileName,
        filePath,
        format: 'text',
        wordCount: chunk.split(/\s+/).length,
        charCount: chunk.length
      }
    });
  }

  return {
    format: 'text',
    episodes,
    metadata: {
      fileName,
      filePath,
      totalChunks: chunks.length,
      totalEpisodes: episodes.length,
      chunkSize,
      overlap
    }
  };
}

/**
 * Chunk text into overlapping segments
 * Tries to break at sentence boundaries
 */
function chunkText(text, chunkSize, overlap) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // If not the last chunk, try to find sentence boundary
    if (end < text.length) {
      // Look for sentence end (. ! ?) within overlap range
      const searchStart = Math.max(start, end - overlap);
      const searchText = text.substring(searchStart, end + overlap);
      const sentenceEndMatch = searchText.match(/[.!?]\s/);

      if (sentenceEndMatch) {
        end = searchStart + sentenceEndMatch.index + 1;
      }
    } else {
      end = text.length;
    }

    const chunk = text.substring(start, end);
    chunks.push(chunk);

    start = end - overlap;
  }

  return chunks;
}

/**
 * Extract metadata from markdown front matter (if exists)
 */
function extractFrontMatter(content) {
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);

  if (!frontMatterMatch) {
    return { content, metadata: {} };
  }

  const frontMatter = frontMatterMatch[1];
  const remainingContent = content.substring(frontMatterMatch[0].length);
  const metadata = {};

  // Parse YAML-like front matter
  const lines = frontMatter.split('\n');
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      metadata[match[1]] = match[2].trim();
    }
  }

  return {
    content: remainingContent,
    metadata
  };
}

export default parseText;
