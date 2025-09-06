import { Request, Response } from 'express';
import type { RepositoryCreatedPayload, WebhookHeaders } from '../types';
import { GitHubAPIService } from '../services/github-api';
import { RepositoryParser } from '../services/repository-parser';
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

    const parsedInfo = RepositoryParser.parse(repoName);
    
    if (!parsedInfo.isClassroomRepo) {
      logger.info({ repository: repoName }, 'Not a classroom repository, skipping');
      return;
    }

    logger.info(
      { repository: repoName, parsedInfo },
      'Identified as classroom repository',
    );

    if (parsedInfo.repoType === 'individual' && parsedInfo.studentUsername) {
      await this.handleIndividualAssignment(
        orgName,
        repoName,
        parsedInfo.studentUsername,
      );
    } else if (parsedInfo.repoType === 'team' && parsedInfo.teamName) {
      await this.handleTeamAssignment(
        orgName,
        repoName,
        parsedInfo.teamName,
      );
    }
  }

  private async handleIndividualAssignment(
    org: string,
    repo: string,
    studentUsername: string,
  ): Promise<void> {
    logger.info(
      { org, repo, student: studentUsername },
      'Handling individual assignment',
    );

    try {
      // List all invitations on the repository
      const invitations = await this.githubService.listRepositoryInvitations(org, repo);
      logger.info(
        { org, repo, invitationCount: invitations.length },
        'Found repository invitations',
      );

      // Find ALL GitHub Classroom bot invitations (not just for specific student)
      const botInvitations = invitations.filter(
        (inv) => inv.inviter?.login === 'github-classroom[bot]'
      );

      if (botInvitations.length === 0) {
        logger.info(
          { org, repo },
          'No GitHub Classroom bot invitations found',
        );
        this.metrics.success++;
        return;
      }

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
          'Found GitHub Classroom bot invitation, processing',
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

        // Send new invitation from current authenticated user
        if (config.features.autoAddCollaborator) {
          logger.info(
            { org, repo, invitee: inviteeUsername },
            'Sending new invitation from authenticated user',
          );

          const result = await this.githubService.sendRepositoryInvitation(
            org,
            repo,
            inviteeUsername,
            botInvitation.permissions || config.features.defaultPermission,
          );
          
          if (result.success) {
            this.metrics.success++;
            logger.info(
              { org, repo, invitee: inviteeUsername, details: result.details },
              'Successfully sent new invitation',
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
    } catch (error) {
      logger.error(
        { error, org, repo },
        'Error handling individual assignment',
      );
      this.metrics.failed++;
    }
  }

  private async handleTeamAssignment(
    org: string,
    repo: string,
    teamName: string,
  ): Promise<void> {
    logger.info(
      { org, repo, team: teamName },
      'Handling team assignment',
    );

    try {
      const orgMembers = await this.githubService.getOrgMembers(org);
      const students = RepositoryParser.extractStudentsFromTeam(teamName, orgMembers);
      
      if (students.length === 0) {
        logger.warn(
          { team: teamName },
          'Could not extract student usernames from team name',
        );
        this.metrics.failed++;
        return;
      }

      logger.info(
        { team: teamName, students },
        'Extracted students from team name',
      );

      for (const student of students) {
        await this.handleIndividualAssignment(org, repo, student);
      }
    } catch (error) {
      logger.error(
        { error, org, repo, team: teamName },
        'Error handling team assignment',
      );
      this.metrics.failed++;
    }
  }

  public getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }
}