const EmailThreadProcessor = require('./src/emailThreadProcessor');
const path = require('path');
const fs = require('fs-extra');

async function main() {
  const processor = new EmailThreadProcessor();

  try {
    console.log('=== Email Thread Processing Demo ===\n');

    // Load the test data
    const csvPath = path.join(__dirname, 'email_test_data.csv');
    console.log('Loading emails from CSV...');
    await processor.loadEmailsFromFile(csvPath);

    // Group by threads
    console.log('Grouping emails by threads...');
    const threads = processor.groupByThreads();
    console.log(`Found ${threads.size} threads\n`);

    // Process each thread
    for (const [threadId, emails] of threads) {
      console.log(`\n--- Thread: ${threadId} ---`);
      console.log(`Emails in thread: ${emails.length}`);

      // Build thread tree
      const tree = processor.buildThreadTree(threadId);
      console.log(`Root messages: ${tree.roots.length}`);

      // Generate statistics
      const stats = processor.generateThreadStats(threadId);
      console.log(`Participants: ${stats.participantCount}`);
      console.log(`Max depth: ${stats.maxDepth}`);
      console.log(`Branches: ${stats.branchCount}`);
      console.log(`Forwards: ${stats.forwardCount}`);
      console.log(`Replies: ${stats.replyCount}`);
      console.log(`External emails: ${stats.externalCount}`);

      // Export for Python processing
      const outputDir = path.join(__dirname, 'output', threadId);
      await fs.ensureDir(outputDir);

      console.log('Exporting .eml files for python-emailthreads...');
      const { emlDir, metadataPath } = await processor.exportForPythonProcessing(threadId, outputDir);
      console.log(`EML files: ${emlDir}`);
      console.log(`Metadata: ${metadataPath}`);

      // Display thread structure
      console.log('\nThread Structure:');
      displayThreadStructure(tree.roots, 0);
    }

    // Generate comprehensive report
    console.log('\n\nGenerating thread report...');
    const reportPath = path.join(__dirname, 'thread_report.json');
    const report = await processor.generateThreadReport(reportPath);
    console.log(`Thread report saved to: ${reportPath}`);

    console.log('\n=== Processing Complete ===');

  } catch (error) {
    console.error('Error processing emails:', error);
  }
}

function displayThreadStructure(nodes, depth) {
  const indent = '  '.repeat(depth);

  nodes.forEach(node => {
    const prefix = depth === 0 ? '📧' : '↳';
    console.log(`${indent}${prefix} ${node.subject} (${node.from})`);

    if (node.children && node.children.length > 0) {
      displayThreadStructure(node.children, depth + 1);
    }
  });
}

// Run the demo
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { EmailThreadProcessor };