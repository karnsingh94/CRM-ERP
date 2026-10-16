import prisma from '../src/config/prisma.js';

async function cleanAllCompanies() {
  console.log('--- Cleaning All Companies / Clients from Database ---');

  try {
    const existingClients = await prisma.clientAdmin.findMany({
      select: { id: true, name: true, email: true, organizationName: true },
    });
    console.log(`Found ${existingClients.length} existing companies:`);
    existingClients.forEach((c) => {
      console.log(` - [ID ${c.id}] ${c.organizationName} (${c.name} - ${c.email})`);
    });

    // Delete related child records explicitly if needed, or via clientAdmin cascade
    const deletedAccessSub = await prisma.clientSubModuleAccess.deleteMany({});
    console.log(`Deleted ${deletedAccessSub.count} client sub-module access records.`);

    const deletedAccessMod = await prisma.clientModuleAccess.deleteMany({});
    console.log(`Deleted ${deletedAccessMod.count} client module access records.`);

    const deletedAccessSvc = await prisma.clientServiceAccess.deleteMany({});
    console.log(`Deleted ${deletedAccessSvc.count} client service access records.`);

    const deletedEmployees = await prisma.companyEmployee.deleteMany({});
    console.log(`Deleted ${deletedEmployees.count} company employees.`);

    const deletedDepartments = await prisma.department.deleteMany({});
    console.log(`Deleted ${deletedDepartments.count} company departments.`);

    const deletedClients = await prisma.clientAdmin.deleteMany({});
    console.log(`Deleted ${deletedClients.count} client company records.`);

    // Check count now
    const remainingCount = await prisma.clientAdmin.count();
    console.log(`Remaining companies in database: ${remainingCount}`);

    // Verify super admin is still intact
    const superAdmin = await prisma.superAdmin.findFirst();
    console.log(`Super Admin status in DB: ${superAdmin ? superAdmin.email : 'Not in DB (Bootstrap active)'}`);
    console.log('\nAll companies have been successfully deleted from database!');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await prisma.$disconnect();
  }
}

cleanAllCompanies();
