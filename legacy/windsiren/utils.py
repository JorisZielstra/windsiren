import hashlib

def email_to_uid(user_email: str) -> str:
    """
    Create a deterministic user identifier.
    """
    return hashlib.sha256(user_email.strip().lower().encode("utf-8")).hexdigest()


def tracking_pixel_url(user_email: str, email_timestamp: int, email_type: str,
        experiment_id: str = None, experiment_group: str = None
        ) -> str:
    """
    Generate a user specific tracking URL.
    """

    # XOR
    assert bool(experiment_id is not None) == bool(experiment_group is not None), (
        "Either experiment_id and experiment_group both must be defined or neither must be defined"
        )

    uid = email_to_uid(user_email)
    email_type = email_type.lower()

    if bool(experiment_id is not None) and bool(experiment_group is not None):
        return (
            "https://europe-west3-email-metrics-326719.cloudfunctions.net/Pixel?"
            f"uid={uid}&email_ts={email_timestamp}&email_type={email_type}"
            f"&experiment_id={experiment_id}&experiment_group={experiment_group}"
            )

    return (
        "https://europe-west3-email-metrics-326719.cloudfunctions.net/Pixel?"
        f"uid={uid}&email_ts={email_timestamp}&email_type={email_type}"
        )
