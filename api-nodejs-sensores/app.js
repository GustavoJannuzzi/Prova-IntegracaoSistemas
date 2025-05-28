const express = require('express');
const redisClient = require('./redisClient');
const axios = require('axios');

const app = express();
app.use(express.json());

const SENSOR_DATA_CACHE_KEY = 'sensor:data';
const SENSOR_DATA_CACHE_TTL = 10; // segundos

// Simula dados de sensores
function gerarDadosSensores() {
  return {
    temperature: (20 + Math.random() * 15).toFixed(2),
    pressure: (100 + Math.random() * 50).toFixed(2),
    timestamp: new Date().toISOString(),
  };
}

// GET /sensor-data com cache Redis
app.get('/sensor-data', async (req, res) => {
  try {
    const cache = await redisClient.get(SENSOR_DATA_CACHE_KEY);
    if (cache) {
      return res.json({ fromCache: true, data: JSON.parse(cache) });
    }

    const dados = gerarDadosSensores();

    await redisClient.setEx(SENSOR_DATA_CACHE_KEY, SENSOR_DATA_CACHE_TTL, JSON.stringify(dados));

    res.json({ fromCache: false, data: dados });
  } catch (error) {
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// POST /alert envia alerta para API Python via HTTP
app.post('/alert', async (req, res) => {
  const alerta = req.body;
  if (!alerta || Object.keys(alerta).length === 0) {
    return res.status(400).json({ error: 'Alerta inválido' });
  }

  try {
    // URL da API Python (ajuste a porta se necessário)
    const pythonApiUrl = 'http://localhost:5000/event';

    const response = await axios.post(pythonApiUrl, alerta);
    res.json({ message: 'Alerta enviado para API Python', response: response.data });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao enviar alerta para API Python' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`API Node.js Sensores rodando na porta ${PORT}`);
});
