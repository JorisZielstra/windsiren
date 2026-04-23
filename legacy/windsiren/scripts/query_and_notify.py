from typing import Dict, List, Tuple

MS_TO_KNOTS_MULTIPLIER = 1.9438

def safe_wind_window(minimum: float, maximum: float, predicted: float) -> bool:
    """
    Check if predicted wind direction is within safe bounds.
    """

    # Safe window runs over 0* mark
    if minimum > maximum:
        if (minimum <= predicted <= 360) or (0.0 <= predicted <= maximum):
            return True
    else:
        if minimum <= predicted <= maximum:
            return True

    return False


def favourable_kiting_conditions(location_forecast: Dict, location_information: Dict) -> bool:
    """
    Evaluate if forecasted weather is favourable for the location.
    """

    wind_knots = float(location_forecast["wind_speed"]) * MS_TO_KNOTS_MULTIPLIER

    if (wind_knots >= 17.0 and
        safe_wind_window(
            float(location_information["Windwindow"]["Minimum"]),
            float(location_information["Windwindow"]["Maximum"]),
            float(location_forecast["wind_deg"])
            )):
        return True

    return False


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--recipient", help="")
    arguments = parser.parse_args()

    import json
    import logging
    import os
    import datetime
    import smtplib

    from windsiren import integration
    from windsiren.utils import tracking_pixel_url
    from windsiren.notifications.kitesurf import html_report, plaintext_report

    from dotenv import load_dotenv

    load_dotenv()

    # TODO Move user collection away from code
    # TODO Add linting/verification for the email addresses
    if arguments.recipient is None:
        recipients = ["windsiren.nederland@gmail.com", "zielstra.jy@gmail.com", "mark@knijn.net",
                      "vince-vissers@hotmail.com", "boschtijmen@gmail.com", "c.o.zanen@gmail.com",
                      "sanne_simons@hotmail.com", "samdelorm2@gmail.com",]
    else:
        recipients = [arguments.recipient]


    kitespots_path = os.path.realpath(
        os.path.join(
            os.path.dirname(__file__), "..", "..", "constants", "kitespots.json"
        )
    )

    with open(kitespots_path, "r", encoding="utf-8") as kitespots:
        locations = json.load(kitespots)["kitespots"]

    assert locations is not None
    assert locations

    for location in locations:
        try:
            latitude, longitude = float(location["Latitude"]), float(location["Longitude"])

            assert latitude is not None
            assert longitude is not None

            forecast = integration.openweathermap.daily_forecast(latitude, longitude)

            location["Forecasts"] = forecast

        except KeyError:
            logging.log(logging.ERROR, msg=f"Invalid key in locations.json. Entry: {location}")


    daily_favourable_locations: List[Tuple[str, List[Tuple[str, float, float]]]] = []

    for day in range(len(locations[0]["Forecasts"]["daily"])):
        favourable_locations = []

        for location in locations:

            if "Forecasts" not in location:
                continue

            if favourable_kiting_conditions(location["Forecasts"]["daily"][day], location):
                location_name = location['Name']
                wind_speed_knots = (
                    float(location["Forecasts"]["daily"][day]["wind_speed"]) * MS_TO_KNOTS_MULTIPLIER # pylint: disable=line-too-long
                )
                wind_gusts_knots = (
                    float(location["Forecasts"]["daily"][day]["wind_gust"]) * MS_TO_KNOTS_MULTIPLIER
                )

                favourable_locations.append((location_name, wind_speed_knots, wind_gusts_knots))

        if favourable_locations:

            date = datetime.date.today() + datetime.timedelta(days=day)

            sorted_locations = sorted(favourable_locations, key=lambda x: float(x[1]), reverse=True)
            top_five = sorted_locations[:5]

            daily_favourable_locations.append((f"Date {date.strftime('%a %d.%m')}", top_five))


    # Only send newsletters if favourable locations are available
    if any((locations for _, locations in daily_favourable_locations)):

        for user_email in recipients:

            timestamp = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
            if arguments.recipient is not None:
                EMAIL_TYPE = "development-test"
            else:
                EMAIL_TYPE = "kitesurf-weather"

            tracking_pixel = tracking_pixel_url(user_email, timestamp, EMAIL_TYPE)

            prepared_html_report = html_report(daily_favourable_locations, tracking_pixel)
            plaintext_alternative = plaintext_report(daily_favourable_locations)

            email_date = datetime.datetime.fromtimestamp(timestamp).strftime("%a %d.%m")

            try:

                integration.gmail.send_weather_report(
                    user_email, plaintext_alternative,
                    email_date, html_report=prepared_html_report
                    )

                logging.log(logging.INFO, msg=f"Report successfully send to {user_email}")

            except smtplib.SMTPAuthenticationError as e:
                logging.log(logging.ERROR,
                    msg=f"Emailing report to {user_email} raised an error: {e}"
                    )
                raise e

    else:
        logging.log(logging.INFO,
            msg="No favourable weather conditions forecasted. Skipping emails"
            )
