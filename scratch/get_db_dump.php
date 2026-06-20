<?php
require_once dirname(__DIR__) . '/db.php';
$res = $db->query("SELECT * FROM contributions")->fetchAll();
echo "CONTRIBUTIONS:\n";
print_r($res);
$res2 = $db->query("SELECT * FROM expenses")->fetchAll();
echo "EXPENSES:\n";
print_r($res2);
?>
