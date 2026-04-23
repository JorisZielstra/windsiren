from setuptools import setup

setup(name="windsiren",
      version="0.2.0",
      description="Notifications on favourable kitesurfing conditions",
      install_requires=[
          "python-dotenv>=0.19.0",
          "requests>=2.26.0",
          "Jinja2>=3.0.1",
          "google-auth-oauthlib==0.5.2",
          "google-api-python-client==2.54.0"
      ],
      packages=["windsiren", "windsiren.integration", "windsiren.notifications"],
      include_package_data=True,
      package_data={
          "windsiren": [
              "notifications/email_templates/kitespot-html-template.jinja",
              "notifications/email_templates/kitespot-plaintext-template.jinja"
              ]
      },
      scripts=[
          "windsiren/scripts/query_and_notify.py"
      ],
      data_files=[
          ("location_data", ["constants/kitespots.json"]),
      ],
      zip_safe=False)
