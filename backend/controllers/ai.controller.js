const { GoogleGenAI } = require('@google/genai');

const analyzeRFP = async (req, res) => {
  try {
    const aiKey = process.env.GEMINI_API_KEY;
    if (!aiKey) {
      return res.status(500).json({ error: 'AI Analysis unavailable. Missing API Key configuration.' });
    }

    const { documentText, documentSourceType = 'TEXT' // TEXT or INTERNAL_MOCK
     } = req.body;

    if (!documentText) {
      return res.status(400).json({ error: 'Document text is required for analysis' });
    }

    // Estimate logical size (basic word count heuristic)
    const wordCount = documentText.split(/\s+/).length;
    let systemInstruction = "";

    if (wordCount > 5000) {
      // Large document (e.g. 150 pages) -> Summarization Mode
      systemInstruction = `
        You are an elite Enterprise Solutions Architect and AI Proposal summarizer. 
        Your task: Analyze the provided massive RFP document (hundreds of pages) and distill it into a comprehensive, highly accurate 10-15 page Executive Summary.
        Focus precisely on: Technical Requirements, Architecture Constraints, Compliance, Resource Allocation, and Risk Factors. 
        Strip all generic fluff and output a highly structured, professional markdown format.
      `;
    } else {
      // Small document (e.g. 5 pages) -> Elaboration Mode
      systemInstruction = `
        You are an elite Enterprise Solutions Architect and AI Proposal generator.
        Your task: Take a very brief input (5-6 pages of raw ideas/RFP requests) and elaborate it into a massive, highly detailed 10-15 page Enterprise Proposal.
        You must logically infer missing technical requirements, design an optimal architecture, formulate resource allocations, and identify potential risk factors.
        Output a highly structured, professional markdown format that expands the small input into a masterclass proposal.
      `;
    }

    const client = new GoogleGenAI({ apiKey: aiKey });
    console.log(`[AI] Attempting analysis with model: gemini-2.0-flash...`);

    const result = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: documentText }] }],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2
      }
    });
    
    const responseText = result.response.text();

    return res.status(200).json({
      success: true,
      analysisType: wordCount > 5000 ? 'SUMMARIZATION' : 'ELABORATION',
      originalWordCount: wordCount,
      result: responseText
    });

  } catch (error) {
    console.error('AI Analysis Error:', error);
    res.status(500).json({ error: 'Failed to complete AI analysis', details: error.message });
  }
};

module.exports = {
  analyzeRFP
};
