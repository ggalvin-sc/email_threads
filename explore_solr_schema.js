const https = require('https');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'solr.casedoxx.com',
      port: 8983,
      path: path,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function exploreSchema() {
  try {
    console.log('=== Exploring Solr Schema ===\n');

    // Get schema fields
    console.log('1. Getting schema fields...');
    const schema = await makeRequest('/solr/casedoxx/schema/fields?wt=json');

    if (schema.fields) {
      console.log(`Found ${schema.fields.length} fields`);

      // Look for email-related fields
      const emailFields = schema.fields.filter(field =>
        field.name.toLowerCase().includes('message') ||
        field.name.toLowerCase().includes('email') ||
        field.name.toLowerCase().includes('reply') ||
        field.name.toLowerCase().includes('reference') ||
        field.name.toLowerCase().includes('thread') ||
        field.name.toLowerCase().includes('from') ||
        field.name.toLowerCase().includes('to') ||
        field.name.toLowerCase().includes('subject') ||
        field.name.toLowerCase().includes('id')
      );

      console.log('\nEmail-related fields:');
      emailFields.forEach(field => {
        console.log(`  - ${field.name} (${field.type})${field.multiValued ? ' [multiValued]' : ''}`);
      });
    }

    // Get some sample documents
    console.log('\n2. Getting sample documents...');
    const samples = await makeRequest('/solr/casedoxx/select?q=*:*&rows=2&wt=json');

    if (samples.response && samples.response.docs) {
      console.log(`\nSample document fields:`);
      const sampleDoc = samples.response.docs[0];
      Object.keys(sampleDoc).forEach(key => {
        const value = sampleDoc[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        const preview = Array.isArray(value) ? `[${value.length} items]` : String(value).substring(0, 100);
        console.log(`  - ${key}: ${type} = ${preview}${String(value).length > 100 ? '...' : ''}`);
      });
    }

    // Look for message ID patterns
    console.log('\n3. Checking for message ID fields...');
    const messageIdQuery = await makeRequest('/solr/casedoxx/select?q=*:*&rows=5&fl=*&wt=json');

    if (messageIdQuery.response && messageIdQuery.response.docs) {
      console.log('\nLooking for Message-ID patterns in first 5 docs:');
      messageIdQuery.response.docs.forEach((doc, i) => {
        console.log(`\nDoc ${i + 1}:`);
        Object.keys(doc).forEach(key => {
          const value = doc[key];
          if (typeof value === 'string' && (
            value.includes('@') && (value.includes('<') || value.includes('Message-ID')) ||
            key.toLowerCase().includes('message') ||
            key.toLowerCase().includes('reply') ||
            key.toLowerCase().includes('reference')
          )) {
            console.log(`  ${key}: ${value.substring(0, 200)}${value.length > 200 ? '...' : ''}`);
          }
        });
      });
    }

  } catch (error) {
    console.error('Error exploring schema:', error);
  }
}

exploreSchema();