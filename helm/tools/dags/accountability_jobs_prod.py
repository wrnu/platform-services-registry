import os
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
from _accountability_jobs import call_accountability_job
from _task_failure_callback import send_alert

BASE_URL = "https://registry.developer.gov.bc.ca"

KC_AUTH_URL = "https://loginproxy.gov.bc.ca/auth"
KC_REALM = "platform-services"
REGISTRY_PROVISION_SA_ID = os.getenv("PROD_PROVISION_SA_ID")
REGISTRY_PROVISION_SA_SECRET = os.getenv("PROD_PROVISION_SA_SECRET")

KC_KWARGS = {
    "base_url": BASE_URL,
    "kc_auth_url": KC_AUTH_URL,
    "kc_realm": KC_REALM,
    "kc_client_id": REGISTRY_PROVISION_SA_ID,
    "kc_client_secret": REGISTRY_PROVISION_SA_SECRET,
}

with DAG(
    dag_id="accountability_jobs_prod",
    description="Public Cloud accountability scheduled jobs (prod)",
    schedule="0 6 * * *",
    start_date=datetime.now() - timedelta(days=1),
    is_paused_upon_creation=True,
    catchup=False,
) as dag:
    quarterly_reminder = PythonOperator(
        task_id="quarterly-forecast-reminder",
        python_callable=call_accountability_job,
        op_kwargs={**KC_KWARGS, "job": "quarterly-reminder"},
        on_failure_callback=lambda context: send_alert(context, context["dag"].dag_id),
    )

    weekly_signoff = PythonOperator(
        task_id="weekly-signoff-reminder",
        python_callable=call_accountability_job,
        op_kwargs={**KC_KWARGS, "job": "weekly-signoff-reminder"},
        on_failure_callback=lambda context: send_alert(context, context["dag"].dag_id),
    )

    monthly_recap = PythonOperator(
        task_id="monthly-accountability-recap",
        python_callable=call_accountability_job,
        op_kwargs={**KC_KWARGS, "job": "monthly-recap"},
        on_failure_callback=lambda context: send_alert(context, context["dag"].dag_id),
    )

    m_plus_one = PythonOperator(
        task_id="m-plus-one-escalation",
        python_callable=call_accountability_job,
        op_kwargs={**KC_KWARGS, "job": "m-plus-one-escalation"},
        on_failure_callback=lambda context: send_alert(context, context["dag"].dag_id),
    )

    [quarterly_reminder, weekly_signoff, monthly_recap, m_plus_one]
