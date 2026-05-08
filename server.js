// CleanCity Backend Server
// AI Classification via Claude API with relevance filtering
// Student: Olumutimi Jesutumininu | MIVA Open University 2026

const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const MAPS_API_KEY = process.env.MAPS_API_KEY;
const CLAUDE_API = 'https://api.anthropic.com/v1/messages';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'CleanCity AI Server running', version: '4.0', ai: 'Claude' });
});

app.get('/maps-key', (req, res) => {
  if (!MAPS_API_KEY) return res.status(500).json({ error: 'Maps API key not configured' });
  res.json({ key: MAPS_API_KEY });
});

app.get('/geocode', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_API_KEY}`);
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const real = data.results.find(r => !r.types.includes('plus_code')) || data.results[0];
      res.json({ address: real.formatted_address });
    } else {
      res.json({ address: 'Lagos, Nigeria' });
    }
  } catch (err) {
    res.json({ address: 'Lagos, Nigeria' });
  }
});

app.post('/classify', async (req, res) => {
  try {
    const { imageBase64, mimeType, location } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

    const response = await fetch(CLAUDE_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: imageBase64 } },
            {
              type: 'text',
              text: `You are CleanCity's AI waste classification system for Nigerian urban areas.

STEP 1 - RELEVANCE CHECK:
First determine if this image shows an environmental, waste, or pollution issue. The image MUST clearly show one of:
- Waste, garbage, trash, litter, illegal dumping
- Blocked drainage, sewage, polluted water
- Flooding, water damage
- Air pollution, smoke, burning waste
- Environmental contamination, chemical spills
- Damaged or overflowing public bins

If the image does NOT show any environmental/waste/pollution issue (e.g., it's a person, food, pet, selfie, building, vehicle, document, screenshot, indoor scene unrelated to waste, or anything irrelevant), respond ONLY with this exact JSON:

{"rejected": true, "reason": "This image does not appear to show a waste or environmental issue. Please upload a clear photo of the problem you want to report."}

STEP 2 - IF RELEVANT:
If the image clearly shows an environmental/waste issue, respond ONLY with this JSON object:

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
Be strict with the relevance check. Only proceed to STEP 2 if you are confident the image shows a real environmental issue.
Respond with JSON only, no other text, no markdown, no backticks.`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    console.log('Claude status:', response.status);

    if (!response.ok) {
      console.error('Claude error:', JSON.stringify(data));
      return res.status(500).json({ error: 'Claude API error', details: data });
    }

    const text = data.content?.[0]?.text || '';
    if (!text) return res.status(500).json({ error: 'No response from Claude' });

    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    // If Claude rejected the image, send a 422 with the reason
    if (result.rejected) {
      return res.status(422).json({ rejected: true, reason: result.reason });
    }

    res.json(result);
  } catch (err) {
    console.error('Classification error:', err);
    res.status(500).json({ error: 'Classification failed', details: err.message });
  }
});

app.listen(PORT, () => console.log(`CleanCity server running on port ${PORT}`));
