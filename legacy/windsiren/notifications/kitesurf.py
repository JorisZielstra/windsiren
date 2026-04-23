from typing import List, Tuple
import os
import jinja2


def html_report(
        favourable_weather_conditions: List[Tuple[str, List[Tuple[str, float, float]]]],
        tracking_pixel_url: str
        ) -> str:
    """
    Generates an html report for favourable weather conditions.
    """

    template_dir = os.path.realpath(
        os.path.join(
            os.path.dirname(__file__), "email_templates"
        )
    )
    template_loader = jinja2.FileSystemLoader(searchpath=template_dir)
    template_env = jinja2.Environment(loader=template_loader)
    template = template_env.get_template("kitespot-html-template.jinja")

    return template.render({
        "weather_days": favourable_weather_conditions,
        "pixel_url": tracking_pixel_url
    })


def plaintext_report(
        favourable_weather_conditions: List[Tuple[str, List[Tuple[str, float, float]]]]
        ) -> str:
    """
    Generates a plaintext report for favourable weahter conditions.
    """

    template_dir = os.path.realpath(
        os.path.join(
            os.path.dirname(__file__), "email_templates"
        )
    )
    template_loader = jinja2.FileSystemLoader(searchpath=template_dir)
    template_env = jinja2.Environment(loader=template_loader)
    template = template_env.get_template("kitespot-plaintext-template.jinja")

    return template.render({
        "weather_days": favourable_weather_conditions
    })
