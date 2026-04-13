/**
 * Code Format Parser
 * Extracts documentation from source code files
 * Supports: JS, TS, PY, Java, C++, Go, Rust
 */

import path from 'path';

/**
 * Parse code file
 * @param {string} content - Code content
 * @param {string} filePath - File path
 * @param {Object} options - Parse options
 * @returns {Object} Parsed data with episodes
 */
export function parseCode(content, filePath, options = {}) {
  const ext = path.extname(filePath).toLowerCase();
  const language = detectLanguage(ext);

  const episodes = [];
  const fileName = path.basename(filePath);

  // Extract different types of documentation
  const docstrings = extractDocstrings(content, language);
  const comments = extractComments(content, language);
  const functions = extractFunctions(content, language);

  // Create episodes from docstrings
  for (let i = 0; i < docstrings.length; i++) {
    const doc = docstrings[i];

    episodes.push({
      content: doc.content,
      role: 'system',
      timestamp: new Date().toISOString(),
      metadata: {
        type: 'code-documentation',
        subtype: 'docstring',
        language,
        fileName,
        filePath,
        lineNumber: doc.lineNumber,
        associatedFunction: doc.functionName
      }
    });
  }

  // Create episodes from important comments (multi-line or with keywords)
  for (let i = 0; i < comments.length; i++) {
    const comment = comments[i];

    // Skip very short comments
    if (comment.content.length < 30) continue;

    // Check if comment has important keywords
    const hasKeywords = /TODO|FIXME|NOTE|IMPORTANT|WARNING|BUG|HACK/i.test(comment.content);
    const isMultiLine = comment.content.split('\n').length > 2;

    if (hasKeywords || isMultiLine) {
      episodes.push({
        content: comment.content,
        role: 'system',
        timestamp: new Date().toISOString(),
        metadata: {
          type: 'code-documentation',
          subtype: 'comment',
          language,
          fileName,
          filePath,
          lineNumber: comment.lineNumber,
          hasKeywords,
          isMultiLine
        }
      });
    }
  }

  // Create episodes from function signatures (if no docstring)
  for (let i = 0; i < functions.length; i++) {
    const func = functions[i];

    // Only if function doesn't have a docstring
    const hasDocstring = docstrings.some(doc => doc.functionName === func.name);
    if (!hasDocstring) {
      episodes.push({
        content: `Function: ${func.name}. Signature: ${func.signature}`,
        role: 'system',
        timestamp: new Date().toISOString(),
        metadata: {
          type: 'code-documentation',
          subtype: 'function-signature',
          language,
          fileName,
          filePath,
          functionName: func.name,
          lineNumber: func.lineNumber
        }
      });
    }
  }

  return {
    format: 'code',
    episodes,
    metadata: {
      language,
      fileName,
      filePath,
      totalDocstrings: docstrings.length,
      totalComments: comments.length,
      totalFunctions: functions.length,
      totalEpisodes: episodes.length
    }
  };
}

/**
 * Detect programming language from extension
 */
function detectLanguage(ext) {
  const langMap = {
    '.js': 'javascript',
    '.mjs': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp',
    '.go': 'go',
    '.rs': 'rust'
  };

  return langMap[ext] || 'unknown';
}

/**
 * Extract docstrings from code
 */
function extractDocstrings(content, language) {
  const docstrings = [];
  const lines = content.split('\n');

  if (language === 'python') {
    // Python: """...""" or '''...'''
    let inDocstring = false;
    let docstringStart = -1;
    let docstringContent = '';
    let associatedFunction = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for function definition
      if (trimmed.startsWith('def ')) {
        const funcMatch = trimmed.match(/def\s+(\w+)/);
        if (funcMatch) {
          associatedFunction = funcMatch[1];
        }
      }

      // Check for docstring start/end
      if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
        if (!inDocstring) {
          inDocstring = true;
          docstringStart = i;
          docstringContent = trimmed.replace(/^['"]/, '').replace(/['"]$/, '');

          // Check if single-line docstring
          if (trimmed.endsWith('"""') || trimmed.endsWith("'''")) {
            inDocstring = false;
            docstrings.push({
              content: docstringContent,
              lineNumber: i + 1,
              functionName: associatedFunction
            });
            docstringContent = '';
            associatedFunction = null;
          }
        } else {
          inDocstring = false;
          docstringContent += '\n' + trimmed.replace(/['"]$/, '');
          docstrings.push({
            content: docstringContent,
            lineNumber: docstringStart + 1,
            functionName: associatedFunction
          });
          docstringContent = '';
          associatedFunction = null;
        }
      } else if (inDocstring) {
        docstringContent += '\n' + trimmed;
      }
    }
  } else if (['javascript', 'typescript', 'java', 'cpp', 'c'].includes(language)) {
    // JSDoc style: /** ... */
    let inDocstring = false;
    let docstringStart = -1;
    let docstringContent = '';
    let associatedFunction = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('/**')) {
        inDocstring = true;
        docstringStart = i;
        docstringContent = trimmed.replace(/^\/\*\*\s*/, '').replace(/\*\/$/, '');

        // Check if single-line
        if (trimmed.endsWith('*/')) {
          inDocstring = false;

          // Look ahead for function
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            const funcMatch = nextLine.match(/function\s+(\w+)|(\w+)\s*[:=]\s*function|(\w+)\s*\(/);
            if (funcMatch) {
              associatedFunction = funcMatch[1] || funcMatch[2] || funcMatch[3];
            }
          }

          docstrings.push({
            content: docstringContent,
            lineNumber: i + 1,
            functionName: associatedFunction
          });
          docstringContent = '';
          associatedFunction = null;
        }
      } else if (inDocstring) {
        if (trimmed.endsWith('*/')) {
          inDocstring = false;
          docstringContent += '\n' + trimmed.replace(/\*\s*/, '').replace(/\*\/$/, '');

          // Look ahead for function
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            const funcMatch = nextLine.match(/function\s+(\w+)|(\w+)\s*[:=]\s*function|(\w+)\s*\(/);
            if (funcMatch) {
              associatedFunction = funcMatch[1] || funcMatch[2] || funcMatch[3];
            }
          }

          docstrings.push({
            content: docstringContent,
            lineNumber: docstringStart + 1,
            functionName: associatedFunction
          });
          docstringContent = '';
          associatedFunction = null;
        } else {
          docstringContent += '\n' + trimmed.replace(/^\*\s*/, '');
        }
      }
    }
  }

  return docstrings;
}

/**
 * Extract comments from code
 */
function extractComments(content, language) {
  const comments = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Single-line comments
    if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
      const commentContent = trimmed.replace(/^(\/\/|#)\s*/, '');

      // Look ahead for multi-line comment block
      let j = i + 1;
      while (j < lines.length && (lines[j].trim().startsWith('//') || lines[j].trim().startsWith('#'))) {
        commentContent += '\n' + lines[j].trim().replace(/^(\/\/|#)\s*/, '');
        j++;
      }

      if (commentContent.length > 0) {
        comments.push({
          content: commentContent,
          lineNumber: i + 1
        });
      }

      i = j - 1; // Skip processed lines
    }
  }

  return comments;
}

/**
 * Extract function signatures
 */
function extractFunctions(content, language) {
  const functions = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    let funcMatch = null;

    if (language === 'python') {
      funcMatch = trimmed.match(/def\s+(\w+)\s*\((.*?)\)/);
    } else if (['javascript', 'typescript'].includes(language)) {
      funcMatch = trimmed.match(/function\s+(\w+)\s*\((.*?)\)|(\w+)\s*[:=]\s*function\s*\((.*?)\)|(\w+)\s*=\s*\((.*?)\)\s*=>/);
    } else if (language === 'java') {
      funcMatch = trimmed.match(/\w+\s+(\w+)\s*\((.*?)\)/);
    }

    if (funcMatch) {
      const name = funcMatch[1] || funcMatch[3] || funcMatch[5];
      const params = funcMatch[2] || funcMatch[4] || funcMatch[6] || '';

      functions.push({
        name,
        signature: trimmed,
        lineNumber: i + 1
      });
    }
  }

  return functions;
}

export default parseCode;
