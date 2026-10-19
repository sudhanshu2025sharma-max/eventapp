# Feed quizzes and attached links

Admins with the Feed permission can create quizzes from the mobile Feed Management screen or `/panel/feed/new/`. Select **Quiz**, enter a question, choose **Multiple choice** (2–6 options) or **True / False**, and optionally mark one correct answer. Choose **No correct answer** to collect responses without grading. Quiz titles are optional; the question is shown when no title is supplied. Body remains required. An optional HTTP/HTTPS link can be attached to any post.

Participants select an answer in the feed and tap **Submit answer**. Each account can submit once; retries return its existing response. The API reveals the correct answer only after submission. Admin editors display response totals per option. Once responses exist, the quiz question, options, type, and correct answer cannot change; title, body, and link can still be edited.

Open **Question Statistics** from the Feed page (`/panel/feed/stats/`), then **View Responses** for a question. The detail page shows option counts and percentages, participant names/emails/registration IDs, selected answers, and submission times. Search participants and filter by selected answer. Pages contain at most 50 responses; statistics always use all responses. Only users with Feed admin access can view these pages.

## Deployment

The implementation includes the additive `posts.0002` migration and `posts.0003` to allow blank titles. Back up the database before applying migrations, then run from `backend/`:

```bash
python3 manage.py migrate posts
python3 manage.py check
```

Reload the backend using the existing deployment procedure and rebuild/distribute the mobile app to expose the updated mobile controls and feedback for questions without a correct answer.

## API

- Existing feed/admin post payloads add `link_url` and `quiz` (`null` for ordinary posts).
- Create/update accepts `quiz_type`, `quiz_question`, `quiz_options` (array), and `quiz_correct_option` (zero-based integer, or `null` for no correct answer), plus `post_type: "quiz"`. Quiz titles may be empty.
- `POST /api/v1/posts/feed/<post_id>/answer/` accepts `{"selected_option": 0}` and returns the current user's quiz result. Only published quizzes accept responses.
- Admin payloads include `correct_option` and `option_counts`; participant payloads withhold the correct answer until submission.
- `has_correct_answer` distinguishes graded questions from opinion questions. Submitted opinion responses return `correct_option: null` and `is_correct: null`.

## Verification

`apps.posts.tests.FeedQuizTests` covers answer visibility and persistence, duplicate submissions, true/false questions, input validation, permissions, unpublished posts, editing restrictions, web creation/editing, and cascade deletion. Run with an isolated test database and local cache; never point tests at the event database itself. JavaScript syntax can be validated using the installed Babel parser.
