import type { Page } from 'playwright';
import type { AssertionDefinition, AssertionOutcome } from '../domain/models.js';
import type { BrowserObservations } from '../browser/session.js';

export async function evaluateAssertion(assertion: AssertionDefinition, page: Page, observations: BrowserObservations): Promise<AssertionOutcome> {
  let observed: unknown;
  const locator = assertion.selector ? page.locator(assertion.selector) : undefined;
  switch (assertion.kind) {
    case 'visible': observed = await locator!.isVisible(); break;
    case 'text': observed = await locator!.textContent(); break;
    case 'count': observed = await locator!.count(); break;
    case 'value': observed = await locator!.inputValue(); break;
    case 'url': observed = new URL(page.url()).pathname; break;
    case 'no_browser_errors': observed = observations.errors.length; break;
  }
  const expected = assertion.kind === 'visible' ? (assertion.expected ?? true) : assertion.kind === 'no_browser_errors' ? 0 : assertion.expected;
  return { id: assertion.id, description: assertion.description, expected, observed, passed: observed === expected };
}
