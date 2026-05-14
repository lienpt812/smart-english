# SmartEnglish Modular Monolith Roadmap

Tai lieu nay mo ta thiet ke moi cua SmartEnglish: **Frontend rieng, Backend API theo Modular Monolith, va AI Service rieng**.

Muc tieu cua thiet ke nay la giu he thong don gian de phat trien nhanh, nhung van tach ro nghiep vu theo module. Chi rieng AI duoc tach thanh service doc lap vi lien quan den provider, prompt, quota, cache va chi phi.

## Kien truc tong quan

| Thanh phan | Kieu trien khai | Vai tro |
| --- | --- | --- |
| `frontend` | Next.js app rieng | UI, routing, goi Backend API |
| `backend-api` | FastAPI modular monolith | REST API public, auth, user, learning modules, dashboard, orchestration nghiep vu |
| `ai-service` | Service HTTP rieng | Gemini gateway, prompt templates, rate limit, cache, usage/cost tracking |
| `postgres` | Database | Du lieu ung dung |
| `redis` | Cache | Cache, token/session dependency, AI cache sau nay |

## Nguyen tac module hoa backend

- Moi module co route/controller, service/use-case, repository va serializer rieng.
- Module khong goi database table cua module khac truc tiep neu co use-case cong khai trong module do.
- Shared code chi nam trong `lib`, `middleware`, `db`, `cache`, `types`.
- Backend API co the goi `ai-service`, nhung frontend khong goi truc tiep AI Service.
- Khi module nao co tai, team, schema, hoac scaling rat khac biet thi moi can tach thanh service rieng trong tuong lai.

## Cac module trong Backend API

| Module | Trang thai | Trach nhiem |
| --- | --- | --- |
| `auth` | Da co nen tang | Google OAuth, JWT access token, refresh token rotation, logout |
| `users` | Da co nen tang | Profile, locale, onboarding/placement flags |
| `dashboard` | Da co nen tang | Tong hop tien do ca nhan, streak, SRS summary, roadmap summary |
| `placement` | Can them | Test dau vao, danh gia CEFR, baseline skill profile |
| `learning-plan` | Can them | Lo trinh hoc, daily plan, next-step recommendation |
| `content` | Can them | Bai hoc, bai doc/nghe, topic, level CEFR, metadata noi dung |
| `reading` | Can them | Reading practice, vocabulary in context, comprehension quiz |
| `listening` | Can them | Dictation, shadowing, transcript segmentation, active listening quiz |
| `speaking` | Can them | Recording flow, roleplay, pronunciation/fluency feedback |
| `writing` | Can them | Writing submission, rubric grading result, inline feedback history |
| `flashcards` | Can them | Deck/card CRUD, import, community deck clone |
| `srs` | Can them | SM-2 scheduling, due queue, review history |
| `exams` | Can them | TOEIC/IELTS mock test, timed attempt, scoring |
| `progress` | Can them | Learning event, skill score, study history, dashboard aggregates |
| `productivity` | Can them | Pomodoro, focus sessions, music preferences, study time |
| `gamification` | Can them | XP, level, badge, streak freeze, leaderboard |
| `community` | Can them | Public decks, friend leaderboard, achievement sharing |
| `subscription` | Tuy chon | Free/Premium entitlement, quota, billing integration |
| `notifications` | Tuy chon | Reminder, due-card warning, streak warning |
| `admin` | Tuy chon | Content ops, moderation, AI cost/usage dashboard |

## AI Service rieng

AI Service nen gom cac phan sau:

| Module noi bo AI Service | Trach nhiem |
| --- | --- |
| `provider` | Client Gemini, retry, timeout, model config |
| `prompts` | Prompt templates theo feature: tutor, writing, speaking, flashcard, roadmap |
| `quota` | Gioi han theo user/plan, chong spam, cost guard |
| `cache` | Cache ket qua AI cho prompt/input lap lai |
| `usage` | Log token/cost/latency theo user va feature |
| `safety` | Loc noi dung, policy, output validation |

Backend API goi AI Service theo HTTP:

```text
Frontend -> Backend API module -> AI Service -> Gemini
```

## Phase phat trien theo module

### Phase 0 - Nen tang hien tai

Muc tieu: on dinh khung Modular Monolith + AI Service rieng.

Lam:

- Backend API gom `auth`, `users`, `dashboard`.
- AI Service co health/version va khung provider.
- Docker Compose chi co `frontend`, `backend-api`, `ai-service`, `postgres`, `redis`.
- Makefile gom lenh dev/build/docker.

Ket qua:

- Frontend chi goi Backend API `:4000`.
- Backend API san sang goi AI Service `:4200`.
- Khong tach auth/user/dashboard thanh service rieng.

### Phase 1 - Core learning MVP

Theo tong quan san pham: Auth Google, dashboard co ban, Flashcard SRS, AI Tutor Chat, Reading module, TOEIC mock test.

Lam trong Backend API:

- `placement`: test dau vao ngan va cap nhat onboarding.
- `flashcards`: deck/card CRUD, card thu cong, import don gian.
- `srs`: SM-2, due today, review history.
- `reading`: bai doc theo level, vocabulary in context, quiz co ban.
- `exams`: TOEIC mock MVP, attempt, scoring co ban.
- `progress`: learning event va aggregates cho dashboard.

Lam trong AI Service:

- Tutor chat.
- Sinh flashcard tu text.
- Sinh quiz reading.
- Giai thich tu vung/ngu phap.
- Cache va quota co ban.

### Phase 2 - AI multimedia and productivity

Theo tong quan san pham: Dictation YouTube/URL, Shadowing nang cao, Writing AI checker, Speaking AI, IELTS full mock, Pomodoro + nhac nen.

Lam trong Backend API:

- `listening`: dictation, transcript, active listening quiz.
- `speaking`: recording flow, roleplay session, feedback history.
- `writing`: submission, rubric result, inline comments.
- `exams`: IELTS full mock.
- `productivity`: Pomodoro, focus session, music preferences.
- `progress`: study time va skill trend.

Lam trong AI Service:

- Writing grading prompts.
- Speaking feedback prompts.
- Transcript/segmentation helpers.
- Multimodal/audio pipeline adapter neu provider ho tro.
- Cost tracking chi tiet theo feature.

### Phase 3 - Personalization, gamification, community

Theo tong quan san pham: Gamification day du, lo trinh AI ca nhan hoa, tinh nang cong dong, Mobile PWA, mo rong TOEFL/Cambridge.

Lam trong Backend API:

- `learning-plan`: roadmap AI, daily plan, next-step recommendation.
- `gamification`: XP, badge, level, streak freeze, leaderboard.
- `community`: public decks, clone/rating deck, friend/global leaderboard.
- `notifications`: due-card reminder, streak warning.
- `exams`: TOEFL/Cambridge extension.
- `content`: taxonomy noi dung lon hon theo CEFR/topic/certificate.

Lam trong AI Service:

- Personalized roadmap prompts.
- Next-step recommendation.
- Error pattern analysis.

### Phase 4 - Platform expansion

Theo tong quan san pham: Live class, AI sinh tai lieu hoc theo user, mobile native, API mo cho doi tac.

Lam trong Backend API:

- `live-class`: lich lop, attendance, recording metadata.
- `materials`: worksheet/lesson pack generated by AI.
- `partner-api`: API key, rate limit, audit log.
- `subscription`: premium entitlement, quota nang cao, payment provider.
- `admin`: moderation, content ops, usage/cost dashboard.

Lam trong AI Service:

- Material generation workflows.
- Batch generation jobs.
- Usage/cost report cho admin va subscription.

## Khi nao moi tach module thanh service rieng?

Chi tach khi co ly do ro rang:

- Tai/heavy workload khac biet, vi du media processing hoac batch AI.
- Bao mat/ranh gioi du lieu dac biet, vi du billing.
- Team ownership doc lap va can deploy rieng.
- Module can scale doc lap hoac co runtime khac.

Ung vien tach sau nay:

- `media-service` neu xu ly upload/audio/video lon.
- `subscription-service` neu tich hop payment that.
- `notification-service` neu can queue/push/email rieng.
- `partner-api-service` neu can public API cho doi tac.
