import type { ParsedRepoInfo } from '../types';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('repository-parser');

export class RepositoryParser {
  private static readonly CLASSROOM_PATTERNS = {
    INDIVIDUAL: [
      // GitHub Classroom patterns in order of specificity
      // Pattern 1: [classroom]-[assignment]-[number]-[username] 
      // e.g., "ece3574-fl25-test-assignment-2-ece3574-fl2025-test" → username="ece3574-fl2025-test"
      /^(.+-assignment-\d+)-(.+)$/,
      
      // Pattern 2: [assignment]-[number]-[username] where number is a standalone segment
      // e.g., "test-assignment-2-shin-z-vt" → username="shin-z-vt"
      // The \d+ must be a complete segment between hyphens
      /^(.+)-(\d+)-(.+)$/,
      
      // Pattern 3: [assignment]-[username] (most common)
      // e.g., "test-assignment-nikmomo" → username="nikmomo"
      // e.g., "test-assignment-shin-z-vt" → username="shin-z-vt"
      /^(.+)-([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)$/,
    ],
    TEAM: [
      /^(.+?)-team-(.+)$/,
      /^group-(.+?)-(.+)$/,
      /^team-(.+?)-assignment-(.+)$/,
    ],
  };

  private static readonly EXCLUDED_PATTERNS = [
    /^\.github$/,
    /^docs?$/,
    /^test$/,
    /^config$/,
    /^scripts?$/,
    /^tools?$/,
    /^templates?$/,
    /^starter$/,
  ];

  public static parse(repositoryName: string): ParsedRepoInfo {
    logger.debug({ repositoryName }, 'Parsing repository name');

    if (this.isExcluded(repositoryName)) {
      logger.debug({ repositoryName }, 'Repository name matches excluded pattern');
      return { isClassroomRepo: false };
    }

    const individualResult = this.tryParseIndividual(repositoryName);
    if (individualResult.isClassroomRepo) {
      logger.info({ repositoryName, result: individualResult }, 'Parsed as individual assignment');
      return individualResult;
    }

    const teamResult = this.tryParseTeam(repositoryName);
    if (teamResult.isClassroomRepo) {
      logger.info({ repositoryName, result: teamResult }, 'Parsed as team assignment');
      return teamResult;
    }

    logger.debug({ repositoryName }, 'Repository name does not match any classroom patterns');
    return { isClassroomRepo: false };
  }

  private static isExcluded(repositoryName: string): boolean {
    return this.EXCLUDED_PATTERNS.some((pattern) => pattern.test(repositoryName));
  }

  private static tryParseIndividual(repositoryName: string): ParsedRepoInfo {
    for (const pattern of this.CLASSROOM_PATTERNS.INDIVIDUAL) {
      const match = repositoryName.match(pattern);
      if (match) {
        // Handle different pattern structures
        let assignmentName: string | undefined;
        let studentUsername: string | undefined;
        
        if (match.length === 4) {
          // Pattern 2: [assignment]-[number]-[username] has 3 capture groups
          assignmentName = match[1];
          studentUsername = match[3];
        } else {
          // Patterns 1 and 3: [assignment]-[username] have 2 capture groups
          assignmentName = match[1];
          studentUsername = match[2];
        }
        
        if (studentUsername && this.isValidUsername(studentUsername) && !this.isCommonWord(studentUsername)) {
          return {
            isClassroomRepo: true,
            ...(assignmentName && { assignmentName }),
            studentUsername,
            repoType: 'individual',
          };
        }
      }
    }
    return { isClassroomRepo: false };
  }

  private static tryParseTeam(repositoryName: string): ParsedRepoInfo {
    for (const pattern of this.CLASSROOM_PATTERNS.TEAM) {
      const match = repositoryName.match(pattern);
      if (match) {
        const [, assignmentName, teamName] = match;
        return {
          isClassroomRepo: true,
          ...(assignmentName && { assignmentName }),
          ...(teamName && { teamName }),
          repoType: 'team',
        };
      }
    }
    return { isClassroomRepo: false };
  }

  private static isValidUsername(username: string): boolean {
    if (!username || username.length < 1 || username.length > 39) {
      return false;
    }
    
    return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(username);
  }

  private static isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'main', 'master', 'dev', 'develop', 'staging', 'production',
      'test', 'testing', 'demo', 'example', 'sample', 'template',
      'starter', 'boilerplate', 'scaffold', 'skeleton', 'base',
      'core', 'common', 'shared', 'utils', 'utilities', 'helpers',
      'docs', 'documentation', 'readme', 'contributing', 'license',
    ]);
    
    return commonWords.has(word.toLowerCase());
  }

  public static extractStudentsFromTeam(
    teamName: string,
    orgMembers?: string[],
  ): string[] {
    const students: string[] = [];
    
    const patterns = [
      /^(.+?)-and-(.+?)$/,
      /^(.+?)_(.+?)$/,
      /^(.+?)-(.+?)$/,
    ];
    
    for (const pattern of patterns) {
      const match = teamName.match(pattern);
      if (match) {
        const [, first, second] = match;
        if (first && this.isValidUsername(first)) {
          students.push(first);
        }
        if (second && this.isValidUsername(second)) {
          students.push(second);
        }
        if (students.length > 0) {
          break;
        }
      }
    }
    
    if (students.length === 0 && orgMembers) {
      const possibleUsername = teamName.toLowerCase();
      const matchedMember = orgMembers.find(
        (member) => member.toLowerCase() === possibleUsername,
      );
      if (matchedMember) {
        students.push(matchedMember);
      }
    }
    
    return students;
  }
}