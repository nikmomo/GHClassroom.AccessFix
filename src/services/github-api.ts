import { Octokit } from '@octokit/rest';
import pRetry from 'p-retry';
import type { CollaboratorCheckResult, OperationResult } from '../types';
import { config } from '../config';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('github-api');

export class GitHubAPIService {
  private octokit: Octokit;
  private rateLimitRemaining: number = 5000;
  private rateLimitReset: Date = new Date();

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token ?? config.github.token,
      userAgent: 'github-classroom-access-fixer/1.0.0',
      throttle: {
        onRateLimit: (retryAfter: number, options: any) => {
          logger.warn(
            { retryAfter, method: options.method, url: options.url },
            'Rate limit hit, retrying',
          );
          return true;
        },
        onSecondaryRateLimit: (retryAfter: number, options: any) => {
          logger.warn(
            { retryAfter, method: options.method, url: options.url },
            'Secondary rate limit hit, retrying',
          );
          return true;
        },
      },
    });
  }

  public async checkCollaborator(
    owner: string,
    repo: string,
    username: string,
  ): Promise<CollaboratorCheckResult> {
    logger.debug({ owner, repo, username }, 'Checking collaborator status');

    try {
      const response = await pRetry(
        async () => {
          try {
            const result = await this.octokit.repos.checkCollaborator({
              owner,
              repo,
              username,
            });
            return result;
          } catch (error: any) {
            if (error.status === 404) {
              return null;
            }
            throw error;
          }
        },
        {
          retries: config.rateLimiting.maxRetries,
          minTimeout: config.rateLimiting.retryDelay,
          onFailedAttempt: (error) => {
            logger.warn(
              { error: (error as unknown as Error).message, attemptNumber: error.attemptNumber },
              'Failed attempt to check collaborator',
            );
          },
        },
      );

      if (response === null) {
        return {
          exists: false,
          needsUpdate: true,
        };
      }

      const permissionResponse = await this.octokit.repos.getCollaboratorPermissionLevel({
        owner,
        repo,
        username,
      });

      const currentPermission = permissionResponse.data.permission;
      const needsUpdate = currentPermission !== config.features.defaultPermission;

      return {
        exists: true,
        permission: currentPermission,
        needsUpdate,
      };
    } catch (error) {
      logger.error({ error, owner, repo, username }, 'Error checking collaborator');
      throw error;
    }
  }

  public async addCollaborator(
    owner: string,
    repo: string,
    username: string,
    permission?: 'pull' | 'push' | 'admin' | 'maintain' | 'triage',
  ): Promise<OperationResult> {
    const finalPermission = permission ?? config.features.defaultPermission;
    
    logger.info(
      { owner, repo, username, permission: finalPermission, dryRun: config.features.dryRun },
      'Adding collaborator to repository',
    );

    if (config.features.dryRun) {
      logger.info('DRY RUN: Would add collaborator but dry run is enabled');
      return {
        success: true,
        message: `DRY RUN: Would add ${username} as collaborator with ${finalPermission} permission`,
        details: { dryRun: true, owner, repo, username, permission: finalPermission },
      };
    }

    try {
      await pRetry(
        async () => {
          await this.octokit.repos.addCollaborator({
            owner,
            repo,
            username,
            permission: finalPermission,
          });
        },
        {
          retries: config.rateLimiting.maxRetries,
          minTimeout: config.rateLimiting.retryDelay,
          onFailedAttempt: (error) => {
            logger.warn(
              { error: (error as unknown as Error).message, attemptNumber: error.attemptNumber },
              'Failed attempt to add collaborator',
            );
          },
        },
      );

      logger.info(
        { owner, repo, username, permission: finalPermission },
        'Successfully added collaborator',
      );

      return {
        success: true,
        message: `Successfully added ${username} as collaborator with ${finalPermission} permission`,
        details: { owner, repo, username, permission: finalPermission },
      };
    } catch (error: any) {
      logger.error({ error, owner, repo, username }, 'Failed to add collaborator');
      
      return {
        success: false,
        message: `Failed to add ${username} as collaborator: ${error.message}`,
        error: error as Error,
        details: { owner, repo, username, permission: finalPermission },
      };
    }
  }

  public async updateCollaboratorPermission(
    owner: string,
    repo: string,
    username: string,
    permission: 'pull' | 'push' | 'admin' | 'maintain' | 'triage',
  ): Promise<OperationResult> {
    logger.info(
      { owner, repo, username, permission, dryRun: config.features.dryRun },
      'Updating collaborator permission',
    );

    if (config.features.dryRun) {
      logger.info('DRY RUN: Would update collaborator permission but dry run is enabled');
      return {
        success: true,
        message: `DRY RUN: Would update ${username} permission to ${permission}`,
        details: { dryRun: true, owner, repo, username, permission },
      };
    }

    try {
      await pRetry(
        async () => {
          await this.octokit.repos.addCollaborator({
            owner,
            repo,
            username,
            permission,
          });
        },
        {
          retries: config.rateLimiting.maxRetries,
          minTimeout: config.rateLimiting.retryDelay,
        },
      );

      logger.info(
        { owner, repo, username, permission },
        'Successfully updated collaborator permission',
      );

      return {
        success: true,
        message: `Successfully updated ${username} permission to ${permission}`,
        details: { owner, repo, username, permission },
      };
    } catch (error: any) {
      logger.error({ error, owner, repo, username }, 'Failed to update collaborator permission');
      
      return {
        success: false,
        message: `Failed to update ${username} permission: ${error.message}`,
        error: error as Error,
        details: { owner, repo, username, permission },
      };
    }
  }

  public async getRepository(owner: string, repo: string): Promise<any> {
    try {
      const response = await this.octokit.repos.get({ owner, repo });
      return response.data;
    } catch (error) {
      logger.error({ error, owner, repo }, 'Failed to get repository');
      throw error;
    }
  }

  public async checkUserExists(username: string): Promise<boolean> {
    try {
      await this.octokit.users.getByUsername({ username });
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  public async getOrgMembers(org: string): Promise<string[]> {
    try {
      const members = await this.octokit.paginate(
        this.octokit.orgs.listMembers,
        { org, per_page: 100 },
      );
      return members.map((member) => member.login);
    } catch (error) {
      logger.error({ error, org }, 'Failed to get organization members');
      return [];
    }
  }

  public async listRepositoryInvitations(
    owner: string,
    repo: string,
  ): Promise<any[]> {
    try {
      const response = await this.octokit.repos.listInvitations({
        owner,
        repo,
      });
      logger.info(
        { owner, repo, count: response.data.length },
        'Listed repository invitations',
      );
      return response.data;
    } catch (error) {
      logger.error({ error, owner, repo }, 'Failed to list repository invitations');
      return [];
    }
  }

  public async deleteRepositoryInvitation(
    owner: string,
    repo: string,
    invitationId: number,
  ): Promise<OperationResult> {
    logger.info(
      { owner, repo, invitationId, dryRun: config.features.dryRun },
      'Deleting repository invitation',
    );

    if (config.features.dryRun) {
      logger.info('DRY RUN: Would delete invitation but dry run is enabled');
      return {
        success: true,
        message: `DRY RUN: Would delete invitation ${invitationId}`,
        details: { dryRun: true, owner, repo, invitationId },
      };
    }

    try {
      await this.octokit.repos.deleteInvitation({
        owner,
        repo,
        invitation_id: invitationId,
      });

      logger.info(
        { owner, repo, invitationId },
        'Successfully deleted invitation',
      );

      return {
        success: true,
        message: `Successfully deleted invitation ${invitationId}`,
        details: { owner, repo, invitationId },
      };
    } catch (error: any) {
      logger.error({ error, owner, repo, invitationId }, 'Failed to delete invitation');
      
      return {
        success: false,
        message: `Failed to delete invitation: ${error.message}`,
        error: error as Error,
        details: { owner, repo, invitationId },
      };
    }
  }

  public async sendRepositoryInvitation(
    owner: string,
    repo: string,
    username: string,
    permission?: 'pull' | 'push' | 'admin' | 'maintain' | 'triage',
  ): Promise<OperationResult> {
    const finalPermission = permission ?? config.features.defaultPermission;
    
    logger.info(
      { owner, repo, username, permission: finalPermission, dryRun: config.features.dryRun },
      'Sending repository invitation',
    );

    if (config.features.dryRun) {
      logger.info('DRY RUN: Would send invitation but dry run is enabled');
      return {
        success: true,
        message: `DRY RUN: Would send invitation to ${username} with ${finalPermission} permission`,
        details: { dryRun: true, owner, repo, username, permission: finalPermission },
      };
    }

    try {
      const response = await pRetry(
        async () => {
          return await this.octokit.repos.addCollaborator({
            owner,
            repo,
            username,
            permission: finalPermission,
          });
        },
        {
          retries: config.rateLimiting.maxRetries,
          minTimeout: config.rateLimiting.retryDelay,
          onFailedAttempt: (error) => {
            logger.warn(
              { error: (error as unknown as Error).message, attemptNumber: error.attemptNumber },
              'Failed attempt to send invitation',
            );
          },
        },
      );

      logger.info(
        { owner, repo, username, permission: finalPermission, invitationId: response.data?.id },
        'Successfully sent invitation',
      );

      return {
        success: true,
        message: `Successfully sent invitation to ${username} with ${finalPermission} permission`,
        details: { owner, repo, username, permission: finalPermission, invitationId: response.data?.id },
      };
    } catch (error: any) {
      logger.error({ error, owner, repo, username }, 'Failed to send invitation');
      
      return {
        success: false,
        message: `Failed to send invitation to ${username}: ${error.message}`,
        error: error as Error,
        details: { owner, repo, username, permission: finalPermission },
      };
    }
  }

  public async getRateLimit(): Promise<{ remaining: number; reset: Date }> {
    try {
      const response = await this.octokit.rateLimit.get();
      this.rateLimitRemaining = response.data.rate.remaining;
      this.rateLimitReset = new Date(response.data.rate.reset * 1000);
      
      return {
        remaining: this.rateLimitRemaining,
        reset: this.rateLimitReset,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get rate limit');
      return {
        remaining: this.rateLimitRemaining,
        reset: this.rateLimitReset,
      };
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.octokit.users.getAuthenticated();
      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to test GitHub connection');
      return false;
    }
  }
}