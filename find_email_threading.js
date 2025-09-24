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

async function findEmailThreading() {
  try {
    console.log('=== Finding Email Threading Information ===\n');

    // Check if email_message-id field has data
    console.log('1. Checking for documents with message IDs...');
    const messageIdQuery = await makeRequest('/solr/casedoxx/select?q=email_message-id:*&rows=10&fl=id,email_message-id,email_subject,email_from_str,email_to_str,email_cc_str,email_timesent,bates_begbates,bates_endbates,bates_begattach,bates_endattach,email_fulltext&wt=json');

    if (messageIdQuery.response) {
      console.log(`Found ${messageIdQuery.response.numFound} documents with message IDs`);

      if (messageIdQuery.response.docs.length > 0) {
        console.log('\nSample documents with message IDs:');
        messageIdQuery.response.docs.forEach((doc, i) => {
          console.log(`\nDoc ${i + 1} (ID: ${doc.id}):`);
          console.log(`  Message-ID: ${doc['email_message-id']}`);
          console.log(`  Subject: ${doc.email_subject}`);
          console.log(`  From: ${Array.isArray(doc.email_from_str) ? doc.email_from_str[0] : doc.email_from_str}`);
          console.log(`  To: ${Array.isArray(doc.email_to_str) ? doc.email_to_str[0] : doc.email_to_str}`);
        });
      }
    }

    // Look for reply/reference fields in email bodies
    console.log('\n2. Looking for In-Reply-To and References in email bodies...');
    const replyQuery = await makeRequest('/solr/casedoxx/select?q=body:"In-Reply-To"%20OR%20body:"References:"&rows=5&fl=id,email_subject,body&wt=json');

    if (replyQuery.response && replyQuery.response.docs.length > 0) {
      console.log(`Found ${replyQuery.response.numFound} documents with reply/reference info in body`);

      replyQuery.response.docs.forEach((doc, i) => {
        console.log(`\nReply Doc ${i + 1} (ID: ${doc.id}):`);
        console.log(`  Subject: ${doc.email_subject}`);

        // Extract threading info from body
        const body = doc.body || '';
        const inReplyToMatch = body.match(/In-Reply-To:\s*([^\r\n]+)/i);
        const referencesMatch = body.match(/References:\s*([^\r\n]+)/i);

        if (inReplyToMatch) {
          console.log(`  In-Reply-To: ${inReplyToMatch[1].trim()}`);
        }
        if (referencesMatch) {
          console.log(`  References: ${referencesMatch[1].trim()}`);
        }
      });
    }

    // Check for email metadata patterns
    console.log('\n3. Looking for email header patterns...');
    const headerQuery = await makeRequest('/solr/casedoxx/select?q=body:"Message-ID:"&rows=5&fl=id,email_subject,body&wt=json');

    if (headerQuery.response && headerQuery.response.docs.length > 0) {
      console.log(`Found ${headerQuery.response.numFound} documents with Message-ID in body`);

      headerQuery.response.docs.forEach((doc, i) => {
        console.log(`\nHeader Doc ${i + 1} (ID: ${doc.id}):`);
        console.log(`  Subject: ${doc.email_subject}`);

        // Extract Message-ID from body
        const body = doc.body || '';
        const messageIdMatch = body.match(/Message-ID:\s*([^\r\n]+)/i);

        if (messageIdMatch) {
          console.log(`  Body Message-ID: ${messageIdMatch[1].trim()}`);
        }
      });
    }

    // Get total counts
    console.log('\n4. Getting document type counts...');
    const totalDocs = await makeRequest('/solr/casedoxx/select?q=*:*&rows=0&wt=json');
    const emailDocs = await makeRequest('/solr/casedoxx/select?q=email_subject:*&rows=0&wt=json');

    console.log(`\nDocument Statistics:`);
    console.log(`  Total documents: ${totalDocs.response.numFound}`);
    console.log(`  Documents with email subjects: ${emailDocs.response.numFound}`);

  } catch (error) {
    console.error('Error finding email threading:', error);
  }
}

findEmailThreading();