<?php
require_once dirname(__DIR__) . '/api/db.php';
try {
    $res = $db->query("SELECT * FROM members")->fetchAll();
    echo "MEMBERS:\n";
    print_r($res);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
