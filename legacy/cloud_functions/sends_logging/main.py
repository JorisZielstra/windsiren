import sqlalchemy
import pg8000
from google.cloud.sql.connector import connector
from flask import abort

def init_connection_engine() -> sqlalchemy.engine.Engine:
    """
    Open connection to metrics database.
    """

    def getconn() -> pg8000.dbapi.Connection:
        conn: pg8000.dbapi.Connection = connector.connect(
            "email-metrics-326719:europe-west1:metrics",
            "pg8000",
            user="email-metrics-326719@appspot",
            db="telemetry",
            enable_iam_auth=True,
        )
        return conn

    engine = sqlalchemy.create_engine(
        "postgresql+pg8000://",
        creator=getconn,
    )

    return engine


def record_email_send(request):
    """Record a OPEN event for the content invoking the endpoint.
    Args:
        request (flask.Request): HTTP request object.
           -> Expected URL parameters: 'uids', 'email_ts', 'email_type'
           -> Additional URL parameters: 'experiment_id', 'experiment_group'
    Returns:
        response (flask.Response): Success/Failure
    """

    # TODO: Better logging messages for GCloud

    post_params = request.get_json()

    if not post_params:
        print("record_email_send invoked without json parameters")
        return abort(400)

    # Check for required fields
    if "uids" in post_params and "email_ts" in post_params and "email_type" in post_params:

        long_form_data = ", ".join(
            [f"('{uid}', {post_params['email_ts']}, '{post_params['email_type']}', 'send')" for uid in post_params["uids"]] # pylint: disable=line-too-long
            )

        engine = init_connection_engine()

        with engine.connect() as connection:
            connection.execute(sqlalchemy.text(
                f"INSERT INTO email (uid, email_ts, email_type, action)\
                  VALUES {long_form_data};"))

    else:
        expected_arguments = ("uids", "email_ts", "email_type")
        missing_arguments = [arg for arg in expected_arguments if arg not in post_params]
        print(f"{missing_arguments} missing from query parameters")
        abort(400)

    return ("", 200)
