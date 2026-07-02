require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `你是一位專業的台灣車險理賠顧問，擁有超過十年的車輛保險理賠實務經驗。

當用戶描述事故情況時，請以清楚、有條理的格式提供分析，使用以下架構：

## 🔍 事故初步判斷
簡述事故性質、雙方可能的責任比例。

## 📋 可申請理賠項目
根據台灣常見保單（強制險、甲/乙/丙式車體險、第三人責任險）分析可申請項目，說明各項目的適用條件。

【強制險最新保額（115年7月1日起適用）】
- 死亡給付：最高 300 萬元（原 200 萬元）
- 失能給付（第一等級）：最高 300 萬元（原 200 萬元）
- 傷害醫療費用：最高 20 萬元
- 死亡＋失能＋醫療綜合上限：320 萬元（原 220 萬元）
- 保費維持不變，無額外負擔

## 📁 必備文件清單
列出辦理理賠所需的所有文件，分強制險和任意險分開說明。

## ⚠️ 注意事項
事故後的重要處理步驟、常見錯誤、時效提醒。

## 🗓️ 理賠流程與時程
說明大概的申辦步驟和預估時間。

---
請使用繁體中文，語氣親切專業，像經驗豐富的理賠人員耐心協助民眾。
最後請務必加上免責聲明：以上分析僅供參考，實際理賠結果依保單條款及現場勘查為準。`;

app.post('/api/analyze', async (req, res) => {
  const { description } = req.body;

  if (!description || description.trim().length < 10) {
    return res.status(400).json({ error: '請輸入較詳細的事故描述（至少 10 個字）' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT
    });

    const result = await model.generateContentStream(
      `以下是事故描述，請協助分析理賠相關事宜：\n\n${description.trim()}`
    );

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('API error:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message || '分析失敗，請稍後再試' })}\n\n`);
    res.end();
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n✅ AI 車險理賠輔助工具已啟動`);
    console.log(`🌐 開啟瀏覽器：http://localhost:${PORT}\n`);
  });
}

module.exports = app;
