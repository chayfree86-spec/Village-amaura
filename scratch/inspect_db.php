<?php
require_once dirname(__DIR__) . '/api/db.php';
try {
    $res = $db->query("DESCRIBE contributions")->fetchAll();
    echo "CONTRIBUTIONS SCHEMA:\n";
    print_r($res);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
