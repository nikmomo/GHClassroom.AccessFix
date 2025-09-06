# Setup Guide for Real GitHub Classroom

## Prerequisites

1. **GitHub Personal Access Token**
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Required scopes:
     - `repo` (Full control of private repositories)
     - `admin:org` (Full control of orgs and teams, read and write org projects)
   - Copy the token and save it securely

2. **GitHub Organization Admin Access**
   - You need admin access to the GitHub Classroom organization (ece3574-fl25)

## Configuration Steps

### Step 1: Update Environment Variables

Edit `.env.production` file:

```bash
# Replace with your actual GitHub Personal Access Token
GITHUB_TOKEN=ghp_your_actual_token_here

# Your GitHub Classroom organization (already set)
GITHUB_ORG=ece3574-fl25

# Generate a secure webhook secret (use a random string)
WEBHOOK_SECRET=your_secure_webhook_secret_here
```

Generate a secure webhook secret:
```bash
# On Linux/Mac:
openssl rand -hex 32

# Or use any random string generator
```

### Step 2: Start the Server

You have two options:

#### Option A: Local Development with ngrok (Recommended for testing)

1. Start the server locally:
```bash
# Copy production config
cp .env.production .env

# Start in development mode for easier debugging
npm run dev

# Or start in production mode
npm start
```

2. Install and start ngrok:
```bash
# Install ngrok (if not installed)
# Download from: https://ngrok.com/download

# Start ngrok tunnel
ngrok http 3000
```

3. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)

#### Option B: Deploy to Cloud (For production)

Deploy to your preferred cloud platform (Heroku, AWS, GCP, etc.)

### Step 3: Configure GitHub Webhook

1. Go to your GitHub Organization settings:
   - Navigate to: https://github.com/organizations/ece3574-fl25/settings/hooks

2. Click "Add webhook"

3. Configure the webhook:
   - **Payload URL**: 
     - Local with ngrok: `https://your-ngrok-url.ngrok.io/webhook/github`
     - Production: `https://your-server.com/webhook/github`
   - **Content type**: `application/json`
   - **Secret**: Enter the same webhook secret from your `.env` file
   - **Which events would you like to trigger this webhook?**
     - Select "Let me select individual events"
     - Check: ✅ **Repositories** (for repository creation events)
     - Optionally check: ✅ **Repository invitations** (to monitor invitations)
   - **Active**: ✅ Check this box

4. Click "Add webhook"

### Step 4: Test the System

1. Monitor the server logs:
```bash
# You should see:
# [INFO]: Server started
# port: 3000
# env: "production"
# org: "ece3574-fl25"
```

2. Create a test assignment in GitHub Classroom:
   - Go to: https://classroom.github.com/classrooms/31011252-ece3574-fl25
   - Create or use existing assignment

3. Accept the assignment as a student:
   - Use the assignment link
   - Accept the assignment

4. Watch the logs for:
   - Webhook received
   - Repository identified as classroom repo
   - Bot invitation found and removed
   - New invitation sent

## How It Works

When a student accepts an assignment:

1. GitHub Classroom creates a new repository
2. GitHub sends a webhook to our server
3. Our system:
   - Identifies it as a classroom repository
   - Extracts the student username from repo name
   - Lists all invitations on the repository
   - Finds and removes the GitHub Classroom bot invitation
   - Sends a new invitation directly to the student
   - Student receives the new invitation

## Monitoring

Check the health endpoint:
```bash
curl http://localhost:3000/health
```

Check metrics:
```bash
curl http://localhost:3000/metrics
```

## Troubleshooting

### Webhook not receiving events
- Check webhook is active in GitHub settings
- Verify webhook secret matches
- Check ngrok is running (if local)
- Look for webhook delivery errors in GitHub webhook settings

### 401 Unauthorized errors
- Verify GitHub token is valid
- Check token has required permissions
- Ensure token hasn't expired

### Repository not being processed
- Check repository naming pattern
- Verify it matches classroom pattern
- Check logs for parsing errors

### Invitations not being sent
- Ensure DRY_RUN=false in production
- Verify student username exists on GitHub
- Check API rate limits

## Testing Checklist

- [ ] Server starts without errors
- [ ] Health endpoint returns healthy status
- [ ] Webhook endpoint is accessible
- [ ] GitHub webhook configured and active
- [ ] Test assignment created
- [ ] Assignment accepted by test student
- [ ] Webhook received by server
- [ ] Bot invitation removed
- [ ] New invitation sent
- [ ] Student can access repository

## Security Notes

- Keep your GitHub token secure
- Use a strong webhook secret
- Consider IP whitelisting for production
- Monitor for unusual activity
- Rotate tokens regularly

## Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify all configuration values
3. Test with DRY_RUN=true first
4. Check GitHub webhook delivery logs