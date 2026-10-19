import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image
from django.test import SimpleTestCase, TestCase, RequestFactory, override_settings
from django.test.utils import CaptureQueriesContext
from django.db import connection

from .media import preview_url, serve_media


class MediaFixtures:
    def setUp(self):
        super().setUp()
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.override = override_settings(MEDIA_ROOT=self.root, MEDIA_URL='/media/')
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.factory = RequestFactory()

    def image(self, mode='RGB', name='profiles/portrait.jpg'):
        source = self.root / name
        source.parent.mkdir(parents=True, exist_ok=True)
        Image.new(mode, (2400, 1600), (10, 80, 120, 100) if mode == 'RGBA' else (10, 80, 120)).save(source)
        return SimpleNamespace(path=str(source), url='/media/' + name, name=name)

    def path(self, url):
        return self.root / url.split('/media/', 1)[1]


class MediaPreviewTests(MediaFixtures, SimpleTestCase):
    def test_preview_smaller_original_untouched_and_cached(self):
        source = self.image()
        original = Path(source.path).read_bytes()
        url = preview_url(source, size=256)
        self.assertIn('/media/_thumbnails/', url)
        with Image.open(self.path(url)) as image:
            self.assertLessEqual(max(image.size), 256)
        self.assertLess(self.path(url).stat().st_size, len(original))
        self.assertEqual(Path(source.path).read_bytes(), original)
        with patch('confhub.media.Image.open', side_effect=AssertionError('Cache should skip decoding')):
            self.assertEqual(preview_url(source, size=256), url)

    def test_replaced_source_gets_new_versioned_url(self):
        source = self.image()
        first = preview_url(source)
        stat = Path(source.path).stat()
        os.utime(source.path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1000000))
        self.assertNotEqual(preview_url(source), first)

    def test_transparency_and_small_images(self):
        source = self.image('RGBA', 'sponsors/logo.png')
        url = preview_url(source)
        self.assertTrue(url.endswith('.png'))
        with Image.open(self.path(url)) as image:
            self.assertEqual(image.mode, 'RGBA')
            self.assertEqual(image.getpixel((0, 0))[3], 100)
        Image.new('RGB', (50, 50)).save(source.path)
        self.assertEqual(preview_url(source), source.url)

    def test_missing_or_corrupt_image_falls_back(self):
        source = SimpleNamespace(path=str(self.root / 'missing.jpg'), url='/media/missing.jpg', name='missing.jpg')
        self.assertEqual(preview_url(source), source.url)
        Path(source.path).write_bytes(b'invalid image')
        self.assertEqual(preview_url(source), source.url)
        self.assertIsNone(preview_url(None))

    def test_conditional_requests_and_public_image_cache(self):
        url = preview_url(self.image())
        path = url.removeprefix('/media/')
        response = serve_media(self.factory.get(url), path, document_root=self.root)
        self.assertEqual(response.status_code, 200)
        self.assertIn('immutable', response['Cache-Control'])
        etag = response['ETag']
        response.close()
        cached = serve_media(self.factory.get(url, HTTP_IF_NONE_MATCH=etag), path, document_root=self.root)
        self.assertEqual(cached.status_code, 304)
        self.assertEqual(cached['ETag'], etag)
        source = self.image(name='chat/images/private.jpg')
        uncached = serve_media(self.factory.get(source.url), source.name, document_root=self.root)
        self.assertNotIn('Cache-Control', uncached)
        uncached.close()

    def test_concurrent_generation_produces_valid_complete_image(self):
        source = self.image()
        with ThreadPoolExecutor(max_workers=4) as executor:
            urls = list(executor.map(lambda _: preview_url(source), range(4)))
        self.assertEqual(len(set(urls)), 1)
        with Image.open(self.path(urls[0])) as image:
            image.verify()
        self.assertFalse(list((self.root / '_thumbnails').glob('*.tmp')))


@override_settings(CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}})
class MediaApiTests(MediaFixtures, TestCase):
    def setUp(self):
        super().setUp()
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient
        self.user = get_user_model().objects.create_user('media-admin@example.com', role='super_admin')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_gallery_and_checkpoints_keep_originals_for_fullscreen(self):
        from apps.photos.models import Photo, SelfiePoint, SelfiePointImage, SelfieSubmission
        photo = self.image(name='photos/gallery.jpg')
        Photo.objects.create(uploader=self.user, image=photo.name, status='approved')
        gallery = self.client.get('/api/v1/photos/gallery/')
        self.assertEqual(gallery.status_code, 200)
        item = gallery.data['photos'][0]
        self.assertTrue(item['image_url'].endswith(photo.url))
        self.assertIn('/_thumbnails/', item['thumbnail_url'])
        sample = self.image(name='selfie_points/samples/reference.jpg')
        point = SelfiePoint.objects.create(name='Reference point', sample_photo=sample.name)
        SelfiePointImage.objects.create(selfie_point=point, image=sample.name)
        SelfieSubmission.objects.create(user=self.user, selfie_point=point, photo=photo.name,
                                       user_latitude=0, user_longitude=0, distance_meters=0)
        result = self.client.get('/api/v1/photos/checkpoints/')
        self.assertEqual(result.status_code, 200)
        item = result.data['points'][0]
        self.assertTrue(item['sample_photo_url'].endswith(sample.url))
        self.assertIn('/_thumbnails/', item['sample_thumbnail_url'])
        self.assertIn('/_thumbnails/', item['sample_thumbnail_urls'][0])
        self.assertTrue(item['submissions'][0]['photo_url'].endswith(photo.url))
        self.assertIn('/_thumbnails/', item['submissions'][0]['thumbnail_url'])

    def test_network_queries_do_not_grow_per_person(self):
        from django.contrib.auth import get_user_model
        from django.core.cache import cache
        cache.clear()
        get_user_model().objects.bulk_create([
            get_user_model()(email=f'media-staff{i}@example.com', role='staff') for i in range(50)])
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get('/api/v1/checkins/network/')
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data['organizers']), 50)
        self.assertLessEqual(len(queries), 12)

    def test_speaker_and_sponsor_lists_use_previews_details_keep_original(self):
        from apps.speakers.models import Speaker
        from apps.sponsors.models import Sponsor
        photo = self.image(name='speakers/photos/speaker.jpg')
        speakers = [Speaker.objects.create(first_name=f'Speaker{i}', last_name='Example', photo=photo.name)
                    for i in range(10)]
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get('/api/v1/speakers/')
        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(len(queries), 4)
        self.assertIn('/_thumbnails/', response.data['speakers'][0]['photo_url'])
        detail = self.client.get(f'/api/v1/speakers/{speakers[0].pk}/')
        self.assertTrue(detail.data['photo_url'].endswith(photo.url))
        logo = self.image('RGBA', name='sponsors/logos/logo.png')
        sponsor = Sponsor.objects.create(name='Sponsor', tier='gold', logo=logo.name)
        listing = self.client.get('/api/v1/sponsors/')
        self.assertIn('/_thumbnails/', listing.data['groups'][0]['sponsors'][0]['logo_url'])
