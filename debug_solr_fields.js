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
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function debugSolrFields() {
  try {
    console.log('=== Investigating Available Solr Fields ===\n');

    // First, let's see what fields are available
    console.log('1. Getting schema info...');
    try {
      const schemaResponse = await makeRequest('/solr/casedoxx/schema/fields?wt=json');
      if (schemaResponse.fields) {
        console.log(`Found ${schemaResponse.fields.length} total fields`);

        // Look for email-related fields
        const emailFields = schemaResponse.fields
          .filter(f => f.name.toLowerCase().includes('email') || f.name.toLowerCase().includes('mail'))
          .map(f => f.name)
          .slice(0, 20);

        console.log('Email-related fields:', emailFields);

        // Look for content/text fields
        const textFields = schemaResponse.fields
          .filter(f => f.name.toLowerCase().includes('text') ||
                      f.name.toLowerCase().includes('content') ||
                      f.name.toLowerCase().includes('body') ||
                      f.name.toLowerCase().includes('message'))
          .map(f => f.name)
          .slice(0, 20);

        console.log('Text/content fields:', textFields);
      }
    } catch (e) {
      console.log('Schema query failed, trying alternative approach...');
    }

    // Get a sample document to see what fields actually contain data
    console.log('\n2. Getting sample document with all fields...');
    const sampleQuery = encodeURI(`/solr/casedoxx/select?q=*:*&rows=1&fl=*&wt=json`);
    const sampleResponse = await makeRequest(sampleQuery);

    if (sampleResponse.response && sampleResponse.response.docs && sampleResponse.response.docs[0]) {
      const sampleDoc = sampleResponse.response.docs[0];
      console.log('\nSample document fields:');

      Object.keys(sampleDoc).forEach(field => {
        const value = sampleDoc[field];
        let preview = '';
        if (typeof value === 'string') {
          preview = value.length > 100 ? value.substring(0, 100) + '...' : value;
        } else if (Array.isArray(value)) {
          preview = `[Array with ${value.length} items]`;
          if (value.length > 0 && typeof value[0] === 'string') {
            preview += ` First: "${value[0].length > 50 ? value[0].substring(0, 50) + '...' : value[0]}"`;
          }
        } else {
          preview = String(value);
        }
        console.log(`  ${field}: ${preview}`);
      });
    }

    // Try different queries to find emails with actual content
    console.log('\n3. Testing queries for emails with content...');

    const contentQueries = [
      'email_fulltext:*',
      'content:*',
      'text:*',
      'body:*',
      'message:*',
      'email_text:*',
      'email_content:*',
      'email_body:*'
    ];

    for (const query of contentQueries) {
      try {
        const testQuery = encodeURI(`/solr/casedoxx/select?q=${query}&rows=1&fl=id,email_subject,${query.split(':')[0]}&wt=json`);
        const testResponse = await makeRequest(testQuery);

        if (testResponse.response && testResponse.response.numFound > 0) {
          console.log(`✅ Query "${query}" found ${testResponse.response.numFound} documents`);
          if (testResponse.response.docs[0]) {
            const doc = testResponse.response.docs[0];
            console.log(`   Sample: ID=${doc.id}, Subject="${doc.email_subject || 'N/A'}"`);
            const contentField = query.split(':')[0];
            if (doc[contentField]) {
              const content = Array.isArray(doc[contentField]) ? doc[contentField][0] : doc[contentField];
              console.log(`   Content preview: "${content.substring(0, 200)}..."`);
            }
          }
        } else {
          console.log(`❌ Query "${query}" found 0 documents`);
        }
      } catch (e) {
        console.log(`❌ Query "${query}" failed: ${e.message}`);
      }
    }

    // Try to find emails with proper Message-ID headers
    console.log('\n4. Looking for emails with proper threading headers...');
    const headerQueries = [
      'email_messageid:*',
      'message_id:*',
      'messageid:*',
      'email_message_id:*',
      'headers:*'
    ];

    for (const query of headerQueries) {
      try {
        const testQuery = encodeURI(`/solr/casedoxx/select?q=${query}&rows=5&fl=id,email_subject,${query.split(':')[0]}&wt=json`);
        const testResponse = await makeRequest(testQuery);

        if (testResponse.response && testResponse.response.numFound > 0) {
          console.log(`✅ Header query "${query}" found ${testResponse.response.numFound} documents`);
          testResponse.response.docs.forEach((doc, i) => {
            if (i < 3) {
              const headerField = query.split(':')[0];
              console.log(`   Doc ${i+1}: ${doc[headerField]}`);
            }
          });
        }
      } catch (e) {
        console.log(`❌ Header query "${query}" failed`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugSolrFields().catch(console.error);