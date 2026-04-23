# Tracking pixel endpoint

## Deploy

To deploy the function to Google Cloud Functions, either use (1) Gcloud tools and run the following:
```
gcloud functions deploy record-send --region=europe-west3 --runtime=python38 --trigger-http --allow-unauthenticated --entry-point=record_email_send --memory=128MB --source=cloud_functions/sends_logging/ --project=email-metrics-326719 --service-account=email-metrics-326719@appspot.gserviceaccount.com
```

 or (2) [Google cloud console](https://console.cloud.google.com/functions/list?authuser=3project=email-metrics-326719)

## Testing

You can locally test the cloud functions by installing 'functions framework' with `pip3 install functions_framework`.

Afterwards you can start a **local test-server** by running:
```
functions-framework --target record_email_send --signature-type http --source cloud_functions/sends_logging/main.py
```

When the test-server is running it is possible to simulate tracking pixel calls by sending requests to `http://localhost:8080`
