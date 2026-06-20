fetch('https://prajapati.chaychaupal.com/db.php')
  .then(res => {
    console.log('Status:', res.status);
    return res.text();
  })
  .then(text => {
    console.log('Body:', text);
  })
  .catch(err => {
    console.error('Error:', err);
  });
