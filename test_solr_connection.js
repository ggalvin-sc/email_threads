const https = require('https');

// Test connection to Solr
function testSolrConnection() {
  const options = {
    hostname: 'solr.casedoxx.com',
    port: 8983,
    path: '/solr/',
    method: 'GET',
    headers: {
      'User-Agent': 'Node.js-EmailThreads/1.0'
    }
  };

  console.log('Attempting to connect to Solr...');

  const req = https.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Response length:', data.length);
      console.log('First 500 chars:', data.substring(0, 500));
    });
  });

  req.on('error', (error) => {
    console.error('Connection error:', error);
  });

  req.setTimeout(10000, () => {
    console.log('Request timeout');
    req.destroy();
  });

  req.end();
}

// Test admin API
function testSolrAdmin() {
  const options = {
    hostname: 'solr.casedoxx.com',
    port: 8983,
    path: '/solr/admin/cores?action=STATUS&wt=json',
    method: 'GET'
  };

  console.log('\nTesting admin API...');

  const req = https.request(options, (res) => {
    console.log(`Admin Status Code: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Admin Response length:', data.length);
      console.log('Admin Response:', data.substring(0, 1000));
    });
  });

  req.on('error', (error) => {
    console.error('Admin API error:', error);
  });

  req.setTimeout(10000, () => {
    console.log('Admin request timeout');
    req.destroy();
  });

  req.end();
}

testSolrConnection();
setTimeout(testSolrAdmin, 2000);