from pathlib import Path
import sys

# The same optional push dependencies must be available to web workers and cron commands.
push_packages = Path(__file__).resolve().parent.parent / '.push-venv' / 'lib' / f'python{sys.version_info.major}.{sys.version_info.minor}' / 'site-packages'
if push_packages.is_dir() and str(push_packages) not in sys.path:
    sys.path.insert(0, str(push_packages))

from .celery import app as celery_app
__all__ = ('celery_app',)
