import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');
const frontendSrcDir = path.resolve(rootDir, 'packages/frontend/src');

test('UI/UX + Existing Module Correction Acceptance Tests', async (t) => {

  await t.test('TEST 1: Class & Section Setup route and component registration', () => {
    const appShellPath = path.join(frontendSrcDir, 'components/layout/AppShell.tsx');
    const content = fs.readFileSync(appShellPath, 'utf8');

    // Must map class_section_setup to ClassSectionSetupModule
    assert.match(content, /case 'class_section_setup':/);
    assert.match(content, /<ClassSectionSetupModule/);

    // Must support common route aliases without breaking
    assert.match(content, /case 'class_sections_setup':/);
    assert.match(content, /case 'class_section':/);
    assert.match(content, /case 'classes_sections':/);
    assert.match(content, /case 'class-section-setup':/);

    // Must verify component file exists
    const componentPath = path.join(frontendSrcDir, 'modules/academics/ClassSectionSetupModule.tsx');
    assert.ok(fs.existsSync(componentPath), 'ClassSectionSetupModule.tsx must exist');
  });

  await t.test('TEST 2: Subject & Offering route and component registration', () => {
    const appShellPath = path.join(frontendSrcDir, 'components/layout/AppShell.tsx');
    const content = fs.readFileSync(appShellPath, 'utf8');

    // Must map subject_offerings and singular subject_offering to SubjectOfferingsModule
    assert.match(content, /case 'subject_offerings':/);
    assert.match(content, /case 'subject_offering':/);
    assert.match(content, /case 'subjects_offerings':/);
    assert.match(content, /case 'subject-offerings':/);
    assert.match(content, /case 'subject-offering':/);
    assert.match(content, /<SubjectOfferingsModule/);

    // Sidebar must label it 'Subject & Offering'
    const sidebarPath = path.join(frontendSrcDir, 'components/layout/Sidebar.tsx');
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
    assert.match(sidebarContent, /label:\s*'Subject & Offering'/);

    // Must verify component file exists
    const componentPath = path.join(frontendSrcDir, 'modules/academics/SubjectOfferingsModule.tsx');
    assert.ok(fs.existsSync(componentPath), 'SubjectOfferingsModule.tsx must exist');
  });

  await t.test('TEST 3: Workspace multitasking capacity is strictly 10 (no hardcoded 8 remaining)', () => {
    const contextPath = path.join(frontendSrcDir, 'context/WorkspaceContext.tsx');
    const content = fs.readFileSync(contextPath, 'utf8');

    // MAX_WORKSPACE_TABS must be 10
    assert.match(content, /MAX_WORKSPACE_TABS\s*=\s*10;/);

    // Check that there is no remaining MAX_WORKSPACE_TABS = 8
    assert.ok(!content.includes('MAX_WORKSPACE_TABS = 8'));

    // Check overflow modal handles 11th tab cleanly
    const overflowPath = path.join(frontendSrcDir, 'components/workspace/WorkspaceOverflowModal.tsx');
    const overflowContent = fs.readFileSync(overflowPath, 'utf8');
    assert.match(overflowContent, /Maximum limit of 10 open tabs reached/);

    // Dashboard card references 10 tabs
    const dashboardPath = path.join(frontendSrcDir, 'modules/dashboard/DashboardModule.tsx');
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    assert.match(dashboardContent, /Up to 10 Open Tabs/);
  });

  await t.test('TEST 4: WorkspaceTabBar layout persistence and non-blocking hierarchy', () => {
    const appShellPath = path.join(frontendSrcDir, 'components/layout/AppShell.tsx');
    const content = fs.readFileSync(appShellPath, 'utf8');

    // WorkspaceTabBar is rendered in persistent relative z-30 container above module viewports
    assert.match(content, /relative z-30 shrink-0 bg-white/);
    assert.match(content, /<WorkspaceTabBar/);

    // Tab content container has transform containing block to isolate module modals below the tabs
    assert.match(content, /transform:\s*'translate\(0,\s*0\)'/);
  });

  await t.test('TEST 5: Modal and Drawer do not block persistent Workspace Tab Bar', () => {
    const modalPath = path.join(frontendSrcDir, 'components/common/Modal.tsx');
    const modalContent = fs.readFileSync(modalPath, 'utf8');

    // Modal must not lock body overflow or use full viewport blocking z-index 50
    assert.ok(!modalContent.includes('document.body.style.overflow'));
    assert.match(modalContent, /z-40/);

    // Modal dialog box must have max-height and internal scrolling to avoid overflowing workspace
    assert.match(modalContent, /max-h-\[calc\(100vh-140px\)\]/);
    assert.match(modalContent, /overflow-y-auto/);

    // UserProfileDrawer must use scoped z-40 within module viewport
    const drawerPath = path.join(frontendSrcDir, 'components/profile/UserProfileDrawer.tsx');
    const drawerContent = fs.readFileSync(drawerPath, 'utf8');
    assert.match(drawerContent, /fixed inset-0 z-40/);
  });

  await t.test('TEST 6: WorkspaceTabBar supports horizontal scrolling and quick switcher for 10 tabs', () => {
    const tabBarPath = path.join(frontendSrcDir, 'components/workspace/WorkspaceTabBar.tsx');
    const content = fs.readFileSync(tabBarPath, 'utf8');

    // Must have overflow-x-auto, scrollIntoView on active tab, and open workspaces dropdown
    assert.match(content, /overflow-x-auto/);
    assert.match(content, /scrollIntoView/);
    assert.match(content, /Open Workspaces/);
    assert.match(content, /isDropdownOpen/);
  });

  await t.test('TEST 7: Form state preservation across tabs (display: flex / display: none)', () => {
    const appShellPath = path.join(frontendSrcDir, 'components/layout/AppShell.tsx');
    const content = fs.readFileSync(appShellPath, 'utf8');

    // All open tabs remain mounted in DOM; inactive tabs are toggled via CSS hidden/none
    assert.match(content, /tab\.id === activeTabId \? 'flex' : 'hidden'/);
    assert.ok(!content.includes('{tab.id === activeTabId && renderModuleContent'));
  });

});
