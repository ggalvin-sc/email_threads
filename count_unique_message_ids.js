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

function extractMessageId(body) {
  if (!body) return null;

  // Look for Message-ID: <...> pattern
  const messageIdMatch = body.match(/Message-ID:\s*<([^>]+)>/i);
  if (messageIdMatch) {
    return messageIdMatch[1].trim();
  }

  // Look for Message-ID: without brackets
  const messageIdMatch2 = body.match(/Message-ID:\s*([^\r\n\s]+)/i);
  if (messageIdMatch2) {
    return messageIdMatch2[1].trim();
  }

  return null;
}

async function countUniqueMessageIds() {
  try {
    console.log('=== Counting Unique Message-IDs ===\n');

    // First, get all documents that contain "Message-ID:" in body
    console.log('1. Getting all documents with Message-ID in body...');
    const messageIdDocs = await makeRequest('/solr/casedoxx/select?q=body:"Message-ID:"&rows=1000&fl=id,body&wt=json');

    if (!messageIdDocs.response) {
      console.log('No response received');
      return;
    }

    console.log(`Found ${messageIdDocs.response.numFound} documents with Message-ID in body`);
    console.log(`Retrieved first ${messageIdDocs.response.docs.length} documents for analysis`);

    // Extract unique Message-IDs
    const messageIds = new Set();
    let processedDocs = 0;
    let docsWithValidMessageId = 0;

    messageIdDocs.response.docs.forEach(doc => {
      processedDocs++;
      const messageId = extractMessageId(doc.body);
      if (messageId) {
        messageIds.add(messageId);
        docsWithValidMessageId++;

        if (docsWithValidMessageId <= 10) {
          console.log(`  Example ${docsWithValidMessageId}: ${messageId}`);
        }
      }
    });

    console.log(`\nResults from first ${processedDocs} documents:`);
    console.log(`  Documents with valid Message-ID: ${docsWithValidMessageId}`);
    console.log(`  Unique Message-IDs found: ${messageIds.size}`);

    // If there are more documents, we need to process them in batches
    if (messageIdDocs.response.numFound > 1000) {
      console.log('\n2. Processing remaining documents in batches...');

      const totalDocs = messageIdDocs.response.numFound;
      const batchSize = 1000;
      let start = 1000;

      while (start < totalDocs) {
        console.log(`  Processing documents ${start} to ${Math.min(start + batchSize - 1, totalDocs - 1)}...`);

        const batchDocs = await makeRequest(`/solr/casedoxx/select?q=body:"Message-ID:"&rows=${batchSize}&start=${start}&fl=id,body&wt=json`);

        if (batchDocs.response && batchDocs.response.docs) {
          batchDocs.response.docs.forEach(doc => {
            processedDocs++;
            const messageId = extractMessageId(doc.body);
            if (messageId) {
              messageIds.add(messageId);
              docsWithValidMessageId++;
            }
          });
        }

        start += batchSize;

        // Show progress every 5 batches
        if ((start / batchSize) % 5 === 0) {
          console.log(`    Progress: ${processedDocs}/${totalDocs} docs, ${messageIds.size} unique IDs`);
        }
      }
    }

    console.log(`\n=== Final Results ===`);
    console.log(`Total documents processed: ${processedDocs}`);
    console.log(`Documents with valid Message-ID: ${docsWithValidMessageId}`);
    console.log(`Unique Message-IDs found: ${messageIds.size}`);

    // Show some example Message-IDs
    console.log('\nSample unique Message-IDs:');
    const sampleIds = Array.from(messageIds).slice(0, 15);
    sampleIds.forEach((id, i) => {
      console.log(`  ${i + 1}: ${id}`);
    });

    return {
      totalDocs: processedDocs,
      docsWithMessageId: docsWithValidMessageId,
      uniqueMessageIds: messageIds.size,
      messageIds: Array.from(messageIds)
    };

  } catch (error) {
    console.error('Error counting unique message IDs:', error);
  }
}

countUniqueMessageIds();