from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import asyncio
import json
import pika
import threading
from redis_client import redis_client

app = FastAPI()

EVENTS_CACHE_KEY = "events:list"
EVENTS_CACHE_TTL = 60  # segundos

events = []

class Alert(BaseModel):
    sensor_id: str
    type: str
    message: str
    timestamp: str

# Função para atualizar cache Redis
async def cache_events():
    await redis_client.set(EVENTS_CACHE_KEY, json.dumps(events), ex=EVENTS_CACHE_TTL)

@app.post("/event")
async def receive_event(alert: Alert):
    events.append(alert.dict())
    await cache_events()
    return {"message": "Alerta recebido"}

@app.get("/events", response_model=List[Alert])
async def get_events():
    cached = await redis_client.get(EVENTS_CACHE_KEY)
    if cached:
        return json.loads(cached)
    else:
        await cache_events()
        return events

# Função para consumir RabbitMQ (API PHP) em thread separada
def start_rabbitmq_consumer():
    def callback(ch, method, properties, body):
        try:
            alert = json.loads(body)
            events.append(alert)
            # Atualiza cache Redis (sincronizado fora do loop async)
            asyncio.run(cache_events())
            print(f"Evento RabbitMQ recebido: {alert}")
        except Exception as e:
            print(f"Erro processando mensagem RabbitMQ: {e}")

    connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
    channel = connection.channel()
    channel.queue_declare(queue='logistica_urgente', durable=True)
    channel.basic_consume(queue='logistica_urgente', on_message_callback=callback, auto_ack=True)
    print("Iniciando consumo da fila RabbitMQ...")
    channel.start_consuming()

threading.Thread(target=start_rabbitmq_consumer, daemon=True).start()
