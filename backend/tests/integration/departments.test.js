// Integration verification for service-based teams and retired department workflows.
import { pathToFileURL } from 'url';
import prisma from '../../src/config/prisma.js';
import { signToken } from '../../src/utils/token.js';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5000/api';

export async function runDepartmentVerification() {
  console.log('\n======================================================');
  console.log('AZZUNIQE CRM & ERP — Service Team Tests');
  console.log('Target API:', API_BASE);
  console.log('======================================================\n');

  let passed = 0;
  const total = 4;

  try {
    const targetClient = await prisma.clientAdmin.findFirst({
      where: {
        serviceAccess: {
          some: {
            isAllowed: true,
            service: { status: 'ACTIVE' },
          },
        },
        deletedAt: null,
      },
      include: {
        serviceAccess: {
          where: { isAllowed: true, service: { status: 'ACTIVE' } },
          include: { service: true },
        },
      },
    });

    if (!targetClient) {
      throw new Error('No active company with an assigned service is available for verification.');
    }

    const companyId = targetClient.id.toString();
    const service = targetClient.serviceAccess[0].service;
    const token = signToken({
      userId: companyId,
      companyId,
      role: 'COMPANY_ADMIN',
      type: 'COMPANY_USER',
    });
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    const teamUrl = `${API_BASE}/companies/${companyId}/services/${service.code}/team`;
    const teamsUrl = `${API_BASE}/companies/${companyId}/services/${service.code}/teams`;

    console.log(`--- TEST 1: ${service.name} does not create a team by default ---`);
    const teamCountBefore = await prisma.companyServiceTeam.count({
      where: { companyId: targetClient.id, serviceId: service.id },
    });
    const teamsResponse = await fetch(teamsUrl, { headers });
    const teamsBody = await teamsResponse.json();
    const singleTeamResponse = await fetch(teamUrl, { headers });
    const teamCountAfter = await prisma.companyServiceTeam.count({
      where: { companyId: targetClient.id, serviceId: service.id },
    });
    const emptyDefaultTeamIsHidden = (teamsBody.data?.teams || []).every(
      (team) => team.name !== `${service.name} Team` || team.head || team.employees.length > 0
    );
    if (
      teamsResponse.ok &&
      teamsBody.success &&
      teamsBody.data.service.code === service.code &&
      singleTeamResponse.status === 400 &&
      teamCountBefore === teamCountAfter &&
      emptyDefaultTeamIsHidden
    ) {
      console.log('PASS: Listing teams leaves the database unchanged and hides an unused generated placeholder.');
      passed++;
    } else {
      console.error('FAIL:', teamsResponse.status, teamsBody, 'counts:', teamCountBefore, teamCountAfter);
    }

    console.log('\n--- TEST 2: Legacy department creation is no longer exposed ---');
    const departmentCountBefore = await prisma.department.count({
      where: { companyId: targetClient.id, serviceId: service.id },
    });
    const obsoleteCreateResponse = await fetch(`${teamUrl.replace('/team', '/departments')}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Should Not Be Created' }),
    });
    const departmentCountAfter = await prisma.department.count({
      where: { companyId: targetClient.id, serviceId: service.id },
    });
    if (obsoleteCreateResponse.status === 404 && departmentCountBefore === departmentCountAfter) {
      console.log('PASS: Manual department creation is unavailable and existing records were not changed.');
      passed++;
    } else {
      console.error('FAIL: obsolete endpoint status', obsoleteCreateResponse.status);
    }

    console.log('\n--- TEST 3: Service team data remains tenant-protected ---');
    const unauthenticatedResponse = await fetch(teamUrl);
    if (unauthenticatedResponse.status === 401) {
      console.log('PASS: Requests without a Company Admin session are rejected.');
      passed++;
    } else {
      console.error('FAIL: unauthenticated endpoint status', unauthenticatedResponse.status);
    }

    console.log('\n--- TEST 4: Existing department assignments map to their service team ---');
    const employees = await prisma.companyEmployee.findMany({
      where: { companyId: targetClient.id, departmentId: { not: null } },
      include: {
        department: { select: { serviceId: true } },
        team: { select: { serviceId: true } },
      },
    });
    const assignmentsPreserved = employees.every(
      (employee) => employee.team && employee.department.serviceId === employee.team.serviceId
    );
    if (assignmentsPreserved) {
      console.log(`PASS: ${employees.length} existing department assignments map to the same service team.`);
      passed++;
    } else {
      console.error('FAIL: one or more legacy employee service assignments were not preserved.');
    }

    console.log('\n======================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} / ${total} TESTS PASSED`);
    console.log('======================================================\n');
    return { passed, total, success: passed === total };
  } catch (error) {
    console.error('Verification error:', error);
    return { passed, total, success: false, error };
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun = process.argv[1] && (
  import.meta.url === pathToFileURL(process.argv[1]).href ||
  process.argv[1].replace(/\\/g, '/').endsWith('departments.test.js')
);

if (isDirectRun) {
  runDepartmentVerification().then((result) => {
    if (!result.success) process.exit(1);
  });
}
