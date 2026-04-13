# **App Name**: NihongoPath

## Core Features:

- Google Sign-In: Secure user authentication via Google, allowing personalized learning progress tracking.
- Video Immersive Learning: Interactive 'Learn' section featuring a YouTube video player (react-youtube). Below the video, display a scrollable list of interactive subtitle segments with Furigana and translation. Users can click a segment to seek the video to that timestamp and save vocabulary to their dictionary.
- Basic Learning Modules: Include a static Kana grid (Hiragana/Katakana) and flip-based Flashcards for basic vocabulary learning.
- Interactive Practice: Specific practice activities including an 'Echo Method' (audio playback using Web Speech API) and a 'Memory Matching Game' (card flipping logic).
- Vocabulary Bank Quiz: The 'Quiz' tab will generate 10 multiple-choice questions dynamically from a static vocabulary database, randomizing wrong options.
- Dictionary & Personal Dashboard: A 'Dictionary' to manage saved words (Learning/Mastered) and a 'Dashboard' showcasing user progress, learning streaks, and mastery statistics stored in Firestore.
- User Settings: A 'Settings' interface allowing users to manage UI preferences (like Furigana display mode and Dark mode), persisted in Firestore.
- Persistent Navigation: A fixed bottom navigation bar with 'Learn', 'Practice', 'Quiz', 'Dashboard', and 'Settings' tabs.

## Style Guidelines:

- Primary color: A serene, deep blue-green (#286A8A), symbolizing focus and depth of learning.
- Background color: A soft, muted off-white (#F0F3F4), creating a calm and inviting learning environment.
- Accent color: A vibrant lime green (#C1DD3C), used for highlights, calls-to-action, and interactive elements.
- Headline font: 'Alegreya' (humanist serif) for an elegant, intellectual feel.
- Body font: 'PT Sans' (humanist sans-serif) for modern readability and warmth.
- Clean, modern line icons for navigation and interactive elements, possibly incorporating subtle Japanese cultural motifs.
- User interface is centered around a responsive, clear main content area with a persistent bottom navigation bar on all main pages.
- Subtle and smooth transitions for page changes and interactive components to enhance user experience without distraction.