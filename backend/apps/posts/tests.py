from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.template.loader import render_to_string
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient

from apps.accounts.models import StaffPermission
from .models import FeedPost, FeedQuizResponse


@override_settings(CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}})
class FeedQuizTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.admin = User.objects.create_user('quiz-admin@example.com', role='super_admin')
        cls.participant = User.objects.create_user('quiz-player@example.com')
        cls.staff = User.objects.create_user('quiz-staff@example.com', role='staff')

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.data = {
            'title': 'Conference quiz', 'body': 'Test your knowledge.',
            'post_type': 'quiz', 'quiz_type': 'multiple_choice',
            'quiz_question': 'Which answer is correct?',
            'quiz_options': ['First', 'Second', 'Third'], 'quiz_correct_option': 1,
            'link_url': 'https://example.com/resources', 'send_push': False,
        }

    def create_quiz(self, **changes):
        response = self.client.post('/api/v1/posts/admin/feed/', {**self.data, **changes}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return FeedPost.objects.get(pk=response.data['post']['id'])

    def answer(self, post, option=1):
        return self.client.post(f'/api/v1/posts/feed/{post.pk}/answer/', {'selected_option': option}, format='json')

    def test_correct_answer_hidden_until_submission_and_persists(self):
        post = self.create_quiz()
        self.client.force_authenticate(self.participant)
        before = self.client.get('/api/v1/posts/feed/').data['results'][0]
        self.assertEqual(before['link_url'], self.data['link_url'])
        self.assertNotIn('correct_option', before['quiz'])
        submitted = self.answer(post)
        self.assertEqual(submitted.status_code, 201)
        self.assertTrue(submitted.data['quiz']['is_correct'])
        after = self.client.get('/api/v1/posts/feed/').data['results'][0]['quiz']
        self.assertTrue(after['answered'])
        self.assertEqual(after['selected_option'], 1)
        self.assertEqual(after['correct_option'], 1)

    def test_repeated_submission_cannot_change_answer(self):
        post = self.create_quiz()
        self.client.force_authenticate(self.participant)
        self.assertEqual(self.answer(post, 0).status_code, 201)
        retry = self.answer(post, 1)
        self.assertEqual(retry.status_code, 200)
        self.assertFalse(retry.data['quiz']['is_correct'])
        self.assertEqual(retry.data['quiz']['selected_option'], 0)
        self.assertEqual(post.quiz_responses.count(), 1)

    def test_true_false_and_admin_results(self):
        post = self.create_quiz(quiz_type='true_false', quiz_options=[], quiz_correct_option=0)
        self.assertEqual(post.quiz_options, ['True', 'False'])
        self.client.force_authenticate(self.participant)
        self.assertTrue(self.answer(post, 0).data['quiz']['is_correct'])
        self.client.force_authenticate(self.admin)
        quiz = self.client.get('/api/v1/posts/admin/feed/').data['results'][0]['quiz']
        self.assertEqual(quiz['option_counts'], [1, 0])
        self.assertEqual(quiz['response_count'], 1)

    def test_validation_rejects_invalid_quizzes_and_links(self):
        cases = [
            {'quiz_question': ''}, {'quiz_type': 'other'},
            {'quiz_options': ['one']}, {'quiz_options': ['one', 'ONE']},
            {'quiz_options': ['one', ' ']}, {'quiz_options': ['a', 2]},
            {'quiz_options': ['a'] * 7}, {'quiz_options': 'bad json'},
            {'quiz_correct_option': 3}, {'quiz_correct_option': True},
            {'quiz_correct_option': 0.5},
            {'link_url': 'javascript:alert(1)'}, {'link_url': 'ftp://example.com'},
            {'link_url': 123}, {'post_type': 'unknown'},
        ]
        for changes in cases:
            with self.subTest(changes=changes):
                response = self.client.post('/api/v1/posts/admin/feed/', {**self.data, **changes}, format='json')
                self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(FeedPost.objects.count(), 0)

    def test_answer_requires_integer_valid_index_and_live_quiz(self):
        post = self.create_quiz()
        self.client.force_authenticate(self.participant)
        for option in [-1, 3, True, '1', None, 0.5]:
            self.assertEqual(self.answer(post, option).status_code, 400)
        FeedPost.objects.filter(pk=post.pk).update(published_at=timezone.now() + timedelta(days=1))
        self.assertEqual(self.answer(post).status_code, 404)
        FeedPost.objects.filter(pk=post.pk).update(published_at=None)
        self.assertEqual(self.answer(post).status_code, 404)
        normal = FeedPost.objects.create(title='News', body='Hello')
        self.assertEqual(self.answer(normal).status_code, 400)
        self.assertEqual(FeedQuizResponse.objects.count(), 0)

    def test_admin_permissions_for_create_edit_and_results(self):
        post = self.create_quiz()
        endpoint = f'/api/v1/posts/admin/feed/{post.pk}/'
        for user in [self.participant, self.staff]:
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get('/api/v1/posts/admin/feed/').status_code, 403)
            self.assertEqual(self.client.post('/api/v1/posts/admin/feed/', self.data, format='json').status_code, 403)
            self.assertEqual(self.client.patch(endpoint, {'body': 'Changed'}, format='json').status_code, 403)
        StaffPermission.objects.create(user=self.staff, module='feed')
        self.assertEqual(self.client.get('/api/v1/posts/admin/feed/').status_code, 200)

    def test_quiz_edits_locked_after_response_but_link_can_change(self):
        post = self.create_quiz()
        self.client.force_authenticate(self.participant)
        self.answer(post)
        self.client.force_authenticate(self.admin)
        endpoint = f'/api/v1/posts/admin/feed/{post.pk}/'
        for changes in [{'quiz_question': 'New question'}, {'quiz_correct_option': 0},
                        {'quiz_options': ['Changed', 'Second', 'Third']}, {'post_type': 'general'}]:
            self.assertEqual(self.client.patch(endpoint, changes, format='json').status_code, 400)
        updated = self.client.patch(endpoint, {'link_url': '', 'body': 'New description'}, format='json')
        self.assertEqual(updated.status_code, 200)
        post.refresh_from_db()
        self.assertEqual(post.link_url, '')
        self.assertEqual(post.quiz_question, self.data['quiz_question'])

    def test_unanswered_quiz_can_be_edited_and_regular_posts_work(self):
        post = self.create_quiz()
        endpoint = f'/api/v1/posts/admin/feed/{post.pk}/'
        changed = self.client.patch(endpoint, {'quiz_correct_option': 2}, format='json')
        self.assertEqual(changed.status_code, 200)
        normal = self.client.patch(endpoint, {'post_type': 'general'}, format='json')
        self.assertEqual(normal.status_code, 200)
        self.assertIsNone(normal.data['post']['quiz'])
        post.refresh_from_db()
        self.assertEqual(post.quiz_options, [])

    def test_anonymous_cannot_answer(self):
        post = self.create_quiz()
        self.client.force_authenticate(None)
        self.assertIn(self.answer(post).status_code, [401, 403])

    def test_web_admin_creates_and_edits_quiz_with_shared_validation(self):
        self.client.force_login(self.admin)
        form = {**self.data, 'quiz_option': self.data['quiz_options'], 'send_push': ''}
        page = self.client.get('/panel/feed/new/')
        self.assertEqual(page.status_code, 200)
        response = self.client.post('/panel/feed/new/', form)
        self.assertEqual(response.status_code, 302)
        post = FeedPost.objects.get()
        self.assertEqual(post.quiz_options, self.data['quiz_options'])
        self.assertEqual(post.link_url, self.data['link_url'])
        self.assertEqual(self.client.get(f'/panel/feed/{post.pk}/edit/').status_code, 200)
        FeedQuizResponse.objects.create(post=post, user=self.participant, selected_option=1)
        form['quiz_question'] = 'Changed question'
        response = self.client.post(f'/panel/feed/{post.pk}/edit/', form)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'already has responses')
        post.refresh_from_db()
        self.assertEqual(post.quiz_question, self.data['quiz_question'])

    def test_deleting_quiz_removes_responses(self):
        post = self.create_quiz()
        FeedQuizResponse.objects.create(post=post, user=self.participant, selected_option=0)
        self.assertEqual(self.client.delete(f'/api/v1/posts/admin/feed/{post.pk}/').status_code, 200)
        self.assertFalse(FeedQuizResponse.objects.exists())

    def test_form_lists_quiz_once_even_with_older_post_types(self):
        for post_types in [FeedPost.POST_TYPES, [('general', 'General')]]:
            html = render_to_string('panel/feed_form.html', {
                'mode': 'create', 'post_types': post_types,
            })
            self.assertEqual(html.count('<option value="quiz"'), 1)
            self.assertIn('>Quiz</option>', html)

    def test_optional_title_and_correct_answer_for_quizzes(self):
        for kind in ['multiple_choice', 'true_false']:
            with self.subTest(kind=kind):
                post = self.create_quiz(title='', quiz_type=kind, quiz_correct_option=None)
                self.assertEqual(post.title, '')
                self.assertIsNone(post.quiz_correct_option)
                self.client.force_authenticate(self.participant)
                result = self.answer(post, 0)
                self.assertEqual(result.status_code, 201)
                self.assertIsNone(result.data['quiz']['is_correct'])
                self.assertIsNone(result.data['quiz']['correct_option'])
                self.assertFalse(result.data['quiz']['has_correct_answer'])
                self.client.force_authenticate(self.admin)
        response = self.client.post('/api/v1/posts/admin/feed/', {
            'post_type': 'general', 'title': '', 'body': 'News'}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_web_quiz_without_title_or_correct_answer(self):
        self.client.force_login(self.admin)
        form = {**self.data, 'title': '', 'quiz_option': self.data['quiz_options'],
                'quiz_correct_option': '', 'send_push': ''}
        self.assertEqual(self.client.post('/panel/feed/new/', form).status_code, 302)
        post = FeedPost.objects.get()
        self.assertEqual(post.title, '')
        self.assertIsNone(post.quiz_correct_option)
        edit = self.client.get(f'/panel/feed/{post.pk}/edit/')
        self.assertContains(edit, 'Title (optional)')
        self.assertEqual(edit.context['quiz_form']['correct'], None)
        self.assertContains(self.client.get('/panel/feed/'), post.quiz_question)

    def test_api_can_clear_title_and_correct_answer_before_responses(self):
        post = self.create_quiz()
        response = self.client.patch(f'/api/v1/posts/admin/feed/{post.pk}/', {
            'title': '', 'quiz_correct_option': None}, format='json')
        self.assertEqual(response.status_code, 200)
        post.refresh_from_db()
        self.assertEqual(post.title, '')
        self.assertIsNone(post.quiz_correct_option)
        self.client.force_authenticate(self.participant)
        self.answer(post)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch(f'/api/v1/posts/admin/feed/{post.pk}/', {
            'quiz_correct_option': 1}, format='json').status_code, 400)

    def test_stats_overview_and_response_details(self):
        post = self.create_quiz(title='')
        FeedQuizResponse.objects.create(post=post, user=self.participant, selected_option=1)
        FeedQuizResponse.objects.create(post=post, user=self.staff, selected_option=0)
        self.client.force_login(self.admin)
        overview = self.client.get('/panel/feed/stats/')
        self.assertEqual(overview.status_code, 200)
        self.assertEqual(overview.context['response_count'], 2)
        self.assertContains(overview, post.quiz_question)
        details = self.client.get(f'/panel/feed/{post.pk}/stats/')
        self.assertEqual(details.status_code, 200)
        self.assertContains(details, self.participant.email)
        self.assertEqual(details.context['post'].response_count, 2)
        self.assertEqual(details.context['correct_count'], 1)
        self.assertEqual(details.context['options'][0]['percent'], 50)
        self.assertEqual(details.context['response_page'].paginator.count, 2)
        filtered = self.client.get(f'/panel/feed/{post.pk}/stats/', {'option': '1', 'q': 'quiz-player'})
        self.assertEqual(filtered.context['response_page'].paginator.count, 1)
        self.assertContains(filtered, self.participant.email)
        self.assertNotContains(filtered, self.staff.email)
        invalid = self.client.get(f'/panel/feed/{post.pk}/stats/', {'option': '-1'})
        self.assertEqual(invalid.context['response_page'].paginator.count, 0)

    def test_stats_ungraded_empty_and_permission_checks(self):
        post = self.create_quiz(quiz_correct_option=None)
        self.client.force_login(self.admin)
        url = f'/panel/feed/{post.pk}/stats/'
        empty = self.client.get(url)
        self.assertContains(empty, 'No responses found.')
        self.assertFalse(empty.context['has_correct_answer'])
        FeedQuizResponse.objects.create(post=post, user=self.participant, selected_option=0)
        self.assertNotContains(self.client.get(url), 'Incorrect')
        normal = FeedPost.objects.create(title='Normal', body='News')
        self.assertEqual(self.client.get(f'/panel/feed/{normal.pk}/stats/').status_code, 404)
        for user in [self.participant, self.staff]:
            self.client.force_login(user)
            self.assertIn(self.client.get(url).status_code, [302, 403])
            self.assertIn(self.client.get('/panel/feed/stats/').status_code, [302, 403])
        StaffPermission.objects.create(user=self.staff, module='feed')
        self.assertEqual(self.client.get(url).status_code, 200)

    def test_stats_response_pagination(self):
        post = self.create_quiz()
        users = get_user_model().objects.bulk_create([
            get_user_model()(email=f'respondent{i}@example.com') for i in range(51)])
        FeedQuizResponse.objects.bulk_create([
            FeedQuizResponse(post=post, user=user, selected_option=0) for user in users])
        self.client.force_login(self.admin)
        response = self.client.get(f'/panel/feed/{post.pk}/stats/', {'option': '0', 'page': '2'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context['rows']), 1)
        self.assertEqual(response.context['response_page'].paginator.count, 51)
        self.assertEqual(response.context['post'].response_count, 51)
