import { createBuilder } from 'broccoli-test-helper';
import { loadScenarios } from '../utils';

describe('broccoli-flatiron', async () => {
  const scenarios = loadScenarios(__dirname);

  for (const [name, scenario] of Object.entries(scenarios)) {
    test(name, async () => {
      const { build, input, output } = scenario;
      const builder = createBuilder(build(input));

      await builder.build();

      expect(builder.read()).toEqual(output.read());
    });
  }
});
