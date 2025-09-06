import { Request, Response } from 'express';
import type { RepositoryCreatedPayload, WebhookHeaders } from '../types';
import { GitHubAPIService } from '../services/github-api';
import { verifyWebhookSignature } from '../utils/crypto';
import { createChildLogger } from '../utils/logger';
import { config } from '../config';

const logger = createChildLogger('webhook-handler');

export class GitHubWebhookHandler {
  private githubService: GitHubAPIService;
  private metrics = {
    processed: 0,
    success: 0,
    failed: 0,
  };

  constructor() {
    this.githubService = new GitHubAPIService();
  }

  public async handleWebhook(req: Request, res: Response): Promise<void> {
    const headers = req.headers as unknown as WebhookHeaders;
    const event = headers['x-github-event'];
    const delivery = headers['x-github-delivery'];
    
    logger.info({ event, delivery }, 'Received webhook');

    if (!this.verifySignature(req)) {
      logger.error({ delivery }, 'Invalid webhook signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    if (event !== 'repository') {
      logger.debug({ event }, 'Ignoring non-repository event');
      res.status(200).json({ message: 'Event ignored' });
      return;
    }

    const payload = req.body as RepositoryCreatedPayload;
    
    if (payload.action !== 'created') {
      logger.debug({ action: payload.action }, 'Ignoring non-created action');
      res.status(200).json({ message: 'Action ignored' });
      return;
    }

    res.status(202).json({ message: 'Processing webhook' });

    this.processRepositoryCreated(payload).catch((error) => {
      logger.error({ error, delivery }, 'Failed to process webhook');
    });
  }

  private verifySignature(req: Request): boolean {
    const signature = (req.headers as unknown as WebhookHeaders)['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);
    
    return verifyWebhookSignature(payload, signature, config.github.webhookSecret);
  }

  private async processRepositoryCreated(payload: RepositoryCreatedPayload): Promise<void> {
    this.metrics.processed++;
    
    const { repository, organization } = payload;
    const repoName = repository.name;
    const orgName = organization?.login ?? repository.owner.login;
    
    logger.info(
      { repository: repoName, organization: orgName },
      'Processing repository created event',
    );

    try {
      // Check if there are any pending GitHub Classroom bot invitations
      const invitations = await this.githubService.listRepositoryInvitations(orgName, repoName);
      logger.info(
        { repository: repoName, invitationCount: invitations.length },
        'Found repository invitations',
      );

      // Find GitHub Classroom bot invitations
      const botInvitations = invitations.filter(
        (inv) => inv.inviter?.login === 'github-classroom[bot]'
      );

      if (botInvitations.length === 0) {
        logger.info(
          { repository: repoName },
          'No GitHub Classroom bot invitations found, skipping',
        );
        return;
      }

      logger.info(
        { repository: repoName, botInvitationCount: botInvitations.length },
        'Found GitHub Classroom bot invitations, processing',
      );

      // Process bot invitations
      await this.processBotInvitations(orgName, repoName, botInvitations);
      
    } catch (error) {
      logger.error(
        { error, repository: repoName, organization: orgName },
        'Error processing repository created event',
      );
      this.metrics.failed++;
    }
  }

  private async processBotInvitations(
    org: string,
    repo: string,
    botInvitations: any[],
  ): Promise<void> {
    logger.info(
      { org, repo, botInvitationCount: botInvitations.length },
      'Processing GitHub Classroom bot invitations',
    );

    // Process each bot invitation
    for (const botInvitation of botInvitations) {
      const inviteeUsername = botInvitation.invitee?.login;
      
      if (!inviteeUsername) {
        logger.warn(
          { invitationId: botInvitation.id },
          'Bot invitation has no invitee username',
        );
        continue;
      }

      logger.info(
        { 
          org, 
          repo, 
          invitee: inviteeUsername,
          invitationId: botInvitation.id,
          inviter: botInvitation.inviter?.login,
          permission: botInvitation.permissions
        },
        'Processing GitHub Classroom bot invitation',
      );

      // Check if invitee already has access (might have accepted invitation)
      const collaboratorStatus = await this.githubService.checkCollaborator(
        org,
        repo,
        inviteeUsername,
      );

      if (collaboratorStatus.exists) {
        logger.info(
          { org, repo, invitee: inviteeUsername, permission: collaboratorStatus.permission },
          'Invitee already has access to repository, skipping',
        );
        continue;
      }

      // Delete the bot invitation
      const deleteResult = await this.githubService.deleteRepositoryInvitation(
        org,
        repo,
        botInvitation.id,
      );

      if (!deleteResult.success) {
        logger.error(
          { result: deleteResult, invitationId: botInvitation.id },
          'Failed to delete bot invitation',
        );
        this.metrics.failed++;
        continue;
      }

      logger.info(
        { org, repo, invitee: inviteeUsername, invitationId: botInvitation.id },
        'Successfully removed bot invitation',
      );

      // Send new invitation from current authenticated user with write access by default
      if (config.features.autoAddCollaborator) {
        logger.info(
          { org, repo, invitee: inviteeUsername },
          'Sending new invitation from authenticated user',
        );

        // Use 'push' (write) permission by default, or original permission if specified
        const permission = 'push'; // Default to write access as requested
        
        const result = await this.githubService.sendRepositoryInvitation(
          org,
          repo,
          inviteeUsername,
          permission,
        );
        
        if (result.success) {
          this.metrics.success++;
          logger.info(
            { org, repo, invitee: inviteeUsername, permission, details: result.details },
            'Successfully sent new invitation with write access',
          );
        } else {
          this.metrics.failed++;
          logger.error(
            { result, invitee: inviteeUsername },
            'Failed to send invitation',
          );
        }
      } else {
        logger.info('Auto-add collaborator is disabled');
      }
    }
  }


  public getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }
}