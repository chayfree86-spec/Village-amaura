<?php
$url = 'http://localhost/Village-amaura/api.php?action=update_profile';
$data = [
    'user_mobile' => '9628717175',
    'new_name' => 'Sandeep Prajapati',
    'new_mobile' => '9628717175'
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
