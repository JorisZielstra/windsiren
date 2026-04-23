import io
import sqlalchemy
import pg8000
from google.cloud.sql.connector import connector
from flask import send_file, make_response

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


def record_pixel(request):
    """Record a OPEN event for the content invoking the endpoint.
    Args:
        request (flask.Request): HTTP request object.
           -> Expected URL parameters: 'uid', 'email_ts', 'email_type'
           -> Additional URL parameters: 'experiment_id', 'experiment_group'
    Returns:
        response (flask.Response): Containing 1x1 tracking pixel image.
    """

    # pylint: disable-next=line-too-long
    transparent_pixel = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\x01sRGB\x00\xae\xce\x1c\xe9\x00\x00\x00\x04gAMA\x00\x00\xb1\x8f\x0b\xfca\x05\x00\x00\x00\x10IDATx\x01\x01\x05\x00\xfa\xff\x00\x00\x00\x00\x00\x00\x05\x00\x01dx\x958\x00\x00\x00\x00IEND\xaeB`\x82'

    response = make_response(send_file(io.BytesIO(transparent_pixel), mimetype="image/png"))
    response.headers['Content-Transfer-Encoding'] = "base64"

    # TODO: Better logging messages for GCloud

    if not request.args:
        print("Pixel requested without query parameters")
        return response

    # Check for required fields
    if "uid" in request.args and "email_ts" in request.args and "email_type" in request.args:
        uid = request.args["uid"]
        email_ts = request.args["email_ts"]
        email_type = request.args["email_type"]
        # experiment_id = request.args.get("experiment_id", None)
        # experiment_assigment = request.args.get("experiment_group", None)

        engine = init_connection_engine()

        with engine.connect() as connection:
            connection.execute(sqlalchemy.text(
                f"INSERT INTO email (uid, email_ts, email_type, action)\
                  VALUES ('{uid}', {email_ts}, '{email_type}', 'open')"))

    else:
        expected_arguments = ("uids", "email_ts", "email_type")
        missing_arguments = [arg for arg in expected_arguments if arg not in request.args]
        print(f"{missing_arguments} missing from query parameters")

    return response
