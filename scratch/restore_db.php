<?php
require_once dirname(__DIR__) . '/db.php';
$db->query("DELETE FROM members WHERE id = 9");
$db->query("UPDATE members SET mobile = '9628717175' WHERE id = 1");
$db->query("UPDATE members SET name = 'Rajesh Prajapati' WHERE id = 8");
echo "DB Restored!\n";
?>
