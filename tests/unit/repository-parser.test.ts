import { RepositoryParser } from '../../src/services/repository-parser';

describe('RepositoryParser', () => {
  describe('parse', () => {
    it('should identify individual assignment repositories', () => {
      const testCases = [
        { name: 'assignment1-johndoe', expected: { assignmentName: 'assignment1', studentUsername: 'johndoe' } },
        { name: 'lab-exercise-alice123', expected: { assignmentName: 'lab-exercise', studentUsername: 'alice123' } },
        { name: 'homework-3-bob-smith', expected: { assignmentName: 'homework-3', studentUsername: 'bob-smith' } },
        { name: 'assignment-001-student1', expected: { assignmentName: '001', studentUsername: 'student1' } },
      ];

      testCases.forEach(({ name, expected }) => {
        const result = RepositoryParser.parse(name);
        expect(result.isClassroomRepo).toBe(true);
        expect(result.repoType).toBe('individual');
        expect(result.assignmentName).toBe(expected.assignmentName);
        expect(result.studentUsername).toBe(expected.studentUsername);
      });
    });

    it('should identify team assignment repositories', () => {
      const testCases = [
        { name: 'project-team-alpha', expected: { assignmentName: 'project', teamName: 'alpha' } },
        { name: 'group-assignment-team1', expected: { assignmentName: 'assignment', teamName: 'team1' } },
        { name: 'team-lab1-assignment-red', expected: { assignmentName: 'lab1', teamName: 'red' } },
      ];

      testCases.forEach(({ name, expected }) => {
        const result = RepositoryParser.parse(name);
        expect(result.isClassroomRepo).toBe(true);
        expect(result.repoType).toBe('team');
        expect(result.assignmentName).toBe(expected.assignmentName);
        expect(result.teamName).toBe(expected.teamName);
      });
    });

    it('should reject non-classroom repositories', () => {
      const nonClassroomRepos = [
        'docs',
        'test',
        'config',
        'scripts',
        'template',
        '.github',
        'my-project',
        'random-repo-name',
      ];

      nonClassroomRepos.forEach((name) => {
        const result = RepositoryParser.parse(name);
        expect(result.isClassroomRepo).toBe(false);
      });
    });

    it('should reject invalid usernames', () => {
      const invalidUsernames = [
        'assignment--user',
        'assignment-',
        'assignment-123456789012345678901234567890123456789',
        'assignment-user!',
        'assignment-user@',
      ];

      invalidUsernames.forEach((name) => {
        const result = RepositoryParser.parse(name);
        expect(result.isClassroomRepo).toBe(false);
      });
    });

    it('should reject common words as usernames', () => {
      const commonWords = [
        'assignment-main',
        'homework-master',
        'lab-test',
        'project-demo',
        'exercise-template',
      ];

      commonWords.forEach((name) => {
        const result = RepositoryParser.parse(name);
        expect(result.isClassroomRepo).toBe(false);
      });
    });
  });

  describe('extractStudentsFromTeam', () => {
    it('should extract students from team names with "and"', () => {
      const result = RepositoryParser.extractStudentsFromTeam('alice-and-bob');
      expect(result).toEqual(['alice', 'bob']);
    });

    it('should extract students from team names with underscore', () => {
      const result = RepositoryParser.extractStudentsFromTeam('john_jane');
      expect(result).toEqual(['john', 'jane']);
    });

    it('should extract students from team names with hyphen', () => {
      const result = RepositoryParser.extractStudentsFromTeam('student1-student2');
      expect(result).toEqual(['student1', 'student2']);
    });

    it('should match against org members if provided', () => {
      const orgMembers = ['TeamAlpha', 'TeamBeta', 'alice', 'bob'];
      const result = RepositoryParser.extractStudentsFromTeam('teamalpha', orgMembers);
      expect(result).toEqual(['TeamAlpha']);
    });

    it('should return empty array for unrecognized team names', () => {
      const result = RepositoryParser.extractStudentsFromTeam('randomteamname');
      expect(result).toEqual([]);
    });
  });
});