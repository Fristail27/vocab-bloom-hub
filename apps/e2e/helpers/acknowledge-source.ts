import type { Page } from '@playwright/test';

// These suites exercise the editor after the operator chose to continue.
// provenance.spec.ts covers the warning, cancellation, and persistence itself.
export const acknowledgeSourceEditing = (page: Page) =>
  page.addInitScript(() => {
    sessionStorage.setItem('edit-source:default', 'yes');
  });
