const axios = require('axios');

const BACKEND_URL = 'https://object-detection-backend.vercel.app';

async function testBackend() {
  console.log('Testing backend endpoints...\n');

  try {
    // Test 1: Basic connection
    console.log('Test 1: Testing basic connection...');
    const response = await axios.get(BACKEND_URL);
    console.log('✅ Backend is accessible\n');

    // Test 2: Test camera endpoint
    console.log('Test 2: Testing camera endpoint...');
    try {
      const testResponse = await axios.post(`${BACKEND_URL}/api/test-camera`, {
        cameraSource: 'default',
        url: 'webcam://0',
        port: '0'
      });
      console.log('✅ Camera test endpoint is working\n');
    } catch (error) {
      console.log('❌ Camera test endpoint error:', error.response?.data || error.message, '\n');
    }

    // Test 3: Video feed endpoint
    console.log('Test 3: Testing video feed endpoint...');
    try {
      const videoResponse = await axios.get(`${BACKEND_URL}/video_feed`, {
        responseType: 'stream'
      });
      console.log('✅ Video feed endpoint is working\n');
    } catch (error) {
      console.log('❌ Video feed endpoint error:', error.response?.data || error.message, '\n');
    }

  } catch (error) {
    console.log('❌ Backend is not accessible:', error.message);
    console.log('\nPlease check:');
    console.log('1. Is the backend deployed to Vercel?');
    console.log('2. Is the URL correct?');
    console.log('3. Are there any deployment errors in Vercel?');
  }
}

testBackend(); 