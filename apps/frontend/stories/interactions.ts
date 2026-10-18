import { expect, waitFor, within } from 'storybook/test';

/** Portaled modals exist in the DOM before Ant's enter animation makes them visible. */
export async function visibleDialog(canvasElement: HTMLElement, name?: string) {
  const element = await within(canvasElement.ownerDocument.body).findByRole('dialog', { name });
  await waitFor(() => expect(element).toBeVisible());
  return within(element);
}

/** Ant keeps its internal loading state briefly after the request settles. */
export async function readyButton(scope: ReturnType<typeof within>, name: string) {
  const button = await scope.findByRole('button', { name });
  await waitFor(() => {
    expect(button).toBeVisible();
    expect(button).toBeEnabled();
    expect(button).not.toHaveClass('ant-btn-loading');
  });
  return button;
}
