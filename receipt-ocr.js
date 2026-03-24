import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mediaType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Call Claude Vision API
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `Extract the following information from this receipt:
1. Vendor/Store name
2. Amount/Total (just the number, e.g., 1250.50)
3. Date (in YYYY-MM-DD format, or best guess)

Return ONLY a JSON object with these exact keys: vendor, amount, date
If any field is not found, use null.
Example: {"vendor": "Jollibee", "amount": 450.00, "date": "2024-03-24"}`,
            },
          ],
        },
      ],
    });

    // Extract the text response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(400).json({ error: 'Could not extract data from receipt' });
    }

    const extractedData = JSON.parse(jsonMatch[0]);

    return res.status(200).json({
      success: true,
      data: {
        vendor: extractedData.vendor || '',
        amount: extractedData.amount || '',
        date: extractedData.date || new Date().toISOString().split('T')[0],
      },
    });
  } catch (error) {
    console.error('Error processing receipt:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error processing receipt',
    });
  }
}
