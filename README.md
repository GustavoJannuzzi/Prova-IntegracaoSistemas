# Prova de Integração de Sistemas
**Gustavo Jannuzzi R. Siebel**

## 1. API Node.js – Módulo de Sensores

Responsável por o simula sensor nos poços com dados de temperatura e pressão.

* **GET /sensor-data:** busca os dados e armazena o resultado em cache por 10 segundos.
  como foi desenvolvido o cache do redis:

```js
const redisClient = require('./redisClient');

app.get('/sensor-data', async (req, res) => {
  const cacheKey = 'sensor:data';
  const cache = await redisClient.get(cacheKey);
  if (cache) {
    return res.json({ fromCache: true, data: JSON.parse(cache) });
  }
  const data = gerarDadosSensores();
  await redisClient.setEx(cacheKey, 10, JSON.stringify(data));
  res.json({ fromCache: false, data });
});
```

* **POST /alert:** recebe alertas e envia para a API de python com axios:

```js
app.post('/alert', async (req, res) => {
  const alerta = req.body;
  await axios.post('http://localhost:5000/event', alerta);
  res.json({ message: 'Alerta enviado para API Python' });
});
```


## 2. API Python – Eventos Críticos

Recebe alertas e consome mensagens da fila do RabbitMQ.


* **Armazenamento em lista na memória e no Redis:**

```python
events = []

@app.post("/event")
async def receive_event(alert: Alert):
    events.append(alert.dict())
    await redis_client.set(EVENTS_CACHE_KEY, json.dumps(events), ex=60)
    return {"message": "Alerta recebido"}

@app.get("/events")
async def get_events():
    cached = await redis_client.get(EVENTS_CACHE_KEY)
    if cached:
        return json.loads(cached)
    return events
```

* **pegar as mensagens do RabbitMQ em thread separada:**

```python
def callback(ch, method, properties, body):
    alert = json.loads(body)
    events.append(alert)
    asyncio.run(cache_events())

channel.basic_consume(queue='logistica_urgente', on_message_callback=callback, auto_ack=True)
channel.start_consuming()
```


## 3. API PHP – Módulo de Logística

Responsável por postar mensagens na fila RabbitMQ e retorna uma lista de equipamentos.


* **Publicar mensagem na fila RabbitMQ:**

```php
function publishMessage($data) {
    $connection = new AMQPStreamConnection('localhost', 5672, 'guest', 'guest');
    $channel = $connection->channel();
    $channel->queue_declare('logistica_urgente', false, true, false, false);
    $msg = new AMQPMessage(json_encode($data), ['delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT]);
    $channel->basic_publish($msg, '', 'logistica_urgente');
    $channel->close();
    $connection->close();
}
```

* **Endpoints:**

```php
if ($path === '/equipments' && $method === 'GET') {
    echo json_encode($equipments);
} elseif ($path === '/dispatch' && $method === 'POST') {
    publishMessage($input);
    echo json_encode(["message" => "Mensagem publicada na fila RabbitMQ"]);
}
```

---

## Como as APIs se comunicam

* A API Node.js envia alertas via HTTP para a API Python.
* A API PHP publica mensagens na fila RabbitMQ, que a API Python consome assincrono.


## Redis

* API Node.js; o Redis cacheia os dados do sensor.
* API Python; o Redis guarda a lista atual de eventos no get `/events`.


## RabbitMQ

* A API PHP publica mensagens urgentes na fila `logistica_urgente`.
* A API Python fica escutando essa fila consumindo e armazenando as mensagens.

## Evidências:
![GET-Events](evidencias\get-events.png)
![POST-Alert](evidencias\post-alert.png)
![POST-Events](evidencias\post-events.png)
![POST-SensorData](evidencias\post-sensor-data.png)
![POST-Dispatch](evidencias\post-dispatch)
![GET-Equipments](evidencias\get-equipments.png)

---
## Como testar esse rolê:

### 1. **Subir Redis e RabbitMQ com Docker**

Execute na pasta do projeto onde está o `docker-compose.yml`

```bash
docker-compose up -d
```

### 2. **Rodar as APIs**

**API Node.js (sensores):**

```bash
cd api-nodejs-sensores
npm install
npm start
```

Vai rodar no `http://localhost:3000`

**API Python (eventos):**

```bash
cd api-python-eventos
pip install -r requirements.txt
uvicorn app:app --reload --port 5000
```

Vai rodar no `http://localhost:5000`

**API PHP (logística):**

```bash
cd api-php-logistica
composer install
php -S localhost:8000
```

Vai rodar no `http://localhost:8000`

