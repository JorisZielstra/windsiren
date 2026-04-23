from typing import Dict
import os
import logging
import requests

from dotenv import load_dotenv

load_dotenv()

def daily_forecast(latitude: float, longitude: float) -> Dict:
    """
    Fetches the weather forecast for the given coordinates.
    """

    api_key = os.getenv("OPENWEATHERMAP_API_KEY")

    response = requests.get(
        "https://api.openweathermap.org/data/2.5/onecall",
        params={
            "lat": latitude,
            "lon": longitude,
            "exclude": "current,minutely,hourly,alerts",
            "units": "metric",
            "appid": api_key,
        }
    )

    if response.status_code != 200:
        logging.log(
            logging.ERROR, msg=(
                "Fetching weather forecast failed with status code "
                f"{response.status_code}, message: '{response.json()['message']}'")
            )
        if response.status_code == 401:
            logging.log(
                logging.ERROR, msg=(
                    "Request for weather forecast was unauthorized. Maybe API-key "
                    "is not available in the environment variables?")
                )
        raise ConnectionError(
            ("Fetching weather forecast failed with status code "
            f"{response.status_code}, message: '{response.json()['message']}'")
            )

    return response.json()
