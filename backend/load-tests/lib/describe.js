import { check } from 'k6';

export function describe(name, fn) {
  console.log(`[Scenario] ${name}`);
  fn();
}
