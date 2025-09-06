export interface Config {
  github: {
    token: string;
    org: string;
    webhookSecret: string;
  };
  server: {
    port: number;
    env: 'development' | 'production' | 'test';
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'pretty';
  };
  features: {
    dryRun: boolean;
    autoAddCollaborator: boolean;
    defaultPermission: 'pull' | 'push' | 'admin' | 'maintain' | 'triage';
  };
  rateLimiting: {
    maxRetries: number;
    retryDelay: number;
  };
  monitoring: {
    enableMetrics: boolean;
    metricsPort: number;
  };
  security: {
    allowedIPs?: string[];
    corsOrigin: string;
  };
}

export interface RepositoryCreatedPayload {
  action: 'created';
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    owner: {
      login: string;
      id: number;
    };
    html_url: string;
    description: string | null;
    created_at: string;
    default_branch: string;
  };
  organization?: {
    login: string;
    id: number;
  };
  sender: {
    login: string;
    id: number;
  };
}

export interface ParsedRepoInfo {
  isClassroomRepo: boolean;
  assignmentName?: string;
  studentUsername?: string;
  teamName?: string;
  repoType?: 'individual' | 'team';
}

export interface CollaboratorCheckResult {
  exists: boolean;
  permission?: string;
  needsUpdate: boolean;
}

export interface OperationResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  error?: Error;
}

export interface WebhookHeaders {
  'x-hub-signature-256'?: string;
  'x-github-event'?: string;
  'x-github-delivery'?: string;
  'content-type'?: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  github: {
    connected: boolean;
    rateLimit?: {
      remaining: number;
      reset: Date;
    };
  };
  metrics?: {
    processed: number;
    success: number;
    failed: number;
  };
}