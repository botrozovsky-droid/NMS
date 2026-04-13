import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function listModels() {
  try {
    const response = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
    );

    const embeddingModels = response.data.models.filter(m =>
      m.name.includes('embedding') || m.supportedGenerationMethods?.includes('embedContent')
    );

    console.log('Available embedding models:');
    embeddingModels.forEach(m => {
      console.log(`  - ${m.name}`);
      console.log(`    Methods: ${m.supportedGenerationMethods.join(', ')}`);
    });

    if (embeddingModels.length === 0) {
      console.log('  No embedding models found!');
      console.log('\nAll models:');
      response.data.models.slice(0, 10).forEach(m => {
        console.log(`  - ${m.name} (${m.supportedGenerationMethods.join(', ')})`);
      });
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

listModels();
