#!/usr/bin/env node
/**
 * Create test events for consolidation testing
 */

import memoryIntegration from '../integration.js';

const TEST_SESSION_ID = 'gemini-test-' + Date.now();

async function createTestEvents() {
  console.log('📝 Creating test events for consolidation...\n');

  await memoryIntegration.initialize();

  // Event 1: Error with file
  await memoryIntegration.onError(
    TEST_SESSION_ID,
    new Error('Failed to read configuration file'),
    { file: 'config.json', operation: 'read' }
  );
  console.log('✅ Created error event');

  // Event 2: Tool call
  await memoryIntegration.onToolCall(
    TEST_SESSION_ID,
    'Write',
    { file_path: '/src/main.py' },
    { success: true },
    { filesModified: ['/src/main.py'] }
  );
  console.log('✅ Created tool call event');

  // Event 3: User message
  await memoryIntegration.onUserMessage(
    TEST_SESSION_ID,
    'Используй Python для этого проекта, не JavaScript',
    { explicitInstruction: true }
  );
  console.log('✅ Created user message event');

  // Event 4: Another error
  await memoryIntegration.onError(
    TEST_SESSION_ID,
    new Error('Module not found: fastapi'),
    { module: 'fastapi', language: 'Python' }
  );
  console.log('✅ Created module error event');

  // Event 5: Code execution
  await memoryIntegration.onToolCall(
    TEST_SESSION_ID,
    'Bash',
    { command: 'pip install fastapi' },
    { success: true },
    { toolCalls: ['Bash'] }
  );
  console.log('✅ Created bash execution event');

  const stats = await memoryIntegration.getStats();
  console.log('\n📊 Current stats:');
  console.log(`   Hippocampus events: ${stats.hippocampus.totalEvents}`);
  console.log(`   Pending consolidation: ${stats.hippocampus.pendingConsolidation}`);

  console.log('\n✅ Test events created! Ready for consolidation.');
  console.log('\nRun: node consolidate.js');
}

createTestEvents().catch(console.error);
