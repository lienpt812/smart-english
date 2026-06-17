# Tài liệu tổng quan hệ thống

## Smart English Learning Platform

> **Hệ thống hỗ trợ học tiếng Anh thông minh — AI-powered**  
> Dành cho tất cả người học tiếng Anh — Mọi trình độ, mọi mục tiêu  
> Phiên bản 1.0 | Tháng 5/2026

---

## 1. Tổng quan hệ thống

Smart English Learning Platform là nền tảng học tiếng Anh trực tuyến tích hợp AI toàn diện, dành cho tất cả người học tiếng Anh — từ người mới bắt đầu đến người đang ôn luyện chứng chỉ quốc tế. Hệ thống hoàn toàn mở: bất kỳ ai cũng có thể tự đăng ký và bắt đầu học ngay bằng tài khoản Google.

### 1.1 Mục tiêu

- Tối ưu hoá trải nghiệm học 4 kỹ năng tiếng Anh (Listening, Speaking, Reading, Writing) thông qua AI
- Hỗ trợ luyện thi các chứng chỉ TOEIC, IELTS và mở rộng thêm trong tương lai
- Cá nhân hoá lộ trình học cho từng học viên dựa trên dữ liệu thực tế
- Tích hợp các công cụ productivity (Pomodoro, nhạc nền, gamification) để tăng động lực học
- Cung cấp trải nghiệm học hoàn toàn miễn phí để bắt đầu, với gói nâng cao tuỳ chọn

### 1.2 Phạm vi hệ thống

| Hạng mục | Chi tiết |
| --- | --- |
| Đối tượng | Tất cả người học tiếng Anh — tự học, ôn thi chứng chỉ, hoặc học để giao tiếp |
| Hình thức học | Hoàn toàn trực tuyến — truy cập mọi lúc, mọi nơi, mọi thiết bị |
| Chứng chỉ | TOEIC, IELTS (ưu tiên); TOEFL, Cambridge, General English (mở rộng) |
| AI Engine | Gemini 2.0/2.5 Flash — sinh đề, chấm bài, phân tích lỗi, tutor chat |
| Xác thực | Google OAuth 2.0 — bắt buộc, không có form đăng ký thủ công |

## 2. Tài khoản người dùng (User)

Hệ thống chỉ có một loại tài khoản duy nhất: User. Bất kỳ ai cũng có thể tự đăng ký bằng tài khoản Google và bắt đầu học ngay — không cần xét duyệt, không cần liên hệ ai.

### 2.1 Đăng ký & đăng nhập

- Đăng nhập bằng Google OAuth 2.0 — không có form email/mật khẩu thủ công
- Tự đăng ký: nhấn Đăng nhập với Google → chọn tài khoản Google → vào hệ thống ngay
- Không cần xét duyệt hay kích hoạt bởi bên thứ ba
- Hồ sơ tự động tạo từ thông tin Google (tên, ảnh đại diện)

### 2.2 Quyền & tính năng của User

Mọi User đều có toàn quyền truy cập tất cả tính năng của hệ thống:

- Học và luyện tập đầy đủ 4 kỹ năng: Listening, Speaking, Reading, Writing
- Sử dụng toàn bộ AI: Tutor Chat 24/7, chấm Writing, đánh giá Speaking, phân tích lỗi
- Luyện thi TOEIC, IELTS qua mock test và đề AI sinh không giới hạn
- Quản lý Flashcard cá nhân với hệ thống SRS tự động
- Sử dụng Pomodoro, nhạc nền, theo dõi streak và bảng xếp hạng cộng đồng
- Xem dashboard cá nhân: tiến độ 4 kỹ năng, lỗi thường gặp, lộ trình học
- Nhận lộ trình học cá nhân hoá do AI tạo dựa trên kết quả test đầu vào

### 2.3 Gói dịch vụ (tuỳ chọn)

Hệ thống có thể triển khai theo mô hình freemium để bền vững về mặt vận hành:

| Gói | Miễn phí | Premium |
| --- | --- | --- |
| 4 kỹ năng cơ bản | Có (giới hạn số bài/ngày) | Không giới hạn |
| AI Tutor Chat | 10 lượt/ngày | Không giới hạn |
| Chấm Writing AI | 3 bài/tháng | Không giới hạn + feedback nâng cao |
| Mock test | 2 lần/tháng | Không giới hạn |
| Flashcard | Tối đa 200 card | Không giới hạn + AI sinh tự động |
| Lộ trình AI | Cơ bản | Cá nhân hoá sâu, cập nhật theo tuần |

## 3. Luồng xác thực (Authentication Flow)

Luồng đăng ký và đăng nhập được thiết kế đơn giản nhất có thể — chỉ 3 bước, không cần điền form hay chờ xét duyệt.

| Bước | Mô tả |
| --- | --- |
| 1 | Người dùng vào web → nhấn Bắt đầu học ngay hoặc Đăng nhập với Google |
| 2 | Redirect sang Google OAuth 2.0 → người dùng chọn tài khoản Google của mình |
| 3a | Lần đầu đăng nhập → hệ thống tự tạo tài khoản mới, điều hướng đến bước test trình độ đầu vào |
| 3b | Đã có tài khoản → đăng nhập thành công, điều hướng về dashboard cá nhân |

Sau lần đăng nhập đầu tiên, hệ thống mời người dùng làm bài test trình độ ngắn (~10 phút) để AI xây dựng lộ trình học phù hợp. Bước này có thể bỏ qua và thực hiện sau.

## 4. Tính năng 4 kỹ năng — AI hỗ trợ triệt để

Đây là lõi của hệ thống. Mỗi kỹ năng có module riêng biệt, được AI hỗ trợ từ đầu đến cuối: sinh nội dung, hướng dẫn luyện tập, chấm điểm và phân tích lỗi.

### 4.1 Listening

| Tính năng | Mô tả chi tiết |
| --- | --- |
| AI sinh hội thoại | Tự động tạo hội thoại theo chủ đề (travel, business, academic, daily life) và độ khó A1–C1 tuỳ chọn |
| Dictation — Nghe chép chính tả | Nghe audio rồi gõ lại từng câu. AI chấm realtime từng từ (đúng/sai/gần đúng), highlight màu, giải thích lỗi. Có thể nghe lại từng đoạn ngắn, điều chỉnh tốc độ 0.5x–1.5x |
| Dictation từ YouTube / URL | Dán link YouTube hoặc upload file audio/video → hệ thống tự extract audio, tạo transcript, chia đoạn → học viên luyện dictation với nội dung yêu thích. Hỗ trợ: YouTube URL, .mp3, .mp4, .wav |
| Shadowing — Luyện nói theo bản mẫu | Nghe câu mẫu → nhấn ghi âm → nói lại theo. AI so sánh waveform và phân tích: phát âm, ngữ điệu (intonation), nhịp điệu (rhythm), linking sounds. Có thể loop câu ngắn để luyện lặp đi lặp lại |
| Shadowing từ YouTube / URL | Dán link YouTube (podcast, TED Talk, phim, bài học...) → hệ thống tạo transcript tự động, chia câu → luyện shadowing từng câu với AI chấm phát âm ngay trong trình phát |
| Active Listening Quiz | AI sinh câu hỏi MCQ, True/False, Short answer, Fill-in-blank sau mỗi bài nghe để kiểm tra comprehension |
| Phân tích lỗi nghe | Hệ thống ghi lại các từ/cụm từ học viên hay nghe sai hoặc gõ sai trong dictation — tự động tạo flashcard và đưa vào SRS để ôn tập |

### 4.2 Speaking

| Tính năng | Mô tả chi tiết |
| --- | --- |
| Chấm phát âm AI | Ghi âm → Gemini phân tích phoneme-level, chấm điểm từng âm, highlight phát âm sai |
| Fluency score | Đánh giá tốc độ nói, số lần dừng, filler words (um, uh), trả về điểm 0–100 |
| AI Roleplay | Đóng vai hội thoại thực tế: phỏng vấn xin việc, gọi điện đặt phòng, thuyết trình |
| Pronunciation Drill | Luyện từng âm yếu được AI phát hiện, có âm mẫu để so sánh |
| IELTS Speaking mock | Mô phỏng Part 1-2-3, AI chấm Fluency/Lexical/Grammar/Pronunciation theo band IELTS |

### 4.3 Reading

| Tính năng | Mô tả chi tiết |
| --- | --- |
| Từ vựng in-context | Nhấn vào bất kỳ từ nào → AI giải thích nghĩa trong ngữ cảnh, ví dụ, thêm vào flashcard |
| AI tóm tắt & phân tích | Tóm tắt đoạn văn theo ý chính, phân tích cấu trúc bài, giải thích từ khó |
| Sinh câu hỏi comprehension | AI tự động sinh câu hỏi MCQ, fill-in-blank, matching từ bất kỳ đoạn văn |
| Luyện Skimming/Scanning | Bài tập có hướng dẫn kỹ thuật đọc nhanh, đọc chắt lọc theo đề thi |
| Reading streak tracker | Theo dõi số bài đọc mỗi ngày, thống kê từ vựng học được qua việc đọc |

### 4.4 Writing

| Tính năng | Mô tả chi tiết |
| --- | --- |
| AI chấm bài writing | Chấm theo rubric IELTS/TOEIC chuẩn: Task Achievement, Coherence, Vocabulary, Grammar |
| Inline comment | AI comment trực tiếp từng câu, từng đoạn — highlight lỗi và giải thích tại chỗ |
| Gợi ý cải thiện | Đề xuất câu hay hơn, từ vựng nâng cấp, liên kết ý mạch lạc hơn |
| So sánh bài mẫu | Hiển thị bài mẫu band cao song song, dễ so sánh cấu trúc và từ ngữ |
| Theo dõi tiến bộ | Biểu đồ điểm writing qua các lần nộp, phát hiện điểm yếu cố thủ |
| Hỗ trợ loại bài | IELTS Task 1 (graph/letter) & Task 2 (essay) · TOEIC Writing · Email thương mại |

## 5. Các phương pháp học tiếng Anh tích hợp trong hệ thống

Hệ thống không chỉ cung cấp nội dung học — mà còn nhúng trực tiếp các phương pháp học tiếng Anh đã được khoa học chứng minh hiệu quả vào từng tính năng. Dưới đây là các phương pháp cốt lõi và cách hệ thống triển khai.

### 5.1 Shadowing (Luyện nói theo bản mẫu)

Phương pháp do Dr. Alexander Arguelles phổ biến — nghe và nói đồng thời hoặc nói lại ngay sau khi nghe. Cực kỳ hiệu quả để cải thiện phát âm, ngữ điệu và tốc độ nói tự nhiên.

- Cách thực hiện trong hệ thống: chọn bài hoặc dán link YouTube → chọn câu → nghe → ghi âm lại ngay → AI so sánh với bản gốc
- AI phân tích: độ chính xác phát âm theo từng âm vị, ngữ điệu lên/xuống, linking sounds (nối âm), weak forms
- Ba mức luyện: Beginner (nghe trước, nói sau với script hiển thị) · Intermediate (nghe, nói, ẩn script) · Advanced (nói đồng thời, không script)
- Luyện lặp: loop từng câu vô hạn lần với nút Repeat, tự động tăng tốc độ khi đạt điểm cao

### 5.2 Nghe chép chính tả — Dictation

Phương pháp luyện tập kết hợp cả 3 kỹ năng: Listening (nghe), Writing (viết đúng chính tả), Vocabulary (nhớ từ trong ngữ cảnh). Đặc biệt hiệu quả cho IELTS Listening và TOEIC LC.

- Nguồn nội dung đa dạng: audio/video có sẵn trong hệ thống · Upload file .mp3/.mp4/.wav · Dán link YouTube (tự động extract audio + tạo transcript bằng AI)
- AI tạo transcript chuẩn: tự động nhận diện giọng (Anh, Mỹ, Úc), chia câu theo ngữ nghĩa, đánh timestamp từng câu
- Chấm realtime: gõ xong một câu → AI chấm ngay: từ đúng (xanh), sai (đỏ), thiếu (vàng), gần đúng (cam)
- Gợi ý từ bị sai: click vào từ sai → xem lại cách nghe đúng, giải thích tại sao dễ nhầm (connected speech, weak forms, accent)
- Chế độ gợi ý: hiện chữ cái đầu mỗi từ (cho người mới) hoặc ẩn hoàn toàn (nâng cao)

### 5.3 Spaced Repetition System — SRS

Thuật toán SM-2 (cùng Anki) — tự động lên lịch ôn tập từ vựng đúng thời điểm trước khi bị quên, tối ưu hóa bộ nhớ dài hạn.

- Áp dụng cho: Flashcard từ vựng · Cấu trúc ngữ pháp · Câu ví dụ · Từ sai trong dictation
- Lịch ôn tập tự động: hệ thống tính toán khoảng cách ôn tối ưu cho từng item dựa trên lịch sử trả lời
- Số card cần ôn hôm nay luôn hiện ở dashboard — không bao giờ bị quên mất

### 5.4 Active Recall (Truy hồi chủ động)

Thay vì đọc lại bài hay nhìn lại flashcard, học viên buộc phải tự nhớ ra đáp án — kỹ thuật được chứng minh tăng khả năng ghi nhớ gấp 2–3 lần.

- Flashcard chế độ recall: ẩn đáp án hoàn toàn, tự gõ trước khi lật
- Quiz sau mỗi bài học: AI sinh câu hỏi từ nội dung vừa học — không phải đọc lại
- Fill-in-blank thông minh: AI ẩn các từ quan trọng trong câu ví dụ, học viên điền lại

### 5.5 Extensive Reading & Listening (Đọc/Nghe rộng)

Tiêu thụ lượng lớn nội dung tiếng Anh ở mức độ phù hợp (i+1 — hơi khó hơn trình độ hiện tại một chút) để xây dựng vốn từ và phản xạ ngôn ngữ tự nhiên.

- Thư viện bài đọc/nghe được phân cấp theo CEFR: A1, A2, B1, B2, C1 — AI gợi ý mức phù hợp
- Extensive Listening: nghe podcast, TED Talk, phim phụ đề — AI highlight từ mới, thêm vào flashcard 1 click
- Reading tracker: thống kê số từ đọc được mỗi ngày/tuần, streak đọc, từ vựng học được qua đọc

### 5.6 Interleaved Practice (Luyện tập xen kẽ)

Thay vì học một kỹ năng liên tục, xen kẽ các dạng bài khác nhau trong một phiên học — giúp não xử lý sâu hơn và nhớ lâu hơn.

- AI tự động thiết kế phiên học xen kẽ: ví dụ Vocabulary → Reading → Dictation → Flashcard → Speaking trong 45 phút
- Daily plan do AI tạo: mỗi ngày một mix khác nhau, ưu tiên điểm yếu hiện tại

### 5.7 Comprehensible Input (Tiếp nhận ngôn ngữ hiểu được)

Lý thuyết của Stephen Krashen: tiếp thu ngôn ngữ hiệu quả nhất khi nghe/đọc nội dung hơi khó hơn trình độ hiện tại một bậc (i+1).

- AI đánh giá độ khó của bất kỳ nội dung nào (paste text hoặc link) và so sánh với trình độ người dùng
- Gợi ý: nếu quá khó → hệ thống đề xuất bài dễ hơn; nếu quá dễ → đề xuất thử thách mới
- Chú thích thông minh: từ ngoài vốn từ của người dùng tự động được highlight và giải thích khi hover

### 5.8 Output Practice — Nói và viết để củng cố

Comprehensible Output (Swain, 1985): chủ động sản xuất ngôn ngữ (nói, viết) giúp người học nhận ra lỗ hổng kiến thức và củng cố cấu trúc ngôn ngữ sâu hơn.

- Journal viết hàng ngày: viết tự do bằng tiếng Anh mỗi ngày, AI nhận xét nhẹ nhàng (không sửa tất cả, chỉ highlight điểm cần chú ý)
- Speaking journal: ghi âm kể lại điều xảy ra trong ngày / mô tả hình ảnh / chia sẻ ý kiến — AI chấm tự nhiên
- Ứng dụng ngữ pháp mới học: sau khi học cấu trúc ngữ pháp, AI đưa bài tập viết câu sử dụng đúng cấu trúc đó

## 6. Hệ thống Flashcard thông minh

Flashcard là công cụ học từ vựng cốt lõi, tích hợp AI để tự động sinh card và thuật toán SRS (Spaced Repetition System) để tối ưu thời điểm ôn tập.

### 6.1 Các nguồn tạo Flashcard

- AI sinh tự động từ bài đọc/nghe: nhấn 1 nút → hệ thống extract từ vựng mới, sinh định nghĩa + ví dụ + phiên âm + hình ảnh minh hoạ
- Học viên tự tạo thủ công: nhập từ, định nghĩa, ví dụ cá nhân
- Deck cộng đồng: hệ thống cung cấp sẵn bộ từ TOEIC 600, IELTS Academic Word List, từ vựng theo chủ đề — người dùng clone về và dùng
- Chia sẻ deck: người dùng có thể public deck của mình để cộng đồng dùng chung
- Import từ file CSV/TXT: hỗ trợ import bộ card từ Anki hoặc Quizlet

### 6.2 Thuật toán SRS (Spaced Repetition)

Hệ thống theo dõi mức độ thuộc của từng card (1–5 sao) và tự động lên lịch ôn tập theo khoảng cách tăng dần:

- Card mới: ôn tập ngay hôm nay
- Biết một phần: ôn lại sau 1–3 ngày
- Thuộc tốt: ôn lại sau 7–14 ngày
- Thuộc rất tốt: ôn lại sau 30+ ngày

AI phân tích pattern sai của học viên để điều chỉnh tần suất ôn tập — card hay bị quên sẽ xuất hiện thường hơn.

### 6.3 Các chế độ luyện tập

| Chế độ | Mô tả |
| --- | --- |
| Flashcard cổ điển | Lật thẻ Mặt trước/sau — từ → nghĩa hoặc nghĩa → từ |
| Multiple choice | Chọn đáp án đúng trong 4 lựa chọn — AI sinh thêm 3 phương án nhiễu thông minh |
| Điền vào chỗ trống | Xem câu ví dụ có chỗ trống → gõ từ → AI kiểm tra và gợi ý |
| Nghe → viết | Nghe phát âm của từ → gõ lại từ đó (kết hợp Listening + Vocabulary) |
| Kiểm tra tổng hợp | Mini quiz 10–20 câu trộn tất cả chế độ trên, chấm điểm và phân tích cuối bài |

### 6.4 Tổ chức Flashcard

- Deck cá nhân: tự tổ chức theo chủ đề, mục tiêu học, hoặc theo từng bài học
- Deck cộng đồng: clone deck có sẵn từ hệ thống hoặc từ người dùng khác chia sẻ
- Gắn tag: mỗi card có thể gắn nhiều tag (IELTS, TOEIC, Business, B2, C1...)
- Thống kê deck: tỷ lệ thuộc, số card cần ôn hôm nay, streak ôn tập

## 7. Module luyện thi chứng chỉ

### 7.1 TOEIC

- Cấu trúc đề: mô phỏng đúng format ETS (LC Part 1-7, RC Part 5-7, SW)
- Đề thi: thư viện đề thật + AI sinh đề mới theo cấu trúc ETS vô hạn
- Timed test: đồng hồ đếm ngược chính xác, cảnh báo hết giờ
- Phân tích sau thi: điểm từng phần, biểu đồ độ chính xác theo dạng câu, so sánh với kỳ trước
- AI nhận xét điểm yếu: "Bạn thường sai Part 5 dạng prepositions — xem gợi ý luyện tập"

### 7.2 IELTS

- 4 kỹ năng đầy đủ trong 1 bài thi: Listening (30 min) · Reading (60 min) · Writing (60 min) · Speaking (11–14 min)
- AI chấm Writing Task 1 & Task 2 theo 4 tiêu chí IELTS chuẩn, trả về band score ước tính
- AI đóng vai examiner cho Speaking: hỏi Part 1-2-3, ghi âm, chấm 4 tiêu chí Speaking
- Phân tích band: biểu đồ band từng kỹ năng qua các lần thi, dự báo tiến độ

### 7.3 Lộ trình mở rộng

| Chứng chỉ | Ưu tiên | Ghi chú |
| --- | --- | --- |
| TOEFL iBT | Phase 2 | Dùng chung AI engine, thêm Academic Reading/Listening |
| Cambridge (B2/C1) | Phase 2 | Use of English là điểm đặc thù cần phát triển riêng |
| Tiếng Anh giao tiếp | Phase 1 | Business · Daily · Travel — không thi cử, tập trung Speaking |

## 8. AI Engine — Gemini 2.0/2.5 Flash

AI là trái tim của toàn bộ hệ thống. Gemini 2.0/2.5 Flash được chọn vì tốc độ phản hồi nhanh, hỗ trợ đa phương thức (text + audio + image), chi phí vận hành thấp, và khả năng xử lý tiếng Việt tốt.

| Chức năng AI | Cách hoạt động |
| --- | --- |
| AI Tutor Chat 24/7 | Chat với học viên bằng tiếng Việt/Anh, giải thích ngữ pháp, từ vựng, sửa câu, trả lời câu hỏi bài tập |
| Sinh đề tự động | Tạo đề thi TOEIC/IELTS theo topic, độ khó và kỹ năng cụ thể — vô hạn đề mới, không trùng lặp |
| Chấm Writing | Phân tích bài viết, chấm điểm theo rubric chuẩn, inline comment chi tiết, gợi ý cải thiện cụ thể |
| Đánh giá Speaking | Xử lý audio ghi âm, phân tích phát âm phoneme-level, chấm fluency/vocabulary/coherence |
| Sinh Flashcard | Extract từ vựng mới từ bài đọc/nghe, sinh định nghĩa + ví dụ + phiên âm tự động |
| Phân tích lỗi | Theo dõi pattern lỗi sai của từng học viên, phân loại lỗi grammar/vocabulary/phonetics |
| Lộ trình cá nhân hoá | Phân tích kết quả test đầu vào và dữ liệu học → tạo roadmap học tập riêng cho từng học viên |
| Next-step gợi ý | Sau mỗi phiên học, AI gợi ý "hôm nay nên làm gì tiếp theo" dựa trên tiến độ và điểm yếu |

## 9. Công cụ Productivity & Gamification

### 9.1 Pomodoro Timer

Đồng hồ Pomodoro tích hợp ngay trong màn hình học — không cần chuyển tab hay dùng app ngoài.

- Chu kỳ mặc định: 25 phút học / 5 phút nghỉ / 15 phút nghỉ dài (sau 4 pomodoro)
- Tuỳ chỉnh thời gian theo sở thích cá nhân
- Thông báo nhẹ nhàng khi hết giờ (không làm gián đoạn audio bài học)
- Thống kê: số pomodoro hoàn thành mỗi ngày/tuần, biểu đồ thói quen học
- "Focus mode": ẩn sidebar, hiện chỉ nội dung học + timer khi vào chế độ tập trung

### 9.2 Nhạc nền

Phát nhạc nền trực tiếp trong app, âm lượng độc lập với audio bài học.

- Lo-fi hip hop: playlist dài không quảng cáo, tốt cho tập trung
- White noise / Pink noise: tiếng ồn trắng/hồng, che tiếng ồn môi trường
- Nature sounds: tiếng mưa, rừng, suối, sóng biển
- Cafe ambience: tiếng quán cà phê — phổ biến với người học muốn cảm giác không gian mở
- Tuỳ chỉnh âm lượng độc lập, tự động dừng khi hết phiên Pomodoro

### 9.3 Streak & Gamification

| Cơ chế | Chi tiết |
| --- | --- |
| Daily Streak | Chuỗi ngày học liên tiếp — có thể dùng "freeze card" (1 lần/tuần) để bảo vệ streak khi bận |
| XP system | Làm bài tập = 10XP · Hoàn thành kỹ năng = 50XP · Nộp writing = 50XP · Mock test = 200XP · Streak 7 ngày = bonus 100XP |
| Level & Huy hiệu | Huy hiệu đặc biệt: "Writing Master", "Speaking Star", "100-Day Streak", "IELTS Band 7" v.v. |
| Bảng xếp hạng | Leaderboard tuần/tháng theo XP — có thể lọc theo lớp học, giúp tạo tinh thần thi đua lành mạnh |
| Daily goal | Học viên tự đặt mục tiêu ngày (ví dụ: 20 flashcard + 1 bài listening), hệ thống nhắc nhở |

## 10. Dashboard & Phân tích cá nhân

### 10.1 Dashboard cá nhân

- Biểu đồ radar 4 kỹ năng: nhìn một cái biết ngay điểm yếu là kỹ năng nào
- Lịch học: streak calendar theo kiểu GitHub heatmap, màu sắc theo cường độ học
- Lỗi thường gặp: top 5 lỗi grammar/vocabulary/pronunciation hay mắc nhất
- Tiến độ lộ trình: % hoàn thành roadmap AI, milestone tiếp theo cần đạt
- Thống kê flashcard: số card đã thuộc / cần ôn hôm nay / mới — biểu đồ SRS queue
- Lịch sử mock test: điểm từng lần thi theo timeline, xu hướng cải thiện
- Tổng thời gian học: hôm nay, tuần này, tổng cộng — phân theo kỹ năng

### 10.2 Tính năng cộng đồng

- Bảng xếp hạng toàn cầu & theo tuần: so sánh XP với người dùng khác trên toàn hệ thống
- Bảng xếp hạng bạn bè: kết nối tài khoản Google và thi đua với người quen
- Chia sẻ thành tích: tự động tạo ảnh thành tích (đạt 100-day streak, band IELTS mới) để chia sẻ mạng xã hội
- Deck cộng đồng: xem, clone, đánh giá deck flashcard của người dùng khác

## 11. Kiến trúc kỹ thuật đề xuất

| Tầng | Công nghệ | Lý do lựa chọn |
| --- | --- | --- |
| Frontend | Next.js 14 (App Router) | SSR + CSR linh hoạt, routing dễ, tốt cho SEO trang landing |
| Auth | Supabase Auth + Google OAuth | Google OAuth tích hợp sẵn, quản lý session tự động |
| Database | Supabase (PostgreSQL) | Realtime, Row Level Security, tích hợp với Auth sẵn |
| Storage | Supabase Storage | Lưu audio ghi âm, file tài liệu — CDN built-in |
| AI Engine | Google Gemini 2.0/2.5 Flash API | Đa phương thức, nhanh, rẻ, tiếng Việt tốt |
| Audio processing | Web Audio API (client-side) | Xử lý phía client → giảm tải server, latency thấp hơn |
| SRS Engine | Custom (thuật toán SM-2) | Thuật toán SM-2 (cùng Anki), đơn giản, đã được kiểm chứng |
| Deploy | Vercel (frontend) + Supabase cloud | Zero-config deploy, auto-scaling, free tier đủ dùng giai đoạn đầu |

### 11.1 Nguyên tắc thiết kế

- API-first: toàn bộ tính năng có REST API để dễ mở rộng mobile app sau này
- AI cost control: cache kết quả AI cho cùng một prompt, giới hạn call API theo gói học
- Offline-friendly: flashcard và bài học đã xem có thể dùng offline (PWA)
- Privacy: audio ghi âm không lưu trữ lâu dài nếu học viên không cho phép

## 12. Lộ trình phát triển (Roadmap)

| Phase | Thời gian | Tính năng triển khai |
| --- | --- | --- |
| Phase 1 | Tháng 1–3 | Auth Google · Dashboard cơ bản · Flashcard SRS · AI Tutor Chat · Reading module · TOEIC mock test |
| Phase 2 | Tháng 4–6 | Dictation từ YouTube/URL · Shadowing nâng cao · Writing AI checker · Speaking AI · IELTS full mock · Pomodoro + nhạc nền |
| Phase 3 | Tháng 7–9 | Gamification đầy đủ · Lộ trình AI cá nhân hoá · Tính năng cộng đồng · Mobile PWA · Mở rộng TOEFL/Cambridge |
| Phase 4 | Tháng 10+ | Live class tích hợp · AI sinh tài liệu học theo học viên · Mobile app native · API mở cho đối tác |
