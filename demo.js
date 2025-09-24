const EmailThreadProcessor = require('./src/emailThreadProcessor');
const ThreadVisualizer = require('./src/visualization/threadVisualizer');
const path = require('path');
const fs = require('fs-extra');

async function generateVisualizationDemo() {
  console.log('=== Email Thread Visualization Demo ===\n');

  const processor = new EmailThreadProcessor();
  const visualizer = new ThreadVisualizer();

  try {
    // Load and process the test data
    const csvPath = path.join(__dirname, 'email_test_data.csv');
    await processor.loadEmailsFromFile(csvPath);

    const threads = processor.groupByThreads();
    console.log(`Loaded ${threads.size} threads for visualization\n`);

    // Create output directory
    const outputDir = path.join(__dirname, 'visualizations');
    await fs.ensureDir(outputDir);

    // Generate visualizations for each thread
    for (const [threadId, emails] of threads) {
      console.log(`Generating visualization for ${threadId}...`);

      // Build thread tree
      const threadData = processor.buildThreadTree(threadId);
      const stats = processor.generateThreadStats(threadId);

      // Merge stats into thread data
      Object.assign(threadData, stats);

      // Generate HTML visualization
      const htmlViz = visualizer.generateHTMLVisualization(threadData, {
        theme: 'default',
        showDetails: true
      });

      const htmlPath = path.join(outputDir, `${threadId}_thread.html`);
      await fs.writeFile(htmlPath, htmlViz);
      console.log(`  ✓ HTML visualization: ${htmlPath}`);

      // Generate D3 tree visualization
      const d3Viz = visualizer.generateD3Visualization(threadData, {
        width: 1000,
        height: 800
      });

      const d3Path = path.join(outputDir, `${threadId}_tree.html`);
      await fs.writeFile(d3Path, d3Viz);
      console.log(`  ✓ D3 tree visualization: ${d3Path}`);

      // Generate dark theme version
      const darkHtmlViz = visualizer.generateHTMLVisualization(threadData, {
        theme: 'dark',
        showDetails: true
      });

      const darkHtmlPath = path.join(outputDir, `${threadId}_thread_dark.html`);
      await fs.writeFile(darkHtmlPath, darkHtmlViz);
      console.log(`  ✓ Dark theme visualization: ${darkHtmlPath}`);

      console.log('');
    }

    // Generate summary page
    const summaryHtml = await generateSummaryPage(threads, processor);
    const summaryPath = path.join(outputDir, 'index.html');
    await fs.writeFile(summaryPath, summaryHtml);

    console.log(`📊 Summary page created: ${summaryPath}`);
    console.log(`\n🎉 All visualizations generated in: ${outputDir}`);
    console.log('\nOpen index.html in your browser to view the thread summary!');

  } catch (error) {
    console.error('Error generating visualizations:', error);
  }
}

async function generateSummaryPage(threads, processor) {
  const threadStats = [];

  for (const [threadId, emails] of threads) {
    const stats = processor.generateThreadStats(threadId);
    threadStats.push(stats);
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Thread Analysis Summary</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.1);
        }

        h1 {
            text-align: center;
            color: #333;
            margin-bottom: 40px;
            font-size: 2.5em;
            font-weight: 700;
        }

        .overview {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .stat-card {
            background: linear-gradient(135deg, #4A90E2, #357ABD);
            color: white;
            padding: 25px;
            border-radius: 15px;
            text-align: center;
        }

        .stat-number {
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 5px;
        }

        .stat-label {
            font-size: 0.9em;
            opacity: 0.9;
        }

        .threads-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
            gap: 30px;
        }

        .thread-card {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 25px;
            border-left: 6px solid #4A90E2;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .thread-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.1);
        }

        .thread-title {
            font-size: 1.3em;
            font-weight: 600;
            color: #333;
            margin-bottom: 15px;
        }

        .thread-stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 20px;
        }

        .thread-stat {
            background: white;
            padding: 10px 15px;
            border-radius: 8px;
            text-align: center;
            font-size: 0.9em;
        }

        .thread-stat .number {
            font-weight: bold;
            color: #4A90E2;
            display: block;
            font-size: 1.2em;
        }

        .participants {
            margin-bottom: 20px;
        }

        .participants-title {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 10px;
        }

        .participants-list {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
        }

        .participant {
            background: #e3f2fd;
            color: #1976d2;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8em;
        }

        .view-links {
            display: flex;
            gap: 10px;
        }

        .view-link {
            flex: 1;
            text-align: center;
            padding: 10px;
            background: #4A90E2;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-size: 0.9em;
            transition: background 0.3s ease;
        }

        .view-link:hover {
            background: #357ABD;
        }

        .view-link.tree {
            background: #7ED321;
        }

        .view-link.tree:hover {
            background: #6BC117;
        }

        .view-link.dark {
            background: #333;
        }

        .view-link.dark:hover {
            background: #222;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📧 Email Thread Analysis</h1>

        <div class="overview">
            <div class="stat-card">
                <div class="stat-number">${threads.size}</div>
                <div class="stat-label">Total Threads</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${threadStats.reduce((sum, t) => sum + t.totalEmails, 0)}</div>
                <div class="stat-label">Total Emails</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${Math.max(...threadStats.map(t => t.maxDepth))}</div>
                <div class="stat-label">Max Thread Depth</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${new Set(threadStats.flatMap(t => t.participants)).size}</div>
                <div class="stat-label">Unique Participants</div>
            </div>
        </div>

        <div class="threads-grid">
            ${threadStats.map(thread => `
                <div class="thread-card">
                    <div class="thread-title">${thread.threadId}</div>

                    <div class="thread-stats">
                        <div class="thread-stat">
                            <span class="number">${thread.totalEmails}</span>
                            <span>Emails</span>
                        </div>
                        <div class="thread-stat">
                            <span class="number">${thread.participantCount}</span>
                            <span>Participants</span>
                        </div>
                        <div class="thread-stat">
                            <span class="number">${thread.maxDepth}</span>
                            <span>Depth</span>
                        </div>
                        <div class="thread-stat">
                            <span class="number">${thread.branchCount}</span>
                            <span>Branches</span>
                        </div>
                    </div>

                    <div class="participants">
                        <div class="participants-title">Participants:</div>
                        <div class="participants-list">
                            ${thread.participants.slice(0, 5).map(p =>
                                `<span class="participant">${p.split('@')[0]}</span>`
                            ).join('')}
                            ${thread.participants.length > 5 ? `<span class="participant">+${thread.participants.length - 5} more</span>` : ''}
                        </div>
                    </div>

                    <div class="view-links">
                        <a href="${thread.threadId}_thread.html" class="view-link">Thread View</a>
                        <a href="${thread.threadId}_tree.html" class="view-link tree">Tree View</a>
                        <a href="${thread.threadId}_thread_dark.html" class="view-link dark">Dark Theme</a>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
}

// Run the demo
if (require.main === module) {
  generateVisualizationDemo().catch(console.error);
}

module.exports = { generateVisualizationDemo };