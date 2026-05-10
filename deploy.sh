#!/bin/bash
PROJECT_ID="cakrana-app"
REGION="asia-southeast2"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/cakrana-repo/wifi-backend"

echo "🔨 Building backend image..."
docker build -t $IMAGE .

echo "📤 Pushing to Artifact Registry..."
gcloud auth configure-docker $REGION-docker.pkg.dev
docker push $IMAGE

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy wifi-backend \
  --image=$IMAGE \
  --platform=managed \
  --region=$REGION \
  --port=3002 \
  --allow-unauthenticated \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,GMAIL_USER=GMAIL_USER:latest,GMAIL_PASS=GMAIL_PASS:latest" \
  --set-env-vars="NODE_ENV=production,JWT_EXPIRES_IN=7d,FRONTEND_URL=https://wifi-frontend-978253671723.asia-southeast2.run.app" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3

echo "✅ Backend deployed!"
gcloud run services describe wifi-backend --region=$REGION --format="value(status.url)"