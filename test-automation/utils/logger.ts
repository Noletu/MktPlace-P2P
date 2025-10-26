// Logger with colors for test output

export class Logger {
  private static testCount = 0;
  private static passedCount = 0;
  private static failedCount = 0;
  private static startTime = Date.now();

  static reset() {
    this.testCount = 0;
    this.passedCount = 0;
    this.failedCount = 0;
    this.startTime = Date.now();
  }

  static section(title: string) {
    console.log('\n' + '═'.repeat(80));
    console.log(`📋 ${title}`);
    console.log('═'.repeat(80) + '\n');
  }

  static info(message: string) {
    console.log(`ℹ️  ${message}`);
  }

  static success(message: string, time?: number) {
    this.testCount++;
    this.passedCount++;
    const timeStr = time ? ` - ${time}ms` : '';
    console.log(`✅ ${message}${timeStr}`);
  }

  static error(message: string, error?: any) {
    this.testCount++;
    this.failedCount++;
    console.log(`❌ ${message}`);
    if (error) {
      console.log(`   Error: ${error.message || error}`);
      if (error.response?.data) {
        console.log(`   Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      }
    }
  }

  static bug(message: string) {
    console.log(`🐛 BUG FOUND: ${message}`);
  }

  static fix(message: string) {
    console.log(`🔧 FIXING: ${message}`);
  }

  static phaseResult(phaseName: string, passed: number, total: number, time: number) {
    const percentage = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';
    const status = passed === total ? '✅' : '⚠️';
    console.log(`\n${status} ${phaseName} Results: ${passed}/${total} passed (${percentage}%) - ${time}ms\n`);
  }

  static finalReport(bugsFound: number, bugsFixed: number) {
    const elapsed = Date.now() - this.startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);

    console.log('\n' + '═'.repeat(80));
    console.log('📊 FINAL TEST REPORT');
    console.log('═'.repeat(80) + '\n');

    console.log(`Total Tests: ${this.testCount}`);
    console.log(`✅ Passed: ${this.passedCount} (${((this.passedCount / this.testCount) * 100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${this.failedCount} (${((this.failedCount / this.testCount) * 100).toFixed(1)}%)`);
    console.log(`⏱️  Total Time: ${minutes}m ${seconds}s`);
    console.log(`\n🐛 Bugs Found: ${bugsFound}`);
    console.log(`🔧 Bugs Fixed: ${bugsFixed}`);
  }

  static getStats() {
    return {
      total: this.testCount,
      passed: this.passedCount,
      failed: this.failedCount,
      elapsed: Date.now() - this.startTime,
    };
  }
}
