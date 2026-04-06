import { SkillRegistry, SkillMetadata } from '../src/orchestration/registry';
import { executor } from '../src/orchestration/executor';
import { router } from '../src/orchestration/router';
import { discoveryService } from '../src/orchestration/discovery';

describe('Skill Orchestration', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  describe('Registry', () => {
    it('should register and retrieve a skill', () => {
      const skill: SkillMetadata = {
        id: 'test.skill',
        name: 'Test Skill',
        description: 'A test skill',
        provider: 'local'
      };

      registry.register(skill);
      const retrieved = registry.getSkill('test.skill');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Skill');
    });

    it('should return all registered skills', () => {
      registry.register({ id: 'skill1', name: 'S1', description: 'D1', provider: 'local' });
      registry.register({ id: 'skill2', name: 'S2', description: 'D2', provider: 'openclaw' });
      
      const skills = registry.getAllSkills();
      expect(skills.length).toBe(2);
    });

    it('should clear registry', () => {
      registry.register({ id: 'skill1', name: 'S1', description: 'D1', provider: 'local' });
      registry.clear();
      expect(registry.getAllSkills().length).toBe(0);
    });

    it('should find skills by name', () => {
      registry.register({ id: 'calc', name: 'Calculator', description: 'Math', provider: 'local' });
      registry.register({ id: 'weather', name: 'Weather', description: 'Forecast', provider: 'local' });
      
      const results = registry.findByName('calc');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('calc');
    });
  });

  describe('Discovery Service', () => {
    it('should discover local skills during discovery', async () => {
      await discoveryService.discoverSkills();
      // Need to import the global registry instance for this test
      const { skillRegistry: globalRegistry } = require('../src/orchestration/registry');
      const all = globalRegistry.getAllSkills();
      
      expect(all.length).toBeGreaterThan(0);
      expect(globalRegistry.getSkill('local.weather')).toBeDefined();
    });
  });

  describe('Executor', () => {
    it('should return error for unknown skill', async () => {
      const result = await executor.executeSkill('unknown.skill', {});
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
