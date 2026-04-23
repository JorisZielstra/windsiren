import os
import base64
import json

from email.message import EmailMessage
from dotenv import load_dotenv

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

load_dotenv()

def send_weather_report(
        recipient: str, plaintext_report: str, report_date: str, html_report: str = None
        ) -> None:
    """
    Delivers the report to given recipient email address.
    """

    assert plaintext_report.strip() != "", "Empty email content is not allowed"

    creds = None

    # If you are missing credentials for GMAIL_COMPOSE_CREDENTIALS, they should be
    # acquired through this quickstart documentation:
    # https://developers.google.com/gmail/api/quickstart/python

    # To send emails appropriate scope permissions must be acquired for the sender email
    # (scope gmail.compose). More on Google Oauth permissions:
    # https://developers.google.com/identity/protocols/oauth2

    if os.getenv("GMAIL_COMPOSE_CREDENTIALS") is not None:
        credentials_mapping = json.loads(os.getenv("GMAIL_COMPOSE_CREDENTIALS"))
        creds = Credentials.from_authorized_user_info(
            credentials_mapping,
            scopes=["https://www.googleapis.com/auth/gmail.compose"])

    assert creds is not None, (
        "GMail credentials were not correctly loaded. "
        "Are credentials stored and pointed to by GMAIL_COMPOSE_CREDENTIALS env-variable?"
    )

    sender = os.getenv("GMAIL_USERNAME")

    email = EmailMessage()
    email["Subject"] = f"WindSiren report {report_date}"
    email["From"] = sender
    email["To"] = recipient

    email["List-Unsubscribe"] = f"mailto:{sender}?subject=unsubscribe"

    email.set_content(plaintext_report)

    if html_report is not None:
        email.add_alternative(html_report, subtype="html")

    # encoded message
    encoded_message = base64.urlsafe_b64encode(email.as_bytes()).decode()

    create_message = {
        "raw": encoded_message
    }


    # Call the Gmail API
    gmail_service = build("gmail", "v1", credentials=creds)
    # pylint: disable=E1101
    gmail_service.users().messages().send(userId="me", body=create_message).execute()
