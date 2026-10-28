import { runIntegrationTestSuite } from './integration/suite.test.js';
import { runCrmSalesFlowTests } from './integration/crm_sales_flow.test.js';
import { runProductCatalogueFlowTests } from './integration/product_catalogue_flow.test.js';

async function main() {
  console.log('🚀 RUNNING ALL CRM & ERP BACKEND INTEGRATION TEST SUITES...\n');
  try {
    await runIntegrationTestSuite();
    await runCrmSalesFlowTests();
    await runProductCatalogueFlowTests();
    console.log('\n🌟 ALL INTEGRATION TEST SUITES PASSED SUCCESSFULLY! 🌟\n');
    process.exit(0);
  } catch (err) {
    console.error('\n💥 TEST EXECUTION FAILED:', err.message);
    process.exit(1);
  }
}

main();

