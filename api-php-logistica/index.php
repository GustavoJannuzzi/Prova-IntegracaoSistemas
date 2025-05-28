<?php
require_once __DIR__ . '/vendor/autoload.php';

use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;

header("Content-Type: application/json");

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

function publishMessage($data) {
    $connection = new AMQPStreamConnection('localhost', 5672, 'guest', 'guest');
    $channel = $connection->channel();

    $channel->queue_declare('logistica_urgente', false, true, false, false);

    $msg = new AMQPMessage(json_encode($data), [
        'delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT
    ]);

    $channel->basic_publish($msg, '', 'logistica_urgente');

    $channel->close();
    $connection->close();
}

if ($path === '/equipments' && $method === 'GET') {
    $equipments = [
        ["id" => 1, "name" => "Bomba de petróleo"],
        ["id" => 2, "name" => "Válvula de controle"],
        ["id" => 3, "name" => "Tubo de aço"],
    ];
    echo json_encode($equipments);
} elseif ($path === '/dispatch' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(["error" => "Dados inválidos"]);
        exit;
    }
    try {
        publishMessage($input);
        echo json_encode(["message" => "Mensagem publicada na fila RabbitMQ"]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["error" => "Erro ao publicar mensagem: " . $e->getMessage()]);
    }
} else {
    http_response_code(404);
    echo json_encode(["error" => "Endpoint não encontrado"]);
}
