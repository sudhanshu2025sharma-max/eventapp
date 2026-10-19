"""Small, versioned previews for image lists; uploaded originals stay intact."""
import hashlib
import logging
import os
from pathlib import Path
from tempfile import NamedTemporaryFile

from PIL import Image, ImageOps
from django.conf import settings
from django.http import HttpResponseNotModified
from django.utils.cache import patch_cache_control
from django.utils.http import parse_etags
from django.views.static import serve

logger = logging.getLogger(__name__)
PREVIEW_VERSION = '1'


def preview_url(image, request=None, size=480):
    if not image:
        return None
    original_url = image.url
    url = original_url
    temporary = None
    try:
        root = Path(settings.MEDIA_ROOT).resolve()
        source = Path(image.path).resolve()
        source.relative_to(root)
        stat = source.stat()
        key = hashlib.sha256(
            f'{PREVIEW_VERSION}:{source.relative_to(root)}:{stat.st_mtime_ns}:{stat.st_size}:{size}'.encode()
        ).hexdigest()
        directory = root / '_thumbnails'
        # The file extension is deterministic once the original format is known.
        cached = next((p for p in (directory / f'{key}.jpg', directory / f'{key}.png') if p.is_file()), None)
        if cached is None:
            with Image.open(source) as raw:
                if getattr(raw, 'is_animated', False):
                    return request.build_absolute_uri(url) if request else url
                if max(raw.size) <= size and stat.st_size <= 96 * 1024:
                    return request.build_absolute_uri(url) if request else url
                image_data = ImageOps.exif_transpose(raw)
                image_data.thumbnail((size, size), Image.Resampling.LANCZOS)
                alpha = 'A' in image_data.getbands() or 'transparency' in image_data.info
                image_data = image_data.convert('RGBA' if alpha else 'RGB')
                extension = 'png' if alpha else 'jpg'
                directory.mkdir(parents=True, exist_ok=True)
                cached = directory / f'{key}.{extension}'
                with NamedTemporaryFile(dir=directory, suffix='.tmp', delete=False) as output:
                    temporary = output.name
                    if alpha:
                        image_data.save(output, format='PNG', optimize=True)
                    else:
                        image_data.save(output, format='JPEG', quality=80, optimize=True, progressive=True)
                os.replace(temporary, cached)
                temporary = None
        url = settings.MEDIA_URL.rstrip('/') + '/_thumbnails/' + cached.name
    except (OSError, ValueError, AttributeError, NotImplementedError, Image.DecompressionBombError):
        logger.debug('Using original image for %s', getattr(image, 'name', ''), exc_info=True)
    finally:
        if temporary:
            Path(temporary).unlink(missing_ok=True)
    return request.build_absolute_uri(url) if request else url


def serve_media(request, path, document_root=None):
    response = serve(request, path, document_root=document_root)
    # Do not change caching for chat attachments, documents or error reports.
    public_image_dirs = {'_thumbnails', 'profiles', 'staff', 'speakers', 'sponsors',
                         'photos', 'selfie_points', 'selfie_submissions'}
    parts = Path(path).parts
    if (response.status_code not in (200, 304) or not parts or parts[0] not in public_image_dirs
            or Path(path).suffix.lower() not in {'.jpg', '.jpeg', '.png', '.webp', '.gif'}):
        return response
    source = Path(document_root) / path
    stat = source.stat()
    etag = f'"{stat.st_mtime_ns:x}-{stat.st_size:x}"'
    if response.status_code == 200 and (etag in parse_etags(request.headers.get('If-None-Match', ''))
                                        or request.headers.get('If-None-Match') == '*'):
        modified = response.get('Last-Modified')
        response.close()
        response = HttpResponseNotModified()
        if modified:
            response['Last-Modified'] = modified
    response['ETag'] = etag
    if parts[0] == '_thumbnails':
        patch_cache_control(response, public=True, max_age=31536000, immutable=True)
    else:
        patch_cache_control(response, public=True, max_age=3600)
    return response
