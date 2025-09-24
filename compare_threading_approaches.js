const AdvancedSolrProcessor = require('./src/AdvancedSolrProcessor');

async function runThreadingComparison() {
  const processor = new AdvancedSolrProcessor();

  try {
    console.log('Running threading approach comparison...\n');

    // Run comparison with 150 emails to get good sample size
    const results = await processor.runComparison(150);

    // Save results for further analysis
    const fs = require('fs-extra');
    await fs.writeJson('./threading_comparison_results.json', results, { spaces: 2 });

    console.log('\n\nComparison complete! Results saved to threading_comparison_results.json');

    // Quick summary
    console.log('\n' + '='.repeat(50));
    console.log('QUICK SUMMARY');
    console.log('='.repeat(50));

    const approaches = ['messageIdOnly', 'messageIdWithProximity', 'hybrid'];
    const labels = ['Message-ID Only', 'Message-ID + Proximity', 'Message-ID + Subject'];

    approaches.forEach((approach, i) => {
      const stats = results[approach].stats;
      console.log(`${labels[i]}:`);
      console.log(`  ${stats.totalThreads} threads (${stats.threadsWithMultipleEmails} multi-email)`);
      console.log(`  Avg: ${stats.averageThreadSize.toFixed(1)} emails/thread`);
    });

    return results;

  } catch (error) {
    console.error('Error running comparison:', error);
  }
}

// Run if called directly
if (require.main === module) {
  runThreadingComparison();
}

module.exports = runThreadingComparison;