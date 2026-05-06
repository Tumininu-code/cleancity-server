// CleanCity Backend Server
// Handles Gemini AI calls and Maps API securely
// Student: Olumutimi Jesutumininu | MIVA Open University 2026
 
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
 
const app = express();
const PORT = process.env.PORT || 3000;
 
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MAPS_API_KEY = process.env.MAPS_API_KEY;
const GEMINI_API = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
 
app.use(cors({
  origin: [
    'https://tumininu-code.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:3000'
  ]
}));
 
app.use(express.json({ limit: '10mb' }));
 
// Health check
app.get('/', (req, res) => {
  res.json({ status: 'CleanCity AI Server running', version: '2.0' });
});
 
// Serve Maps API key securely to frontend
app.get('/maps-key', (req, res) => {
  if (!MAPS_API_KEY) {
    return res.status(500).json({ error: 'Maps API key not configured' });
  }
  res.json({ key: MAPS_API_KEY });
});
 
// Reverse geocode: coordinates to real address
app.get('/geocode', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng required' });
  }
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_API_KEY}`
    );
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      res.json({ address: data.results[0].formatted_address });
    } else {
      res.json({ address: 'Lagos, Nigeria' });
    }
  } catch (err) {
    res.json({ address: 'Lagos, Nigeria' });
  }
});
 
// AI Classification endpoint
app.post('/classify', async (req, res) => {
  try {
    const { imageBase64, mimeType, location } = req.body;
 
    if (!imageBase64) {
      return res.status(400).json({ error: 'No image provided' });
    }
 
    const response = await fetch(GEMINI_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } },
            { text: `You are CleanCity's AI waste classification system for Nigerian urban areas.
 
Analyze this image and generate a complete environmental incident report.
 
Respond ONLY with a valid JSON object, no other text, no markdown, no backticks:
{
  "category": "one of: Illegal Dumping, Waste Pileup, Blocked Drainage, Flooding, Environmental Pollution, Other",
  "confidence": number between 60-99,
  "severity": "Low, Medium, or High",
  "title": "short 4-6 word title describing the issue",
  "description": "2-3 sentence professional description written as an official environmental incident report",
  "recommended_action": "specific action LAWMA or authorities should take",
  "estimated_cleanup_time": "e.g. 2-4 hours, 1 day, etc",
  "location_context": "brief description of the environment visible in image"
}
 
Location: ${location || 'Lagos, Nigeria'}
Be specific, professional, and accurate.` }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1000 }
      })
    });
 
    const data = await response.json();
    console.log('Gemini status:', response.status);
    console.log('Gemini full response:', JSON.stringify(data));
 
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) {
      return res.status(500).json({ error: 'No response from AI', raw: data });
    }
 
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    res.json(result);
 
  } catch (err) {
    console.error('Classification error:', err);
    res.status(500).json({ error: 'Classification failed', details: err.message });
  }
});
 
app.listen(PORT, () => {
  console.log(`CleanCity server running on port ${PORT}`);
});
