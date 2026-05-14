import { collateralReleaseWorker } from '../src/workers/collateral-release.worker';

console.log('🔍 Checking Collateral Release Worker Status...\n');

const status = collateralReleaseWorker.getStatus();

console.log('Status:', JSON.stringify(status, null, 2));

if (status.isRunning) {
  console.log('\n✅ Worker is RUNNING');
  console.log(`   Executions: ${status.executionCount}`);
  console.log(`   Last execution: ${status.lastExecution || 'Never'}`);
  console.log(`   Check interval: ${status.checkInterval / 1000}s`);
} else {
  console.log('\n❌ Worker is NOT running');
}

// Forçar uma execução para testar
console.log('\n🔄 Forcing manual execution...');
collateralReleaseWorker.processLockedCollateral().then(() => {
  console.log('\n✅ Manual execution completed');

  const newStatus = collateralReleaseWorker.getStatus();
  console.log('\nUpdated Status:', JSON.stringify(newStatus, null, 2));

  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Error during manual execution:', error);
  process.exit(1);
});
