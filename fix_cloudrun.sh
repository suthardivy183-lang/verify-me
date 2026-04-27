#!/bin/bash
gcloud run services update asli-api --region=asia-south1 --project=asli-solution-challenge --memory=4Gi --cpu=2 --timeout=300 --set-env-vars="GEMINI_API_KEY=AIzaSyC38sT6UidDUnqSKxu6a5Tg963KIbAXmXk,ALLOWED_ORIGINS=https://asli-solution-challenge.web.app" --min-instances=1 --cpu-boost
