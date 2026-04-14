#!/usr/bin/env node
/**
 * Test Gemini API connection
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

async function testGemini() {
  console.log('🧪 Testing Gemini API connection...\n');
  console.log(`Model: ${GEMINI_MODEL}`);
  console.log(`API Key: ${GEMINI_API_KEY.slice(0, 10)}...${GEMINI_API_KEY.slice(-5)}\n`);

  const testEvents = [
    {
      id: 'test-1',
      event: {
        type: 'error',
        message: 'ENOENT: no such file or directory, open config.json'
      },
      importance: 5.0
    },
    {
      id: 'test-2',
      event: {
        type: 'tool_call',
        toolName: 'Read',
        file: 'src/main.py'
      },
      importance: 2.0
    }
  ];

  const prompt = `You are a memory consolidation system. Analyze these episodic memories and extract structured knowledge.

Episodes (JSON):
${JSON.stringify(testEvents, null, 2)}

Extract and respond with ONLY valid JSON in this exact format:
{
  "concepts": [{"name": "...", "type": "...", "importance": 0-1}],
  "relationships": [{"source": "...", "target": "...", "type": "...", "strength": 0-1}],
  "facts": [{"statement": "...", "confidence": 0-1}],
  "themes": ["..."]
}

Instructions:
1. Extract key concepts and entities (nouns, technical terms, file paths)
2. Identify relationships between concepts
3. Find patterns and themes
4. Note important facts to remember
5. Respond with ONLY the JSON, no markdown, no explanation`;

  try {
    console.log('📤 Sending request to Gemini...');
    const startTime = Date.now();

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          responseMimeType: "application/json"
        }
      },
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const duration = Date.now() - startTime;
    console.log(`✅ Response received in ${duration}ms\n`);

    const content = response.data.candidates[0].content.parts[0].text;

    // Try to parse JSON
    let analysis;
    try {
      analysis = JSON.parse(content);
      console.log('✅ Valid JSON response\n');
    } catch (e) {
      console.log('⚠️  Response not pure JSON, trying to extract...\n');
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
        console.log('✅ JSON extracted successfully\n');
      } else {
        throw new Error('Could not extract JSON from response');
      }
    }

    console.log('📊 Extracted Analysis:');
    console.log(JSON.stringify(analysis, null, 2));

    console.log('\n✅ Gemini API test PASSED!');
    console.log('\n💰 Estimated tokens:');
    console.log(`   Input: ~${Math.ceil(prompt.length / 4)} tokens`);
    console.log(`   Output: ~${Math.ceil(content.length / 4)} tokens`);

    const inputCost = (prompt.length / 4) * 0.075 / 1000000;
    const outputCost = (content.length / 4) * 0.30 / 1000000;
    console.log(`   Cost: $${(inputCost + outputCost).toFixed(6)}`);

  } catch (error) {
    console.error('\n❌ Gemini API test FAILED!');
    console.error('Error:', error.message);

    if (error.response) {
      console.error('\nResponse status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }

    process.exit(1);
  }
}

testGemini();
