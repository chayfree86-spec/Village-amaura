<?php
$url = 'http://localhost/Village-amaura/api/api.php?action=add_contribution';
$data = [
    'user_mobile' => '9628717175', // Admin user
    'name' => 'Test User',
    'mobile' => '9999999999',
    'type' => 'goods',
    'date' => '2026-07-14',
    'remark' => 'Test Goods remark',
    'item_name' => 'CEMENT',
    'quantity' => 10,
    'rate' => 450
];

$options = [
    'http' => [
        'header'  => "Content-Type: application/json\r\n",
        'method'  => 'POST',
        'content' => json_encode($data),
        'ignore_errors' => true
    ]
];
$context  = stream_context_create($options);
$response = file_get_contents($url, false, $context);

echo "Response:\n";
var_dump($response);
?>
